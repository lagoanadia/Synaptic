import { Caveat, Fraunces } from "next/font/google";

// The landing's serif titles and handwriting (also used by the error pages).
export const lndSerif = Fraunces({ subsets: ["latin"], weight: ["700", "800"], variable: "--font-lnd-serif" });
export const lndHand = Caveat({ subsets: ["latin"], weight: ["600"], variable: "--font-lnd-hand" });
