import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";

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

  return (
    <ReviewEditor
      documentId={review.documentId}
      runId={review.runId}
      originalFilename={review.originalFilename}
      completedAt={review.completedAt}
      initialImportedAt={review.importedAt}
      initialImportedCases={review.importedCases}
      initialDraft={review.draft}
    />
  );
}
