import type { Metadata } from "next";
import "./globals.css";
export const metadata: Metadata = {
  title: "Nexo Assist · Service desk de TI",
  description: "Seu ponto de apoio para resolver assuntos de TI.",
};
export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  );
}
