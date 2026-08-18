import type { Prisma } from "@/generated/prisma/client";

export const validationStatuses = [
  "DRAFT",
  "IN_REVIEW",
  "VALIDATED",
  "REJECTED",
] as const;

export type CaseBrowserFilters = {
  q?: string;
  status?: string;
  brand?: string;
  model?: string;
  engineCode?: string;
  engineFamily?: string;
  dtc?: string;
  symptom?: string;
  component?: string;
  system?: string;
};

function clean(value: string | undefined) {
  return value?.trim().slice(0, 100) || undefined;
}

export function normalizeCaseBrowserFilters(
  filters: CaseBrowserFilters,
): CaseBrowserFilters {
  const status = clean(filters.status);

  return {
    q: clean(filters.q),
    status: validationStatuses.includes(
      status as (typeof validationStatuses)[number],
    )
      ? status
      : undefined,
    brand: clean(filters.brand),
    model: clean(filters.model),
    engineCode: clean(filters.engineCode),
    engineFamily: clean(filters.engineFamily),
    dtc: clean(filters.dtc)?.toUpperCase(),
    symptom: clean(filters.symptom),
    component: clean(filters.component),
    system: clean(filters.system),
  };
}

export function buildTechnicalCaseWhere(
  input: CaseBrowserFilters,
): Prisma.TechnicalCaseWhereInput {
  const filters = normalizeCaseBrowserFilters(input);
  const AND: Prisma.TechnicalCaseWhereInput[] = [];

  if (filters.q) {
    AND.push({ title: { contains: filters.q, mode: "insensitive" } });
  }
  if (filters.status) {
    AND.push({
      validationStatus: filters.status as (typeof validationStatuses)[number],
    });
  }
  if (filters.brand) {
    AND.push({
      applicability: {
        some: { brand: { contains: filters.brand, mode: "insensitive" } },
      },
    });
  }
  if (filters.model) {
    AND.push({
      applicability: {
        some: { model: { contains: filters.model, mode: "insensitive" } },
      },
    });
  }
  if (filters.engineCode) {
    AND.push({
      applicability: {
        some: {
          engineCode: { equals: filters.engineCode, mode: "insensitive" },
        },
      },
    });
  }
  if (filters.engineFamily) {
    AND.push({
      applicability: {
        some: {
          engineFamily: {
            contains: filters.engineFamily,
            mode: "insensitive",
          },
        },
      },
    });
  }
  if (filters.dtc) {
    AND.push({
      faultCodes: {
        some: {
          normalizedCode: { equals: filters.dtc, mode: "insensitive" },
        },
      },
    });
  }
  if (filters.symptom) {
    AND.push({
      symptoms: {
        some: {
          OR: [
            { label: { contains: filters.symptom, mode: "insensitive" } },
            {
              normalizedLabel: {
                contains: filters.symptom,
                mode: "insensitive",
              },
            },
          ],
        },
      },
    });
  }
  if (filters.component) {
    AND.push({
      components: {
        some: {
          OR: [
            { name: { contains: filters.component, mode: "insensitive" } },
            {
              normalizedName: {
                contains: filters.component,
                mode: "insensitive",
              },
            },
            {
              manufacturerIdentifier: {
                equals: filters.component,
                mode: "insensitive",
              },
            },
          ],
        },
      },
    });
  }
  if (filters.system) {
    AND.push({
      primarySystem: { contains: filters.system, mode: "insensitive" },
    });
  }

  return AND.length > 0 ? { AND } : {};
}

const sourceDocumentSelect = {
  id: true,
  originalFilename: true,
  bulletinReference: true,
} as const;

export function technicalCaseListQuery(filters: CaseBrowserFilters) {
  return {
    where: buildTechnicalCaseWhere(filters),
    orderBy: { updatedAt: "desc" as const },
    select: {
      id: true,
      title: true,
      primarySystem: true,
      validationStatus: true,
      updatedAt: true,
      faultCodes: {
        orderBy: { rawCode: "asc" as const },
        select: { id: true, rawCode: true, normalizedCode: true },
      },
      applicability: {
        orderBy: [{ brand: "asc" as const }, { model: "asc" as const }],
        select: {
          id: true,
          brand: true,
          model: true,
          engineCode: true,
          engineFamily: true,
        },
      },
    },
  };
}

export function technicalCaseDetailQuery(caseId: string) {
  return {
    where: { id: caseId },
    include: {
      sources: {
        orderBy: { isPrimary: "desc" as const },
        include: { sourceDocument: { select: sourceDocumentSelect } },
      },
      applicability: {
        orderBy: { id: "asc" as const },
        include: { sourceDocument: { select: sourceDocumentSelect } },
      },
      faultCodes: {
        orderBy: { id: "asc" as const },
        include: { sourceDocument: { select: sourceDocumentSelect } },
      },
      symptoms: {
        orderBy: { id: "asc" as const },
        include: { sourceDocument: { select: sourceDocumentSelect } },
      },
      components: {
        orderBy: { id: "asc" as const },
        include: { sourceDocument: { select: sourceDocumentSelect } },
      },
      causes: {
        orderBy: [{ priority: "asc" as const }, { id: "asc" as const }],
        include: {
          component: { select: { name: true, manufacturerIdentifier: true } },
          sourceDocument: { select: sourceDocumentSelect },
        },
      },
      solutions: {
        orderBy: [{ priority: "asc" as const }, { id: "asc" as const }],
        include: {
          component: { select: { name: true, manufacturerIdentifier: true } },
          sourceDocument: { select: sourceDocumentSelect },
        },
      },
      procedures: {
        orderBy: { position: "asc" as const },
        include: {
          steps: {
            orderBy: { position: "asc" as const },
            include: {
              component: {
                select: { name: true, manufacturerIdentifier: true },
              },
              applicability: {
                select: {
                  brand: true,
                  model: true,
                  engineCode: true,
                  engineFamily: true,
                },
              },
              sourceDocument: { select: sourceDocumentSelect },
            },
          },
        },
      },
      measurementSpecs: {
        orderBy: { id: "asc" as const },
        include: {
          component: { select: { name: true, manufacturerIdentifier: true } },
          applicability: {
            select: {
              brand: true,
              model: true,
              engineCode: true,
              engineFamily: true,
            },
          },
          procedureStep: {
            select: {
              position: true,
              procedure: { select: { title: true, position: true } },
            },
          },
          sourceDocument: { select: sourceDocumentSelect },
        },
      },
      notes: {
        orderBy: { id: "asc" as const },
        include: { sourceDocument: { select: sourceDocumentSelect } },
      },
      parts: {
        orderBy: { partNumber: "asc" as const },
        include: {
          component: { select: { name: true, manufacturerIdentifier: true } },
          applicability: {
            select: {
              brand: true,
              model: true,
              engineCode: true,
              engineFamily: true,
            },
          },
          sourceDocument: { select: sourceDocumentSelect },
        },
      },
    },
  };
}
