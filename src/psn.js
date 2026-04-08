// src/psn.js
import "dotenv/config";
import {
  exchangeNpssoForAccessCode,
  exchangeAccessCodeForAuthTokens,
  getUserFriendsAccountIds,
  getProfileFromAccountId,
  getBasicPresence,
} from "psn-api";

const npsso = process.env.PSN_NPSSO;

if (!npsso) {
  console.error("❌ PSN_NPSSO manquant dans .env");
  process.exit(1);
}

const DEBUG_PROFILE = true;

// Récupère le pseudo depuis différentes structures possibles
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

// Récupère la meilleure URL d'avatar
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

// Normalise la présence en objet simple pour le front
// Normalise la présence en objet simple pour le front
// Normalise la présence en objet simple pour le front
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
    hasGame; // s'il a un jeu en cours, on le considère en ligne

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
    titleFormat: game?.format ?? null, // "ps4" | "ps5"
    titleIconUrl: game?.npTitleIconUrl ?? game?.conceptIconUrl ?? null,
  };
}



/**
 * Retourne :
 * {
 *   total: nombre total d'amis,
 *   friends: [{ accountId, onlineId, avatarUrl, presence }, ...]
 * }
 */
export async function fetchFriends(limit = 50) {
  // Auth
  const accessCode = await exchangeNpssoForAccessCode(npsso);
  const auth = await exchangeAccessCodeForAuthTokens(accessCode);
  const authorization = { accessToken: auth.accessToken };

  // Liste d'amis (accountId)
  const friendsResult = await getUserFriendsAccountIds(authorization, "me");
  const friendsAccountIds = friendsResult.friends || [];
  const sliced = friendsAccountIds.slice(0, limit);

  let debugDone = false;

  const profiles = await Promise.all(
    sliced.map(async (accountId) => {
      try {
        // On récupère profil + présence en parallèle
        const [profile, basicPresence] = await Promise.all([
          getProfileFromAccountId(authorization, accountId),
          getBasicPresence(authorization, accountId),
        ]);

        if (DEBUG_PROFILE && !debugDone) {
          console.log("===== PROFIL DEBUG =====");
          console.log(JSON.stringify({ profile, basicPresence }, null, 2));
          console.log("========================");
          debugDone = true;
        }

        const onlineId = extractOnlineId(profile);
        const avatarUrl = extractAvatarUrl(profile);
        const presence = mapPresence(basicPresence);

        return { accountId, onlineId, avatarUrl, presence };
      } catch (err) {
        console.warn(
          "Profil/presence inaccessible pour",
          accountId,
          "-",
          err?.message || err
        );
        return {
          accountId,
          onlineId: "(profil privé / inaccessible)",
          avatarUrl: null,
          presence: null,
        };
      }
    })
  );

  return {
    total: friendsResult.totalItemCount ?? friendsAccountIds.length,
    friends: profiles,
  };
}
