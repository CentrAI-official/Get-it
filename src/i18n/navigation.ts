import { createNavigation } from "next-intl/navigation";
import { routing } from "./routing";

// Versions de Link, redirect, etc. qui conservent la langue courante dans l'URL
export const { Link, redirect, usePathname, useRouter, getPathname } =
  createNavigation(routing);
