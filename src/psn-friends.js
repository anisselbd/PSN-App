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

// Batch les requêtes par petits groupes avec pause entre chaque
async function batchProcess(items, fn, batchSize = 3) {
  const results = [];
  for (let i = 0; i < items.length; i += batchSize) {
    const batch = items.slice(i, i + batchSize);
    const batchResults = await Promise.all(batch.map(fn));
    results.push(...batchResults);
    // Pause 1.5s entre chaque batch pour ne pas saturer l'API
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
      };
    }
  });

  return {
    total: friendsResult.totalItemCount ?? friendsAccountIds.length,
    friends: profiles,
  };
}
