"use client";

import { ClerkProvider } from "@clerk/nextjs";
import { enUS, ptBR } from "@clerk/localizations";
import { I18nProvider, useI18n } from "@/lib/i18n";

function ThemedClerkProvider({ children }: { children: React.ReactNode }) {
  const { language } = useI18n();
  const localization = language === "pt-BR" ? ptBR : enUS;

  return (
    <ClerkProvider
      key={language}
      localization={localization}
      appearance={{
        variables: {
          colorPrimary: "#00ff41",
          colorBackground: "#060606",
          colorInputBackground: "#0c0c0c",
          colorInputText: "#f5f5f5",
          colorText: "#f5f5f5",
          colorTextSecondary: "#b8c0cc",
          colorDanger: "#f87171",
          borderRadius: "0.75rem",
          fontFamily: "var(--font-jetbrains-mono)",
        },
        elements: {
          rootBox: "font-mono",
          cardBox: "rounded-2xl",
          card: "rounded-2xl border border-white/15 bg-gradient-to-b from-white/[0.07] to-white/[0.03] shadow-2xl shadow-black/70 backdrop-blur-sm",
          headerTitle: "text-white text-xl font-bold",
          headerSubtitle: "text-white/75",
          formFieldLabel: "text-white/85",
          formFieldInput:
            "bg-matrix-black border border-white/25 text-white placeholder:text-white/45 focus:border-matrix-green focus:ring-2 focus:ring-matrix-green/70",
          formFieldInputShowPasswordButton: "text-white/70 hover:text-white",
          formButtonPrimary:
            "bg-matrix-green/15 border border-matrix-green text-white hover:bg-matrix-green/25 hover:text-white shadow-[0_0_0_1px_rgba(0,255,65,0.15)]",
          formButtonReset:
            "border border-white/25 bg-white/[0.04] text-white/90 hover:bg-white/[0.1] hover:text-white",
          formButtonSecondary:
            "border border-white/25 bg-white/[0.04] text-white/90 hover:bg-white/[0.1] hover:text-white",
          footerActionText: "text-white/75",
          footerActionLink: "text-matrix-green hover:text-white underline-offset-2",
          socialButtonsBlockButton:
            "bg-white/[0.04] border border-white/15 text-white hover:bg-white/[0.08]",
          socialButtonsProviderIcon:
            "h-8 w-8 rounded-full bg-white/85 p-1.5 text-black shadow-[0_0_0_1px_rgba(255,255,255,0.25)]",
          dividerLine: "bg-white/20",
          dividerText: "text-white/70",
          modalBackdrop: "bg-black/80 backdrop-blur-[2px]",
          modalContent:
            "rounded-2xl border border-white/15 bg-gradient-to-b from-white/[0.07] to-white/[0.03] backdrop-blur-sm",
          modalCloseButton: "text-white/75 hover:text-white hover:bg-white/[0.08]",
          identityPreviewText: "text-white",
          identityPreviewEditButton: "text-matrix-green hover:text-white",
          formResendCodeLink: "text-matrix-green hover:text-white",
          otpCodeFieldInput:
            "bg-matrix-black border border-white/25 text-white focus:border-matrix-green focus:ring-2 focus:ring-matrix-green/70",
          alertText: "text-red-300",
          alert: "border border-red-400/40 bg-red-900/20 text-red-200",
          navbar: "border-b border-white/10 bg-white/[0.02]",
          navbarButton: "text-white/80 hover:text-white hover:bg-white/[0.08]",
          pageScrollBox: "bg-transparent",
          page: "bg-transparent",
          profileSectionTitleText: "text-white",
          profileSectionPrimaryButton:
            "text-matrix-green hover:text-white hover:bg-white/[0.06] rounded-md px-2 py-1",
          avatarImageActionsUpload:
            "border border-white/25 bg-white/[0.04] text-white/90 hover:bg-white/[0.1] hover:text-white",
          avatarImageActionsRemove:
            "border border-red-400/60 bg-red-900/20 text-red-200 hover:bg-red-900/35",
          avatarImageActionsUploadButton:
            "border border-white/25 bg-white/[0.04] text-white/90 hover:bg-white/[0.1] hover:text-white",
          avatarImageActionsRemoveButton:
            "border border-red-400/60 bg-red-900/20 text-red-200 hover:bg-red-900/35",
          userButtonPopoverCard:
            "rounded-2xl border border-white/15 bg-gradient-to-b from-white/[0.07] to-white/[0.03] shadow-2xl shadow-black/80 backdrop-blur-sm",
          userButtonPopoverMainIdentifier: "!text-white",
          userButtonPopoverSecondaryIdentifier: "!text-white/75",
          userButtonPopoverActions: "bg-transparent p-1",
          userButtonPopoverActionButton:
            "text-white hover:bg-white/[0.12] focus:bg-white/[0.12] focus:outline-none rounded-md",
          userButtonPopoverActionButtonText: "!text-white",
          userButtonPopoverActionButtonIcon: "!text-white/85",
          userButtonPopoverFooter: "border-t border-white/15 bg-white/[0.04]",
          userPreviewMainIdentifier: "!text-white",
          userPreviewSecondaryIdentifier: "!text-white/75",
          userPreviewTextContainer: "text-white",
        },
      }}
    >
      {children}
    </ClerkProvider>
  );
}

export default function Providers({ children }: { children: React.ReactNode }) {
  return (
    <I18nProvider>
      <ThemedClerkProvider>{children}</ThemedClerkProvider>
    </I18nProvider>
  );
}
