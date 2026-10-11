import type { Metadata } from "next";
import { getPublicAppUrl } from "@/lib/config/app-url";
import "./globals.css";

const appUrl = getPublicAppUrl();

export const metadata: Metadata = {
  metadataBase: new URL(appUrl),
  title: "Knowra — Adaptive Learning That Knows What You Know",
  description: "Knowra understands what you already know, finds your learning gaps, and adapts what you should learn next.",
  openGraph: {
    title: "Knowra — Adaptive Learning That Knows What You Know",
    description: "Knowra understands what you already know, finds your learning gaps, and adapts what you should learn next.",
    type: "website",
    siteName: "Knowra",
    url: appUrl,
  },
  twitter: {
    card: "summary_large_image",
    title: "Knowra — Adaptive Learning That Knows What You Know",
    description: "Knowra understands what you already know, finds your learning gaps, and adapts what you should learn next.",
  },
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "32x32" },
      { url: "/brand/knowra-symbol.svg", type: "image/svg+xml" },
    ],
    apple: [
      { url: "/apple-touch-icon.png", sizes: "180x180" },
    ],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased bg-slate-950 text-slate-100 min-h-screen">
        {children}
      </body>
    </html>
  );
}
