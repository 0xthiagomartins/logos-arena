"use client";

import { createContext, useContext, useEffect, useMemo, useState } from "react";

export type AppLanguage = "pt-BR" | "en";

type I18nContextValue = {
  language: AppLanguage;
  setLanguage: (lang: AppLanguage) => void;
  t: (key: string) => string;
};

const STORAGE_KEY = "logosarena:language";

const DICTIONARY: Record<AppLanguage, Record<string, string>> = {
  "pt-BR": {
    "nav.home": "Home",
    "nav.gallery": "Galeria",
    "nav.language": "Idioma",
    "nav.login": "Logar",
    "nav.signup": "Cadastrar",
    "nav.auth_disabled": "Auth será habilitado com Clerk",
    "home.title": "LogosArena",
    "home.subtitle":
      "Debates estruturados com IA, rounds rastreáveis e mediação explicável em um fluxo claro: criar, acompanhar, concluir.",
    "home.new_debate": "Novo debate",
    "home.my_debates": "Meus debates",
    "home.engine": "debate engine",
    "gallery.title": "Galeria",
    "gallery.subtitle_loading": "Carregando debates...",
    "gallery.subtitle_ready": "Explore debates públicos e os seus debates locais.",
    "gallery.new_debate": "Novo debate",
    "gallery.my_section": "Minha galeria",
    "gallery.public_section": "Galeria pública",
    "gallery.empty_my": "Você ainda não criou debates neste navegador.",
    "gallery.empty_public": "Nenhum debate público disponível no momento.",
    "gallery.empty_all": "Nenhum debate disponível.",
    "status.completed": "Concluído",
    "status.running": "Em andamento",
    "status.failed": "Falhou",
    "status.draft": "Rascunho",
  },
  en: {
    "nav.home": "Home",
    "nav.gallery": "Gallery",
    "nav.language": "Language",
    "nav.login": "Log in",
    "nav.signup": "Sign up",
    "nav.auth_disabled": "Auth will be enabled with Clerk",
    "home.title": "LogosArena",
    "home.subtitle":
      "Structured AI debates with traceable rounds and explainable mediation in a clear flow: create, follow, conclude.",
    "home.new_debate": "New debate",
    "home.my_debates": "My debates",
    "home.engine": "debate engine",
    "gallery.title": "Gallery",
    "gallery.subtitle_loading": "Loading debates...",
    "gallery.subtitle_ready": "Explore public debates and your local debates.",
    "gallery.new_debate": "New debate",
    "gallery.my_section": "My gallery",
    "gallery.public_section": "Public gallery",
    "gallery.empty_my": "You haven't created debates in this browser yet.",
    "gallery.empty_public": "No public debates available right now.",
    "gallery.empty_all": "No debates available.",
    "status.completed": "Completed",
    "status.running": "Running",
    "status.failed": "Failed",
    "status.draft": "Draft",
  },
};

const I18nContext = createContext<I18nContextValue | null>(null);

export function I18nProvider({ children }: { children: React.ReactNode }) {
  const [language, setLanguageState] = useState<AppLanguage>("pt-BR");

  useEffect(() => {
    const saved = window.localStorage.getItem(STORAGE_KEY);
    if (saved === "pt-BR" || saved === "en") {
      setLanguageState(saved);
    }
  }, []);

  const value = useMemo<I18nContextValue>(() => {
    const setLanguage = (lang: AppLanguage) => {
      setLanguageState(lang);
      window.localStorage.setItem(STORAGE_KEY, lang);
    };

    const t = (key: string) => {
      return DICTIONARY[language][key] ?? key;
    };

    return { language, setLanguage, t };
  }, [language]);

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n() {
  const ctx = useContext(I18nContext);
  if (!ctx) {
    throw new Error("useI18n must be used within I18nProvider");
  }
  return ctx;
}

