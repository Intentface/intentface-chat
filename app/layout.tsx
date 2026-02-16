import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { Providers } from "@/components/providers";
import "./globals.css";
import "streamdown/styles.css";

const inter = Inter({
  variable: "--font-inter",
  weight: "variable",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Intentface",
  description: "Intentface is a platform for creating and sharing AI prompts",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${inter.variable} antialiased`}
        suppressHydrationWarning
      >
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
