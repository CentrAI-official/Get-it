import "server-only";
import { after } from "next/server";
import type { AdminAuditAction } from "@/features/analytics/rules";
import { db } from "@/server/db";
import { requireAdmin } from "./auth";

// Journal des accès de l'application admin : chaque connexion et chaque page
// consultée, avec la personne de l'équipe. Visible dans « Accès ».

/** Inscrit un accès ; ne fait jamais échouer la page ni l'action. */
export async function logAdminAccess(
  adminId: string,
  action: AdminAuditAction,
  page: string | null = null,
) {
  try {
    await db.adminAuditEntry.create({ data: { adminId, action, page } });
  } catch (error) {
    console.error("Accès admin non inscrit au journal", error);
  }
}

/** Pages du dashboard, inscrites au journal quand on les ouvre. */
export const ADMIN_PAGES = [
  "overview",
  "sections",
  "features",
  "results",
  "retention",
  "content",
  "ai",
  "feedback",
  "errors",
  "audit",
] as const;
export type AdminPage = (typeof ADMIN_PAGES)[number];

/** Exige un membre de l'équipe et inscrit la consultation de la page au journal. */
export async function openAdminPage(page: AdminPage) {
  const admin = await requireAdmin();
  after(() => logAdminAccess(admin.id, "view", page));
  return admin;
}

export type AuditEntry = {
  id: string;
  at: Date;
  action: AdminAuditAction;
  page: string | null;
  admin: string;
};

/** Les 200 derniers accès, du plus récent au plus ancien. */
export async function listAuditEntries(): Promise<AuditEntry[]> {
  await requireAdmin();
  const entries = await db.adminAuditEntry.findMany({
    orderBy: { createdAt: "desc" },
    take: 200,
    select: {
      id: true,
      createdAt: true,
      action: true,
      page: true,
      admin: { select: { displayName: true, username: true } },
    },
  });
  return entries.map((entry) => ({
    id: entry.id,
    at: entry.createdAt,
    action: entry.action as AdminAuditAction,
    page: entry.page,
    admin: entry.admin.displayName ?? entry.admin.username ?? "—",
  }));
}
