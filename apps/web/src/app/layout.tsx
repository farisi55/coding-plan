import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "coding-plan — Idea to PRD",
  description: "Ubah ide produkmu jadi PRD siap pakai untuk AI coding agent.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="id">
      <body>{children}</body>
    </html>
  );
}
