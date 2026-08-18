import { drainNextIngestionJob } from "@/lib/server/extraction/ingestion-queue";
import { getTranslations } from "next-intl/server";

export const runtime = "nodejs";
export const maxDuration = 300;

export async function POST() {
  const t = await getTranslations("Queue");

  try {
    return Response.json(await drainNextIngestionJob());
  } catch (error) {
    console.error("Ingestion queue drain failed", {
      message: error instanceof Error ? error.message : "Unknown error",
    });
    return Response.json({ error: t("failed") }, { status: 500 });
  }
}
