import { ZodError } from "zod";
import { getTranslations } from "next-intl/server";

import { KnowledgeImportValidationError } from "@/lib/import/knowledge-import-plan";
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
  const t = await getTranslations("ApiErrors");
  const { documentId } = await context.params;

  if (!documentId || documentId.length > 64) {
    return Response.json({ error: t("invalidDocumentId") }, { status: 400 });
  }

  if (!request.headers.get("content-type")?.includes("application/json")) {
    return Response.json({ error: t("reviewJson") }, { status: 415 });
  }

  const contentLength = Number(request.headers.get("content-length"));

  if (Number.isFinite(contentLength) && contentLength > MAX_REVIEW_BODY_BYTES) {
    return Response.json({ error: t("reviewTooLarge") }, { status: 413 });
  }

  try {
    const body = (await request.json()) as { runId?: unknown; draft?: unknown };

    if (typeof body.runId !== "string" || body.runId.length > 64) {
      return Response.json({ error: t("invalidRunId") }, { status: 400 });
    }

    const result = await saveDocumentReview(documentId, body.runId, body.draft);

    return Response.json({
      status: "saved",
      savedAt: new Date().toISOString(),
      ...result,
    });
  } catch (error) {
    if (error instanceof KnowledgeImportValidationError) {
      return Response.json(
        {
          error: t("importValidationFailed"),
          issues: error.issues.map((issue) => ({
            ...issue,
            message: t(`importValidation.${issue.code}`, {
              path: issue.path,
              reference: issue.reference ?? "",
            }),
          })),
        },
        { status: 422 },
      );
    }

    if (error instanceof ReviewDraftConflictError) {
      return Response.json({ error: t("newerExtraction") }, { status: 409 });
    }

    if (error instanceof ReviewDraftNotFoundError) {
      return Response.json(
        { error: t("noSuccessfulExtraction") },
        { status: 404 },
      );
    }

    if (error instanceof ZodError) {
      return Response.json(
        {
          error: t("invalidReviewFields"),
        },
        { status: 400 },
      );
    }

    if (error instanceof SyntaxError) {
      return Response.json({ error: t("invalidJson") }, { status: 400 });
    }

    console.error("Review draft save failed", {
      documentId,
      message: error instanceof Error ? error.message : "Unknown error",
    });

    return Response.json({ error: t("reviewSaveFailed") }, { status: 500 });
  }
}
