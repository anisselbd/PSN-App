// src/psn-friends.js
import {
  getUserFriendsAccountIds,
  getProfileFromAccountId,
  getBasicPresence,
} from "psn-api";
import { getAuthorization, withRetry } from "./psn-auth.js";
import { extractOnlineId, extractAvatarUrl } from "./psn-profile.js";

function mapPresence(basicPresence) {
  if (!basicPresence) return null;

  const game = basicPresence.gameTitleInfoList?.[0] ?? null;

  const availability =
    basicPresence.availability ??
    basicPresence.primaryPlatformInfo?.availability ??
    null;

  const rawOnlineStatus =
    basicPresence.onlineStatus ??
    basicPresence.primaryPlatformInfo?.onlineStatus ??
    null;

  const hasGame =
    Array.isArray(basicPresence.gameTitleInfoList) &&
    basicPresence.gameTitleInfoList.length > 0;

  const isOnline =
    basicPresence.isOnline === true ||
    basicPresence.primaryPlatformInfo?.isOnline === true ||
    rawOnlineStatus === "online" ||
    availability === "available" ||
    hasGame;

  const platform =
    basicPresence.primaryPlatformInfo?.platform ??
    basicPresence.platform ??
    game?.format ??
    null;

  return {
    availability,
    onlineStatus: rawOnlineStatus,
    isOnline,
    platform,
    lastOnlineDate:
      basicPresence.lastOnlineDate ??
      basicPresence.primaryPlatformInfo?.lastOnlineDate ??
      basicPresence.lastAvailableDate ??
      null,
    titleName: game?.titleName ?? null,
    titleFormat: game?.format ?? null,
    titleIconUrl: game?.npTitleIconUrl ?? game?.conceptIconUrl ?? null,
  };
}

// Batch les requêtes par groupes pour éviter le rate limiting
async function batchProcess(items, fn, batchSize = 8) {
  const results = [];
  for (let i = 0; i < items.length; i += batchSize) {
    const batch = items.slice(i, i + batchSize);
    const batchResults = await Promise.all(batch.map(fn));
    results.push(...batchResults);
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
