import "server-only";

import { createExtractionService } from "@/lib/extraction/extraction-service";
import { preparePdfForExtraction } from "@/lib/extraction/pdf-processing";
import { downloadPrivatePdf } from "@/lib/server/supabase-storage";

import { OpenAIExtractionProvider } from "./openai-extraction-provider";
import { optimizePdfForExtraction } from "./pdf-optimizer";
import { prismaExtractionRepository } from "./prisma-extraction-repository";

export function extractDocument(documentId: string) {
  const service = createExtractionService({
    repository: prismaExtractionRepository,
    provider: new OpenAIExtractionProvider(),
    loadPdf: downloadPrivatePdf,
    preparePdf(pdf) {
      return preparePdfForExtraction(pdf, {
        optimizer: optimizePdfForExtraction,
        onWarning(warning) {
          console.warn(warning);
        },
      });
    },
  });

  return service.extractDocument(documentId);
}
