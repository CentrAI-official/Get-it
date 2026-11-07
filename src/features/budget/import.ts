import { z } from "zod";
import type { BuiltInCategory } from "./categories";
import { isCategoryKey } from "./categories";
import { BUDGET_NOTE_MAX, parseSignedAmount } from "./rules";

// Importer le relevé de sa banque et exporter son budget, en CSV. Pas de connexion
// à la banque : le fichier est lu dans le navigateur, seules les lignes retenues
// partent au serveur. Chaque banque a son format (entêtes ou non, débit et crédit
// séparés, ordre des dates) : on le devine, et la personne corrige. Fonctions pures.

/** Lignes envoyées d'un coup, et lignes importées au plus par 24 heures. */
export const MAX_IMPORT_ROWS = 1000;
export const MAX_IMPORT_ROWS_PER_DAY = 5000;

/** Découpe un fichier CSV : séparateur deviné, guillemets, retours à la ligne. */
export function parseCsv(text: string): string[][] {
  const content = text.replace(/^﻿/, "");
  const delimiter = guessDelimiter(content);
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  const endCell = () => {
    row.push(cell.trim());
    cell = "";
  };
  const endRow = () => {
    endCell();
    if (row.some((value) => value !== "")) rows.push(row);
    row = [];
  };
  for (let index = 0; index < content.length; index++) {
    const char = content[index];
    if (quoted) {
      if (char === '"' && content[index + 1] === '"') {
        cell += '"';
        index += 1;
      } else if (char === '"') {
        quoted = false;
      } else {
        cell += char;
      }
    } else if (char === '"' && cell === "") {
      quoted = true;
    } else if (char === delimiter) {
      endCell();
    } else if (char === "\n") {
      endRow();
    } else if (char !== "\r") {
      cell += char;
    }
  }
  endRow();
  return rows;
}

function guessDelimiter(content: string) {
  const lines = content.split(/\r?\n/).filter(Boolean).slice(0, 8);
  let best = ",";
  let bestScore = 0;
  for (const delimiter of [",", ";", "\t", "|"]) {
    const counts = lines.map((line) => {
      let count = 0;
      let quoted = false;
      for (const char of line) {
        if (char === '"') quoted = !quoted;
        else if (char === delimiter && !quoted) count += 1;
      }
      return count;
    });
    // Le bon séparateur revient le même nombre de fois à chaque ligne
    const first = counts[0] ?? 0;
    const steady = counts.filter((count) => count === first).length;
    const score = first > 0 ? steady * 100 + first : 0;
    if (score > bestScore) {
      best = delimiter;
      bestScore = score;
    }
  }
  return best;
}

export const DATE_ORDERS = ["ymd", "dmy", "mdy"] as const;
export type DateOrder = (typeof DATE_ORDERS)[number];

/** Une date de relevé → « AAAA-MM-JJ » ; null si elle ne se lit pas ainsi. */
export function parseCsvDate(value: string, order: DateOrder): string | null {
  const parts = value
    .trim()
    .split(/[-/.\s]+/)
    .map(Number);
  if (parts.length < 3 || parts.some((part) => !Number.isInteger(part))) {
    return null;
  }
  const [a = 0, b = 0, c = 0] = parts;
  const [rawYear, month, day] =
    order === "ymd" ? [a, b, c] : order === "dmy" ? [c, b, a] : [c, a, b];
  const year = rawYear < 100 ? rawYear + 2000 : rawYear;
  if (month === undefined || day === undefined) return null;
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  const text = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  return z.iso.date().safeParse(text).success ? text : null;
}

/**
 * L'ordre des dates d'une colonne : celui qui les lit toutes. Si plusieurs le font
 * (« 11/03/2026 » : le 3 novembre ou le 11 mars?), celui qui donne les dates les plus
 * rapprochées : un relevé couvre quelques semaines.
 */
export function detectDateOrder(values: readonly string[]): DateOrder {
  let best: DateOrder = "ymd";
  let bestSpread = Number.POSITIVE_INFINITY;
  for (const order of DATE_ORDERS) {
    const days = values.map((value) => parseCsvDate(value, order));
    if (days.some((day) => day === null)) continue;
    const times = days.map((day) => new Date(`${day}T00:00:00Z`).getTime());
    const spread =
      times.length > 0 ? Math.max(...times) - Math.min(...times) : 0;
    if (spread < bestSpread) {
      best = order;
      bestSpread = spread;
    }
  }
  return best;
}

/** Colonnes du fichier, et comment lire les montants. */
export type CsvMapping = {
  hasHeader: boolean;
  date: number;
  description: number;
  /** Une seule colonne de montants, signés. */
  amount: number | null;
  /** Ou deux : ce qui sort et ce qui entre. */
  debit: number | null;
  credit: number | null;
  dateOrder: DateOrder;
  /** Sur certains relevés de carte, un achat est positif. */
  invert: boolean;
};

const clean = (value: string) =>
  value
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .trim();

const HEADERS = {
  date: /^(date|transaction date|posted date|date de transaction|date d.operation|date de l.operation)\b/,
  debit: /(debit|retrait|withdrawal|money out|sorties?)/,
  credit: /(credit|depot|deposit|money in|entrees?)/,
  amount: /(amount|montant|cad\$?$)/,
  description:
    /(description|libelle|details?|name|nom|memo|payee|beneficiaire|transaction)/,
};

/** Devine les colonnes : par leurs entêtes, sinon par ce qu'elles contiennent. */
export function guessMapping(rows: readonly string[][]): CsvMapping {
  const first = rows[0] ?? [];
  const width = Math.max(...rows.slice(0, 20).map((row) => row.length), 0);
  const find = (pattern: RegExp, skip: readonly number[] = []) => {
    const index = first.findIndex(
      (cell, position) => !skip.includes(position) && pattern.test(clean(cell)),
    );
    return index === -1 ? null : index;
  };
  const dateHeader = find(HEADERS.date);
  const body = rows.slice(dateHeader !== null ? 1 : 0, 40);
  const column = (index: number) => body.map((row) => row[index] ?? "");
  const isDateColumn = (index: number) => {
    const values = column(index).filter(Boolean);
    return (
      values.length > 0 &&
      values.some((value) =>
        DATE_ORDERS.some((order) => parseCsvDate(value, order) !== null),
      )
    );
  };

  if (dateHeader !== null) {
    const debit = find(HEADERS.debit, [dateHeader]);
    const credit = find(HEADERS.credit, [dateHeader]);
    const amount =
      debit !== null && credit !== null
        ? null
        : find(HEADERS.amount, [dateHeader]);
    const taken = [dateHeader, debit, credit, amount].filter(
      (value): value is number => value !== null,
    );
    return {
      hasHeader: true,
      date: dateHeader,
      description:
        find(HEADERS.description, taken) ??
        Array.from({ length: width }, (_, index) => index).find(
          (index) => !taken.includes(index),
        ) ??
        0,
      amount: amount ?? (debit === null || credit === null ? 0 : null),
      debit: amount === null ? debit : null,
      credit: amount === null ? credit : null,
      dateOrder: detectDateOrder(column(dateHeader).filter(Boolean)),
      invert: false,
    };
  }

  // Sans entêtes (TD, souvent Desjardins) : d'après ce que contient chaque colonne
  const indexes = Array.from({ length: width }, (_, index) => index);
  const date = indexes.find(isDateColumn) ?? 0;
  const numeric = indexes.filter(
    (index) =>
      index !== date &&
      column(index).some(Boolean) &&
      column(index)
        .filter(Boolean)
        .every((value) => parseSignedAmount(value) !== null),
  );
  const text = indexes.filter(
    (index) => index !== date && !numeric.includes(index),
  );
  const description =
    text.sort(
      (a, b) => column(b).join("").length - column(a).join("").length || a - b,
    )[0] ?? 0;
  const [firstNumber, secondNumber] = numeric;
  // Deux colonnes qui ne sont jamais remplies en même temps : ce qui sort, ce qui entre
  const separate =
    firstNumber !== undefined &&
    secondNumber !== undefined &&
    body.every((row) => !(row[firstNumber] && row[secondNumber]));
  return {
    hasHeader: false,
    date,
    description,
    amount: separate ? null : (firstNumber ?? null),
    debit: separate ? firstNumber : null,
    credit: separate ? secondNumber : null,
    dateOrder: detectDateOrder(column(date).filter(Boolean)),
    invert: false,
  };
}

/** Une ligne du relevé : `cents` est signé (une dépense est négative). */
export type ImportRow = {
  date: string;
  cents: number;
  description: string | null;
};

const abs = (value: string | undefined) => {
  const cents = value ? parseSignedAmount(value) : null;
  return cents === null ? null : Math.abs(cents);
};

/** Lit les lignes selon les colonnes choisies ; compte celles qui ne se lisent pas. */
export function readImportRows(
  rows: readonly string[][],
  mapping: CsvMapping,
): { rows: ImportRow[]; skipped: number } {
  const body = mapping.hasHeader ? rows.slice(1) : rows;
  const out: ImportRow[] = [];
  let skipped = 0;
  for (const row of body) {
    const date = parseCsvDate(row[mapping.date] ?? "", mapping.dateOrder);
    let cents: number | null = null;
    if (mapping.amount !== null) {
      const value = row[mapping.amount];
      cents = value ? parseSignedAmount(value) : null;
    } else {
      const debit = abs(
        mapping.debit !== null ? row[mapping.debit] : undefined,
      );
      const credit = abs(
        mapping.credit !== null ? row[mapping.credit] : undefined,
      );
      if (debit || credit) cents = (credit ?? 0) - (debit ?? 0);
    }
    if (!date || !cents) {
      skipped += 1;
      continue;
    }
    const description = (row[mapping.description] ?? "")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, BUDGET_NOTE_MAX);
    out.push({
      date,
      cents: mapping.invert ? -cents : cents,
      description: description || null,
    });
  }
  return { rows: out, skipped };
}

/** Le commerçant sans ses numéros : « IGA #8123 MONTRÉAL » → « iga montreal ». */
export function normalizeDescription(value: string) {
  return clean(value)
    .replace(/[^a-z\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Les commerces connus au Québec et au Canada, pour une première catégorie. */
const KEYWORDS: readonly [BuiltInCategory, RegExp][] = [
  [
    "groceries",
    /\b(iga|metro|maxi|provigo|super c|costco|adonis|loblaws|sobeys|no frills|food basics|avril|epicerie|grocery)\b/,
  ],
  [
    "restaurants",
    /\b(tim hortons|mcdonald s?|starbucks|a w|subway|uber eats|doordash|skip the dishes|skipthedishes|pizza|restaurant|resto|st hubert|harvey s?|presse cafe|cafe)\b/,
  ],
  [
    "transport",
    /\b(esso|petro canada|shell|ultramar|irving|couche tard|stm|rtc|exo|presto|lyft|uber|communauto|saaq|stationnement|parking)\b/,
  ],
  ["utilities", /\b(hydro quebec|hydro|energir|gaz metro|electricite)\b/],
  [
    "phone",
    /\b(videotron|bell|rogers|telus|fizz|koodo|virgin|public mobile|fido|cogeco)\b/,
  ],
  [
    "subscriptions",
    /\b(netflix|spotify|disney|crave|apple com bill|amazon prime|youtube premium|patreon|dropbox|icloud|abonnement)\b/,
  ],
  [
    "health",
    /\b(pharmaprix|jean coutu|familiprix|uniprix|shoppers|pharmacie|dentiste|clinique|optometriste)\b/,
  ],
  [
    "insurance",
    /\b(assurance|assurances|insurance|intact|belairdirect|la capitale|beneva)\b/,
  ],
  ["housing", /\b(loyer|rent|hypotheque|mortgage)\b/],
  [
    "leisure",
    /\b(saq|cineplex|cinema|steam|playstation|nintendo|gym|energie cardio)\b/,
  ],
  [
    "shopping",
    /\b(amazon|walmart|canadian tire|ikea|winners|simons|best buy|dollarama|renaud bray|sports experts)\b/,
  ],
  ["fees", /\b(frais|fee|fees|service charge)\b/],
  ["taxes", /\b(revenu quebec|arc|cra|receiver general|impot|impots)\b/],
  ["education", /\b(universite|cegep|college|ecole|tuition)\b/],
  ["travel", /\b(airbnb|air canada|westjet|porter|expedia|hotel|via rail)\b/],
];

/**
 * Une première catégorie pour une dépense : celle déjà choisie pour ce commerçant,
 * sinon d'après les commerces connus, sinon « Autre ». Tout reste modifiable.
 */
export function guessCategory(
  description: string | null,
  history: ReadonlyMap<string, string>,
): string {
  if (!description) return "other";
  const text = normalizeDescription(description);
  const known = history.get(text);
  if (known) return known;
  return KEYWORDS.find(([, pattern]) => pattern.test(text))?.[0] ?? "other";
}

/**
 * Ce qui identifie une ligne : le même fichier importé deux fois n'ajoute rien, et
 * deux cafés identiques le même jour restent deux lignes (`occurrence`).
 */
export function importIdentity(
  accountId: string | null,
  row: ImportRow,
  occurrence: number,
) {
  return [
    accountId ?? "",
    row.date,
    row.cents,
    normalizeDescription(row.description ?? ""),
    occurrence,
  ].join("|");
}

/** Numérote les lignes identiques d'un fichier (voir `importIdentity`). */
export function withOccurrences<Row extends ImportRow>(rows: readonly Row[]) {
  const seen = new Map<string, number>();
  return rows.map((row) => {
    const key = importIdentity(null, row, 0);
    const occurrence = seen.get(key) ?? 0;
    seen.set(key, occurrence + 1);
    return { row, occurrence };
  });
}

/** Ce que le navigateur envoie : revalidé ici, et par le serveur. */
export const importSchema = z.strictObject({
  accountId: z.uuid().nullable(),
  rows: z
    .array(
      z.strictObject({
        date: z.iso.date(),
        cents: z
          .number()
          .int()
          .min(-100_000_000)
          .max(100_000_000)
          .refine((value) => value !== 0),
        description: z.string().trim().max(BUDGET_NOTE_MAX).nullable(),
        category: z.string().refine(isCategoryKey),
      }),
    )
    .min(1)
    .max(MAX_IMPORT_ROWS),
});
export type ImportInput = z.output<typeof importSchema>;

/**
 * Une cellule CSV. Un tableur exécuterait une cellule qui commence par = + - ou @ :
 * on la neutralise, sauf un nombre (une dépense est négative).
 */
export function csvCell(value: string, delimiter: string) {
  const safe =
    /^[=+\-@\t\r]/.test(value) && !/^-?[\d\s .,]+$/.test(value)
      ? `'${value}`
      : value;
  return safe.includes(delimiter) || /["\n\r]/.test(safe)
    ? `"${safe.replace(/"/g, '""')}"`
    : safe;
}

/** Un fichier CSV lisible par Excel : `;` et la virgule décimale en français. */
export function toCsv(rows: readonly (readonly string[])[], locale: string) {
  const delimiter = locale === "fr" ? ";" : ",";
  const lines = rows.map((row) =>
    row.map((cell) => csvCell(cell, delimiter)).join(delimiter),
  );
  return `﻿${lines.join("\r\n")}\r\n`;
}
