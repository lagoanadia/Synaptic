"use client";

import { createContext, useContext } from "react";
import { LOCALE, makeT, type Lang } from "@/lib/i18n";

const LangContext = createContext<Lang>("es");

// The app's language for client components (set from the cookie in the layout).
export function LangProvider({ lang, children }: { lang: Lang; children: React.ReactNode }) {
  return <LangContext.Provider value={lang}>{children}</LangContext.Provider>;
}

export const useLang = () => useContext(LangContext);
export const useT = () => makeT(useContext(LangContext));
export const useLocale = () => LOCALE[useContext(LangContext)];
