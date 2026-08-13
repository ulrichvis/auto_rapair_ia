import { ExtractionConflictError } from "@/lib/extraction/extraction-service";
import { extractDocument } from "@/lib/server/extraction/extract-document";

export const runtime = "nodejs";
export const maxDuration = 300;

export async function POST(
  _request: Request,
  context: RouteContext<"/api/admin/documents/[documentId]/extract">,
) {
  const { documentId } = await context.params;

  if (!documentId || documentId.length > 64) {
    return Response.json({ error: "Invalid document ID." }, { status: 400 });
  }

  try {
    const result = await extractDocument(documentId);
    return Response.json(result);
  } catch (error) {
    if (error instanceof ExtractionConflictError) {
      return Response.json({ error: error.message }, { status: 409 });
    }

    if (
      error instanceof Error &&
      error.message === "Source document not found."
    ) {
      return Response.json({ error: error.message }, { status: 404 });
    }

    console.error("PDF extraction failed", {
      documentId,
      message: error instanceof Error ? error.message : "Unknown error",
    });

    return Response.json(
      { error: "Extraction failed. You can retry this document." },
      { status: 500 },
    );
  }
}
