import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";

import {
  buildKnowledgeImportPlan,
  KnowledgeImportValidationError,
} from "@/lib/import/knowledge-import-plan";
import {
  getDocumentReview,
  ReviewDraftNotFoundError,
} from "@/lib/server/review/review-draft";

import { ReviewEditor } from "./review-editor";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("Metadata");
  return { title: t("reviewTitle") };
}

export const dynamic = "force-dynamic";

export default async function DocumentReviewPage(
  props: PageProps<"/admin/documents/[documentId]/review">,
) {
  const { documentId } = await props.params;

  if (!documentId || documentId.length > 64) {
    notFound();
  }

  let review;

  try {
    review = await getDocumentReview(documentId);
  } catch (error) {
    if (error instanceof ReviewDraftNotFoundError) {
      notFound();
    }

    throw error;
  }

  const apiT = await getTranslations("ApiErrors");
  let initialValidationIssues: Array<{
    code: string;
    path: string;
    message: string;
  }> = [];

  try {
    buildKnowledgeImportPlan(review.draft, {
      maxSourcePage: review.maxSourcePage,
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
      documentId={review.documentId}
      runId={review.runId}
      originalFilename={review.originalFilename}
      completedAt={review.completedAt}
      initialImportedAt={review.importedAt}
      initialReviewedAt={review.reviewedAt}
      initialImportedCases={review.importedCases}
      initialDraft={review.draft}
      initialValidationIssues={initialValidationIssues}
    />
  );
}
