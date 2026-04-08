// src/psn-friends.js
// Utilise l'endpoint legacy friends/profiles2 qui retourne TOUS les amis
// avec profils + présence en UN SEUL appel (au lieu de 149 appels).

import { call } from "psn-api";
import { getAuthorization, withRetry } from "./psn-auth.js";

const LEGACY_BASE = "https://us-prof.np.community.playstation.net/userProfile/v1/users";

function mapLegacyPresence(presences) {
  if (!Array.isArray(presences) || presences.length === 0) return null;

  // Trouver la présence principale (primaryInfo ou la première)
  const primary = presences.find((p) => p.hasBroadcastData !== undefined) ?? presences[0];

  const onlineStatus = primary?.onlineStatus ?? null;
  const platform = primary?.platform ?? null;
  const titleName = primary?.npTitleId ? primary?.titleName : null;
  const lastOnlineDate = primary?.lastOnlineDate ?? null;

  const isOnline = onlineStatus === "online";

  return {
    availability: isOnline ? "available" : "unavailable",
    onlineStatus,
    isOnline,
    platform,
    lastOnlineDate,
    titleName: titleName ?? null,
    titleFormat: platform ?? null,
    titleIconUrl: null,
  };
}

function mapModernPresence(rawResponse) {
  if (!rawResponse) return null;
  const p = rawResponse.basicPresence ?? rawResponse;
  const game = p.gameTitleInfoList?.[0] ?? null;
  const availability = p.availability ?? null;
  const rawOnlineStatus = p.primaryPlatformInfo?.onlineStatus ?? null;
  const hasGame = Array.isArray(p.gameTitleInfoList) && p.gameTitleInfoList.length > 0;

  return {
    availability,
    onlineStatus: rawOnlineStatus,
    isOnline: rawOnlineStatus === "online" || availability === "availableToPlay" || availability === "available" || hasGame,
    platform: p.primaryPlatformInfo?.platform ?? game?.format ?? null,
    lastOnlineDate: p.primaryPlatformInfo?.lastOnlineDate ?? p.lastAvailableDate ?? null,
    titleName: game?.titleName ?? null,
    titleFormat: game?.format ?? null,
    titleIconUrl: game?.npTitleIconUrl ?? game?.conceptIconUrl ?? null,
  };
}

function extractAvatarFromLegacy(avatarUrls) {
  if (!Array.isArray(avatarUrls) || avatarUrls.length === 0) return null;
  // Prendre la plus grande
  const preferred = avatarUrls.find((a) => a.size === "xl" || a.avatarUrlType === "xl");
  if (preferred) return preferred.avatarUrl ?? preferred.url ?? null;
  return avatarUrls[avatarUrls.length - 1]?.avatarUrl ?? avatarUrls[0]?.url ?? null;
}

/**
 * Récupère tous les amis avec profils + présence en UN SEUL appel legacy.
 * Fallback sur l'approche multi-appels si ça échoue.
 */
export async function fetchFriends(limit = 100) {
  const auth = await getAuthorization();

  // === Tentative endpoint legacy (1 seul appel) ===
  try {
    const url = `${LEGACY_BASE}/me/friends/profiles2?fields=onlineId,accountId,avatarUrls,plus,primaryOnlineStatus,presences(@default,@titleInfo,platform,lastOnlineDate,hasBroadcastData)&sort=name-onlineId&offset=0&limit=${limit}`;

    const response = await withRetry(() => call({ url }, auth));

    if (response?.profiles) {
      const friends = response.profiles.map((p) => ({
        accountId: p.accountId ?? p.npId ?? "",
        onlineId: p.onlineId ?? "(inconnu)",
        avatarUrl: extractAvatarFromLegacy(p.avatarUrls),
        presence: mapLegacyPresence(p.presences),
      }));

      console.log(`[friends] Legacy endpoint: ${friends.length} amis en 1 appel`);

      return {
        total: response.totalResults ?? friends.length,
        friends,
      };
    }
  } catch (err) {
    console.warn("[friends] Legacy endpoint failed, fallback multi-appels:", err.message);
  }

  // === Fallback : approche classique multi-appels ===
  const { getUserFriendsAccountIds, getProfileFromAccountId, getBasicPresence } = await import("psn-api");

  const friendsResult = await withRetry(() => getUserFriendsAccountIds(auth, "me"));
  const friendsAccountIds = friendsResult.friends || [];
  const sliced = friendsAccountIds.slice(0, limit);

  const results = [];
  for (let i = 0; i < sliced.length; i += 3) {
    const batch = sliced.slice(i, i + 3);
    const batchResults = await Promise.all(
      batch.map(async (accountId) => {
        try {
          const [profile, basicPresence] = await Promise.all([
            withRetry(() => getProfileFromAccountId(auth, accountId)),
            withRetry(() => getBasicPresence(auth, accountId)),
          ]);
          return {
            accountId,
            onlineId: profile?.onlineId ?? "(inconnu)",
            avatarUrl: extractAvatarFromLegacy(profile?.avatars),
            presence: mapModernPresence(basicPresence),
          };
        } catch {
          return { accountId, onlineId: "(inaccessible)", avatarUrl: null, presence: null, _failed: true };
        }
      })
    );

    results.push(...batchResults);

    // Stop si tout le batch échoue
    if (batchResults.every((r) => r._failed) && batch.length > 1) break;

    if (i + 3 < sliced.length) await new Promise((r) => setTimeout(r, 2000));
  }

  const clean = results.map(({ _failed, ...rest }) => rest);
  const failCount = results.filter((r) => r._failed).length;
  if (failCount > results.length * 0.5) {
    throw new Error(`Trop d'echecs (${failCount}/${results.length})`);
  }

  return {
    total: friendsResult.totalItemCount ?? friendsAccountIds.length,
    friends: clean,
  };
}
