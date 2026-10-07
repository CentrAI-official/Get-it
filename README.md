# Get iT

> Si tu le veux, tu peux l’avoir.

Get iT transforme les objectifs d’une personne en plans, en actions quotidiennes et en progrès mesurables, sur quatre piliers : physique, mental, social et financier. La vision complète est décrite dans [docs/PRODUCT.md](docs/PRODUCT.md).

## Prérequis

- Node.js 24 ou plus récent
- Un projet [Supabase](https://supabase.com) (base PostgreSQL et authentification), nécessaire à partir de l’étape Auth

## Démarrage

```bash
npm install                 # installe les dépendances et génère le client Prisma
cp .env.example .env.local  # puis remplir les valeurs
npm run dev                 # http://localhost:3000
```

Le site détecte la langue du navigateur et redirige vers `/fr` ou `/en`. Le choix fait avec le sélecteur de langue est mémorisé un an.

## Scripts

| Commande                      | Rôle                                  |
| ----------------------------- | ------------------------------------- |
| `npm run dev`                 | Serveur de développement              |
| `npm run build` / `npm start` | Build et serveur de production        |
| `npm run check`               | Lint, vérification des types et tests |
| `npm run format`              | Formate le code avec Prettier         |
| `npm run db:migrate`          | Crée et applique une migration Prisma |
| `npm run db:studio`           | Explore la base de données            |

## Structure

```
docs/PRODUCT.md           document fondateur du produit
messages/                 textes de l’interface (fr, en)
prisma/schema.prisma      schéma de la base de données
src/app/[locale]/         pages : (marketing) site public, (app) application
src/components/           composants partagés et primitives shadcn/ui (ui/)
src/features/             composants par domaine
src/server/               logique serveur (base de données, environnement)
src/i18n/                 configuration des langues
```

## Feuille de route du MVP

- [x] 1. Fondation : stack, design system, langues, mises en page, base de données
- [ ] 2. Authentification (Supabase)
- [ ] 3. Onboarding et profil
- [ ] 4. Objectifs, jalons et tâches
- [ ] 5. Habitudes et séries
- [ ] 6. Page Aujourd’hui et check-in quotidien
- [ ] 7. XP, niveaux et progression
- [ ] 8. Get iT AI
- [ ] 9. Fil social de base et modération
- [ ] 10. Finitions, analytics et déploiement
