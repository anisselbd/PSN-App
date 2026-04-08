// src/psn-friends.js
// Stratégie hybride :
// 1. Endpoint legacy pour charger 74 profils en 1 appel
// 2. API moderne getBasicPresence pour la présence exacte (quelques appels de plus)

import { call, getBasicPresence } from "psn-api";
import { getAuthorization, withRetry } from "./psn-auth.js";

const LEGACY_BASE = "https://us-prof.np.community.playstation.net/userProfile/v1/users";

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
  const preferred = avatarUrls.find((a) => a.size === "xl" || a.avatarUrlType === "xl");
  if (preferred) return preferred.avatarUrl ?? preferred.url ?? null;
  return avatarUrls[avatarUrls.length - 1]?.avatarUrl ?? avatarUrls[0]?.url ?? null;
}

/**
 * Récupère les présences modernes pour une liste d'accountIds.
 * Batch de 5 avec pause de 1s pour rester dans les limites.
 */
async function fetchPresenceBatch(auth, accountIds) {
  const presenceMap = new Map();

  for (let i = 0; i < accountIds.length; i += 5) {
    const batch = accountIds.slice(i, i + 5);
    const results = await Promise.all(
      batch.map(async (id) => {
        try {
          const raw = await withRetry(() => getBasicPresence(auth, id));
          return { id, presence: mapModernPresence(raw) };
        } catch {
          return { id, presence: null };
        }
      })
    );
    for (const r of results) presenceMap.set(r.id, r.presence);

    if (i + 5 < accountIds.length) {
      await new Promise((r) => setTimeout(r, 1000));
    }
  }

  return presenceMap;
}

/**
 * Stratégie hybride :
 * 1. Legacy endpoint → tous les profils en 1 appel
 * 2. API moderne → présence pour tous les amis (par batch de 5)
 */
export async function fetchFriends(limit = 100) {
  const auth = await getAuthorization();

  // === Étape 1 : charger tous les profils via legacy ===
  let friends = [];
  let total = 0;

  try {
    const url = `${LEGACY_BASE}/me/friends/profiles2?fields=onlineId,accountId,avatarUrls,plus,personalDetail(firstName,lastName)&sort=name-onlineId&offset=0&limit=${limit}`;

    const response = await withRetry(() => call({ url }, auth));

    if (response?.profiles) {
      friends = response.profiles.map((p) => {
        const firstName = p.personalDetail?.firstName ?? null;
        const lastName = p.personalDetail?.lastName ?? null;
        const realName = firstName ? `${firstName} ${lastName ?? ""}`.trim() : null;

        return {
          accountId: p.accountId ?? p.npId ?? "",
          onlineId: p.onlineId ?? "(inconnu)",
          realName,
          avatarUrl: extractAvatarFromLegacy(p.avatarUrls),
          isPlus: p.plus === 1 || p.plus === true,
          presence: null, // sera rempli à l'étape 2
        };
      });

      total = response.totalResults ?? friends.length;
      console.log(`[friends] Legacy: ${friends.length} profils en 1 appel`);
    }
  } catch (err) {
    console.warn("[friends] Legacy failed:", err.message);
    // Fallback simple
    const { getUserFriendsAccountIds } = await import("psn-api");
    const res = await withRetry(() => getUserFriendsAccountIds(auth, "me"));
    friends = (res.friends || []).slice(0, limit).map((id) => ({
      accountId: id, onlineId: id, realName: null, avatarUrl: null, isPlus: false, presence: null,
    }));
    total = res.totalItemCount ?? friends.length;
  }

  // === Étape 2 : présence moderne pour tous les amis ===
  const accountIds = friends.map((f) => f.accountId).filter(Boolean);

  if (accountIds.length > 0) {
    try {
      const presenceMap = await fetchPresenceBatch(auth, accountIds);
      for (const friend of friends) {
        friend.presence = presenceMap.get(friend.accountId) ?? null;
      }
      const onlineCount = friends.filter((f) => f.presence?.isOnline).length;
      console.log(`[friends] Presence: ${onlineCount} en ligne sur ${friends.length}`);
    } catch (err) {
      console.warn("[friends] Presence batch failed:", err.message);
    }
  }

  return { total, friends };
}
