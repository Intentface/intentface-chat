import type { Metadata } from "next";
import { Inter } from "next/font/google";
import localFont from "next/font/local";
import { Providers } from "@/components/providers";
import { SiteShell } from "@/components/site-shell";
import { source } from "@/lib/docs/source";
import "streamdown/styles.css";
import "./globals.css";
const inter = Inter({
  variable: "--font-inter",
  weight: "variable",
  subsets: ["latin"],
  display: "swap",
});

// Ioskeley Mono (OFL-1.1, github.com/ahatem/IoskeleyMono). Only the ligature
// build ships web fonts, so globals.css turns ligatures off for mono text.
const ioskeleyMono = localFont({
  variable: "--font-ioskeley-mono",
  src: [
    { path: "./fonts/IoskeleyMono-Regular.woff2", weight: "400", style: "normal" },
    { path: "./fonts/IoskeleyMono-Medium.woff2", weight: "500", style: "normal" },
    { path: "./fonts/IoskeleyMono-SemiBold.woff2", weight: "600", style: "normal" },
  ],
  display: "swap",
});

export const metadata: Metadata = {
  // Absolute base for Open Graph and canonical URLs. Without it Next cannot
  // resolve them, so link previews fall back to relative paths.
  metadataBase: new URL("https://ui.intentface.com"),
  title: "@intentface/chat",
  description:
    "Headless chat UI primitives for React — unstyled compound components, hooks, and wire formats for building AI chat interfaces.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${inter.variable} ${ioskeleyMono.variable} antialiased`}
        suppressHydrationWarning
      >
        <Providers>
          <SiteShell tree={source.pageTree}>{children}</SiteShell>
        </Providers>
      </body>
    </html>
  );
}
