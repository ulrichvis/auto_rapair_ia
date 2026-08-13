export const supportedLocales = ["en", "it"] as const;
export type AppLocale = (typeof supportedLocales)[number];

export const defaultLocale: AppLocale = "en";
export const localeCookieName = "autorepair_ui_locale";

export function isSupportedLocale(value: unknown): value is AppLocale {
  return (
    typeof value === "string" && supportedLocales.includes(value as AppLocale)
  );
}

export function detectBrowserLocale(acceptLanguage: string | null): AppLocale {
  if (!acceptLanguage) return defaultLocale;

  const preferences = acceptLanguage
    .split(",")
    .map((entry) => {
      const [tag, ...parameters] = entry.trim().split(";");
      const qualityParameter = parameters.find((parameter) =>
        parameter.trim().startsWith("q="),
      );
      const quality = qualityParameter
        ? Number(qualityParameter.trim().slice(2))
        : 1;

      return {
        language: tag.toLowerCase().split("-")[0],
        quality: Number.isFinite(quality) ? quality : 0,
      };
    })
    .sort((a, b) => b.quality - a.quality);

  for (const preference of preferences) {
    if (preference.quality > 0 && isSupportedLocale(preference.language)) {
      return preference.language;
    }
  }

  return defaultLocale;
}

export function resolveLocale(
  storedLocale: string | undefined,
  acceptLanguage: string | null,
): AppLocale {
  if (storedLocale !== undefined) {
    return isSupportedLocale(storedLocale) ? storedLocale : defaultLocale;
  }

  return detectBrowserLocale(acceptLanguage);
}
