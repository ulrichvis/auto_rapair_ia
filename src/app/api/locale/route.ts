import { cookies } from "next/headers";

import {
  defaultLocale,
  isSupportedLocale,
  localeCookieName,
} from "@/i18n/locale";

export async function POST(request: Request) {
  let requestedLocale: unknown;

  try {
    requestedLocale = ((await request.json()) as { locale?: unknown }).locale;
  } catch {
    requestedLocale = defaultLocale;
  }

  const locale = isSupportedLocale(requestedLocale)
    ? requestedLocale
    : defaultLocale;
  const cookieStore = await cookies();

  cookieStore.set(localeCookieName, locale, {
    httpOnly: true,
    maxAge: 60 * 60 * 24 * 365,
    path: "/",
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
  });

  return Response.json({ locale });
}
