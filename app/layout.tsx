import "@fontsource-variable/manrope";
import "./globals.css";
import "./workspace.css";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: { default: "Sellio — поиск компаний и автоматизация продаж", template: "%s · Sellio" },
  description: "Ищите компании, оценивайте их сайты и управляйте продажами на маркетплейсах из одного кабинета.",
  ...(process.env.SELLIO_STATIC_PAGES === "true" ? { icons: (process.env.NEXT_PUBLIC_SELLIO_PAGES_BASE || "") + "/icon.png" } : {}),
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="ru"><body>{children}</body></html>;
}
