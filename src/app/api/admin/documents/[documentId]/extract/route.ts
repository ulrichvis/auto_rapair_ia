import { ExtractionConflictError } from "@/lib/extraction/extraction-service";
import { extractDocument } from "@/lib/server/extraction/extract-document";
import { getTranslations } from "next-intl/server";

export const runtime = "nodejs";
export const maxDuration = 300;

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
    const result = await extractDocument(documentId);
    return Response.json(result);
  } catch (error) {
    if (error instanceof ExtractionConflictError) {
      return Response.json(
        { error: extractionT("alreadyProcessing") },
        { status: 409 },
      );
    }

    if (
      error instanceof Error &&
      error.message === "Source document not found."
    ) {
      return Response.json(
        { error: extractionT("documentNotFound") },
        { status: 404 },
      );
    }

    console.error("PDF extraction failed", {
      documentId,
      message: error instanceof Error ? error.message : "Unknown error",
    });

    return Response.json(
      { error: extractionT("failedRetry") },
      { status: 500 },
    );
  }
}
