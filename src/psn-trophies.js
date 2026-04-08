// src/psn-trophies.js
import {
  getUserTitles,
  getTitleTrophies,
  getUserTrophiesEarnedForTitle,
  getTitleTrophyGroups,
} from "psn-api";
import { getAuthorization, getMyAccountId } from "./psn-auth.js";

/**
 * Liste tous les jeux avec progression trophées de l'utilisateur.
 * Retourne un tableau paginé de titres.
 */
export async function fetchTrophyTitles(offset = 0, limit = 50) {
  const auth = await getAuthorization();
  const accountId = getMyAccountId();

  const res = await getUserTitles(auth, accountId, { offset, limit });

  const titles = (res.trophyTitles ?? []).map((t) => ({
    npCommunicationId: t.npCommunicationId,
    npServiceName: t.npServiceName,
    name: t.trophyTitleName,
    iconUrl: t.trophyTitleIconUrl,
    platform: t.trophyTitlePlatform,
    progress: t.progress,
    earned: t.earnedTrophies,
    defined: t.definedTrophies,
    hasTrophyGroups: t.hasTrophyGroups,
    lastUpdated: t.lastUpdatedDateTime,
  }));

  return {
    titles,
    totalItemCount: res.totalItemCount,
    offset,
    limit,
  };
}

/**
 * Détail des trophées pour un jeu donné.
 * Fusionne les définitions (nom, description, icône, rareté) avec le statut earned.
 */
export async function fetchTrophiesForTitle(npCommunicationId, npServiceName) {
  const auth = await getAuthorization();
  const accountId = getMyAccountId();

  const serviceName = npServiceName === "trophy" ? "trophy" : "trophy2";

  const [titleTrophies, earnedTrophies, trophyGroups] = await Promise.all([
    getTitleTrophies(auth, npCommunicationId, "all", {
      npServiceName: serviceName,
    }),
    getUserTrophiesEarnedForTitle(
      auth,
      accountId,
      npCommunicationId,
      "all",
      { npServiceName: serviceName }
    ),
    getTitleTrophyGroups(auth, npCommunicationId, {
      npServiceName: serviceName,
    }).catch(() => null),
  ]);

  // Index des trophées gagnés par trophyId
  const earnedMap = new Map();
  for (const t of earnedTrophies.trophies ?? []) {
    earnedMap.set(t.trophyId, t);
  }

  // Fusionner définitions + earned
  const trophies = (titleTrophies.trophies ?? []).map((t) => {
    const earned = earnedMap.get(t.trophyId);
    return {
      trophyId: t.trophyId,
      name: t.trophyName,
      detail: t.trophyDetail,
      type: t.trophyType,
      iconUrl: t.trophyIconUrl,
      hidden: t.trophyHidden,
      earnedRate: t.trophyEarnedRate,
      groupId: t.trophyGroupId,
      progressTarget: t.trophyProgressTargetValue ?? null,
      rare: t.trophyRare ?? null,
      rewardImageUrl: t.trophyRewardImageUrl ?? null,
      rewardName: t.trophyRewardName ?? null,
      earned: earned?.earned ?? false,
      earnedDateTime: earned?.earnedDateTime ?? null,
      progress: earned?.progress ?? null,
      progressRate: earned?.progressRate ?? null,
    };
  });

  // Groupes
  const groups = (trophyGroups?.trophyGroups ?? []).map((g) => ({
    id: g.trophyGroupId,
    name: g.trophyGroupName,
    iconUrl: g.trophyGroupIconUrl,
    defined: g.definedTrophies,
  }));

  return { trophies, groups };
}
