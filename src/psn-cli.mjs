// src/psn-cli.mjs
import { fetchFriends } from "./psn.js";

(async () => {
  try {
    console.log("🔐 Auth PSN & récupération des amis...");
    const { total, friends } = await fetchFriends(20);

    console.log(`✅ Tu as ${total} amis PSN (affichage limité à ${friends.length})\n`);

    friends.forEach((f, i) => {
      console.log(`${i + 1}. ${f.onlineId} — ${f.accountId}`);
    });
  } catch (err) {
    console.error("💥 Erreur :", err);
  }
})();
