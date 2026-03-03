"use client";

import { ClerkProvider } from "@clerk/nextjs";
import { I18nProvider } from "@/lib/i18n";

export default function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ClerkProvider>
      <I18nProvider>{children}</I18nProvider>
    </ClerkProvider>
  );
}
