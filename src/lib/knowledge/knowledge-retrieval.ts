import type { Prisma } from "@/generated/prisma/client";

import { technicalCaseDetailQuery } from "./case-browser";

export const KNOWLEDGE_SEARCH_DEFAULT_LIMIT = 10;
export const KNOWLEDGE_SEARCH_MAX_LIMIT = 25;
export const KNOWLEDGE_SEARCH_CANDIDATE_LIMIT = 250;

export const KNOWLEDGE_RANKING_WEIGHTS = {
  exactDtc: 40,
  manufacturerDtc: 34,
  exactEngineCode: 30,
  enginePattern: 24,
  engineFamily: 18,
  engineFamilyPartial: 14,
  model: 14,
  modelPartial: 10,
  brand: 10,
  brandPartial: 8,
  normalizedSymptom: 12,
  sourceSymptom: 8,
  normalizedComponent: 10,
  sourceComponent: 7,
  system: 6,
  systemPartial: 4,
  year: 5,
} as const;

export type KnowledgeSearchInput = {
  brand?: string;
  model?: string;
  engineCode?: string;
  engineFamily?: string;
  dtc?: string;
  symptoms?: string[];
  components?: string[];
  system?: string;
  year?: number;
  limit?: number;
};

export type NormalizedKnowledgeSearchInput = Omit<
  KnowledgeSearchInput,
  "limit"
> & {
  limit: number;
};

export type KnowledgeMatchReason =
  | "exact_dtc"
  | "manufacturer_dtc"
  | "exact_engine_code"
  | "engine_pattern"
  | "engine_family"
  | "brand"
  | "model"
  | "symptom"
  | "component"
  | "system"
  | "year";

export class EmptyKnowledgeSearchError extends Error {
  constructor() {
    super("At least one knowledge search criterion is required.");
    this.name = "EmptyKnowledgeSearchError";
  }
}

export class InvalidKnowledgeSearchError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InvalidKnowledgeSearchError";
  }
}

function clean(value: string | undefined) {
  return value?.trim().replace(/\s+/g, " ").slice(0, 100) || undefined;
}

function cleanList(values: string[] | undefined) {
  const cleaned = values
    ?.map(clean)
    .filter((value): value is string => !!value);
  return cleaned ? [...new Set(cleaned)].slice(0, 10) : undefined;
}

export function normalizeDtcSearchValue(value: string) {
  const compact = value.toUpperCase().replace(/[^A-Z0-9]/g, "");

  if (/^[PCBU][0-9A-F]{4}00$/.test(compact)) {
    return compact.slice(0, 5);
  }

  return compact;
}

export function normalizeKnowledgeSearchInput(
  input: KnowledgeSearchInput,
): NormalizedKnowledgeSearchInput {
  if (
    input.year !== undefined &&
    (!Number.isInteger(input.year) || input.year < 0 || input.year > 9999)
  ) {
    throw new InvalidKnowledgeSearchError("The requested year is invalid.");
  }

  const dtc = clean(input.dtc);
  const requestedLimit = Number.isFinite(input.limit)
    ? Math.trunc(input.limit!)
    : KNOWLEDGE_SEARCH_DEFAULT_LIMIT;
  const normalized: NormalizedKnowledgeSearchInput = {
    brand: clean(input.brand),
    model: clean(input.model),
    engineCode: clean(input.engineCode)?.toUpperCase(),
    engineFamily: clean(input.engineFamily),
    dtc: dtc ? normalizeDtcSearchValue(dtc) : undefined,
    symptoms: cleanList(input.symptoms),
    components: cleanList(input.components),
    system: clean(input.system),
    year: input.year,
    limit: Math.min(Math.max(requestedLimit, 1), KNOWLEDGE_SEARCH_MAX_LIMIT),
  };

  if (
    !normalized.brand &&
    !normalized.model &&
    !normalized.engineCode &&
    !normalized.engineFamily &&
    !normalized.dtc &&
    !normalized.symptoms?.length &&
    !normalized.components?.length &&
    !normalized.system &&
    normalized.year === undefined
  ) {
    throw new EmptyKnowledgeSearchError();
  }

  return normalized;
}

const searchableKnowledgeStatuses = ["IN_REVIEW", "VALIDATED"] as const;

function yearApplicabilityWhere(year: number) {
  return {
    AND: [
      { OR: [{ yearFrom: null }, { yearFrom: { lte: year } }] },
      { OR: [{ yearTo: null }, { yearTo: { gte: year } }] },
    ],
  } satisfies Prisma.CaseApplicabilityWhereInput;
}

export function buildKnowledgeCandidateWhere(
  input: NormalizedKnowledgeSearchInput,
): Prisma.TechnicalCaseWhereInput {
  const criteria: Prisma.TechnicalCaseWhereInput[] = [];

  if (input.brand) {
    criteria.push({
      applicability: {
        some: { brand: { contains: input.brand, mode: "insensitive" } },
      },
    });
  }
  if (input.model) {
    criteria.push({
      applicability: {
        some: { model: { contains: input.model, mode: "insensitive" } },
      },
    });
  }
  if (input.engineCode) {
    criteria.push({
      applicability: {
        some: {
          OR: [
            { engineCode: { equals: input.engineCode, mode: "insensitive" } },
            { engineCodePattern: { not: null } },
          ],
        },
      },
    });
  }
  if (input.engineFamily) {
    criteria.push({
      applicability: {
        some: {
          engineFamily: { contains: input.engineFamily, mode: "insensitive" },
        },
      },
    });
  }
  if (input.dtc) {
    criteria.push({
      faultCodes: {
        some: {
          OR: [
            { normalizedCode: { equals: input.dtc, mode: "insensitive" } },
            { rawCode: { contains: input.dtc, mode: "insensitive" } },
            {
              manufacturerCode: {
                contains: input.dtc,
                mode: "insensitive",
              },
            },
          ],
        },
      },
    });
  }
  for (const symptom of input.symptoms ?? []) {
    criteria.push({
      symptoms: {
        some: {
          OR: [
            { normalizedLabel: { contains: symptom, mode: "insensitive" } },
            { label: { contains: symptom, mode: "insensitive" } },
            { details: { contains: symptom, mode: "insensitive" } },
          ],
        },
      },
    });
  }
  for (const component of input.components ?? []) {
    criteria.push({
      components: {
        some: {
          OR: [
            { normalizedName: { contains: component, mode: "insensitive" } },
            { name: { contains: component, mode: "insensitive" } },
            {
              manufacturerIdentifier: {
                contains: component,
                mode: "insensitive",
              },
            },
          ],
        },
      },
    });
  }
  if (input.system) {
    criteria.push({
      OR: [
        { primarySystem: { contains: input.system, mode: "insensitive" } },
        {
          components: {
            some: { system: { contains: input.system, mode: "insensitive" } },
          },
        },
      ],
    });
  }

  const AND: Prisma.TechnicalCaseWhereInput[] = [
    { validationStatus: { in: [...searchableKnowledgeStatuses] } },
  ];

  if (input.year !== undefined) {
    AND.push({ applicability: { some: yearApplicabilityWhere(input.year) } });
  }
  if (criteria.length > 0) AND.push({ OR: criteria });

  return { AND };
}

export const knowledgeCandidateSelect = {
  id: true,
  title: true,
  summary: true,
  primarySystem: true,
  validationStatus: true,
  importedAutomatically: true,
  reviewedByHuman: true,
  reviewedAt: true,
  updatedAt: true,
  applicability: {
    select: {
      id: true,
      brand: true,
      model: true,
      yearFrom: true,
      yearTo: true,
      engineFamily: true,
      engineCode: true,
      engineCodePattern: true,
      engineMatchType: true,
    },
  },
  faultCodes: {
    select: {
      id: true,
      rawCode: true,
      normalizedCode: true,
      manufacturerCode: true,
      description: true,
    },
  },
  symptoms: {
    select: {
      id: true,
      label: true,
      normalizedLabel: true,
      details: true,
    },
  },
  components: {
    select: {
      id: true,
      name: true,
      normalizedName: true,
      manufacturerIdentifier: true,
      system: true,
    },
  },
} satisfies Prisma.TechnicalCaseSelect;

export type KnowledgeCandidate = Prisma.TechnicalCaseGetPayload<{
  select: typeof knowledgeCandidateSelect;
}>;

export function knowledgeCandidateQuery(input: NormalizedKnowledgeSearchInput) {
  return {
    where: buildKnowledgeCandidateWhere(input),
    select: knowledgeCandidateSelect,
    orderBy: [{ updatedAt: "desc" as const }, { id: "asc" as const }],
    take: KNOWLEDGE_SEARCH_CANDIDATE_LIMIT,
  };
}

function text(value: string | null | undefined) {
  return value?.trim().toLocaleLowerCase("en") ?? "";
}

function key(value: string | null | undefined) {
  return text(value)
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_|_$/g, "");
}

function identifier(value: string | null | undefined) {
  return value?.toUpperCase().replace(/[^A-Z0-9]/g, "") ?? "";
}

function exactOrPartial(stored: string | null | undefined, requested: string) {
  const left = text(stored);
  const right = text(requested);
  if (!left || !right) return 0;
  if (left === right) return 2;
  return left.includes(right) || right.includes(left) ? 1 : 0;
}

function yearMatches(
  item: KnowledgeCandidate["applicability"][number],
  year: number,
) {
  return (
    (item.yearFrom === null || item.yearFrom <= year) &&
    (item.yearTo === null || item.yearTo >= year)
  );
}

function enginePatternMatches(
  item: KnowledgeCandidate["applicability"][number],
  requested: string,
) {
  const pattern = item.engineCodePattern?.trim();
  if (!pattern || item.engineMatchType === "ALL") return false;

  const requestedCode = identifier(requested);
  const patternCode = identifier(pattern.replace(/[?*%_]/g, ""));

  if (item.engineMatchType === "PREFIX") {
    return !!patternCode && requestedCode.startsWith(patternCode);
  }
  if (item.engineMatchType === "FAMILY") {
    return identifier(item.engineFamily) === requestedCode;
  }
  if (item.engineMatchType === "EXACT") {
    return patternCode === requestedCode;
  }

  const escaped = pattern
    .toUpperCase()
    .replace(/[.+^${}()|[\]\\]/g, "\\$&")
    .replace(/[\*%]/g, ".*")
    .replace(/[\?_]/g, ".");

  try {
    return new RegExp(`^${escaped}$`, "i").test(requested);
  } catch {
    return patternCode === requestedCode;
  }
}

function faultCodeMatches(
  item: KnowledgeCandidate["faultCodes"][number],
  requested: string,
) {
  const normalized = normalizeDtcSearchValue(item.normalizedCode ?? "");
  if (normalized && normalized === requested) return "exact_dtc" as const;

  const raw = identifier(item.rawCode);
  const manufacturer = identifier(item.manufacturerCode);
  return raw.includes(requested) || manufacturer.includes(requested)
    ? ("manufacturer_dtc" as const)
    : null;
}

function symptomMatches(
  item: KnowledgeCandidate["symptoms"][number],
  requested: string,
) {
  if (key(item.normalizedLabel) === key(requested)) return 2;
  const requestedText = text(requested);
  return text(item.label).includes(requestedText) ||
    text(item.details).includes(requestedText)
    ? 1
    : 0;
}

function componentMatches(
  item: KnowledgeCandidate["components"][number],
  requested: string,
) {
  if (key(item.normalizedName) === key(requested)) return 2;
  const requestedText = text(requested);
  return text(item.name).includes(requestedText) ||
    text(item.manufacturerIdentifier).includes(requestedText)
    ? 1
    : 0;
}

function matchingApplicability(
  candidate: KnowledgeCandidate,
  input: NormalizedKnowledgeSearchInput,
) {
  const hasTextCriterion = Boolean(
    input.brand || input.model || input.engineCode || input.engineFamily,
  );

  return candidate.applicability.filter((item) => {
    if (input.year !== undefined && !yearMatches(item, input.year))
      return false;
    if (!hasTextCriterion) return input.year !== undefined;

    return Boolean(
      (input.brand && exactOrPartial(item.brand, input.brand)) ||
      (input.model && exactOrPartial(item.model, input.model)) ||
      (input.engineCode &&
        (identifier(item.engineCode) === identifier(input.engineCode) ||
          enginePatternMatches(item, input.engineCode))) ||
      (input.engineFamily &&
        exactOrPartial(item.engineFamily, input.engineFamily)),
    );
  });
}

export type KnowledgeSearchResult = {
  caseId: string;
  title: string;
  summary: string | null;
  primarySystem: string | null;
  provenance: {
    validationStatus: KnowledgeCandidate["validationStatus"];
    importedAutomatically: boolean;
    reviewedByHuman: boolean;
    reviewedAt: Date | null;
  };
  matchingApplicability: KnowledgeCandidate["applicability"];
  matchingDtcs: KnowledgeCandidate["faultCodes"];
  matchingSymptoms: KnowledgeCandidate["symptoms"];
  matchingComponents: KnowledgeCandidate["components"];
  score: number;
  matchReasons: KnowledgeMatchReason[];
};

export function rankKnowledgeCandidates(
  candidates: KnowledgeCandidate[],
  searchInput: KnowledgeSearchInput,
): KnowledgeSearchResult[] {
  const input = normalizeKnowledgeSearchInput(searchInput);

  return candidates
    .map((candidate): KnowledgeSearchResult | null => {
      let score = 0;
      const reasons = new Set<KnowledgeMatchReason>();
      const eligibleApplicability = candidate.applicability.filter(
        (item) => input.year === undefined || yearMatches(item, input.year),
      );

      if (input.year !== undefined) {
        if (eligibleApplicability.length === 0) return null;
        score += KNOWLEDGE_RANKING_WEIGHTS.year;
        reasons.add("year");
      }

      const brandMatch = input.brand
        ? Math.max(
            0,
            ...eligibleApplicability.map((item) =>
              exactOrPartial(item.brand, input.brand!),
            ),
          )
        : 0;
      if (brandMatch) {
        score +=
          brandMatch === 2
            ? KNOWLEDGE_RANKING_WEIGHTS.brand
            : KNOWLEDGE_RANKING_WEIGHTS.brandPartial;
        reasons.add("brand");
      }

      const modelMatch = input.model
        ? Math.max(
            0,
            ...eligibleApplicability.map((item) =>
              exactOrPartial(item.model, input.model!),
            ),
          )
        : 0;
      if (modelMatch) {
        score +=
          modelMatch === 2
            ? KNOWLEDGE_RANKING_WEIGHTS.model
            : KNOWLEDGE_RANKING_WEIGHTS.modelPartial;
        reasons.add("model");
      }

      if (input.engineCode) {
        const exactEngine = eligibleApplicability.some(
          (item) =>
            identifier(item.engineCode) === identifier(input.engineCode),
        );
        const patternEngine = eligibleApplicability.some((item) =>
          enginePatternMatches(item, input.engineCode!),
        );
        if (exactEngine) {
          score += KNOWLEDGE_RANKING_WEIGHTS.exactEngineCode;
          reasons.add("exact_engine_code");
        } else if (patternEngine) {
          score += KNOWLEDGE_RANKING_WEIGHTS.enginePattern;
          reasons.add("engine_pattern");
        }
      }

      const familyMatch = input.engineFamily
        ? Math.max(
            0,
            ...eligibleApplicability.map((item) =>
              exactOrPartial(item.engineFamily, input.engineFamily!),
            ),
          )
        : 0;
      if (familyMatch) {
        score +=
          familyMatch === 2
            ? KNOWLEDGE_RANKING_WEIGHTS.engineFamily
            : KNOWLEDGE_RANKING_WEIGHTS.engineFamilyPartial;
        reasons.add("engine_family");
      }

      const matchingDtcs = input.dtc
        ? candidate.faultCodes.filter((item) =>
            faultCodeMatches(item, input.dtc!),
          )
        : [];
      if (input.dtc) {
        const dtcReasons = matchingDtcs
          .map((item) => faultCodeMatches(item, input.dtc!))
          .filter((reason): reason is NonNullable<typeof reason> => !!reason);
        if (dtcReasons.includes("exact_dtc")) {
          score += KNOWLEDGE_RANKING_WEIGHTS.exactDtc;
          reasons.add("exact_dtc");
        } else if (dtcReasons.includes("manufacturer_dtc")) {
          score += KNOWLEDGE_RANKING_WEIGHTS.manufacturerDtc;
          reasons.add("manufacturer_dtc");
        }
      }

      const matchingSymptoms = candidate.symptoms.filter((item) =>
        (input.symptoms ?? []).some((requested) =>
          symptomMatches(item, requested),
        ),
      );
      let symptomScore = 0;
      for (const requested of input.symptoms ?? []) {
        const quality = Math.max(
          0,
          ...candidate.symptoms.map((item) => symptomMatches(item, requested)),
        );
        symptomScore +=
          quality === 2
            ? KNOWLEDGE_RANKING_WEIGHTS.normalizedSymptom
            : quality === 1
              ? KNOWLEDGE_RANKING_WEIGHTS.sourceSymptom
              : 0;
      }
      symptomScore = Math.min(
        symptomScore,
        KNOWLEDGE_RANKING_WEIGHTS.normalizedSymptom * 3,
      );
      if (symptomScore) {
        score += symptomScore;
        reasons.add("symptom");
      }

      const matchingComponents = candidate.components.filter(
        (item) =>
          (input.components ?? []).some((requested) =>
            componentMatches(item, requested),
          ) ||
          (input.system
            ? exactOrPartial(item.system, input.system) > 0
            : false),
      );
      let componentScore = 0;
      for (const requested of input.components ?? []) {
        const quality = Math.max(
          0,
          ...candidate.components.map((item) =>
            componentMatches(item, requested),
          ),
        );
        componentScore +=
          quality === 2
            ? KNOWLEDGE_RANKING_WEIGHTS.normalizedComponent
            : quality === 1
              ? KNOWLEDGE_RANKING_WEIGHTS.sourceComponent
              : 0;
      }
      componentScore = Math.min(
        componentScore,
        KNOWLEDGE_RANKING_WEIGHTS.normalizedComponent * 3,
      );
      if (componentScore) {
        score += componentScore;
        reasons.add("component");
      }

      if (input.system) {
        const systemQuality = Math.max(
          exactOrPartial(candidate.primarySystem, input.system),
          ...candidate.components.map((item) =>
            exactOrPartial(item.system, input.system!),
          ),
        );
        if (systemQuality) {
          score +=
            systemQuality === 2
              ? KNOWLEDGE_RANKING_WEIGHTS.system
              : KNOWLEDGE_RANKING_WEIGHTS.systemPartial;
          reasons.add("system");
        }
      }

      if (score === 0) return null;

      return {
        caseId: candidate.id,
        title: candidate.title,
        summary: candidate.summary,
        primarySystem: candidate.primarySystem,
        provenance: {
          validationStatus: candidate.validationStatus,
          importedAutomatically: candidate.importedAutomatically,
          reviewedByHuman: candidate.reviewedByHuman,
          reviewedAt: candidate.reviewedAt,
        },
        matchingApplicability: matchingApplicability(candidate, input),
        matchingDtcs,
        matchingSymptoms,
        matchingComponents,
        score,
        matchReasons: [...reasons],
      };
    })
    .filter((result): result is KnowledgeSearchResult => result !== null)
    .sort(
      (left, right) =>
        right.score - left.score ||
        left.title.localeCompare(right.title) ||
        left.caseId.localeCompare(right.caseId),
    )
    .slice(0, input.limit);
}

export function knowledgeCaseContextQuery(caseId: string) {
  const query = technicalCaseDetailQuery(caseId);

  return {
    ...query,
    where: {
      id: caseId,
      validationStatus: { in: [...searchableKnowledgeStatuses] },
    },
  };
}
