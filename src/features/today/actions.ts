"use server";

import { refresh } from "next/cache";
import { toCalendarDay } from "@/lib/dates";
import { requireUser } from "@/server/auth/session";
import { saveCheckIn } from "@/server/check-ins/service";
import { getUserTimeZone } from "@/server/profile/service";
import { checkInSchema, type CheckInState } from "./schemas";

/** Enregistre le check-in du jour. Le jour est calculé ici, dans le fuseau de l'utilisateur. */
export async function saveCheckInAction(
  _previous: CheckInState,
  formData: FormData,
): Promise<CheckInState> {
  const user = await requireUser();
  const parsed = checkInSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { status: "error", error: "incomplete" };

  try {
    const timeZone = await getUserTimeZone(user.id);
    await saveCheckIn(
      user.id,
      toCalendarDay(new Date(), timeZone),
      parsed.data,
    );
  } catch (error) {
    console.error("Enregistrement du check-in impossible", error);
    return { status: "error", error: "unexpected" };
  }
  refresh();
  return { status: "success" };
}
