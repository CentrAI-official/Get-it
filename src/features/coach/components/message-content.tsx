import { Fragment } from "react";
import { parseMessage, type InlinePart } from "../message-format";

function Inline({ parts }: { parts: InlinePart[] }) {
  return parts.map((part, index) =>
    part.bold ? (
      <strong key={index} className="font-semibold text-foreground">
        {part.text}
      </strong>
    ) : (
      <Fragment key={index}>{part.text}</Fragment>
    ),
  );
}

/** Réponse de Get iT AI mise en forme (paragraphes, listes, gras). */
export function MessageContent({ text }: { text: string }) {
  return (
    <div className="flex flex-col gap-2.5 text-pretty break-words">
      {parseMessage(text).map((block, index) => {
        if (block.type === "paragraph") {
          return (
            <p key={index}>
              {block.lines.map((line, lineIndex) => (
                <Fragment key={lineIndex}>
                  {lineIndex > 0 ? <br /> : null}
                  <Inline parts={line} />
                </Fragment>
              ))}
            </p>
          );
        }
        const List = block.type === "bullets" ? "ul" : "ol";
        return (
          <List
            key={index}
            className={
              block.type === "bullets"
                ? "flex list-disc flex-col gap-1 pl-5 marker:text-muted-foreground"
                : "flex list-decimal flex-col gap-1 pl-5 marker:text-muted-foreground"
            }
          >
            {block.items.map((item, itemIndex) => (
              <li key={itemIndex}>
                <Inline parts={item} />
              </li>
            ))}
          </List>
        );
      })}
    </div>
  );
}
