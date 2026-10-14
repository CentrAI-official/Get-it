// Mise en forme des réponses de Get iT AI : paragraphes, listes à puces ou
// numérotées et gras (**…**). Le texte n'est jamais interprété comme du HTML.

export type InlinePart = { text: string; bold: boolean };

export type MessageBlock =
  | { type: "paragraph"; lines: InlinePart[][] }
  | { type: "bullets"; items: InlinePart[][] }
  | { type: "numbered"; items: InlinePart[][] };

const BULLET = /^\s*[-*•]\s+(.*)$/;
const NUMBERED = /^\s*\d+[.)]\s+(.*)$/;
const HEADING = /^\s*#{1,6}\s+(.*)$/;

/** « Fais **ceci** » → [« Fais », « ceci » en gras]. */
export function parseInline(text: string): InlinePart[] {
  return text
    .split(/(\*\*[^*]+\*\*)/)
    .filter((part) => part !== "")
    .map((part) =>
      part.startsWith("**") && part.endsWith("**") && part.length > 4
        ? { text: part.slice(2, -2), bold: true }
        : { text: part, bold: false },
    );
}

/** Découpe une réponse en blocs ; un titre (# …) devient une ligne en gras. */
export function parseMessage(text: string): MessageBlock[] {
  const blocks: MessageBlock[] = [];
  // Une ligne vide termine le bloc en cours
  let continuing = false;

  for (const raw of text.replace(/\r\n/g, "\n").split("\n")) {
    if (raw.trim() === "") {
      continuing = false;
      continue;
    }
    const last = continuing ? blocks.at(-1) : undefined;
    continuing = true;
    const bullet = raw.match(BULLET);
    const numbered = raw.match(NUMBERED);

    if (bullet || numbered) {
      const type = bullet ? "bullets" : "numbered";
      const item = parseInline((bullet ?? numbered)?.[1] ?? "");
      if (last && last.type === type) last.items.push(item);
      else blocks.push({ type, items: [item] });
      continue;
    }

    const heading = raw.match(HEADING);
    const line = heading
      ? [{ text: heading[1] ?? "", bold: true }]
      : parseInline(raw.trim());
    if (last && last.type === "paragraph") last.lines.push(line);
    else blocks.push({ type: "paragraph", lines: [line] });
  }
  return blocks;
}
