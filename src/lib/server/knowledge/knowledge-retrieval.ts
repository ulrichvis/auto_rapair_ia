import "server-only";

import {
  knowledgeCandidateQuery,
  knowledgeCaseContextQuery,
  normalizeKnowledgeSearchInput,
  rankKnowledgeCandidates,
  type KnowledgeSearchInput,
} from "@/lib/knowledge/knowledge-retrieval";
import { prisma } from "@/lib/server/prisma";

export async function searchKnowledge(input: KnowledgeSearchInput) {
  const normalized = normalizeKnowledgeSearchInput(input);
  const candidates = await prisma.technicalCase.findMany(
    knowledgeCandidateQuery(normalized),
  );

  return rankKnowledgeCandidates(candidates, normalized);
}

export async function getKnowledgeCaseContext(caseId: string) {
  const normalizedCaseId = caseId.trim();
  if (!normalizedCaseId || normalizedCaseId.length > 64) return null;

  return prisma.technicalCase.findFirst(
    knowledgeCaseContextQuery(normalizedCaseId),
  );
}
