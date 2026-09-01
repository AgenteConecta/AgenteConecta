import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Newtek Sales Engine",
  description: "Sistema comercial autônomo da Newtek Automação",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  );
}
