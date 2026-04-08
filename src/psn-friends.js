// src/psn-friends.js
import {
  getUserFriendsAccountIds,
  getProfileFromAccountId,
  getBasicPresence,
} from "psn-api";
import { getAuthorization, withRetry } from "./psn-auth.js";
import { extractOnlineId, extractAvatarUrl } from "./psn-profile.js";

function mapPresence(rawResponse) {
  if (!rawResponse) return null;

  // L'API retourne { basicPresence: { ... } } — il faut unwrap
  const p = rawResponse.basicPresence ?? rawResponse;

  const game = p.gameTitleInfoList?.[0] ?? null;

  const availability = p.availability ?? null;
  const rawOnlineStatus = p.primaryPlatformInfo?.onlineStatus ?? null;

  const hasGame =
    Array.isArray(p.gameTitleInfoList) && p.gameTitleInfoList.length > 0;

  const isOnline =
    rawOnlineStatus === "online" ||
    availability === "availableToPlay" ||
    availability === "available" ||
    hasGame;

  const platform =
    p.primaryPlatformInfo?.platform ?? game?.format ?? null;

  return {
    availability,
    onlineStatus: rawOnlineStatus,
    isOnline,
    platform,
    lastOnlineDate:
      p.primaryPlatformInfo?.lastOnlineDate ??
      p.lastAvailableDate ??
      null,
    titleName: game?.titleName ?? null,
    titleFormat: game?.format ?? null,
    titleIconUrl: game?.npTitleIconUrl ?? game?.conceptIconUrl ?? null,
  };
}

// Batch les requêtes par petits groupes avec pause entre chaque.
// S'arrête dès qu'un batch a trop d'échecs (rate limit probable).
async function batchProcess(items, fn, batchSize = 3) {
  const results = [];
  for (let i = 0; i < items.length; i += batchSize) {
    const batch = items.slice(i, i + batchSize);
    const batchResults = await Promise.all(batch.map(fn));
    results.push(...batchResults);

    // Si tout le batch a échoué → rate limit, on arrête
    const failures = batchResults.filter((r) => r._failed).length;
    if (failures === batch.length && batch.length > 1) {
      console.log(`[friends] Batch entier en échec, arrêt (${results.length}/${items.length} traités)`);
      break;
    }

    if (i + batchSize < items.length) {
      await new Promise((r) => setTimeout(r, 1500));
    }
  }
  return results;
}

/**
 * Récupère la liste d'amis enrichie avec profils et présence.
 */
export async function fetchFriends(limit = 50) {
  const auth = await getAuthorization();

  const friendsResult = await withRetry(() => getUserFriendsAccountIds(auth, "me"));
  const friendsAccountIds = friendsResult.friends || [];
  const sliced = friendsAccountIds.slice(0, limit);

  const profiles = await batchProcess(sliced, async (accountId) => {
    try {
      const [profile, basicPresence] = await Promise.all([
        withRetry(() => getProfileFromAccountId(auth, accountId)),
        withRetry(() => getBasicPresence(auth, accountId)),
      ]);

      return {
        accountId,
        onlineId: extractOnlineId(profile),
        avatarUrl: extractAvatarUrl(profile),
        presence: mapPresence(basicPresence),
      };
    } catch {
      return {
        accountId,
        onlineId: "(profil privé / inaccessible)",
        avatarUrl: null,
        presence: null,
        _failed: true,
      };
    }
  });

  // Filtrer le flag interne
  const cleanProfiles = profiles.map(({ _failed, ...rest }) => rest);

  // Si plus de 50% d'échecs, ne pas retourner de données pourries
  const failCount = profiles.filter((p) => p._failed).length;
  if (failCount > profiles.length * 0.5) {
    throw new Error(`Trop d'échecs (${failCount}/${profiles.length}) — rate limit probable`);
  }

  return {
    total: friendsResult.totalItemCount ?? friendsAccountIds.length,
    friends: cleanProfiles,
  };
}
