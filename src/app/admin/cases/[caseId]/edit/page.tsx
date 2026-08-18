import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";

import {
  buildKnowledgeImportPlan,
  KnowledgeImportValidationError,
} from "@/lib/import/knowledge-import-plan";
import {
  getTechnicalCaseEdit,
  TechnicalCaseEditNotFoundError,
} from "@/lib/server/knowledge/update-technical-case";

import { ReviewEditor } from "../../../documents/[documentId]/review/review-editor";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("Metadata");
  return { title: t("caseEditTitle") };
}

export default async function TechnicalCaseEditPage(
  props: PageProps<"/admin/cases/[caseId]/edit">,
) {
  const { caseId } = await props.params;
  if (!caseId || caseId.length > 64) notFound();

  let edit;
  try {
    edit = await getTechnicalCaseEdit(caseId);
  } catch (error) {
    if (error instanceof TechnicalCaseEditNotFoundError) notFound();
    throw error;
  }

  const [apiT, caseEditT] = await Promise.all([
    getTranslations("ApiErrors"),
    getTranslations("CaseEdit"),
  ]);
  let initialValidationIssues: Array<{
    code: string;
    path: string;
    message: string;
  }> = [];

  try {
    buildKnowledgeImportPlan(edit.draft, {
      maxSourcePage: edit.maxSourcePage,
    });
  } catch (error) {
    if (error instanceof KnowledgeImportValidationError) {
      initialValidationIssues = error.issues.map((issue) => ({
        ...issue,
        message: apiT(`importValidation.${issue.code}`, {
          path: issue.path,
          reference: issue.reference ?? "",
        }),
      }));
    } else {
      throw error;
    }
  }

  return (
    <ReviewEditor
      mode="case-edit"
      caseId={edit.caseId}
      initialUpdatedAt={edit.updatedAt}
      caseEditLabels={{
        eyebrow: caseEditT("eyebrow"),
        description: caseEditT("description"),
        back: caseEditT("back"),
      }}
      documentId={edit.sourceDocumentId ?? ""}
      runId=""
      originalFilename={edit.originalFilename}
      completedAt={null}
      initialImportedAt={null}
      initialReviewedAt={null}
      initialImportedCases={[]}
      initialDraft={edit.draft}
      initialValidationIssues={initialValidationIssues}
    />
  );
}
