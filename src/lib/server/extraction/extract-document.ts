import "server-only";

import { createExtractionService } from "@/lib/extraction/extraction-service";
import { downloadPrivatePdf } from "@/lib/server/supabase-storage";

import { OpenAIExtractionProvider } from "./openai-extraction-provider";
import { prismaExtractionRepository } from "./prisma-extraction-repository";

export function extractDocument(documentId: string) {
  const service = createExtractionService({
    repository: prismaExtractionRepository,
    provider: new OpenAIExtractionProvider(),
    loadPdf: downloadPrivatePdf,
  });

  return service.extractDocument(documentId);
}
