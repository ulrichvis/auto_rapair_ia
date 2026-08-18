import type { Metadata } from "next";
import Link from "next/link";
import { NextIntlClientProvider } from "next-intl";
import { getLocale, getMessages, getTranslations } from "next-intl/server";

import { LanguageSelector } from "./language-selector";
import "./globals.css";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("Metadata");
  return { title: t("appTitle"), description: t("appDescription") };
}

export default async function RootLayout({ children }: LayoutProps<"/">) {
  const locale = await getLocale();
  const messages = await getMessages();
  const t = await getTranslations("Navigation");

  return (
    <html lang={locale} className="h-full antialiased">
      <body className="flex min-h-full flex-col">
        <NextIntlClientProvider messages={messages}>
          <header className="border-b border-slate-200 bg-white">
            <nav
              className="mx-auto flex w-full max-w-7xl items-center justify-between gap-4 px-5 py-3"
              aria-label={t("admin")}
            >
              <div className="flex items-center gap-5">
                <Link href="/" className="font-semibold text-slate-950">
                  AutoRepair Knowledge
                </Link>
                <Link
                  href="/admin/documents"
                  className="text-sm font-medium text-slate-700 hover:text-blue-700"
                >
                  {t("documents")}
                </Link>
                <Link
                  href="/admin/cases"
                  className="text-sm font-medium text-slate-700 hover:text-blue-700"
                >
                  {t("cases")}
                </Link>
              </div>
              <LanguageSelector />
            </nav>
          </header>
          {children}
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
