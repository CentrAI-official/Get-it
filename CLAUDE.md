@AGENTS.md

# Get iT — guide de travail

Plateforme de développement personnel tout-en-un, organisée autour de quatre piliers : Physique, Mental, Social, Financier. Le document fondateur [docs/PRODUCT.md](docs/PRODUCT.md) fait foi pour la vision, le périmètre du MVP (§70) et l'ordre de construction (§89) : le relire avant toute nouvelle fonctionnalité.

## Façon de travailler

- Lire le code concerné avant de le modifier ; ne pas réécrire ce qui fonctionne par simple préférence.
- Classer chaque fonctionnalité en NOW / NEXT / LATER et garder le MVP minimal.
- Après une analyse, attendre la validation avant une refonte majeure ; expliquer avant d'ajouter une dépendance majeure.
- Signaler la dette technique et les risques produit plutôt qu'exécuter aveuglément.
- Communiquer en français. Code et identifiants en anglais, commentaires en français.

## Stack

- **Next.js 16.4** (App Router, Turbopack, Cache Components et Partial Prefetching activés). Les API diffèrent des versions précédentes : consulter `node_modules/next/dist/docs/` avant d'écrire du code Next.
- **TypeScript** strict, avec `noUncheckedIndexedAccess`.
- **Tailwind CSS v4** et **shadcn/ui** (Radix, style « nova »). Les primitives sont dans `src/components/ui` et s'ajoutent avec `npx shadcn@latest add <composant>`.
- **next-intl 4** (fr, en), avec la langue lue via `next/root-params`.
- **Prisma 7.10** : la config est dans `prisma7.config.ts` (nom imposé par cette version), le client est généré dans `src/generated/prisma`. La base est PostgreSQL sur Supabase.
- **Zod 4** pour la validation, **Vitest 5** pour les tests.

## Commandes

```bash
npm run dev          # serveur de développement
npm run dev:mobile   # idem, ouvert au réseau Wi-Fi local (tester sur un vrai téléphone)
npm run check        # lint + typecheck + tests (à lancer avant de conclure une tâche)
npm run build        # build de production (vérifie aussi le prérendu)
npm run format       # Prettier
npm run db:migrate   # nouvelle migration Prisma (nécessite DIRECT_URL)
npm run db:deploy    # applique les migrations existantes
npm run db:generate  # régénère le client Prisma (puis redémarrer npm run dev : le client est conservé entre les rechargements)
```

## Architecture

| Dossier                        | Rôle                                                                                        |
| ------------------------------ | ------------------------------------------------------------------------------------------- |
| `src/app/[locale]/(marketing)` | Site public                                                                                 |
| `src/app/[locale]/(app)`       | Application, réservée aux utilisateurs connectés (voir `src/features/auth/access.ts`)       |
| `src/app/[locale]/(auth)`      | Connexion, inscription, mot de passe oublié (écran divisé)                                  |
| `src/components/ui`            | Primitives shadcn                                                                           |
| `src/components`               | Composants partagés (layout, brand, empty-state, locale-switcher)                           |
| `src/features/<domaine>`       | Composants et schémas Zod d'un domaine                                                      |
| `src/server/<domaine>`         | Logique métier et autorisation (`server-only`), appelée par les Server Actions et `/api/v1` |
| `src/i18n`                     | Routage, configuration de requête et navigation localisée                                   |
| `src/config`                   | Constantes produit (piliers, site)                                                          |
| `messages/`                    | Textes de l'interface (`fr.json` est la langue source)                                      |

La logique métier ne vit jamais dans les composants : le web et la future app mobile (Expo) appelleront les mêmes services de `src/server`.

## Règles

- **Textes** : aucun texte en dur dans les composants. Chaque clé existe dans `messages/fr.json` **et** `messages/en.json` (un test vérifie la parité). Les arguments numériques s'écrivent `{n, number}`, les pluriels `{n, plural, …}`. En français, utiliser l'apostrophe typographique ’ et une espace insécable avant « : ».
- **Liens internes** : utiliser `Link`, `redirect` et `useRouter` de `@/i18n/navigation`, pas ceux de `next/link`, pour conserver la langue.
- **Composants** : Server Components par défaut ; `"use client"` uniquement pour l'interactivité. Les `id` de formulaire passent par `useId()` : Next garde la page précédente cachée dans le DOM, des `id` fixes y seraient dupliqués. Un Server Component ne passe à un Client Component que des valeurs sérialisables (jamais une icône ou une fonction ; seules les Server Actions font exception).
- **Cache Components** : pas de `new Date()`, `Date.now()` ni `Math.random()` dans un Server Component sans `io()` (de `next/cache`) ou `"use cache"`. Les données propres à l'utilisateur vont dans un `<Suspense>`. `error.tsx` reçoit `retry()`. `usePathname`, `useSearchParams` et `params` suspendent sur les routes à paramètre dynamique (ex. `/goals/[id]`) : les isoler dans un `<Suspense>` (voir la barre latérale), ou lire l'adresse au moment de l'action.
- **Sécurité** : valider toute entrée côté serveur avec Zod, vérifier l'autorisation sur chaque ressource et ne jamais faire confiance au client. Les données passent uniquement par `src/server/db.ts`, jamais du navigateur vers Supabase. Activer le RLS (sans policy) sur toutes les tables pour que la clé publique Supabase n'expose rien : chaque migration qui crée une table ajoute `ALTER TABLE … ENABLE ROW LEVEL SECURITY` (un test le vérifie).
- **Authentification** : Supabase Auth sert uniquement à la session (`src/server/supabase`). Le proxy ne fait qu'une redirection rapide ; chaque service et chaque Server Action revérifie la session avec `requireUser()` (`src/server/auth/session.ts`). Une nouvelle section de l'app s'ajoute à `PROTECTED_PATHS`. `next/root-params` est indisponible dans les Server Actions : les formulaires envoient la langue dans un champ caché `locale`.
- **Utilisateur courant** : les pages lisent le profil avec `getCurrentProfile()` (`src/server/profile/service.ts`), dans un `<Suspense>`. Les services reçoivent toujours l'`userId` de la session, jamais du client, et nomment les colonnes écrites (jamais `data: { ...input }` : l'entrée validée contient aussi la langue). Tant que `onboardedAt` est vide, l'utilisateur est renvoyé vers `/onboarding`. Toute nouvelle table liée à l'utilisateur référence `profiles` avec `onDelete: Cascade`, pour que la suppression de compte (`src/server/account/service.ts`) efface tout.
- **Base de données** : modèles en PascalCase, tables et colonnes en snake_case (`@@map`/`@map`), dates en `timestamptz`, jours du calendrier (échéance, date cible) en `@db.Date` via `src/lib/dates.ts`, formatés avec `timeZone: "UTC"`. Les champs « jour » (habitudes, séries) dépendent du fuseau de l'utilisateur (`UserSettings.timeZone`).
- **XP** : le barème, la limite quotidienne de tâches et la courbe des niveaux vivent dans `src/features/xp/rules.ts` (fonctions pures testées). Toute action qui rapporte de l'XP l'écrit dans `xp_events` **dans la même transaction** que l'action (`src/server/xp/service.ts`) ; chaque ligne pointe vers son action (clé étrangère en cascade), donc annuler ou supprimer l'action retire son XP. Une nouvelle source d'XP ajoute une valeur à l'enum `XpSource`, sa colonne et la contrainte `xp_events_source_check`.
- **Get iT AI** : tout passe par la couche d'abstraction `src/server/ai` (`types.ts`) ; le SDK d'Anthropic n'est importé que dans `claude.ts` (modèle, effort, repli `fallbacks: "default"`). La clé `ANTHROPIC_API_KEY` reste côté serveur (jamais `NEXT_PUBLIC_`, `env.ts` le refuse). Aucun appel sans l'accord de l'utilisateur (`UserSettings.aiConsentAt`, Loi 25). Chaque appel réserve d'abord une ligne `ai_requests` (limite de 20 par jour, jetons enregistrés pour suivre le coût). Les consignes sont dans `src/features/coach/prompts.ts`, le contexte envoyé est résumé et borné dans `src/features/coach/context.ts` (jamais l'historique brut). Les réponses s'affichent sans HTML injecté (`message-format.ts`). Le coach peut **proposer** des ajouts (objectif, habitude, tâche, jalon) avec les outils `propose_*` de `src/features/coach/coach-tools.ts` : chaque appel est revalidé (`parseToolCall`), enregistré dans `coach_actions` et affiché en carte ; rien n'est créé avant le clic « Ajouter », qui passe par les services habituels (`src/server/coach/actions.ts`, une seule décision par proposition). Ne jamais donner au modèle un outil qui modifie les données sans confirmation. Pour les tests de bout en bout : `AI_PROVIDER=fake` (réponses factices, refusé en production).
- **Centre Get iT** : les limites et schémas vivent dans `src/features/community/rules.ts`, la logique dans `src/server/community` (fil, publications, membres, modération). Il faut un nom d'utilisateur et les règles acceptées (`UserSettings.communityRulesAt`) avant de participer ; un compte suspendu (`Profile.suspendedUntil`) lit mais ne publie, ne commente ni ne réagit. Objectifs, habitudes et check-ins restent privés : seul un progrès choisi est partagé, figé au moment du partage (`posts.progress`), à partir d'une référence revérifiée par le serveur (jamais le texte du navigateur). Chaque lecture exclut les personnes bloquées dans les deux sens (`getBlockedIds`). Trois signalements de personnes différentes masquent un contenu en attendant la modération ; les décisions revérifient le rôle (`Profile.role`) et retrouvent l'auteur en base. Aucune XP pour l'activité sociale.
- **Messagerie** : règles et limites dans `src/features/messages/rules.ts` (fonctions pures testées : `sendPermission`, `layoutMessages`), logique dans `src/server/messages/service.ts`. Conversations privées entre membres du Centre, une seule par paire (`directKey`). Le premier message d'une personne inconnue arrive comme une **demande** : un seul message avant l'acceptation ; refuser la retire sans prévenir l'expéditeur. Chaque fonction revérifie la participation et les blocages (dans les deux sens). Pas de « Vu » ni de « En ligne » : `lastReadAt` ne sert qu'aux non-lus. Les messages ne sont jamais envoyés à Get iT AI ; un message signalé n'est visible par la modération que lui seul. Pas encore de temps réel : la conversation ouverte se rafraîchit toutes les 3 secondes, la boîte toutes les 10, la pastille toutes les 30 (`UnreadPoller`). **Pactes** (défi à deux) : règles pures dans `src/features/messages/pacts.ts` (`pactProgress`, `pactNeed`, `pactOutcome`), logique dans `src/server/messages/pacts.ts`. Un seul pacte ouvert par conversation (index unique partiel) ; chacun relie une habitude dont seul le « fait / pas fait » est partagé ; le pacte commence le lendemain de l'accord ; un jour manqué ne casse que la série commune ; la fin est réglée à l'ouverture de la conversation (`settlePacts`, pas de tâche planifiée) ; quitter montre seulement « Le pacte est terminé ». Les étapes (proposition, fin, arrêt) sont des messages `kind: "pact"` affichés selon l'état du pacte. Pas d'XP en plus : l'habitude en rapporte déjà.
- **Navigation** : cinq catégories dans `src/components/layout/nav-items.ts` : Communauté (accueil, `APP_HOME_PATH` ; regroupe Groupes, Événements, Modération), Messagerie, Mes services (au centre de la barre du bas), Marketplace (onglets Gear et Services), Profil (regroupe `/profile`, `/goals`, `/habits`, `/settings`, avec les sous-onglets `ProfileTabs`). Les boutons du haut changent selon la catégorie (`categoryActions`) : Get iT AI partout, Réglages seulement dans Profil ; la langue et la déconnexion sont dans Réglages. Pas de bouton « + » : on crée depuis la section concernée. « Ma journée » (`src/features/today/components/day-panel.tsx`) est monté une fois dans la mise en page de l'application : il s'ouvre tout seul à la première visite du jour (`UserSettings.dayPanelSeenOn`), puis depuis la carte du Profil (`openDayPanel()`). Il renvoie aussi vers l'onboarding tant qu'il n'est pas terminé. Une section en construction utilise `ComingSoon`.
- **Design** : les tokens sont dans `src/app/globals.css`. L'orange (`--primary`) est réservé aux actions, à la progression, à la sélection et au focus. Chaque écran gère les états chargement, vide, erreur et succès, est responsive (sans défilement horizontal à 390 px) et accessible au clavier.
