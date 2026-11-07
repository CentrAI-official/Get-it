import { z } from "zod";
import { isCategoryKey } from "./categories";
import { ENTRY_KINDS, type EntryKind } from "./rules";

// Les filtres de la liste des transactions, lus dans l'adresse. Fonctions pures.

export const TRANSACTIONS_STEP = 100;
export const TRANSACTIONS_MAX = 2000;

export type TransactionFilters = {
  q: string | null;
  category: string | null;
  type: EntryKind | null;
  account: string | null;
  /** « AAAA-MM » ; null : tout l'historique. */
  month: string | null;
  limit: number;
};

const uuid = z.uuid();
const text = (value: unknown) =>
  typeof value === "string" ? value.trim() : "";

/** Lit les filtres de l'adresse : ce qui n'est pas valide est simplement ignoré. */
export function parseTransactionFilters(
  params: Record<string, string | string[] | undefined>,
): TransactionFilters {
  const q = text(params.q).slice(0, 80);
  const category = text(params.cat);
  const type = text(params.type);
  const account = text(params.account);
  const month = text(params.month);
  const limit = Number(text(params.limit));
  return {
    q: q || null,
    category: isCategoryKey(category) ? category : null,
    type: ENTRY_KINDS.find((kind) => kind === type) ?? null,
    account: uuid.safeParse(account).success ? account : null,
    month: /^\d{4}-(0[1-9]|1[0-2])$/.test(month) ? month : null,
    limit:
      Number.isInteger(limit) && limit > 0
        ? Math.min(limit, TRANSACTIONS_MAX)
        : TRANSACTIONS_STEP,
  };
}
