import { getTranslations } from "next-intl/server";
import { ZodError } from "zod";

import { KnowledgeImportValidationError } from "@/lib/import/knowledge-import-plan";
import {
  importReviewedKnowledge,
  KnowledgeAlreadyImportedError,
  KnowledgeImportConflictError,
  KnowledgeImportNotFoundError,
  KnowledgeReviewRequiredError,
} from "@/lib/server/import/import-reviewed-knowledge";

export const runtime = "nodejs";

export async function POST(
  request: Request,
  context: RouteContext<"/api/admin/documents/[documentId]/import">,
) {
  const t = await getTranslations("ApiErrors");
  const { documentId } = await context.params;

  if (!documentId || documentId.length > 64) {
    return Response.json({ error: t("invalidDocumentId") }, { status: 400 });
  }
  if (!request.headers.get("content-type")?.includes("application/json")) {
    return Response.json({ error: t("reviewJson") }, { status: 415 });
  }

  try {
    const body = (await request.json()) as { runId?: unknown };
    if (typeof body.runId !== "string" || body.runId.length > 64) {
      return Response.json({ error: t("invalidRunId") }, { status: 400 });
    }

    const result = await importReviewedKnowledge(documentId, body.runId);
    return Response.json({ status: "imported", ...result });
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
    if (error instanceof KnowledgeAlreadyImportedError) {
      return Response.json({ error: t("alreadyImported") }, { status: 409 });
    }
    if (error instanceof KnowledgeImportConflictError) {
      return Response.json({ error: t("newerExtraction") }, { status: 409 });
    }
    if (error instanceof KnowledgeReviewRequiredError) {
      return Response.json({ error: t("reviewRequired") }, { status: 409 });
    }
    if (error instanceof KnowledgeImportNotFoundError) {
      return Response.json(
        { error: t("noSuccessfulExtraction") },
        { status: 404 },
      );
    }
    if (error instanceof ZodError) {
      return Response.json(
        {
          error: t("invalidReviewFields"),
          issues: error.issues.map((issue) => ({
            code: "INVALID_DRAFT_FIELD",
            path: issue.path.join("."),
            message: t("invalidDraftField", {
              path: issue.path.join("."),
            }),
          })),
        },
        { status: 422 },
      );
    }
    if (error instanceof SyntaxError) {
      return Response.json({ error: t("invalidJson") }, { status: 400 });
    }

    console.error("Reviewed knowledge import failed", {
      documentId,
      message: error instanceof Error ? error.message : "Unknown error",
    });
    return Response.json({ error: t("importFailed") }, { status: 500 });
  }
}
