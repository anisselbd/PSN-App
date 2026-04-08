// src/psn-trophies.js
import {
  getUserTitles,
  getTitleTrophies,
  getUserTrophiesEarnedForTitle,
  getTitleTrophyGroups,
} from "psn-api";
import { getAuthorization, getMyAccountId, withRetry } from "./psn-auth.js";

/**
 * Liste tous les jeux avec progression trophées de l'utilisateur.
 * Retourne un tableau paginé de titres.
 */
export async function fetchTrophyTitles(offset = 0, limit = 50) {
  const auth = await getAuthorization();
  const accountId = getMyAccountId();

  const res = await withRetry(() => getUserTitles(auth, accountId, { offset, limit }));

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
    withRetry(() => getTitleTrophies(auth, npCommunicationId, "all", {
      npServiceName: serviceName,
    })),
    withRetry(() => getUserTrophiesEarnedForTitle(
      auth,
      accountId,
      npCommunicationId,
      "all",
      { npServiceName: serviceName }
    )),
    withRetry(() => getTitleTrophyGroups(auth, npCommunicationId, {
      npServiceName: serviceName,
    })).catch(() => null),
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

/**
 * Compare les trophées d'un jeu entre l'utilisateur connecté et un autre joueur.
 */
export async function compareTrophies(npCommunicationId, npServiceName, otherAccountId) {
  const auth = await getAuthorization();
  const myAccountId = getMyAccountId();
  const serviceName = npServiceName === "trophy" ? "trophy" : "trophy2";

  const [titleTrophies, myEarned, otherEarned] = await Promise.all([
    withRetry(() => getTitleTrophies(auth, npCommunicationId, "all", {
      npServiceName: serviceName,
    })),
    withRetry(() => getUserTrophiesEarnedForTitle(
      auth, myAccountId, npCommunicationId, "all",
      { npServiceName: serviceName }
    )),
    withRetry(() => getUserTrophiesEarnedForTitle(
      auth, otherAccountId, npCommunicationId, "all",
      { npServiceName: serviceName }
    )),
  ]);

  const myMap = new Map();
  for (const t of myEarned.trophies ?? []) myMap.set(t.trophyId, t);

  const otherMap = new Map();
  for (const t of otherEarned.trophies ?? []) otherMap.set(t.trophyId, t);

  const trophies = (titleTrophies.trophies ?? []).map((t) => {
    const me = myMap.get(t.trophyId);
    const other = otherMap.get(t.trophyId);
    return {
      trophyId: t.trophyId,
      name: t.trophyName,
      detail: t.trophyDetail,
      type: t.trophyType,
      iconUrl: t.trophyIconUrl,
      hidden: t.trophyHidden,
      earnedRate: t.trophyEarnedRate,
      meEarned: me?.earned ?? false,
      meEarnedDate: me?.earnedDateTime ?? null,
      otherEarned: other?.earned ?? false,
      otherEarnedDate: other?.earnedDateTime ?? null,
    };
  });

  return { trophies };
}

/**
 * Récupère les titres trophées d'un autre joueur (pour trouver les jeux en commun).
 */
export async function fetchPlayerTrophyTitles(accountId, offset = 0, limit = 100) {
  const auth = await getAuthorization();

  const res = await withRetry(() => getUserTitles(auth, accountId, { offset, limit }));

  return (res.trophyTitles ?? []).map((t) => ({
    npCommunicationId: t.npCommunicationId,
    npServiceName: t.npServiceName,
    name: t.trophyTitleName,
    iconUrl: t.trophyTitleIconUrl,
    platform: t.trophyTitlePlatform,
    progress: t.progress,
    earned: t.earnedTrophies,
    defined: t.definedTrophies,
  }));
}
