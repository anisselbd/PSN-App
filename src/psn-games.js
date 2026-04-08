// src/psn-games.js
import { getUserPlayedGames, getRecentlyPlayedGames } from "psn-api";
import { getAuthorization, getMyAccountId } from "./psn-auth.js";

/**
 * Jeux joués par l'utilisateur avec stats détaillées (temps, dates, etc.)
 */
export async function fetchPlayedGames(offset = 0, limit = 50) {
  const auth = await getAuthorization();
  const accountId = getMyAccountId();

  const res = await getUserPlayedGames(auth, accountId, { offset, limit });

  const titles = (res.titles ?? []).map((t) => ({
    titleId: t.titleId,
    name: t.name,
    imageUrl: t.imageUrl ?? null,
    platform: t.category ?? null,
    playCount: t.playCount ?? 0,
    playDuration: t.playDuration ?? null,
    firstPlayed: t.firstPlayedDateTime ?? null,
    lastPlayed: t.lastPlayedDateTime ?? null,
    conceptId: t.concept?.id ?? null,
    conceptIconUrl: t.concept?.media?.audios?.[0]?.url ?? t.concept?.media?.screenshots?.[0]?.url ?? null,
  }));

  return {
    titles,
    totalItemCount: res.totalItemCount,
    offset,
    limit,
  };
}

/**
 * Jeux récemment joués (endpoint GraphQL, données différentes).
 */
export async function fetchRecentlyPlayed(limit = 12) {
  const auth = await getAuthorization();

  const res = await getRecentlyPlayedGames(auth, { limit });
  const games = res?.data?.gameLibraryTitlesRetrieve?.games ?? [];

  return games.map((g) => ({
    titleId: g.titleId,
    name: g.name,
    imageUrl: g.image?.url ?? null,
    platform: g.platform,
    lastPlayed: g.lastPlayedDateTime,
    conceptId: g.conceptId ?? null,
    isActive: g.isActive ?? false,
  }));
}
