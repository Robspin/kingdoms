import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Kingdoms — tribe sim",
  description: "Manage a small tribe: people, resources, offspring and defences.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
