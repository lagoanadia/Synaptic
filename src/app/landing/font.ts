import { Plus_Jakarta_Sans } from "next/font/google";

// Scoped to the landing page only — the rest of the app keeps Work Sans
// (see globals.css's --font-sans), this is deliberately a different,
// bolder marketing typeface, not a site-wide change.
export const plusJakarta = Plus_Jakarta_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
});
