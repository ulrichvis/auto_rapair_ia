import Link from "next/link";
import { getTranslations } from "next-intl/server";

export default async function ReviewNotFound() {
  const t = await getTranslations("ApiErrors");
  const reviewT = await getTranslations("Review");

  return (
    <main className="flex flex-1 items-center justify-center px-6 py-16">
      <section className="w-full max-w-xl rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
        <h1 className="text-2xl font-semibold text-slate-950">
          {t("reviewNotFoundTitle")}
        </h1>
        <p className="mt-3 text-slate-600">{t("reviewNotFoundDescription")}</p>
        <Link
          href="/admin/documents"
          className="mt-6 inline-flex rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white"
        >
          {reviewT("back")}
        </Link>
      </section>
    </main>
  );
}
