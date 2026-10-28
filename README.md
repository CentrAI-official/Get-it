# Get iT

> Si tu le veux, tu peux l’avoir.

Get iT transforme les objectifs d’une personne en plans, en actions quotidiennes et en progrès mesurables, sur quatre piliers : physique, mental, social et financier. La vision complète est décrite dans [docs/PRODUCT.md](docs/PRODUCT.md).

## Prérequis

- Node.js 24 ou plus récent
- Un projet [Supabase](https://supabase.com) (base PostgreSQL et authentification)

## Démarrage

```bash
npm install                 # installe les dépendances et génère le client Prisma
cp .env.example .env.local  # puis remplir les valeurs
npm run dev                 # http://localhost:3000
```

Le site détecte la langue du navigateur et redirige vers `/fr` ou `/en`. Le choix fait avec le sélecteur de langue est mémorisé un an, et enregistré dans le compte de l’utilisateur connecté.

## Configuration de Supabase

1. Créer un projet Supabase, de préférence dans la région Canada (Central).
2. Remplir `.env.local` à partir de `.env.example`. La clé à utiliser est la clé **publiable** (`sb_publishable_…`), jamais la clé secrète.
3. Dans Authentication → URL Configuration :
   - Site URL : `http://localhost:3000` (puis l’URL de production) ;
   - Redirect URLs : ajouter `http://localhost:3000/**`.
4. Créer les tables : `npm run db:deploy`.
5. Recommandé, pour que les liens reçus par courriel fonctionnent sur n’importe quel appareil : dans Authentication → Emails, remplacer `{{ .ConfirmationURL }}` par :
   - modèle « Confirm signup » : `{{ .RedirectTo }}&token_hash={{ .TokenHash }}&type=email` ;
   - modèle « Reset password » : `{{ .RedirectTo }}&token_hash={{ .TokenHash }}&type=recovery`.

Sans cette étape, le lien fonctionne seulement dans le navigateur où la demande a été faite.

Le service de courriel intégré à Supabase n’envoie qu’aux membres de l’équipe du projet, quelques fois par heure. Un fournisseur SMTP sera nécessaire avant d’ouvrir les inscriptions au public.

## Mise en ligne (Vercel)

La version de test est hébergée sur [Vercel](https://vercel.com) (plan Pro : le plan gratuit est réservé à un usage non commercial), dans la région de Montréal (`yul1`, voir `vercel.json`), à côté de la base Supabase. Chaque envoi sur la branche `main` du dépôt GitHub est mis en ligne automatiquement.

1. Sur Vercel : **Add New → Project**, importer le dépôt GitHub (framework Next.js détecté, aucune commande à changer).
2. Dans **Settings → Environment Variables**, ajouter les variables de `.env.local` : `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `DATABASE_URL`, `DIRECT_URL`, `SUPABASE_SECRET_KEY`, `ANTHROPIC_API_KEY`, et `SIGNUP_INVITE_CODE` (le code donné aux testeurs). Ne jamais mettre `AI_PROVIDER=fake` (refusé en production). `NEXT_PUBLIC_APP_URL` peut rester vide : l'adresse de production `…vercel.app` du projet est utilisée (`VERCEL_PROJECT_PRODUCTION_URL`, fournie par Vercel), y compris dans les liens des courriels.
3. Dans Supabase, **Authentication → URL Configuration** : **Site URL** = l'adresse Vercel (`https://<projet>.vercel.app`), et ajouter `https://<projet>.vercel.app/**` dans **Redirect URLs** en gardant `http://localhost:3000/**` pour le développement. Une adresse absente de cette liste est remplacée par la Site URL : les liens « mot de passe oublié » et de confirmation mèneraient ailleurs.
4. Les migrations ne sont pas appliquées par Vercel : `npm run db:deploy` depuis un poste de développement, **puis** envoyer le code qui les utilise (la base est partagée avec le développement pendant la bêta).

Changer une variable sur Vercel demande un nouveau déploiement (**Deployments → Redeploy**).

## Scripts

| Commande                      | Rôle                                  |
| ----------------------------- | ------------------------------------- |
| `npm run dev`                 | Serveur de développement              |
| `npm run build` / `npm start` | Build et serveur de production        |
| `npm run check`               | Lint, vérification des types et tests |
| `npm run format`              | Formate le code avec Prettier         |
| `npm run db:migrate`          | Crée et applique une migration Prisma |
| `npm run db:deploy`           | Applique les migrations existantes    |
| `npm run db:studio`           | Explore la base de données            |

## Structure

```
docs/PRODUCT.md           document fondateur du produit
messages/                 textes de l’interface (fr, en)
prisma/schema.prisma      schéma de la base de données
src/app/[locale]/         pages : (marketing) site public, (auth) connexion, (app) application
src/components/           composants partagés et primitives shadcn/ui (ui/)
src/features/             composants par domaine
src/server/               logique serveur (base de données, session, services)
src/i18n/                 configuration des langues
```

## Feuille de route du MVP

- [x] 1. Fondation : stack, design system, langues, mises en page, base de données
- [x] 2. Authentification (Supabase)
- [x] 3. Onboarding et profil
- [x] 4. Objectifs, jalons et tâches
- [x] 5. Habitudes et séries
- [x] 6. Page Aujourd’hui et check-in quotidien
- [x] 7. XP, niveaux et progression
- [x] 8. Get iT AI
- [x] 9. Centre Get iT : fil social de base et modération
- [x] 9b. Réorganisation : Communauté en accueil, popup « Ma journée », Profil (objectifs, habitudes, progression)
- [x] 9c. Navigation à cinq catégories : Communauté, Messagerie, Mon développement (anciennement Mes services), Marketplace, Profil
- [x] 9d. Journal (dans Profil) : une page par jour en texte libre, check-in du jour, photos et vidéo, récap de la semaine et du mois
- [x] 9d2. Profil public : photo, courte présentation, nombre de contacts, onglet Publications
- [x] 9d3. Mode Ranked (lot 1) : niveaux physique et financier classés de 1 à 100 (tests et questions), comparés au Canada et aux États-Unis par tranche d’âge ; niveaux privés sans Ranked
- [x] 9d3b. Objectifs (3 par pilier, photo), habitudes (filtre, tri, couleurs), publications (enregistrer, partager, envoyer, lien)
- [ ] 9d4. Mode Ranked (lot 2) : connexion des réseaux sociaux pour la vérification
- [x] 9e. Messagerie (M1) : messages privés, demandes, réactions, cartes de progrès, modération
- [x] 9e2. Messagerie (M2) : Pactes (défis à deux)
- [x] 9f0. Photos et vidéos dans les publications
- [x] 9f0b. Contacts (amis) : demandes, liste privée, écrire sans demande
- [x] 9f1. Groupes : forums publics (par pilier ou généraux), rôles créateur et admins
- [x] 9f2. Discussions de groupe privées (Messagerie, sur invitation)
- [x] 9f2b. Photos et vidéos dans les messages privés
- [x] 9f2c. Renseignements du compte (date de naissance, sexe, région), Ranked avec taille, poids et IMC, Gear « bientôt »
- [x] 9f2d. Mode clair et sombre (au choix dans Réglages, gardé dans le compte), typographie Inter et Anton
- [ ] 9f3. Pactes à plusieurs
- [ ] 9f. Événements (proposés par les membres, approuvés par Get iT)
- [x] 9g1. Marketplace (lot 1) : comptes affiliés, catalogue Services et Gear, filtres, formulaire de vente, approbation par l’équipe Get iT
- [ ] 9g2. Paiement dans l’application (Stripe Connect : commission ou abonnement des vendeurs)
- [ ] 9g3. Avis et vérification des affiliés
- [x] 9i1. Mon développement : plans personnalisés par Get iT AI (entraînement, mental, social, financier, entreprise)
- [x] 9i1b. Calendriers : principal (tout) et par plan (séances, tâches, habitudes, objectifs)
- [x] 9i1c. Modifier un plan avec ses propres mots ; description du projet dans le plan d’entreprise
- [ ] 9i2. Mon développement : suivi par un professionnel (rendez-vous, notes de session)
- [ ] 10. Finitions, analytics et déploiement
