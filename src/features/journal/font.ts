import { Lora } from "next/font/google";

/** Police du journal : une page de carnet, distincte du reste de l'application. */
export const journalFont = Lora({
  subsets: ["latin"],
  style: ["normal", "italic"],
  display: "swap",
});
