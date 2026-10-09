-- CreateTable
CREATE TABLE "daily_check_ins" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "day" DATE NOT NULL,
    "mood" SMALLINT NOT NULL,
    "energy" SMALLINT NOT NULL,
    "stress" SMALLINT NOT NULL,
    "sleep" SMALLINT NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "daily_check_ins_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "daily_check_ins_user_id_day_key" ON "daily_check_ins"("user_id", "day");

-- AddForeignKey
ALTER TABLE "daily_check_ins" ADD CONSTRAINT "daily_check_ins_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Notes de 1 à 5, garanties aussi par la base
ALTER TABLE "daily_check_ins" ADD CONSTRAINT "daily_check_ins_scores_check" CHECK (
  "mood" BETWEEN 1 AND 5 AND "energy" BETWEEN 1 AND 5 AND "stress" BETWEEN 1 AND 5 AND "sleep" BETWEEN 1 AND 5
);

-- Sécurité : RLS sans policy, comme toutes les tables (voir 20261007200000_init)
ALTER TABLE "daily_check_ins" ENABLE ROW LEVEL SECURITY;
