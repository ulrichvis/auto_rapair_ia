import type { AutomotiveExtractionDraft } from "./automotive-draft-schema";

export type ExtractionUsage = {
  inputTokens: number | null;
  outputTokens: number | null;
  totalTokens: number | null;
};

export type ExtractionProviderResult = {
  draft: AutomotiveExtractionDraft;
  model: string;
  providerVersion: string;
  usage: ExtractionUsage;
};

export type ExtractPdfInput = {
  filename: string;
  pdf: Buffer;
};

export interface ExtractionProvider {
  extractPdf(input: ExtractPdfInput): Promise<ExtractionProviderResult>;
}
