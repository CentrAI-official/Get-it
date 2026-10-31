// Abonnements, comme Instagram : on suit un membre sans qu'il ait à accepter.
// Contacts = amis (réciproques) ; abonnés = ceux qui suivent la page ;
// abonnements = les comptes que l'on suit. Le fil « Abonnements » en dépend.

/** Nouveaux abonnements par 24 heures (anti-abus). */
export const DAILY_FOLLOW_LIMIT = 200;
/** Personnes montrées au plus dans une liste d'abonnés ou d'abonnements. */
export const FOLLOW_LIST_SIZE = 200;

export const FOLLOW_LISTS = ["followers", "following"] as const;
export type FollowList = (typeof FOLLOW_LISTS)[number];

export type FollowError =
  | "notFound"
  | "self"
  | "notJoined"
  | "suspended"
  | "followLimit"
  | "unexpected";
