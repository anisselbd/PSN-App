# psn-api v2.16.0 - Reference interne complete

> Document de reference interne pour le package npm `psn-api` (par Wes Copeland / achievements-app).
> Derniere mise a jour : 2026-04-08.
> Source : analyse du code source + documentation officielle https://psn-api.achievements.app

---

## Table des matieres

1. [Vue d'ensemble](#1-vue-densemble)
2. [Flux d'authentification](#2-flux-dauthentification)
3. [URLs de base (Base URLs)](#3-urls-de-base)
4. [Fonctions exportees - Reference complete](#4-fonctions-exportees---reference-complete)
   - 4.1 [Authentification](#41-authentification)
   - 4.2 [Recherche](#42-recherche)
   - 4.3 [Utilisateurs](#43-utilisateurs)
   - 4.4 [Trophees - Titres](#44-trophees---titres)
   - 4.5 [Trophees - Utilisateurs](#45-trophees---utilisateurs)
   - 4.6 [GraphQL (Jeux)](#46-graphql-jeux)
   - 4.7 [Utilitaires](#47-utilitaires)
5. [Modeles et Types - Reference complete](#5-modeles-et-types---reference-complete)
6. [Endpoints HTTP complets](#6-endpoints-http-complets)
7. [Limites de taux (Rate Limits)](#7-limites-de-taux-rate-limits)
8. [Problemes connus et solutions](#8-problemes-connus-et-solutions)
9. [Bonnes pratiques](#9-bonnes-pratiques)

---

## 1. Vue d'ensemble

`psn-api` est une bibliotheque JavaScript/TypeScript bas-niveau pour interagir avec l'API non-officielle du PlayStation Network. Chaque fonction effectue exactement un appel HTTP. La bibliotheque est modulaire (tree-shaking), pese moins de 5 Ko, et fonctionne en Node.js (>=20) et dans les navigateurs.

**Dependance unique** : `isomorphic-unfetch` (pour `fetch` cross-platform).

**Licence** : MIT. Non affiliee a Sony/PlayStation.

---

## 2. Flux d'authentification

### 2.1 Schema global

```
Navigateur (cookie PSN)
    |
    v
[1] Recuperer NPSSO (64 caracteres)
    URL : https://ca.account.sony.com/api/v1/ssocookie
    |
    v
[2] exchangeNpssoForAccessCode(npsso)
    -> Retourne un code d'acces (string "v3.XXXXXX")
    |
    v
[3] exchangeAccessCodeForAuthTokens(accessCode)
    -> Retourne { accessToken, refreshToken, expiresIn, ... }
    |
    v
[4] Utiliser accessToken pour tous les appels API
    |
    v (quand accessToken expire)
[5] exchangeRefreshTokenForAuthTokens(refreshToken)
    -> Nouveau { accessToken, refreshToken, ... }
```

### 2.2 Details techniques de l'authentification

#### Etape 1 : Obtenir le NPSSO

1. Se connecter sur https://www.playstation.com/ dans un navigateur
2. Dans le meme navigateur, visiter : `https://ca.account.sony.com/api/v1/ssocookie`
3. La reponse JSON contient : `{ "npsso": "<token de 64 caracteres>" }`

> **ATTENTION** : Le NPSSO est equivalent a un mot de passe. Ne jamais l'exposer publiquement.
> Si erreur, essayer un autre navigateur (probleme de cookies persistants).

#### Etape 2 : NPSSO -> Code d'acces

```typescript
const accessCode = await exchangeNpssoForAccessCode(npsso);
```

**Endpoint interne** :
```
GET https://ca.account.sony.com/api/authz/v3/oauth/authorize
  ?access_type=offline
  &client_id=09515159-7237-4370-9b40-3806e67c0891
  &redirect_uri=com.scee.psxandroid.scecompcall://redirect
  &response_type=code
  &scope=psn:mobile.v2.core psn:clientapp
Headers:
  Cookie: npsso=<token>
```

Le serveur repond avec un **HTTP 302** (redirection). Le code d'acces est extrait du header `Location` de la reponse (parametre `?code=`).

#### Etape 3 : Code d'acces -> Tokens

```typescript
const authorization = await exchangeAccessCodeForAuthTokens(accessCode);
```

**Endpoint interne** :
```
POST https://ca.account.sony.com/api/authz/v3/oauth/token
Headers:
  Content-Type: application/x-www-form-urlencoded
  Authorization: Basic MDk1MTUxNTktNzIzNy00MzcwLTliNDAtMzgwNmU2N2MwODkxOnVjUGprYTV0bnRCMktxc1A=
Body:
  code=<accessCode>
  &redirect_uri=com.scee.psxandroid.scecompcall://redirect
  &grant_type=authorization_code
  &token_format=jwt
```

**Identifiants OAuth hardcodes dans la bibliotheque** :
- **Client ID** : `09515159-7237-4370-9b40-3806e67c0891`
- **Client Secret** (en Base64 dans le header Authorization) : `ucPjka5tntB2KqsP`
- **Redirect URI** : `com.scee.psxandroid.scecompcall://redirect`
- **Scopes** : `psn:mobile.v2.core psn:clientapp`

#### Etape 4 : Rafraichir les tokens

```typescript
const newAuth = await exchangeRefreshTokenForAuthTokens(authorization.refreshToken);
```

**Endpoint interne** :
```
POST https://ca.account.sony.com/api/authz/v3/oauth/token
Headers:
  Content-Type: application/x-www-form-urlencoded
  Authorization: Basic MDk1MTUxNTktNzIzNy00MzcwLTliNDAtMzgwNmU2N2MwODkxOnVjUGprYTV0bnRCMktxc1A=
Body:
  refresh_token=<refreshToken>
  &grant_type=refresh_token
  &token_format=jwt
  &scope=psn:mobile.v2.core psn:clientapp
```

### 2.3 Durees de vie des tokens

| Token | Duree approximative |
|-------|-------------------|
| Access Token | ~1 heure (3600 secondes) |
| Refresh Token | ~60 jours |
| NPSSO | ~60 jours (lie a la session navigateur) |

> L'`expiresIn` et le `refreshTokenExpiresIn` retournes par l'API donnent la valeur exacte en secondes.

---

## 3. URLs de base

| Constante | URL | Usage |
|-----------|-----|-------|
| `AUTH_BASE_URL` | `https://ca.account.sony.com/api/authz/v3/oauth` | Authentification OAuth |
| `USER_BASE_URL` | `https://m.np.playstation.com/api/userProfile/v1/internal/users` | Profils, presence, amis |
| `USER_GAMES_BASE_URL` | `https://m.np.playstation.com/api/gamelist/v2/users` | Liste des jeux joues |
| `USER_LEGACY_BASE_URL` | `https://us-prof.np.community.playstation.net/userProfile/v1/users` | Profil legacy (profile2) |
| `USER_CPSS_BASE_URL` | `https://m.np.playstation.com/api/cpss` | Liens partageables de profil |
| `USER_DMS_BASE_URL` | `https://dms.api.playstation.com/api` | Appareils du compte |
| `TROPHY_BASE_URL` | `https://m.np.playstation.com/api/trophy` | Trophees (v1) |
| `SEARCH_BASE_URL` | `https://m.np.playstation.com/api/search` | Recherche universelle |
| `GRAPHQL_BASE_URL` | `https://web.np.playstation.com/api/graphql/v1/op` | Jeux recents/achetes (GraphQL) |

---

## 4. Fonctions exportees - Reference complete

### 4.1 Authentification

#### `exchangeNpssoForAccessCode(npssoToken)`

Echange un token NPSSO contre un code d'acces.

| Parametre | Type | Description |
|-----------|------|-------------|
| `npssoToken` | `string` | Token NPSSO de 64 caracteres |

**Retour** : `Promise<string>` - Le code d'acces (ex: `"v3.XXXXXX"`)

```typescript
import { exchangeNpssoForAccessCode } from "psn-api";

const accessCode = await exchangeNpssoForAccessCode("votre-npsso-64-chars");
console.log(accessCode); // "v3.XXXXXX"
```

> **Alias deprecie** : `exchangeNpssoForCode()` - sera supprime dans une future version.

---

#### `exchangeAccessCodeForAuthTokens(accessCode)`

Echange un code d'acces contre des tokens d'authentification.

| Parametre | Type | Description |
|-----------|------|-------------|
| `accessCode` | `string` | Code d'acces obtenu via `exchangeNpssoForAccessCode()` |

**Retour** : `Promise<AuthTokensResponse>`

```typescript
import { exchangeAccessCodeForAuthTokens } from "psn-api";

const auth = await exchangeAccessCodeForAuthTokens(accessCode);
// auth.accessToken  -> token pour les appels API
// auth.refreshToken -> token pour rafraichir l'access token
// auth.expiresIn    -> duree en secondes avant expiration
```

> **Alias deprecie** : `exchangeCodeForAccessToken()` - sera supprime dans une future version.

---

#### `exchangeRefreshTokenForAuthTokens(refreshToken)`

Utilise un refresh token pour obtenir de nouveaux tokens sans repasser par le NPSSO.

| Parametre | Type | Description |
|-----------|------|-------------|
| `refreshToken` | `string` | Refresh token non expire |

**Retour** : `Promise<AuthTokensResponse>`

```typescript
import { exchangeRefreshTokenForAuthTokens } from "psn-api";

const newAuth = await exchangeRefreshTokenForAuthTokens(auth.refreshToken);
```

---

### 4.2 Recherche

#### `makeUniversalSearch(authorization, searchTerm, domain)`

Recherche sur le PlayStation Network. Methode recommandee pour trouver l'`accountId` d'un utilisateur a partir de son nom d'utilisateur.

| Parametre | Type | Description |
|-----------|------|-------------|
| `authorization` | `AuthorizationPayload` | `{ accessToken: string }` |
| `searchTerm` | `string` | Terme de recherche |
| `domain` | `"SocialAllAccounts"` | Domaine de recherche (seul domaine supporte actuellement) |

**Retour** : `Promise<UniversalSearchResponse<SocialAccountResult>>`

**Endpoint** : `POST https://m.np.playstation.com/api/search/v1/universalSearch`

**Body** :
```json
{
  "searchTerm": "xelnia",
  "domainRequests": [{ "domain": "SocialAllAccounts" }]
}
```

```typescript
import { makeUniversalSearch } from "psn-api";

const response = await makeUniversalSearch(
  { accessToken: auth.accessToken },
  "xelnia",
  "SocialAllAccounts"
);

// Acceder au premier resultat
const firstResult = response.domainResponses[0]?.results[0];
const accountId = firstResult?.socialMetadata.accountId;
const onlineId = firstResult?.socialMetadata.onlineId;
```

> **Attention** : Si vous cherchez votre propre nom d'utilisateur, il n'apparaitra PAS dans les resultats. Utilisez `"me"` pour les fonctions qui acceptent un `accountId`.

---

### 4.3 Utilisateurs

#### `getProfileFromAccountId(authorization, accountId, options?)`

Recupere le profil d'un utilisateur a partir de son `accountId`.

| Parametre | Type | Description |
|-----------|------|-------------|
| `authorization` | `AuthorizationPayload` | `{ accessToken: string }` |
| `accountId` | `string` | L'ID du compte cible |
| `options?.headerOverrides` | `CallValidHeaders` | Optionnel, ex: `{ "Accept-Language": "fr-FR" }` |

**Retour** : `Promise<ProfileFromAccountIdResponse>`

**Endpoint** : `GET https://m.np.playstation.com/api/userProfile/v1/internal/users/{accountId}/profiles`

```typescript
import { getProfileFromAccountId } from "psn-api";

const profile = await getProfileFromAccountId(
  { accessToken: auth.accessToken },
  "962157895908076652"
);
// profile.onlineId -> "Hakoom"
// profile.avatars  -> [{ size: "xl", url: "https://..." }]
// profile.isPlus   -> true/false
```

---

#### `getProfileFromUserName(authorization, userName)` (LEGACY)

Recupere le profil d'un utilisateur a partir de son nom d'utilisateur via l'endpoint legacy `profile2`.

> **Endpoint legacy** : utilise `USER_LEGACY_BASE_URL`. Recommande principalement pour recuperer les informations de presence sur consoles legacy (PS3) ou l'`accountId` d'un utilisateur. Pour simplement trouver un `accountId`, preferer `makeUniversalSearch()`.

| Parametre | Type | Description |
|-----------|------|-------------|
| `authorization` | `AuthorizationPayload` | `{ accessToken: string }` |
| `userName` | `string` | Nom d'utilisateur PSN (onlineId) |

**Retour** : `Promise<ProfileFromUserNameResponse>`

**Endpoint** :
```
GET https://us-prof.np.community.playstation.net/userProfile/v1/users/{userName}/profile2
  ?fields=npId,onlineId,accountId,avatarUrls,plus,aboutMe,languagesUsed,
          trophySummary(@default,level,progress,earnedTrophies),
          isOfficiallyVerified,personalDetail(@default,profilePictureUrls),
          personalDetailSharing,personalDetailSharingRequestMessageFlag,
          primaryOnlineStatus,presences(@default,@titleInfo,platform,lastOnlineDate,hasBroadcastData),
          requestMessageFlag,blocking,friendRelation,following,consoleAvailability
```

```typescript
import { getProfileFromUserName } from "psn-api";

const result = await getProfileFromUserName(
  { accessToken: auth.accessToken },
  "Hakoom"
);
// result.profile.accountId     -> "962157895908076652"
// result.profile.onlineId      -> "Hakoom"
// result.profile.npId          -> (base64 encoded)
// result.profile.plus          -> 0 | 1
// result.profile.trophySummary -> { level, progress, earnedTrophies }
// result.profile.presences     -> [{ onlineStatus, lastOnlineDate, ... }]
// result.profile.blocking      -> false
// result.profile.friendRelation -> "friend" | ...
```

---

#### `getUserFriendsAccountIds(authorization, accountId, options?)`

Recupere la liste des `accountId` des amis d'un utilisateur.

| Parametre | Type | Description |
|-----------|------|-------------|
| `authorization` | `AuthorizationPayload` | `{ accessToken: string }` |
| `accountId` | `string` | ID du compte cible. `"me"` pour le compte authentifie. |
| `options?.limit` | `number` | Nombre max d'amis retournes |
| `options?.offset` | `number` | Decalage pour la pagination |

**Retour** : `Promise<GetUserFriendsAccountIdsResponse>`

**Endpoint** : `GET https://m.np.playstation.com/api/userProfile/v1/internal/users/{accountId}/friends?limit=X&offset=Y`

```typescript
import { getUserFriendsAccountIds } from "psn-api";

const friends = await getUserFriendsAccountIds(
  { accessToken: auth.accessToken },
  "me",
  { limit: 100, offset: 0 }
);
// friends.friends         -> ["1234567890", "0987654321", ...]
// friends.totalItemCount  -> 42
// friends.nextOffset      -> 100 (si plus de resultats)
```

> **Erreur possible** : "Not permitted by access control" si la liste d'amis est privee.

---

#### `getBasicPresence(authorization, accountId, options?)`

Recupere l'etat de presence basique d'un utilisateur (en ligne, hors ligne, jeu en cours).

| Parametre | Type | Description |
|-----------|------|-------------|
| `authorization` | `AuthorizationPayload` | `{ accessToken: string }` |
| `accountId` | `string` | ID du compte cible |
| `options?.headerOverrides` | `CallValidHeaders` | Optionnel |

**Retour** : `Promise<BasicPresenceResponse>`

**Endpoint** : `GET https://m.np.playstation.com/api/userProfile/v1/internal/users/{accountId}/basicPresences?type=primary`

```typescript
import { getBasicPresence } from "psn-api";

const presence = await getBasicPresence(
  { accessToken: auth.accessToken },
  "962157895908076652"
);
// presence.basicPresence.availability       -> "availableToPlay" | "unavailable"
// presence.basicPresence.primaryPlatformInfo -> { onlineStatus, platform, lastOnlineDate }
// presence.basicPresence.gameTitleInfoList   -> [{ npTitleId, titleName, format, ... }]
```

---

#### `getUserPlayedGames(authorization, accountId, options?)`

Recupere la liste des jeux joues par un utilisateur, triee par date de derniere session.

| Parametre | Type | Description |
|-----------|------|-------------|
| `authorization` | `AuthorizationPayload` | `{ accessToken: string }` |
| `accountId` | `string` | ID du compte. `"me"` pour le compte authentifie. |
| `options?.limit` | `number` | Nombre max de jeux |
| `options?.offset` | `number` | Decalage pour la pagination |
| `options?.categories` | `string` | Filtre par plateforme : `"ps4_game,ps5_native_game,pspc_game,unknown"` |

**Retour** : `Promise<UserPlayedGamesResponse>`

**Endpoint** : `GET https://m.np.playstation.com/api/gamelist/v2/users/{accountId}/titles?limit=X&offset=Y&categories=...`

```typescript
import { getUserPlayedGames } from "psn-api";

const games = await getUserPlayedGames(
  { accessToken: auth.accessToken },
  "me",
  { limit: 20, offset: 0, categories: "ps5_native_game" }
);
// games.titles[0].titleId           -> "PPSA01521_00"
// games.titles[0].name              -> "Horizon Forbidden West"
// games.titles[0].playDuration      -> "PT228H56M33S" (format ISO 8601)
// games.titles[0].firstPlayedDateTime -> "2022-02-18T00:00:00Z"
// games.titles[0].lastPlayedDateTime  -> "2024-08-03T19:28:27.12Z"
// games.titles[0].playCount         -> 100
// games.titles[0].category          -> "ps5_native_game"
// games.totalItemCount              -> 300
```

---

#### `getAccountDevices(authorization, options?)`

Recupere la liste des appareils sur lesquels le compte authentifie est connecte.

| Parametre | Type | Description |
|-----------|------|-------------|
| `authorization` | `AuthorizationPayload` | `{ accessToken: string }` |
| `options?.headerOverrides` | `CallValidHeaders` | Optionnel |

**Retour** : `Promise<AccountDevicesResponse>`

**Endpoint** : `GET https://dms.api.playstation.com/api/v1/devices/accounts/me?includeFields=device,systemData&platform=PS5,PS4,PS3,PSVita`

> **Note** : Cette fonction n'accepte pas d'`accountId` - elle utilise toujours `"me"` (le compte authentifie).

```typescript
import { getAccountDevices } from "psn-api";

const devices = await getAccountDevices({ accessToken: auth.accessToken });
// devices.accountId        -> "1234567890"
// devices.accountDevices   -> [{ deviceId, deviceType: "PS5", activationType: "PRIMARY", ... }]
```

---

#### `getUserRegion(authorization, userName, locales?)`

Determine la region d'un utilisateur a partir de son nom d'utilisateur, en decodant le `npId` de son profil legacy.

| Parametre | Type | Description |
|-----------|------|-------------|
| `authorization` | `AuthorizationPayload` | `{ accessToken: string }` |
| `userName` | `string` | Nom d'utilisateur PSN |
| `locales` | `Intl.LocalesArgument` | Optionnel. Defaut: `["en"]`. Ex: `["fr"]` |

**Retour** : `Promise<UserRegionInfo | null>`

> **Fonctionnement interne** : Appelle `getProfileFromUserName()`, decode le `npId` en base64 (format `user@xx.CC` ou CC est le code region), puis utilise `Intl.DisplayNames` pour le nom du pays.

```typescript
import { getUserRegion } from "psn-api";

const region = await getUserRegion(
  { accessToken: auth.accessToken },
  "Hakoom",
  ["fr"]
);
// region?.code -> "US"
// region?.name -> "Etats-Unis"
```

---

#### `getProfileShareableLink(authorization, accountId)`

Recupere un lien partageable et un QR code pour le profil d'un utilisateur.

| Parametre | Type | Description |
|-----------|------|-------------|
| `authorization` | `AuthorizationPayload` | `{ accessToken: string }` |
| `accountId` | `string` | ID du compte cible |

**Retour** : `Promise<ShareableProfileLinkResponse>`

**Endpoint** : `GET https://m.np.playstation.com/api/cpss/v1/share/profile/{accountId}`

```typescript
import { getProfileShareableLink } from "psn-api";

const link = await getProfileShareableLink(
  { accessToken: auth.accessToken },
  "962157895908076652"
);
// link.shareUrl                -> "https://..."
// link.shareImageUrl           -> "https://..." (image/QR code)
// link.shareImageUrlDestination -> "https://..."
```

---

### 4.4 Trophees - Titres

#### `getTitleTrophies(authorization, npCommunicationId, trophyGroupId, options?)`

Recupere la liste des trophees d'un jeu pour un ou tous les groupes de trophees.

| Parametre | Type | Description |
|-----------|------|-------------|
| `authorization` | `AuthorizationPayload` | `{ accessToken: string }` |
| `npCommunicationId` | `string` | ID unique du titre (ex: `"NPWR20188_00"`) |
| `trophyGroupId` | `string` | `"all"` pour tous, `"default"` pour le jeu de base, `"001"`, `"002"` pour les DLC |
| `options?.npServiceName` | `"trophy" \| "trophy2"` | **Obligatoire** pour PS3/PS4/Vita: `"trophy"`. PS5: `"trophy2"`. |
| `options?.limit` | `number` | Limite de resultats |
| `options?.offset` | `number` | Decalage pagination |
| `options?.headerOverrides` | `CallValidHeaders` | Ex: `{ "Accept-Language": "fr-FR" }` pour noms de trophees localises |

**Retour** : `Promise<TitleTrophiesResponse>`

**Endpoint** : `GET https://m.np.playstation.com/api/trophy/v1/npCommunicationIds/{npCommunicationId}/trophyGroups/{trophyGroupId}/trophies?npServiceName=...&limit=...&offset=...`

```typescript
import { getTitleTrophies } from "psn-api";

// Trophees d'un jeu PS5
const trophies = await getTitleTrophies(
  { accessToken: auth.accessToken },
  "NPWR20188_00",
  "all"
);

// Trophees d'un jeu PS4 (npServiceName obligatoire)
const ps4Trophies = await getTitleTrophies(
  { accessToken: auth.accessToken },
  "NPWR10788_00",
  "all",
  { npServiceName: "trophy" }
);

// Avec localisation francaise
const frTrophies = await getTitleTrophies(
  { accessToken: auth.accessToken },
  "NPWR20188_00",
  "all",
  { headerOverrides: { "Accept-Language": "fr-FR" } }
);
```

---

#### `getTitleTrophyGroups(authorization, npCommunicationId, options?)`

Recupere la liste des groupes de trophees d'un jeu (jeu de base + DLC).

| Parametre | Type | Description |
|-----------|------|-------------|
| `authorization` | `AuthorizationPayload` | `{ accessToken: string }` |
| `npCommunicationId` | `string` | ID unique du titre |
| `options?.npServiceName` | `"trophy" \| "trophy2"` | Obligatoire pour PS3/PS4/Vita |
| `options?.headerOverrides` | `CallValidHeaders` | Optionnel |

**Retour** : `Promise<TitleTrophyGroupsResponse>`

**Endpoint** : `GET https://m.np.playstation.com/api/trophy/v1/npCommunicationIds/{npCommunicationId}/trophyGroups?npServiceName=...`

```typescript
import { getTitleTrophyGroups } from "psn-api";

const groups = await getTitleTrophyGroups(
  { accessToken: auth.accessToken },
  "NPWR20188_00"
);
// groups.trophyTitleName     -> "ASTRO's PLAYROOM"
// groups.trophyGroups[0]     -> { trophyGroupId: "default", trophyGroupName: "...", ... }
// groups.definedTrophies     -> { bronze: 20, silver: 10, gold: 5, platinum: 1 }
```

---

### 4.5 Trophees - Utilisateurs

#### `getUserTitles(authorization, accountId, options?)`

Recupere la liste des jeux auxquels un utilisateur a joue, avec un resume des trophees obtenus. Trie par derniere activite trophee.

| Parametre | Type | Description |
|-----------|------|-------------|
| `authorization` | `AuthorizationPayload` | `{ accessToken: string }` |
| `accountId` | `string` | ID du compte. `"me"` pour le compte authentifie. |
| `options?.limit` | `number` | Max 800 par appel |
| `options?.offset` | `number` | Decalage pagination |
| `options?.headerOverrides` | `CallValidHeaders` | Optionnel |

**Retour** : `Promise<UserTitlesResponse>`

**Endpoint** : `GET https://m.np.playstation.com/api/trophy/v1/users/{accountId}/trophyTitles?limit=...&offset=...`

```typescript
import { getUserTitles } from "psn-api";

const titles = await getUserTitles(
  { accessToken: auth.accessToken },
  "me",
  { limit: 100, offset: 0 }
);
// titles.trophyTitles[0].npCommunicationId -> "NPWR20188_00"
// titles.trophyTitles[0].trophyTitleName   -> "ASTRO's PLAYROOM"
// titles.trophyTitles[0].progress          -> 100
// titles.trophyTitles[0].earnedTrophies    -> { bronze: 20, silver: 10, gold: 5, platinum: 1 }
// titles.totalItemCount                    -> 300
```

---

#### `getUserTrophiesEarnedForTitle(authorization, accountId, npCommunicationId, trophyGroupId, options?)`

Recupere le statut d'obtention des trophees d'un utilisateur pour un titre donne.

| Parametre | Type | Description |
|-----------|------|-------------|
| `authorization` | `AuthorizationPayload` | `{ accessToken: string }` |
| `accountId` | `string` | `"me"` ou ID numerique |
| `npCommunicationId` | `string` | ID unique du titre |
| `trophyGroupId` | `string` | `"all"` ou ID de groupe specifique |
| `options?.npServiceName` | `"trophy" \| "trophy2"` | Obligatoire pour PS3/PS4/Vita |
| `options?.limit` | `number` | Limite |
| `options?.offset` | `number` | Decalage |
| `options?.headerOverrides` | `CallValidHeaders` | Optionnel |

**Retour** : `Promise<UserTrophiesEarnedForTitleResponse>`

**Endpoint** : `GET https://m.np.playstation.com/api/trophy/v1/users/{accountId}/npCommunicationIds/{npCommunicationId}/trophyGroups/{trophyGroupId}/trophies?npServiceName=...`

> **Important** : Cette fonction retourne uniquement le statut d'obtention (earned/not earned), pas les metadonnees (nom, description). Utiliser `getTitleTrophies()` pour les metadonnees, puis combiner les resultats.

```typescript
import { getUserTrophiesEarnedForTitle } from "psn-api";

const earned = await getUserTrophiesEarnedForTitle(
  { accessToken: auth.accessToken },
  "me",
  "NPWR20188_00",
  "all"
);
// earned.trophies[0].trophyId -> 0
// earned.trophies[0].earned   -> true
// earned.trophies[0].earnedDateTime -> "2021-08-15T21:22:08Z"
// earned.rarestTrophies       -> [{ trophyId: 5, trophyEarnedRate: "1.2", ... }]
```

---

#### `getUserTrophiesForSpecificTitle(authorization, accountId, options)`

Recupere un resume des trophees obtenus pour des titres specifiques via leur `npTitleId`. Utile pour lier `npTitleId` a `npCommunicationId`.

| Parametre | Type | Description |
|-----------|------|-------------|
| `authorization` | `AuthorizationPayload` | `{ accessToken: string }` |
| `accountId` | `string` | `"me"` ou ID numerique |
| `options.npTitleIds` | `string` | **Obligatoire**. IDs separes par virgules. Max 5 IDs. Ex: `"CUSA01433_00,PPSA01521_00"` |
| `options.includeNotEarnedTrophyIds` | `boolean` | Optionnel. Si `true`, inclut les IDs des trophees non obtenus. |
| `options.headerOverrides` | `CallValidHeaders` | Optionnel |

**Retour** : `Promise<UserTrophiesBySpecificTitleResponse>`

**Endpoint** : `GET https://m.np.playstation.com/api/trophy/v1/users/{accountId}/titles/trophyTitles?npTitleIds=...&includeNotEarnedTrophyIds=...`

> **Limite** : Maximum 5 `npTitleIds` par appel. Au-dela, erreur "Bad Request".

```typescript
import { getUserTrophiesForSpecificTitle } from "psn-api";

const result = await getUserTrophiesForSpecificTitle(
  { accessToken: auth.accessToken },
  "me",
  { npTitleIds: "CUSA01433_00,PPSA01521_00" }
);
// result.titles[0].npTitleId     -> "CUSA01433_00"
// result.titles[0].trophyTitles  -> [{ npCommunicationId, progress, ... }]
```

---

#### `getUserTrophyGroupEarningsForTitle(authorization, accountId, npCommunicationId, options?)`

Recupere un resume des trophees obtenus par groupe pour un titre.

| Parametre | Type | Description |
|-----------|------|-------------|
| `authorization` | `AuthorizationPayload` | `{ accessToken: string }` |
| `accountId` | `string` | `"me"` ou ID numerique |
| `npCommunicationId` | `string` | ID unique du titre |
| `options?.npServiceName` | `"trophy" \| "trophy2"` | Obligatoire pour PS3/PS4/Vita |
| `options?.headerOverrides` | `CallValidHeaders` | Optionnel |

**Retour** : `Promise<UserTrophyGroupEarningsForTitleResponse>`

**Endpoint** : `GET https://m.np.playstation.com/api/trophy/v1/users/{accountId}/npCommunicationIds/{npCommunicationId}/trophyGroups?npServiceName=...`

```typescript
import { getUserTrophyGroupEarningsForTitle } from "psn-api";

const earnings = await getUserTrophyGroupEarningsForTitle(
  { accessToken: auth.accessToken },
  "me",
  "NPWR20188_00"
);
// earnings.progress        -> 100
// earnings.earnedTrophies  -> { bronze: 20, silver: 10, gold: 5, platinum: 1 }
// earnings.trophyGroups[0] -> { trophyGroupId: "default", progress: 100, ... }
```

---

#### `getUserTrophyProfileSummary(authorization, accountId, options?)`

Recupere le resume global des trophees d'un utilisateur (niveau, progression, nombre par type).

| Parametre | Type | Description |
|-----------|------|-------------|
| `authorization` | `AuthorizationPayload` | `{ accessToken: string }` |
| `accountId` | `string` | `"me"` ou ID numerique |
| `options?.headerOverrides` | `CallValidHeaders` | Optionnel |

**Retour** : `Promise<UserTrophyProfileSummaryResponse>`

**Endpoint** : `GET https://m.np.playstation.com/api/trophy/v1/users/{accountId}/trophySummary`

```typescript
import { getUserTrophyProfileSummary } from "psn-api";

const summary = await getUserTrophyProfileSummary(
  { accessToken: auth.accessToken },
  "me"
);
// summary.accountId      -> "1234567890"
// summary.trophyLevel    -> "350"
// summary.progress       -> 45
// summary.tier           -> 4  (Silver)
// summary.earnedTrophies -> { bronze: 500, silver: 200, gold: 80, platinum: 20 }
```

**Niveaux de trophees (systeme 2020)** :

| Tier | Grade | Niveaux |
|------|-------|---------|
| 1 | Bronze | 1 - 99 |
| 2 | Bronze | 100 - 199 |
| 3 | Bronze | 200 - 299 |
| 4 | Silver | 300 - 399 |
| 5 | Silver | 400 - 499 |
| 6 | Silver | 500 - 599 |
| 7 | Gold | 600 - 699 |
| 8 | Gold | 700 - 799 |
| 9 | Gold | 800 - 998 |
| 10 | Platinum | 999 |

---

### 4.6 GraphQL (Jeux)

Ces fonctions utilisent l'API GraphQL de PlayStation via des "persisted queries" avec des hashes SHA256 reverse-engineered depuis le code source de `library.playstation.com`.

#### `getRecentlyPlayedGames(authorization, options?)`

Recupere les jeux recemment joues par le compte authentifie.

| Parametre | Type | Description |
|-----------|------|-------------|
| `authorization` | `AuthorizationPayload` | `{ accessToken: string }` |
| `options?.limit` | `number` | Defaut: `50` |
| `options?.categories` | `("ps4_game" \| "ps5_native_game")[]` | Defaut: `["ps4_game", "ps5_native_game"]` |

**Retour** : `Promise<RecentlyPlayedGamesResponse>`

**Endpoint** :
```
GET https://web.np.playstation.com/api/graphql/v1/op
  ?operationName=getUserGameList
  &variables={"limit":50,"categories":"ps4_game,ps5_native_game"}
  &extensions={"persistedQuery":{"version":1,"sha256Hash":"e780a6d8b921ef0c59ec01ea5c5255671272ca0d819edb61320914cf7a78b3ae"}}
```

> **Limitation** : Ne retourne que les jeux du compte authentifie (pas d'`accountId` en parametre). Pour les jeux d'un autre utilisateur, utiliser `getUserPlayedGames()`.

```typescript
import { getRecentlyPlayedGames } from "psn-api";

const recent = await getRecentlyPlayedGames(
  { accessToken: auth.accessToken },
  { limit: 10, categories: ["ps5_native_game"] }
);
// recent.data.gameLibraryTitlesRetrieve.games[0].name -> "Horizon Forbidden West"
// recent.data.gameLibraryTitlesRetrieve.games[0].lastPlayedDateTime -> "2023-03-10T01:01:01.390000Z"
// recent.data.gameLibraryTitlesRetrieve.games[0].platform -> "PS5"
```

---

#### `getPurchasedGames(authorization, options?)`

Recupere les jeux achetes par le compte authentifie.

| Parametre | Type | Description |
|-----------|------|-------------|
| `authorization` | `AuthorizationPayload` | `{ accessToken: string }` |
| `options?.isActive` | `boolean` | Defaut: `true` |
| `options?.platform` | `("ps4" \| "ps5")[]` | Defaut: `["ps4", "ps5"]` |
| `options?.size` | `number` | Taille de page. Defaut: `24` |
| `options?.start` | `number` | Decalage. Defaut: `0` |
| `options?.sortBy` | `"ACTIVE_DATE"` | Tri. Defaut: `"ACTIVE_DATE"` |
| `options?.sortDirection` | `"asc" \| "desc"` | Direction. Defaut: `"desc"` |
| `options?.membership` | `"NONE" \| "PS_PLUS"` | Filtre par type d'abonnement |

**Retour** : `Promise<PurchasedGamesResponse>`

**Endpoint** :
```
GET https://web.np.playstation.com/api/graphql/v1/op
  ?operationName=getPurchasedGameList
  &variables={"isActive":true,"platform":["ps4","ps5"],"size":24,"start":0,...}
  &extensions={"persistedQuery":{"version":1,"sha256Hash":"827a423f6a8ddca4107ac01395af2ec0eafd8396fc7fa204aaf9b7ed2eefa168"}}
```

> **Limitation** : Retourne uniquement les jeux PS4 et PS5. Pas de support PS3/Vita.

```typescript
import { getPurchasedGames } from "psn-api";

const purchased = await getPurchasedGames(
  { accessToken: auth.accessToken },
  { size: 50, platform: ["ps5"], membership: "NONE" }
);
// purchased.data.purchasedTitlesRetrieve.games[0].name     -> "God of War Ragnarok"
// purchased.data.purchasedTitlesRetrieve.games[0].titleId   -> "PPSA01411_00"
// purchased.data.purchasedTitlesRetrieve.games[0].platform  -> "PS5"
// purchased.data.purchasedTitlesRetrieve.games[0].membership -> "NONE"
```

### Hashes GraphQL

| Operation | Hash SHA256 |
|-----------|-------------|
| `getUserGameList` | `e780a6d8b921ef0c59ec01ea5c5255671272ca0d819edb61320914cf7a78b3ae` |
| `getPurchasedGameList` | `827a423f6a8ddca4107ac01395af2ec0eafd8396fc7fa204aaf9b7ed2eefa168` |

> Ces hashes sont reverse-engineered depuis `app-<hash>.js` charge par `library.playstation.com/recently-played`. Ils peuvent changer si Sony met a jour son frontend.

---

### 4.7 Utilitaires

#### `call(config, authorization, bodyPayload?)`

Fonction utilitaire de bas niveau pour effectuer des appels HTTP authentifies a l'API PSN.

| Parametre | Type | Description |
|-----------|------|-------------|
| `config.url` | `string` | URL complete de l'endpoint |
| `config.method` | `"GET" \| "POST"` | Defaut: `"GET"` |
| `config.headers` | `CallValidHeaders` | Headers additionnels |
| `authorization` | `AuthorizationPayload` | `{ accessToken: string }` |
| `bodyPayload` | `Record<string, any>` | Corps de la requete (pour POST) |

**Retour** : `Promise<T>` (generique)

> Utile pour appeler des endpoints non couverts par la bibliotheque (ex: endpoints non-documentes, endpoints legacy).

```typescript
import { call } from "psn-api";

// Exemple : appel direct a un endpoint custom
const response = await call<MonType>(
  {
    url: "https://m.np.playstation.com/api/some/custom/endpoint",
    method: "GET",
    headers: { "Accept-Language": "fr-FR" }
  },
  { accessToken: auth.accessToken }
);
```

**Headers envoyes automatiquement** :
```
Authorization: Bearer <accessToken>
Content-Type: application/json
```

---

#### `buildRequestUrl(baseUrl, endpointUrl, options?, args?)`

Construit une URL de requete avec substitution de parametres et query string.

```typescript
buildRequestUrl(
  "https://m.np.playstation.com/api/trophy",
  "/v1/users/:accountId/trophyTitles",
  { limit: 100 },
  { accountId: "me" }
);
// Resultat: "https://m.np.playstation.com/api/trophy/v1/users/me/trophyTitles?limit=100"
```

---

#### `extractRegionFromNpId(npId)`

Extrait le code region (ISO 3166-1 alpha-2) d'un npId encode en base64.

| Parametre | Type | Description |
|-----------|------|-------------|
| `npId` | `string` | L'npId encode en base64 |

**Retour** : `RegionCode | null` (ex: `"US"`, `"JP"`, `"GB"`)

**Fonctionnement** : Decode le base64, extrait la partie apres le `.` dans le format `user@xx.CC`.

---

## 5. Modeles et Types - Reference complete

### 5.1 Authentification

#### `AuthorizationPayload`
```typescript
interface AuthorizationPayload {
  accessToken: string;
}
```

#### `AuthTokensResponse`
```typescript
interface AuthTokensResponse {
  accessToken: string;           // Token pour les appels API
  expiresIn: number;             // Duree en secondes (~3600)
  idToken: string;               // Token d'identite JWT
  refreshToken: string;          // Token de rafraichissement
  refreshTokenExpiresIn: number; // Duree en secondes (~5184000 = 60 jours)
  scope: string;                 // "psn:mobile.v2.core psn:clientapp"
  tokenType: string;             // "bearer"
}
```

### 5.2 Options et Headers

#### `AllCallOptions`
```typescript
interface AllCallOptions {
  npServiceName: "trophy" | "trophy2"; // "trophy" pour PS3/PS4/Vita, "trophy2" pour PS5
  limit: number;                       // Nombre max d'entites retournees
  offset: number;                      // Point de depart (pagination)
  headerOverrides: CallValidHeaders;   // Headers personnalises
}
```

#### `CallValidHeaders`
```typescript
interface CallValidHeaders {
  "Accept-Language": string; // Ex: "fr-FR", "en-US", "ja"
}
```

### 5.3 Profil Utilisateur

#### `ProfileFromAccountIdResponse`
```typescript
interface ProfileFromAccountIdResponse {
  onlineId: string;                     // Ex: "Hakoom"
  aboutMe: string;                      // Bio de l'utilisateur
  avatars: Array<{
    size: string;                       // Ex: "s", "m", "l", "xl"
    url: string;                        // URL de l'avatar
  }>;
  languages: string[];                  // Langues utilisees
  isPlus: boolean;                      // Abonne PS Plus ?
  isOfficiallyVerified: boolean;        // Compte verifie ?
  isMe: boolean;                        // C'est le compte authentifie ?
}
```

#### `ProfileFromUserNameResponse` (Legacy)
```typescript
interface ProfileFromUserNameResponse {
  profile: {
    onlineId: string;                   // Nom d'utilisateur
    accountId: string;                  // Ex: "962157895908076652"
    npId: string;                       // NPID encode en base64
    avatarUrls: Array<{
      size: string;
      avatarUrl: string;
    }>;
    plus: 0 | 1;                        // 0 = non, 1 = oui (PS Plus)
    aboutMe: string;
    languagesUsed: string[];
    trophySummary: {
      level: number;
      progress: number;
      earnedTrophies: {
        bronze: number;
        silver: number;
        gold: number;
        platinum: number;
      };
    };
    isOfficiallyVerified: boolean;
    personalDetail: {
      firstName: string;
      lastName: string;
      profilePictureUrls: Array<{
        size: string;
        profilePictureUrl: string;
      }>;
    };
    personalDetailSharing: string;
    personalDetailSharingRequestMessageFlag: boolean;
    primaryOnlineStatus: string;        // Ex: "online", "offline"
    presences: Array<{
      onlineStatus: string;
      hasBroadcastData: boolean;
      lastOnlineDate: string;           // ISO 8601
    }>;
    friendRelation: string;             // Ex: "friend", "no"
    requestMessageFlag: boolean;
    blocking: boolean;                  // Bloque par le compte authentifie ?
    following: boolean;
    consoleAvailability: {
      availabilityStatus: string;
    };
  };
}
```

### 5.4 Amis

#### `GetUserFriendsAccountIdsResponse`
```typescript
interface GetUserFriendsAccountIdsResponse {
  friends: string[];          // Liste d'accountIds
  totalItemCount: number;     // Nombre total d'amis
  nextOffset?: number;        // Prochain offset (pagination)
  previousOffset?: number;    // Offset precedent
}
```

### 5.5 Presence

#### `BasicPresenceResponse`
```typescript
interface BasicPresenceResponse {
  basicPresence: {
    availability: "unavailable" | "availableToPlay";
    lastAvailableDate?: string;
    primaryPlatformInfo: {
      onlineStatus: "online" | "offline";
      platform: "ps4" | "PS5";
      lastOnlineDate: string;           // ISO 8601
    };
    lastOnlineDate?: string;
    onlineStatus?: "offline" | "online";
    platform?: "ps4" | "PS5";
    gameTitleInfoList: Array<{
      npTitleId: string;                // Ex: "PPSA01521_00"
      titleName: string;               // Ex: "Horizon Forbidden West"
      format: "ps4" | "PS5";
      launchPlatform: "ps4" | "PS5";
      npTitleIconUrl?: string;
      conceptIconUrl?: string;
    }>;
  };
}
```

### 5.6 Jeux Joues

#### `UserPlayedGamesResponse`
```typescript
interface UserPlayedGamesResponse {
  titles: Array<{
    titleId: string;              // Ex: "CUSA01433_00"
    name: string;                 // Ex: "Rocket League"
    localizedName: string;
    imageUrl: string;
    localizedImageUrl: string;
    category: string;             // "ps4_game" | "ps5_native_game" | "pspc_game" | "unknown"
    service: string;              // "none" | "none_purchased" | "ps_plus"
    playCount: number;
    concept: {
      id: number;                 // Concept ID (identifiant unique cross-platform)
      titleIds: string[];         // Tous les IDs de versions du jeu
      name: string;
      media: {
        audios: unknown[];
        videos: unknown[];
        images: Array<{
          url: string;
          format: string;         // Ex: "UNKNOWN"
          type: string;           // Ex: "FOUR_BY_THREE_BANNER"
        }>;
      };
    };
    media: {
      screenshotUrl?: string;
      [key: string]: string | undefined;
    };
    firstPlayedDateTime: string;  // ISO 8601
    lastPlayedDateTime: string;   // ISO 8601
    playDuration: string;         // Format ISO 8601 duration: "PT228H56M33S"
  }>;
  totalItemCount: number;
  nextOffset: number;
  previousOffset: number;
}
```

### 5.7 Appareils

#### `AccountDevicesResponse`
```typescript
interface AccountDevicesResponse {
  accountId: string;
  accountDevices: Array<{
    deviceId: string;
    deviceType: string;           // "PS5" | "PS4" | "PS3" | "PSVita"
    activationType: string;       // "PRIMARY" | "PSN_GAME_V3"
    activationDate: string;       // ISO 8601
    accountDeviceVector: string;
  }>;
}
```

### 5.8 Region

#### `UserRegionInfo`
```typescript
interface UserRegionInfo {
  code: RegionCode;     // Ex: "US", "JP", "FR"
  name?: string;        // Ex: "United States", "Japon", "France"
}
type RegionCode = `${Uppercase<string>}${Uppercase<string>}`; // 2 lettres majuscules
```

### 5.9 Lien Partageable

#### `ShareableProfileLinkResponse`
```typescript
interface ShareableProfileLinkResponse {
  shareUrl: string;                 // URL du profil partageable
  shareImageUrl: string;            // URL de l'image/QR code
  shareImageUrlDestination: string; // URL de destination du QR code
}
```

### 5.10 Trophees

#### `Trophy`
```typescript
interface Trophy {
  trophyId: number;                     // ID unique dans le titre
  trophyHidden: boolean;                // Trophee secret ?
  trophyType: TrophyType;              // "bronze" | "silver" | "gold" | "platinum"
  earned?: boolean;                     // Obtenu ?
  earnedDateTime?: string;              // Date d'obtention ISO 8601
  trophyDetail?: string;               // Description
  trophyEarnedRate?: string;           // % de joueurs ayant obtenu (ex: "23.5")
  trophyGroupId?: string;             // "default", "001", "002"...
  trophyIconUrl?: string;             // URL de l'icone
  trophyName?: string;                // Nom du trophee
  trophyProgressTargetValue?: string; // Cible de progression (PS5 uniquement)
  trophyRare?: TrophyRarity;          // Rarete
  trophyRewardImageUrl?: string;      // Image recompense (PS5 uniquement)
  trophyRewardName?: string;          // Nom recompense (PS5 uniquement)
}
```

#### `TrophyType`
```typescript
type TrophyType = "bronze" | "silver" | "gold" | "platinum";
```

#### `TrophyRarity` (enum)
```typescript
enum TrophyRarity {
  UltraRare = 0,   // < 5% des joueurs
  VeryRare = 1,    // 5-10%
  Rare = 2,        // 10-20%
  Common = 3       // > 20%
}
```

#### `TrophyCounts`
```typescript
interface TrophyCounts {
  bronze: number;
  silver: number;
  gold: number;
  platinum: 0 | 1;  // 0 ou 1 (un seul platine par jeu)
}
```

#### `TrophyTitle`
```typescript
interface TrophyTitle {
  npServiceName: "trophy" | "trophy2";
  npCommunicationId: string;            // Ex: "NPWR20188_00"
  trophySetVersion: string;
  trophyTitleName: string;
  trophyTitleIconUrl: string;
  trophyTitlePlatform: TitlePlatform | string; // "PS5", "PS4", "PS3", "Vita", ou "PS4,PSVITA"
  hasTrophyGroups: boolean;
  definedTrophies: TrophyCounts;
  progress: number;                     // 0-100
  earnedTrophies: TrophyCounts;
  hiddenFlag: boolean;                  // Cache sur la liste (compte authentifie seulement)
  lastUpdatedDateTime: string;          // ISO 8601
  trophyTitleDetail?: string;           // Legacy (PS3/PS4/Vita uniquement)
}
```

#### `TitlePlatform`
```typescript
type TitlePlatform = "PS5" | "PS4" | "PS3" | "Vita";
```

#### `TrophyGroup`
```typescript
interface TrophyGroup {
  trophyGroupId: string;      // "default", "001", "002"...
  trophyGroupName: string;    // Nom du groupe (ex: "ASTRO's PLAYROOM")
  trophyGroupIconUrl: string;
  definedTrophies: TrophyCounts;
  trophyGroupDetail?: string; // Legacy (PS3/PS4/Vita uniquement)
}
```

#### `TrophyGroupEarnings`
```typescript
interface TrophyGroupEarnings {
  trophyGroupId: string;
  progress: number;               // 0-100
  earnedTrophies: TrophyCounts;
  lastUpdatedDateTime: string;    // ISO 8601
}
```

### 5.11 Types "Thin" (sous-ensembles)

#### `TitleThinTrophy`
```typescript
type TitleThinTrophy = Pick<Trophy,
  "trophyId" | "trophyHidden" | "trophyType" | "trophyName" |
  "trophyDetail" | "trophyIconUrl" | "trophyGroupId"
>;
```

#### `UserThinTrophy`
```typescript
type UserThinTrophy = Pick<Trophy,
  "trophyId" | "trophyHidden" | "earned" | "earnedDateTime" |
  "trophyType" | "trophyRare" | "trophyEarnedRate" |
  "trophyProgressTargetValue" | "trophyRewardImageUrl" | "trophyRewardName"
>;
```

#### `RarestThinTrophy`
```typescript
type RarestThinTrophy = Pick<Trophy,
  "trophyId" | "trophyHidden" | "earned" | "trophyType" |
  "trophyRare" | "trophyEarnedRate"
>;
```

### 5.12 Reponses Trophees

#### `TitleTrophiesResponse`
```typescript
interface TitleTrophiesResponse {
  trophySetVersion: string;
  hasTrophyGroups: boolean;
  trophies: TitleThinTrophy[];
  totalItemCount: number;
  nextOffset?: number;
  previousOffset?: number;
}
```

#### `TitleTrophyGroupsResponse`
```typescript
interface TitleTrophyGroupsResponse {
  trophySetVersion: string;
  trophyTitleName: string;
  trophyTitleIconUrl: string;
  trophyTitlePlatform: string;
  definedTrophies: TrophyCounts;
  trophyGroups: TrophyGroup[];
  trophyTitleDetail?: string;  // Legacy PS3/PS4/Vita
}
```

#### `UserTitlesResponse`
```typescript
interface UserTitlesResponse {
  trophyTitles: TrophyTitle[];
  totalItemCount: number;
  nextOffset?: number;
  previousOffset?: number;
}
```

#### `UserTrophiesEarnedForTitleResponse`
```typescript
interface UserTrophiesEarnedForTitleResponse {
  trophySetVersion: string;
  hasTrophyGroups: boolean;
  lastUpdatedDateTime: string;
  trophies: UserThinTrophy[];
  totalItemCount: number;
  rarestTrophies?: RarestThinTrophy[];  // Le(s) trophee(s) le(s) plus rare(s) obtenu(s)
  nextOffset?: number;
  previousOffset?: number;
}
```

#### `UserTrophiesBySpecificTitleResponse`
```typescript
interface UserTrophiesBySpecificTitleResponse {
  titles: Array<{
    npTitleId: string;
    trophyTitles: TrophyTitle[];  // Uniquement si le compte a joue au titre
  }>;
}
```

#### `UserTrophyGroupEarningsForTitleResponse`
```typescript
interface UserTrophyGroupEarningsForTitleResponse {
  trophySetVersion: string;
  hiddenFlag: boolean;
  progress: number;
  earnedTrophies: TrophyCounts;
  trophyGroups: TrophyGroupEarnings[];
  lastUpdatedDateTime: string;
}
```

#### `UserTrophyProfileSummaryResponse`
```typescript
interface UserTrophyProfileSummaryResponse {
  accountId: string;
  trophyLevel: string;
  progress: number;
  tier: 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10;
  earnedTrophies: TrophyCounts;
}
```

### 5.13 Recherche

#### `UniversalSearchResponse<T>`
```typescript
interface UniversalSearchResponse<T> {
  prefix: string;
  suggestions: string[];
  fallbackQueried: boolean;
  domainResponses: UniversalSearchDomainResponse<T>[];
}
```

#### `UniversalSearchDomainResponse<T>`
```typescript
interface UniversalSearchDomainResponse<T> {
  domain: string;
  domainTitle: string;
  domainTitleMessageId: string;
  zeroState: boolean;
  univexId: string;
  facetOptions: unknown[];
  next: string;
  totalResultCount: number;
  results: T[];
}
```

#### `SocialAccountResult`
```typescript
interface SocialAccountResult {
  id: string;
  type: string;
  score: number;
  socialMetadata: {
    accountId: string;
    country: string;
    language: string;
    onlineId: string;
    isPsPlus: boolean;
    isOfficiallyVerified: boolean;
    avatarUrl: string;
    verifiedUserName: string;
    highlights: {
      onlineId: string[];  // Parties correspondantes du nom
    };
  };
}
```

#### `UniversalSearchDomains`
```typescript
type UniversalSearchDomains = "SocialAllAccounts";
```

### 5.14 GraphQL - Jeux

#### `RecentlyPlayedGame`
```typescript
interface RecentlyPlayedGame {
  __typename: "GameLibraryTitle";
  image: { __typename: "Media"; url: string };
  isActive: boolean | null;
  lastPlayedDateTime: string;           // ISO 8601
  name: string;
  platform: TitlePlatform | "UNKNOWN";  // "UNKNOWN" si partage de console
  productId: string | null;
  entitlementId: string | null;
  titleId: string;
  conceptId: string;
  subscriptionService: "NONE" | string;
}
```

#### `RecentlyPlayedGamesResponse`
```typescript
interface RecentlyPlayedGamesResponse {
  data: {
    gameLibraryTitlesRetrieve: {
      __typename: "GameList";
      games: RecentlyPlayedGame[];
    };
  };
}
```

#### `PurchasedGame`
```typescript
interface PurchasedGame {
  __typename: "GameLibraryTitle";
  conceptId: string | null;
  entitlementId: string;
  image: { __typename: "Media"; url: string };
  isActive: boolean;
  isDownloadable: boolean;
  isPreOrder: boolean;
  membership: Membership;         // "NONE" | "PS_PLUS"
  name: string;
  platform: TitlePlatform;
  productId: string;
  titleId: string;
}
```

#### `PurchasedGamesResponse`
```typescript
interface PurchasedGamesResponse {
  data: {
    purchasedTitlesRetrieve: {
      __typename: "GameList";
      games: PurchasedGame[];
    };
  };
}
```

#### `Membership`
```typescript
type Membership = "NONE" | "PS_PLUS";
```

---

## 6. Endpoints HTTP complets

### 6.1 Authentification

| Methode | URL | Usage |
|---------|-----|-------|
| GET | `https://ca.account.sony.com/api/v1/ssocookie` | Recuperer NPSSO (navigateur) |
| GET | `https://ca.account.sony.com/api/authz/v3/oauth/authorize?...` | NPSSO -> Access Code (302 redirect) |
| POST | `https://ca.account.sony.com/api/authz/v3/oauth/token` | Access Code -> Tokens |
| POST | `https://ca.account.sony.com/api/authz/v3/oauth/token` | Refresh Token -> Tokens |

### 6.2 Utilisateurs (API moderne)

| Methode | URL | Fonction |
|---------|-----|----------|
| GET | `.../userProfile/v1/internal/users/{accountId}/profiles` | `getProfileFromAccountId()` |
| GET | `.../userProfile/v1/internal/users/{accountId}/basicPresences?type=primary` | `getBasicPresence()` |
| GET | `.../userProfile/v1/internal/users/{accountId}/friends?limit=&offset=` | `getUserFriendsAccountIds()` |
| GET | `.../gamelist/v2/users/{accountId}/titles?limit=&offset=&categories=` | `getUserPlayedGames()` |
| GET | `.../cpss/v1/share/profile/{accountId}` | `getProfileShareableLink()` |
| GET | `https://dms.api.playstation.com/api/v1/devices/accounts/me?...` | `getAccountDevices()` |

### 6.3 Utilisateurs (API legacy)

| Methode | URL | Fonction |
|---------|-----|----------|
| GET | `https://us-prof.np.community.playstation.net/userProfile/v1/users/{userName}/profile2?fields=...` | `getProfileFromUserName()` |

> **profile2** est l'ancien endpoint de profil. Il retourne plus de donnees que l'API moderne (trophySummary, presences, friendRelation, blocking, personalDetail, etc.) mais fonctionne par nom d'utilisateur et non par accountId.

### 6.4 Trophees

| Methode | URL | Fonction |
|---------|-----|----------|
| GET | `.../trophy/v1/npCommunicationIds/{id}/trophyGroups/{groupId}/trophies?npServiceName=` | `getTitleTrophies()` |
| GET | `.../trophy/v1/npCommunicationIds/{id}/trophyGroups?npServiceName=` | `getTitleTrophyGroups()` |
| GET | `.../trophy/v1/users/{accountId}/trophyTitles?limit=&offset=` | `getUserTitles()` |
| GET | `.../trophy/v1/users/{accountId}/npCommunicationIds/{id}/trophyGroups/{groupId}/trophies?npServiceName=` | `getUserTrophiesEarnedForTitle()` |
| GET | `.../trophy/v1/users/{accountId}/titles/trophyTitles?npTitleIds=` | `getUserTrophiesForSpecificTitle()` |
| GET | `.../trophy/v1/users/{accountId}/npCommunicationIds/{id}/trophyGroups?npServiceName=` | `getUserTrophyGroupEarningsForTitle()` |
| GET | `.../trophy/v1/users/{accountId}/trophySummary` | `getUserTrophyProfileSummary()` |

### 6.5 Recherche

| Methode | URL | Fonction |
|---------|-----|----------|
| POST | `https://m.np.playstation.com/api/search/v1/universalSearch` | `makeUniversalSearch()` |

### 6.6 GraphQL

| Methode | URL | Operation | Fonction |
|---------|-----|-----------|----------|
| GET | `https://web.np.playstation.com/api/graphql/v1/op?operationName=getUserGameList&...` | `getUserGameList` | `getRecentlyPlayedGames()` |
| GET | `https://web.np.playstation.com/api/graphql/v1/op?operationName=getPurchasedGameList&...` | `getPurchasedGameList` | `getPurchasedGames()` |

---

## 7. Limites de taux (Rate Limits)

L'API PSN n'a pas de documentation officielle sur les limites de taux. Voici les informations connues de la communaute :

### 7.1 Limites observees

| Contexte | Limite estimee | Source |
|----------|---------------|--------|
| API Trophees (m.np.playstation.com) | ~300 requetes / 15 minutes | Observation communautaire |
| API Profil utilisateur | ~300 requetes / 15 minutes | Observation communautaire |
| API Recherche universelle | Plus restrictive (~100 req/15 min) | Observation communautaire |
| GraphQL (web.np.playstation.com) | Moins restrictive | Observation communautaire |
| API Legacy (us-prof.np.community) | Variable, peut etre tres restrictive | Observation communautaire |

### 7.2 Comportement en cas de depassement

- **Code HTTP 429** : "Too Many Requests" avec header `Retry-After`
- L'API peut aussi retourner un **HTTP 503** sous forte charge
- Apres un 429, attendre la duree indiquee par `Retry-After` (en secondes)
- Les bans temporaires durent generalement 15 minutes

### 7.3 Recommandations

1. **Espacer les requetes** : minimum 100ms entre chaque appel
2. **Utiliser un systeme de queue** : avec backoff exponentiel
3. **Mettre en cache** : les donnees qui changent rarement (profils, listes de trophees)
4. **Traiter par lots** : les listes d'amis et profils avec des pauses
5. **Surveiller les 429** : et implementer un retry automatique

---

## 8. Problemes connus et solutions

### 8.1 NPSSO expiration et erreurs

**Probleme** : Le NPSSO expire apres ~60 jours ou devient invalide.
**Solution** : Stocker le refresh token et l'utiliser via `exchangeRefreshTokenForAuthTokens()`. Ne repasser par le NPSSO que quand le refresh token expire aussi.

**Probleme** : "There was a problem retrieving your PSN access code" lors de l'echange NPSSO.
**Solutions** :
- Verifier que le NPSSO est bien de 64 caracteres
- Essayer un autre navigateur (probleme de cookies)
- Se reconnecter sur playstation.com avant de recuperer le NPSSO
- Le NPSSO a peut-etre expire

### 8.2 Recherche de son propre compte

**Probleme** : `makeUniversalSearch()` ne retourne pas votre propre compte dans les resultats.
**Solution** : Utiliser `"me"` comme `accountId` dans les fonctions qui l'acceptent.

### 8.3 npServiceName manquant pour PS3/PS4/Vita

**Probleme** : Erreur lors de l'interrogation des trophees d'un titre PS3/PS4/Vita.
**Solution** : Toujours passer `{ npServiceName: "trophy" }` dans les options pour ces plateformes. Pour PS5, utiliser `"trophy2"` ou ne rien passer (defaut).

### 8.4 Profil prive / Liste d'amis privee

**Probleme** : "Not permitted by access control" ou erreur similaire.
**Solution** : C'est normal si l'utilisateur a des parametres de confidentialite stricts. Il n'y a pas de contournement - respecter la vie privee de l'utilisateur.

### 8.5 Titre non joue

**Probleme** : "Resource Not Found" lors de l'interrogation des trophees d'un titre.
**Solution** : L'utilisateur n'a jamais lance le jeu ou n'a pas synchronise ses trophees. Verifier d'abord avec `getUserTitles()`.

### 8.6 Hashes GraphQL invalides

**Probleme** : Les endpoints GraphQL retournent des erreurs apres une mise a jour de Sony.
**Solution** : Les hashes SHA256 sont reverse-engineered. Si Sony modifie son frontend, ils peuvent changer. Mettre a jour le package `psn-api` ou trouver les nouveaux hashes via les DevTools du navigateur sur `library.playstation.com`.

### 8.7 Platform "UNKNOWN" dans les jeux recents

**Probleme** : `getRecentlyPlayedGames()` retourne `"UNKNOWN"` comme plateforme.
**Solution** : Cela se produit quand un autre utilisateur partage la meme console que le compte authentifie. Pas de correction possible.

### 8.8 Limite de 5 npTitleIds

**Probleme** : `getUserTrophiesForSpecificTitle()` retourne "Bad Request" avec plus de 5 IDs.
**Solution** : Decouper les requetes en lots de maximum 5 `npTitleIds` par appel.

### 8.9 getUserTitles() limite a 800 par appel

**Probleme** : Un joueur peut avoir plus de 800 jeux avec des trophees.
**Solution** : Utiliser la pagination avec `limit: 800` et incrementer `offset` de 800 a chaque appel jusqu'a atteindre `totalItemCount`.

---

## 9. Bonnes pratiques

### 9.1 Gestion des tokens

```typescript
// Stocker les tokens de maniere securisee
let currentAuth: AuthTokensResponse;
let tokenExpiresAt: number;

async function getValidAuth(): Promise<AuthorizationPayload> {
  if (Date.now() / 1000 > tokenExpiresAt - 60) {
    // Rafraichir 60 secondes avant expiration
    currentAuth = await exchangeRefreshTokenForAuthTokens(currentAuth.refreshToken);
    tokenExpiresAt = Date.now() / 1000 + currentAuth.expiresIn;
  }
  return { accessToken: currentAuth.accessToken };
}
```

### 9.2 Pagination

```typescript
// Recuperer TOUS les titres de trophees
async function getAllUserTitles(auth: AuthorizationPayload, accountId: string) {
  const allTitles: TrophyTitle[] = [];
  let offset = 0;
  const limit = 800;

  while (true) {
    const response = await getUserTitles(auth, accountId, { limit, offset });
    allTitles.push(...response.trophyTitles);

    if (!response.nextOffset || allTitles.length >= response.totalItemCount) {
      break;
    }
    offset = response.nextOffset;
  }

  return allTitles;
}
```

### 9.3 Rate limiting cote client

```typescript
// Simple delai entre les requetes
function delay(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Traitement sequentiel avec delai
for (const friendId of friends) {
  const profile = await getProfileFromAccountId(auth, friendId);
  // ... traitement
  await delay(150); // 150ms entre chaque requete
}
```

### 9.4 Combinaison trophees titre + utilisateur

Pour obtenir les trophees avec leurs noms ET le statut d'obtention, il faut combiner deux appels :

```typescript
// 1. Obtenir les metadonnees (noms, descriptions, icones)
const titleTrophies = await getTitleTrophies(auth, npCommunicationId, "all");

// 2. Obtenir le statut d'obtention
const userTrophies = await getUserTrophiesEarnedForTitle(auth, "me", npCommunicationId, "all");

// 3. Combiner
const combined = titleTrophies.trophies.map(titleTrophy => {
  const userTrophy = userTrophies.trophies.find(ut => ut.trophyId === titleTrophy.trophyId);
  return {
    ...titleTrophy,
    earned: userTrophy?.earned ?? false,
    earnedDateTime: userTrophy?.earnedDateTime
  };
});
```

### 9.5 Utiliser la fonction `call()` pour des endpoints non couverts

```typescript
import { call } from "psn-api";

// Exemple : endpoint non couvert nativement
const customData = await call<MonType>(
  { url: "https://m.np.playstation.com/api/custom/endpoint" },
  { accessToken: auth.accessToken }
);
```

---

## Annexe A : Correspondance npServiceName / Plateforme

| Plateforme | npServiceName | Requis ? |
|------------|--------------|----------|
| PS5 | `"trophy2"` | Non (defaut implicite) |
| PS4 | `"trophy"` | **Oui, obligatoire** |
| PS3 | `"trophy"` | **Oui, obligatoire** |
| PS Vita | `"trophy"` | **Oui, obligatoire** |

## Annexe B : Conventions d'identifiants PSN

| Type | Format | Exemple |
|------|--------|---------|
| `accountId` | Numerique (string) | `"962157895908076652"` |
| `onlineId` | Alphanum + tirets | `"Hakoom"` |
| `npCommunicationId` | `NPWR` + chiffres + `_00` | `"NPWR20188_00"` |
| `npTitleId` (PS4) | `CUSA` + chiffres + `_00` | `"CUSA01433_00"` |
| `npTitleId` (PS5) | `PPSA` + chiffres + `_00` | `"PPSA01521_00"` |
| `conceptId` | Numerique | `10009763` |
| `npsso` | 64 caracteres hex | `"a1b2c3..."` |

## Annexe C : Alias deprecies

| Ancien nom | Nouveau nom | Status |
|------------|-------------|--------|
| `exchangeNpssoForCode()` | `exchangeNpssoForAccessCode()` | Deprecie, sera supprime |
| `exchangeCodeForAccessToken()` | `exchangeAccessCodeForAuthTokens()` | Deprecie, sera supprime |
