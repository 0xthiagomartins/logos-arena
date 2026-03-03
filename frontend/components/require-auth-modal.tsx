"use client";

import { SignInButton, SignUpButton } from "@clerk/nextjs";
import { useI18n } from "@/lib/i18n";

type RequireAuthModalProps = {
  open: boolean;
  mandatory?: boolean;
  onClose?: () => void;
};

export default function RequireAuthModal({ open, mandatory = false, onClose }: RequireAuthModalProps) {
  const { t } = useI18n();
  if (!open) return null;

  return (
    <div className="modal-backdrop fixed inset-0 z-50 flex items-center justify-center bg-black/75 px-4">
      <div className="modal-panel w-full max-w-md rounded-xl border border-white/15 bg-matrix-black p-5 shadow-xl shadow-black/70">
        <h2 className="text-lg font-semibold text-white">{t("auth.required_title")}</h2>
        <p className="mt-2 text-sm leading-relaxed text-white/75">{t("auth.required_description")}</p>
        <div className="mt-5 grid gap-2 sm:grid-cols-2">
          <SignInButton mode="modal">
            <button
              type="button"
              className="rounded-md border border-white/15 bg-white/[0.04] px-3 py-2 text-sm font-semibold text-white transition hover:bg-white/[0.1]"
            >
              {t("auth.sign_in")}
            </button>
          </SignInButton>
          <SignUpButton mode="modal">
            <button
              type="button"
              className="rounded-md border border-matrix-green bg-matrix-green/15 px-3 py-2 text-sm font-semibold text-white transition hover:bg-matrix-green/25"
            >
              {t("auth.sign_up")}
            </button>
          </SignUpButton>
        </div>
        {!mandatory && onClose && (
          <div className="mt-3">
            <button
              type="button"
              onClick={onClose}
              className="text-xs text-white/70 underline transition hover:text-white"
            >
              {t("auth.cancel")}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
