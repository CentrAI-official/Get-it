import { useSyncExternalStore, useTransition } from "react";
import { setReactionAction } from "./actions";

// « Bravo » donné depuis le fil ou depuis la visionneuse des progrès du jour :
// une seule valeur par publication, pour que les deux affichent la même chose.

export type Reaction = { on: boolean; count: number };

const overrides = new Map<string, Reaction>();
const listeners = new Set<() => void>();

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function setReaction(postId: string, reaction: Reaction) {
  overrides.set(postId, reaction);
  for (const listener of listeners) listener();
}

/**
 * « Bravo » d'une publication : la dernière valeur choisie dans la page, sinon
 * celle du serveur. `setBravo` l'affiche tout de suite, puis l'enregistre (et
 * revient en arrière si le serveur refuse).
 */
export function useBravo(post: {
  id: string;
  reacted: boolean;
  reactions: number;
}) {
  const override = useSyncExternalStore(
    subscribe,
    () => overrides.get(post.id),
    () => undefined,
  );
  const reaction = override ?? { on: post.reacted, count: post.reactions };
  const [, startTransition] = useTransition();

  function setBravo(next: boolean) {
    if (next === reaction.on) return;
    const previous = reaction;
    setReaction(post.id, {
      on: next,
      count: reaction.count + (next ? 1 : -1),
    });
    startTransition(async () => {
      const result = await setReactionAction(post.id, next);
      if (!result.ok) setReaction(post.id, previous);
    });
  }

  return { reaction, setBravo };
}
