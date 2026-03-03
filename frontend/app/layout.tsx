import type { Metadata } from "next";
import { JetBrains_Mono } from "next/font/google";
import Providers from "@/components/providers";
import Topbar from "@/components/topbar";
import "./globals.css";

const jetbrainsMono = JetBrains_Mono({
  weight: ["400", "700"],
  subsets: ["latin"],
  variable: "--font-jetbrains-mono",
});

export const metadata: Metadata = {
  title: "LogosArena",
  description: "Debates estruturados com IA — cypherpunk & grego",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR" className={jetbrainsMono.variable}>
      <body className="min-h-screen bg-matrix-black text-matrix-green font-mono">
        <Providers>
          <Topbar />
          {children}
        </Providers>
      </body>
    </html>
  );
}
