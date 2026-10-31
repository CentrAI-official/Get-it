// Présence en ligne : le petit rond orange sur la photo des contacts, comme le
// rond vert d'Instagram et de Facebook. Vue par les contacts seulement, et
// réciproque : qui cache la sienne ne voit pas celle des autres.

/** En ligne : vu dans les 2 dernières minutes. */
export const ONLINE_WINDOW_MS = 2 * 60 * 1000;
/** La dernière activité s'écrit au plus une fois par minute. */
export const PRESENCE_TOUCH_MS = 60 * 1000;

/** Vrai si la personne est en ligne pour quelqu'un qui montre aussi la sienne. */
export function isOnline(
  person: { lastSeenAt: Date | null; showPresence: boolean },
  viewerShows: boolean,
  now: Date,
) {
  return (
    viewerShows &&
    person.showPresence &&
    person.lastSeenAt !== null &&
    now.getTime() - person.lastSeenAt.getTime() <= ONLINE_WINDOW_MS
  );
}
