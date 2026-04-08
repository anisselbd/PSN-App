// src/psn-profile.js
import {
  getProfileFromAccountId,
  getUserTrophyProfileSummary,
  getRecentlyPlayedGames,
} from "psn-api";
import { getAuthorization, getMyAccountId } from "./psn-auth.js";

function extractOnlineId(profile) {
  return (
    profile?.onlineId ??
    profile?.aboutMe ??
    profile?.profile?.onlineId ??
    profile?.profile?.personalDetail?.onlineId ??
    profile?.profile?.accountIdMappings?.[0]?.onlineId ??
    profile?.profileSummary?.onlineId ??
    "(pseudo inconnu)"
  );
}

function extractAvatarUrl(profile) {
  const avatars = profile?.avatars;
  if (!Array.isArray(avatars) || avatars.length === 0) return null;

  const preferredOrder = ["xl", "l", "m", "s"];
  for (const size of preferredOrder) {
    const found = avatars.find((a) => a.size === size && a.url);
    if (found) return found.url;
  }
  return avatars[0].url ?? null;
}

/**
 * Récupère le profil de l'utilisateur connecté (me)
 */
export async function fetchMyProfile() {
  const auth = await getAuthorization();
  const accountId = getMyAccountId();

  const [profile, trophySummary, recentGames] = await Promise.all([
    getProfileFromAccountId(auth, accountId),
    getUserTrophyProfileSummary(auth, accountId).catch(() => null),
    getRecentlyPlayedGames(auth, { limit: 5 }).catch(() => null),
  ]);

  return {
    onlineId: extractOnlineId(profile),
    avatarUrl: extractAvatarUrl(profile),
    aboutMe: profile?.aboutMe ?? null,
    isPlus: profile?.isPlus ?? false,
    languages: profile?.languages ?? [],
    trophySummary: trophySummary
      ? {
          level: trophySummary.trophyLevel,
          progress: trophySummary.progress,
          tier: trophySummary.tier,
          earned: trophySummary.earnedTrophies,
        }
      : null,
    recentGames:
      recentGames?.data?.gameLibraryTitlesRetrieve?.games?.map((g) => ({
        name: g.name,
        imageUrl: g.image?.url ?? null,
        platform: g.platform,
        lastPlayed: g.lastPlayedDateTime,
      })) ?? [],
  };
}

export { extractOnlineId, extractAvatarUrl };
