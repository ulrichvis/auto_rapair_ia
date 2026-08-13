"use client";

import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useState } from "react";

import type { AppLocale } from "@/i18n/locale";

export function LanguageSelector() {
  const t = useTranslations("LanguageSelector");
  const locale = useLocale() as AppLocale;
  const router = useRouter();
  const [isChanging, setIsChanging] = useState(false);

  async function changeLanguage(nextLocale: AppLocale) {
    setIsChanging(true);

    try {
      await fetch("/api/locale", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ locale: nextLocale }),
      });
      router.refresh();
    } finally {
      setIsChanging(false);
    }
  }

  return (
    <label className="flex items-center gap-2 text-sm text-slate-700">
      <span className="sr-only">{t("label")}</span>
      <select
        aria-label={t("label")}
        value={locale}
        disabled={isChanging}
        onChange={(event) => changeLanguage(event.target.value as AppLocale)}
        className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-900 disabled:opacity-60"
      >
        <option value="en">{t("english")}</option>
        <option value="it">{t("italian")}</option>
      </select>
    </label>
  );
}
