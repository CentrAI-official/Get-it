// Lance l'application admin en développement (port 3001), à côté de `npm run dev` :
// APP_SURFACE=admin, et un dossier de build à part (deux `next dev` ne partagent pas .next).
import { spawn } from "node:child_process";

const child = spawn("npx", ["next", "dev", "-p", "3001"], {
  stdio: "inherit",
  shell: process.platform === "win32",
  env: { ...process.env, APP_SURFACE: "admin", NEXT_DIST_DIR: ".next-admin" },
});
child.on("exit", (code) => process.exit(code ?? 0));
