import type { Metadata } from "next";
import "./globals.css";
import "./brand.css";

export const metadata: Metadata = {
  title: "SuperDoc × Jev — Living Deal Desk",
  description:
    "A live legal review matrix becomes verified Word redlines, numbered safeguards, and human decisions. Jev evaluates; SuperDoc executes.",
  other: {
    "codex-preview": "development",
  },
  icons: {
    icon: "/brand/superdoc-logo.png",
    shortcut: "/brand/superdoc-logo.png",
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
