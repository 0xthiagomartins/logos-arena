"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { SignInButton, SignUpButton, SignedIn, SignedOut, UserButton } from "@clerk/nextjs";
import { useI18n, type AppLanguage } from "@/lib/i18n";

export default function Topbar() {
  const pathname = usePathname();
  const { language, setLanguage, t } = useI18n();
  const [languageMenuOpen, setLanguageMenuOpen] = useState(false);
  const languageMenuRef = useRef<HTMLDivElement | null>(null);

  const navLinkClass = (href: string) =>
    [
      "rounded-md border px-3 py-1.5 text-sm transition",
      pathname === href
        ? "border-matrix-green/70 bg-matrix-green/10 text-white"
        : "border-white/15 bg-white/[0.03] text-white/85 hover:bg-white/[0.08]",
    ].join(" ");

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (!languageMenuRef.current) return;
      if (!languageMenuRef.current.contains(event.target as Node)) {
        setLanguageMenuOpen(false);
      }
    }

    function handleEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setLanguageMenuOpen(false);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleEscape);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleEscape);
    };
  }, []);

  const currentLanguageLabel = language === "pt-BR" ? "PT-BR" : "EN";
  const currentLanguageFlag = language === "pt-BR" ? "/flags/br.svg" : "/flags/us.svg";

  return (
    <header className="sticky top-0 z-40 border-b border-white/10 bg-matrix-black/85 backdrop-blur-md">
      <div className="mx-auto flex w-full max-w-6xl flex-wrap items-center justify-between gap-3 px-3 py-3 sm:px-4 md:px-6">
        <div className="flex items-center gap-2">
          <Link href="/" className={navLinkClass("/")}>
            {t("nav.home")}
          </Link>
          <Link href="/debates" className={navLinkClass("/debates")}>
            {t("nav.gallery")}
          </Link>
        </div>

        <div className="flex items-center gap-2">
          <div className="relative" ref={languageMenuRef}>
            <button
              type="button"
              onClick={() => setLanguageMenuOpen((prev) => !prev)}
              aria-haspopup="menu"
              aria-expanded={languageMenuOpen}
              aria-label="Selecionar idioma"
              className="flex w-[105px] items-center justify-between rounded-md border border-white/15 bg-white/[0.03] px-2.5 py-1.5 text-xs text-white/90 transition hover:bg-white/[0.08] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-matrix-green/70"
            >
              <span className="flex items-center gap-2">
                <img src={currentLanguageFlag} alt="" className="h-3.5 w-5 rounded-[2px] object-cover" />
                <span>{currentLanguageLabel}</span>
              </span>
              <span className="text-[10px] text-white/60">{languageMenuOpen ? "▲" : "▼"}</span>
            </button>

            {languageMenuOpen && (
              <div
                role="menu"
                className="absolute right-0 z-50 mt-1.5 w-[105px] rounded-md border border-white/15 bg-matrix-black/95 p-1 shadow-lg shadow-black/50"
              >
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    setLanguage("pt-BR" as AppLanguage);
                    setLanguageMenuOpen(false);
                  }}
                  className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-xs text-white/90 transition hover:bg-white/[0.08]"
                >
                  <img src="/flags/br.svg" alt="" className="h-3.5 w-5 rounded-[2px] object-cover" />
                  <span>PT-BR</span>
                </button>
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    setLanguage("en" as AppLanguage);
                    setLanguageMenuOpen(false);
                  }}
                  className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-xs text-white/90 transition hover:bg-white/[0.08]"
                >
                  <img src="/flags/us.svg" alt="" className="h-3.5 w-5 rounded-[2px] object-cover" />
                  <span>EN</span>
                </button>
              </div>
            )}
          </div>

          <SignedOut>
            <SignInButton mode="modal">
              <button
                type="button"
                className="w-[96px] rounded-md border border-white/15 bg-white/[0.03] px-3 py-1.5 text-center text-sm text-white/85 transition hover:bg-white/[0.08]"
              >
                {t("nav.login")}
              </button>
            </SignInButton>
            <SignUpButton mode="modal">
              <button
                type="button"
                className="w-[96px] rounded-md border border-matrix-green/60 bg-matrix-green/10 px-3 py-1.5 text-center text-sm text-white transition hover:bg-matrix-green/20"
              >
                {t("nav.signup")}
              </button>
            </SignUpButton>
          </SignedOut>
          <SignedIn>
            <div className="flex items-center justify-center">
              <UserButton
                afterSignOutUrl="/"
                appearance={{
                  elements: {
                    userButtonAvatarBox: "h-8 w-8",
                    userButtonTrigger:
                      "rounded-full p-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-matrix-green/70",
                  },
                }}
              />
            </div>
          </SignedIn>
        </div>
      </div>
    </header>
  );
}
