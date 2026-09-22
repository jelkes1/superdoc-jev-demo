import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "SuperDoc × Jev — Document Decision Lab",
  description:
    "Jev evaluates a contract. SuperDoc creates verified tracked changes. You review the result.",
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
