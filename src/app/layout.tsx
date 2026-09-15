import type { Metadata } from "next";
import type { ReactNode } from "react";
import { Fraunces, Inter } from "next/font/google";
import "./globals.css";

const fraunces = Fraunces({
  subsets: ["latin"],
  variable: "--font-fraunces",
  display: "swap",
});

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Degenerates With Integrity Fantasy Assistant",
  description:
    "GLM-5.3-Flash-powered fantasy football assistant for the Degenerates With Integrity Fantasy Assistant ESPN league.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className={`${fraunces.variable} ${inter.variable}`}>
      <body className="bg-base text-ink font-sans antialiased">{children}</body>
    </html>
  );
}
