import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "EDUIA — Universal Adaptive Learning Platform",
  description: "Intelligent competency-based adaptive learning engine powered by structured evidence.",
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
