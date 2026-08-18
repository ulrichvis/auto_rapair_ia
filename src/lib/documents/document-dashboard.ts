import type { Prisma } from "@/generated/prisma/client";

export const documentDashboardFilters = [
  "all",
  "uploaded",
  "processing",
  "imported",
  "failed",
  "reviewed",
] as const;

export type DocumentDashboardFilter = (typeof documentDashboardFilters)[number];

export type DocumentDashboardState =
  "UPLOADED" | "QUEUED" | "EXTRACTING" | "IMPORTING" | "IMPORTED" | "FAILED";

export type DocumentDashboardAction =
  | "extract"
  | "reextract"
  | "retry"
  | "openKnowledge"
  | "editKnowledge"
  | "reviewImportIssues";

type DashboardIngestionRun = {
  id: string;
  status: string;
  model: string | null;
  inputTokens: number | null;
  outputTokens: number | null;
  totalTokens: number | null;
  errorMessage: string | null;
  originalFileSizeBytes: number | null;
  processingFileSizeBytes: number | null;
  processingWasOptimized: boolean | null;
  processingWarning: string | null;
  startedAt: Date;
};

export type DocumentDashboardInput = {
  id: string;
  originalFilename: string;
  title: string | null;
  bulletinReference: string | null;
  language: string | null;
  processingStatus: string;
  createdAt: Date;
  ingestionRuns: DashboardIngestionRun[];
  caseSources: Array<{
    technicalCase: {
      id: string;
      title: string;
      reviewedByHuman: boolean;
    };
  }>;
};

export type DocumentDashboardItem = ReturnType<
  typeof createDocumentDashboardItem
>;

export const documentDashboardQuery = {
  orderBy: { createdAt: "desc" },
  select: {
    id: true,
    originalFilename: true,
    title: true,
    bulletinReference: true,
    language: true,
    processingStatus: true,
    createdAt: true,
    ingestionRuns: {
      orderBy: { startedAt: "desc" },
      take: 1,
      select: {
        id: true,
        status: true,
        model: true,
        inputTokens: true,
        outputTokens: true,
        totalTokens: true,
        errorMessage: true,
        originalFileSizeBytes: true,
        processingFileSizeBytes: true,
        processingWasOptimized: true,
        processingWarning: true,
        startedAt: true,
      },
    },
    caseSources: {
      orderBy: { id: "asc" },
      select: {
        technicalCase: {
          select: {
            id: true,
            title: true,
            reviewedByHuman: true,
          },
        },
      },
    },
  },
} satisfies Prisma.SourceDocumentFindManyArgs;

export function normalizeDocumentDashboardFilter(
  value: string | string[] | undefined,
): DocumentDashboardFilter {
  const candidate = Array.isArray(value) ? value[0] : value;

  return documentDashboardFilters.includes(candidate as DocumentDashboardFilter)
    ? (candidate as DocumentDashboardFilter)
    : "all";
}

export function resolveDocumentDashboardState(
  document: Pick<DocumentDashboardInput, "processingStatus" | "ingestionRuns">,
): DocumentDashboardState {
  const latestRun = document.ingestionRuns[0];

  if (document.processingStatus === "QUEUED") return "QUEUED";

  if (document.processingStatus === "PROCESSING") {
    return latestRun?.status === "IMPORTING" ? "IMPORTING" : "EXTRACTING";
  }

  if (document.processingStatus === "COMPLETED") return "IMPORTED";
  if (document.processingStatus === "FAILED") return "FAILED";
  if (latestRun?.status === "IMPORTED") return "IMPORTED";
  if (latestRun?.status === "FAILED") return "FAILED";

  return "UPLOADED";
}

function hasReviewableExtraction(latestRun: DashboardIngestionRun | undefined) {
  return Boolean(
    latestRun &&
    (latestRun.model ||
      ["SUCCESS", "COMPLETED", "IMPORTED"].includes(latestRun.status)),
  );
}

function actionsForDocument(
  document: DocumentDashboardInput,
  state: DocumentDashboardState,
  technicalCaseCount: number,
): DocumentDashboardAction[] {
  const latestRun = document.ingestionRuns[0];

  if (state === "QUEUED" || state === "EXTRACTING" || state === "IMPORTING")
    return [];
  if (state === "FAILED") {
    return [
      "retry",
      ...(hasReviewableExtraction(latestRun)
        ? (["reviewImportIssues"] as const)
        : []),
    ];
  }
  if (state === "IMPORTED") {
    return [
      ...(technicalCaseCount > 0 ? (["openKnowledge"] as const) : []),
      ...(hasReviewableExtraction(latestRun)
        ? (["editKnowledge"] as const)
        : []),
    ];
  }

  return [
    document.processingStatus === "REVIEW_REQUIRED" ? "reextract" : "extract",
  ];
}

export function createDocumentDashboardItem(document: DocumentDashboardInput) {
  const state = resolveDocumentDashboardState(document);
  const latestRun = document.ingestionRuns[0] ?? null;
  const technicalCases = document.caseSources.map(
    ({ technicalCase }) => technicalCase,
  );
  const manuallyReviewed = technicalCases.some(
    (technicalCase) => technicalCase.reviewedByHuman,
  );

  return {
    ...document,
    latestRun,
    technicalCases,
    manuallyReviewed,
    state,
    actions: actionsForDocument(document, state, technicalCases.length),
  };
}

export function filterDocumentDashboardItems(
  documents: DocumentDashboardItem[],
  filter: DocumentDashboardFilter,
) {
  if (filter === "all") return documents;
  if (filter === "reviewed") {
    return documents.filter((document) => document.manuallyReviewed);
  }
  if (filter === "processing") {
    return documents.filter(
      (document) =>
        document.state === "QUEUED" ||
        document.state === "EXTRACTING" ||
        document.state === "IMPORTING",
    );
  }

  const stateByFilter = {
    uploaded: "UPLOADED",
    imported: "IMPORTED",
    failed: "FAILED",
  } as const;

  return documents.filter(
    (document) => document.state === stateByFilter[filter],
  );
}

export function summarizeDocumentDashboard(documents: DocumentDashboardItem[]) {
  return {
    total: documents.length,
    processing: documents.filter(
      (document) =>
        document.state === "QUEUED" ||
        document.state === "EXTRACTING" ||
        document.state === "IMPORTING",
    ).length,
    imported: documents.filter((document) => document.state === "IMPORTED")
      .length,
    failed: documents.filter((document) => document.state === "FAILED").length,
  };
}

export type DocumentFailureStage = "pdf" | "extraction" | "import";

export function inferDocumentFailureStage(
  latestRun: DashboardIngestionRun,
): DocumentFailureStage {
  if (latestRun.model) return "import";
  if (latestRun.originalFileSizeBytes === null) return "pdf";
  return "extraction";
}

export function sanitizeDocumentError(message: string) {
  return message
    .replace(/\bBearer\s+\S+/gi, "Bearer [redacted]")
    .replace(/\bsk-[A-Za-z0-9_-]+/gi, "[redacted key]")
    .replace(
      /\beyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g,
      "[redacted token]",
    )
    .replace(/\b(?:https?|postgres(?:ql)?):\/\/\S+/gi, "[redacted URL]")
    .replace(/\b[A-Za-z]:\\[^\r\n]+/g, "[redacted path]")
    .trim()
    .slice(0, 1_000);
}
