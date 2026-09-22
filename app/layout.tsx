import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "SuperDoc × Jev — The Negotiation Lab",
  description:
    "One deal decision becomes connected, reviewable Word redlines. Jev evaluates, SuperDoc executes, and you negotiate.",
  other: {
    "codex-preview": "development",
  },
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">{children}</body>
    </html>
  );
}
