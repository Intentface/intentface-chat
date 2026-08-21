import type { Metadata } from "next";
import { IBM_Plex_Mono, Inter } from "next/font/google";
import { Providers } from "@/components/providers";
import "streamdown/styles.css";
import "./globals.css";
const inter = Inter({
  variable: "--font-inter",
  weight: "variable",
  subsets: ["latin"],
  display: "swap",
});

// IBM Plex Mono isn't a variable font — enumerate the weights actually used (regular,
// medium, semibold) so next/font subsets only those.
const ibmPlexMono = IBM_Plex_Mono({
  variable: "--font-ibm-plex-mono",
  weight: ["400", "500", "600"],
  subsets: ["latin"],
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
        className={`${inter.variable} ${ibmPlexMono.variable} antialiased`}
        suppressHydrationWarning
      >
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
