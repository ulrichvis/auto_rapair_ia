import "server-only";

import {
  createExtractionService,
  type ClaimedExtractionRun,
} from "@/lib/extraction/extraction-service";
import { preparePdfForExtraction } from "@/lib/extraction/pdf-processing";
import { downloadPrivatePdf } from "@/lib/server/supabase-storage";

import { OpenAIExtractionProvider } from "./openai-extraction-provider";
import { optimizePdfForExtraction } from "./pdf-optimizer";
import { prismaExtractionRepository } from "./prisma-extraction-repository";
import { importExtractedKnowledge } from "../import/import-knowledge";

const extractionService = createExtractionService({
  repository: prismaExtractionRepository,
  provider: new OpenAIExtractionProvider(),
  loadPdf: downloadPrivatePdf,
  importKnowledge: importExtractedKnowledge,
  preparePdf(pdf) {
    return preparePdfForExtraction(pdf, {
      optimizer: optimizePdfForExtraction,
      onWarning(warning) {
        console.warn(warning);
      },
    });
  },
});

export function extractDocument(documentId: string) {
  return extractionService.extractDocument(documentId);
}

export function processClaimedDocument(claim: ClaimedExtractionRun) {
  return extractionService.processClaimedDocument(claim);
}
