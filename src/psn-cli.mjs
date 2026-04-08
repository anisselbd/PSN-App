// src/psn-cli.mjs
import { fetchFriends } from "./psn-friends.js";

(async () => {
  try {
    console.log("Auth PSN & récupération des amis...");
    const { total, friends } = await fetchFriends(20);

    console.log(`Tu as ${total} amis PSN (affichage limité à ${friends.length})\n`);

    friends.forEach((f, i) => {
      const status = f.presence?.isOnline ? "EN LIGNE" : "hors ligne";
      const game = f.presence?.titleName ? ` — ${f.presence.titleName}` : "";
      console.log(`${i + 1}. ${f.onlineId} [${status}${game}]`);
    });
  } catch (err) {
    console.error("Erreur :", err);
  }
})();
