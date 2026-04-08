// src/psn-search.js
import {
  makeUniversalSearch,
  getProfileFromAccountId,
  getBasicPresence,
  getUserTrophyProfileSummary,
} from "psn-api";
import { getAuthorization, withRetry } from "./psn-auth.js";

/**
 * Recherche de joueurs PSN par pseudo.
 * Retourne une liste de résultats avec infos basiques.
 */
export async function searchPlayers(query) {
  if (!query || query.trim().length < 2) return [];

  const auth = await getAuthorization();

  const res = await withRetry(() => makeUniversalSearch(auth, query, "SocialAllAccounts"));

  const results =
    res?.domainResponses?.[0]?.results ?? [];

  return results.map((r) => ({
    accountId: r.socialMetadata?.accountId ?? r.id,
    onlineId: r.socialMetadata?.onlineId ?? "(inconnu)",
    avatarUrl: r.socialMetadata?.avatarUrl ?? null,
    isPsPlus: r.socialMetadata?.isPsPlus ?? false,
    isVerified: r.socialMetadata?.isOfficiallyVerified ?? false,
    country: r.socialMetadata?.country ?? null,
  }));
}

/**
 * Profil détaillé d'un joueur trouvé via recherche.
 */
export async function fetchPlayerProfile(accountId) {
  const auth = await getAuthorization();

  const [profile, presence, trophySummary] = await Promise.all([
    withRetry(() => getProfileFromAccountId(auth, accountId)).catch(() => null),
    withRetry(() => getBasicPresence(auth, accountId)).catch(() => null),
    withRetry(() => getUserTrophyProfileSummary(auth, accountId)).catch(() => null),
  ]);

  const avatars = profile?.avatars;
  let avatarUrl = null;
  if (Array.isArray(avatars) && avatars.length > 0) {
    for (const size of ["xl", "l", "m", "s"]) {
      const found = avatars.find((a) => a.size === size && a.url);
      if (found) { avatarUrl = found.url; break; }
    }
    if (!avatarUrl) avatarUrl = avatars[0].url ?? null;
  }

  const game = presence?.gameTitleInfoList?.[0] ?? null;
  const isOnline =
    presence?.primaryPlatformInfo?.onlineStatus === "online" ||
    presence?.availability === "available" ||
    !!game;

  return {
    accountId,
    onlineId: profile?.onlineId ?? "(inconnu)",
    avatarUrl,
    aboutMe: profile?.aboutMe ?? null,
    isPlus: profile?.isPlus ?? false,
    languages: profile?.languages ?? [],
    presence: {
      isOnline,
      platform: presence?.primaryPlatformInfo?.platform ?? game?.format ?? null,
      titleName: game?.titleName ?? null,
      lastOnlineDate:
        presence?.primaryPlatformInfo?.lastOnlineDate ??
        presence?.lastAvailableDate ??
        null,
    },
    trophySummary: trophySummary
      ? {
          level: trophySummary.trophyLevel,
          progress: trophySummary.progress,
          tier: trophySummary.tier,
          earned: trophySummary.earnedTrophies,
        }
      : null,
  };
}
