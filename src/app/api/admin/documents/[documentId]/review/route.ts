import { ZodError } from "zod";

import {
  ReviewDraftConflictError,
  ReviewDraftNotFoundError,
  saveDocumentReview,
} from "@/lib/server/review/review-draft";

export const runtime = "nodejs";

const MAX_REVIEW_BODY_BYTES = 5 * 1024 * 1024;

export async function PUT(
  request: Request,
  context: RouteContext<"/api/admin/documents/[documentId]/review">,
) {
  const { documentId } = await context.params;

  if (!documentId || documentId.length > 64) {
    return Response.json({ error: "Invalid document ID." }, { status: 400 });
  }

  if (!request.headers.get("content-type")?.includes("application/json")) {
    return Response.json(
      { error: "The review must be submitted as JSON." },
      { status: 415 },
    );
  }

  const contentLength = Number(request.headers.get("content-length"));

  if (Number.isFinite(contentLength) && contentLength > MAX_REVIEW_BODY_BYTES) {
    return Response.json(
      { error: "The review is too large." },
      { status: 413 },
    );
  }

  try {
    const body = (await request.json()) as { runId?: unknown; draft?: unknown };

    if (typeof body.runId !== "string" || body.runId.length > 64) {
      return Response.json(
        { error: "Invalid ingestion run ID." },
        { status: 400 },
      );
    }

    const draft = await saveDocumentReview(documentId, body.runId, body.draft);

    return Response.json({
      status: "saved",
      savedAt: new Date().toISOString(),
      draft,
    });
  } catch (error) {
    if (error instanceof ReviewDraftConflictError) {
      return Response.json({ error: error.message }, { status: 409 });
    }

    if (error instanceof ReviewDraftNotFoundError) {
      return Response.json({ error: error.message }, { status: 404 });
    }

    if (error instanceof ZodError) {
      return Response.json(
        {
          error:
            "Some review fields are invalid. Check required fields and numeric values.",
        },
        { status: 400 },
      );
    }

    if (error instanceof SyntaxError) {
      return Response.json({ error: "Invalid JSON body." }, { status: 400 });
    }

    console.error("Review draft save failed", {
      documentId,
      message: error instanceof Error ? error.message : "Unknown error",
    });

    return Response.json(
      { error: "The review could not be saved. Please try again." },
      { status: 500 },
    );
  }
}
