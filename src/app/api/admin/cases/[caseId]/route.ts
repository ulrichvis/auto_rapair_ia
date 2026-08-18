import { getTranslations } from "next-intl/server";
import { ZodError } from "zod";

import { KnowledgeImportValidationError } from "@/lib/import/knowledge-import-plan";
import {
  TechnicalCaseEditConflictError,
  TechnicalCaseEditNotFoundError,
  updateTechnicalCaseKnowledge,
} from "@/lib/server/knowledge/update-technical-case";

export const runtime = "nodejs";

const MAX_EDIT_BODY_BYTES = 5 * 1024 * 1024;

export async function PUT(
  request: Request,
  context: RouteContext<"/api/admin/cases/[caseId]">,
) {
  const t = await getTranslations("ApiErrors");
  const { caseId } = await context.params;

  if (!caseId || caseId.length > 64) {
    return Response.json({ error: t("invalidCaseId") }, { status: 400 });
  }

  if (!request.headers.get("content-type")?.includes("application/json")) {
    return Response.json({ error: t("caseEditJson") }, { status: 415 });
  }

  const contentLength = Number(request.headers.get("content-length"));
  if (Number.isFinite(contentLength) && contentLength > MAX_EDIT_BODY_BYTES) {
    return Response.json({ error: t("caseEditTooLarge") }, { status: 413 });
  }

  try {
    const body = (await request.json()) as {
      expectedUpdatedAt?: unknown;
      draft?: unknown;
    };

    if (
      typeof body.expectedUpdatedAt !== "string" ||
      Number.isNaN(Date.parse(body.expectedUpdatedAt))
    ) {
      return Response.json(
        { error: t("invalidCaseEditVersion") },
        { status: 400 },
      );
    }

    const result = await updateTechnicalCaseKnowledge(
      caseId,
      body.expectedUpdatedAt,
      body.draft,
    );

    return Response.json({ status: "saved", ...result });
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

    if (error instanceof TechnicalCaseEditConflictError) {
      return Response.json({ error: t("caseEditConflict") }, { status: 409 });
    }

    if (error instanceof TechnicalCaseEditNotFoundError) {
      return Response.json({ error: t("caseEditNotFound") }, { status: 404 });
    }

    if (error instanceof ZodError) {
      return Response.json(
        { error: t("invalidReviewFields") },
        { status: 400 },
      );
    }

    if (error instanceof SyntaxError) {
      return Response.json({ error: t("invalidJson") }, { status: 400 });
    }

    console.error("Technical case update failed", {
      caseId,
      message: error instanceof Error ? error.message : "Unknown error",
    });

    return Response.json({ error: t("caseEditSaveFailed") }, { status: 500 });
  }
}
