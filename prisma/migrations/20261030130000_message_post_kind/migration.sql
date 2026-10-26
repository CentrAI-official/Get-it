-- Message qui partage une publication du Centre. Valeur ajoutée dans sa propre
-- migration : Postgres refuse une valeur d'enum utilisée dans la transaction
-- qui l'ajoute (voir 20261030140000_post_saves_shares).
ALTER TYPE "MessageKind" ADD VALUE 'post';
