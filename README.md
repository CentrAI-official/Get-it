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
- [x] 9c. Navigation à cinq catégories : Communauté, Messagerie, Mes services, Marketplace, Profil
- [ ] 9d. Journal (dans Profil)
- [x] 9e. Messagerie (M1) : messages privés, demandes, réactions, cartes de progrès, modération
- [x] 9e2. Messagerie (M2) : Pactes (défis à deux)
- [x] 9f0. Photos et vidéos dans les publications
- [ ] 9f1. Groupes (création, fil, rôles)
- [ ] 9f2. Discussions de groupe (Messagerie)
- [ ] 9f3. Pactes à plusieurs
- [ ] 9f. Événements (proposés par les membres, approuvés par Get iT)
- [ ] 9g. Marketplace › Gear (vitrine, sans paiement dans l’application)
- [ ] 9h. Groupes
- [ ] 9i. Services : annuaire, réservations, Mes services, notes de session
- [ ] 10. Finitions, analytics et déploiement
