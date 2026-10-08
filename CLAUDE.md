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
npm run check        # lint + typecheck + tests (à lancer avant de conclure une tâche)
npm run build        # build de production (vérifie aussi le prérendu)
npm run format       # Prettier
npm run db:migrate   # nouvelle migration Prisma (nécessite DIRECT_URL)
npm run db:deploy    # applique les migrations existantes
npm run db:generate  # régénère le client Prisma
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
- **Composants** : Server Components par défaut ; `"use client"` uniquement pour l'interactivité.
- **Cache Components** : pas de `new Date()`, `Date.now()` ni `Math.random()` dans un Server Component sans `io()` (de `next/cache`) ou `"use cache"`. Les données propres à l'utilisateur vont dans un `<Suspense>`. `error.tsx` reçoit `retry()`.
- **Sécurité** : valider toute entrée côté serveur avec Zod, vérifier l'autorisation sur chaque ressource et ne jamais faire confiance au client. Les données passent uniquement par `src/server/db.ts`, jamais du navigateur vers Supabase. Activer le RLS (sans policy) sur toutes les tables pour que la clé publique Supabase n'expose rien : chaque migration qui crée une table ajoute `ALTER TABLE … ENABLE ROW LEVEL SECURITY` (un test le vérifie).
- **Authentification** : Supabase Auth sert uniquement à la session (`src/server/supabase`). Le proxy ne fait qu'une redirection rapide ; chaque service et chaque Server Action revérifie la session avec `requireUser()` (`src/server/auth/session.ts`). Une nouvelle section de l'app s'ajoute à `PROTECTED_PATHS`. `next/root-params` est indisponible dans les Server Actions : les formulaires envoient la langue dans un champ caché `locale`.
- **Utilisateur courant** : les pages lisent le profil avec `getCurrentProfile()` (`src/server/profile/service.ts`), dans un `<Suspense>`. Les services reçoivent toujours l'`userId` de la session, jamais du client. Tant que `onboardedAt` est vide, l'utilisateur est renvoyé vers `/onboarding`. Toute nouvelle table liée à l'utilisateur référence `profiles` avec `onDelete: Cascade`, pour que la suppression de compte (`src/server/account/service.ts`) efface tout.
- **Base de données** : modèles en PascalCase, tables et colonnes en snake_case (`@@map`/`@map`), dates en `timestamptz`. Les champs « jour » (habitudes, séries) dépendent du fuseau de l'utilisateur (`UserSettings.timeZone`).
- **Design** : les tokens sont dans `src/app/globals.css`. L'orange (`--primary`) est réservé aux actions, à la progression, à la sélection et au focus. Chaque écran gère les états chargement, vide, erreur et succès, est responsive (sans défilement horizontal à 390 px) et accessible au clavier.
