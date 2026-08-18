import {
  IngestionQueueConflictError,
  IngestionQueueNotFoundError,
  queueDocumentForExtraction,
} from "@/lib/server/extraction/prisma-ingestion-queue";
import { getTranslations } from "next-intl/server";

export const runtime = "nodejs";

export async function POST(
  _request: Request,
  context: RouteContext<"/api/admin/documents/[documentId]/extract">,
) {
  const apiT = await getTranslations("ApiErrors");
  const extractionT = await getTranslations("Extraction");
  const { documentId } = await context.params;

  if (!documentId || documentId.length > 64) {
    return Response.json({ error: apiT("invalidDocumentId") }, { status: 400 });
  }

  try {
    const result = await queueDocumentForExtraction(documentId);
    return Response.json(result, { status: 202 });
  } catch (error) {
    if (error instanceof IngestionQueueConflictError) {
      return Response.json(
        { error: extractionT("alreadyProcessing") },
        { status: 409 },
      );
    }

    if (error instanceof IngestionQueueNotFoundError) {
      return Response.json(
        { error: extractionT("documentNotFound") },
        { status: 404 },
      );
    }

    console.error("PDF queueing failed", {
      documentId,
      message: error instanceof Error ? error.message : "Unknown error",
    });

    return Response.json(
      { error: extractionT("failedRetry") },
      { status: 500 },
    );
  }
}
