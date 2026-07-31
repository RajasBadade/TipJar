import type { Metadata } from "next";
import "./globals.css";
import { Providers } from "@/components/Providers";
import { Nav } from "@/components/Nav";

export const metadata: Metadata = {
  title: "TipJar — Every tip, permanently receipted",
  description:
    "Send XLM tips directly to creators on Stellar. No platform, no cut, no middleman — just a public, permanent ledger.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <head>
        {/*
          Loaded via a standard <link> tag rather than next/font/google so
          fonts fetch at runtime in the browser instead of at build time.
          Swap this for next/font/google once you have network access to
          fonts.googleapis.com in your build environment, if preferred.
        */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Fraunces:ital,wght@0,400;0,500;0,600;0,700;1,400;1,500&family=Inter:wght@400;500;600&family=IBM+Plex+Mono:wght@400;500;600&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="min-h-screen font-body antialiased">
        <Providers>
          <Nav />
          <main className="mx-auto max-w-5xl px-6 pb-24">{children}</main>
        </Providers>
      </body>
    </html>
  );
}
