import assert from "node:assert/strict";
import test from "node:test";

import {
  EmptyKnowledgeSearchError,
  KNOWLEDGE_RANKING_WEIGHTS,
  buildKnowledgeCandidateWhere,
  knowledgeCandidateQuery,
  knowledgeCaseContextQuery,
  normalizeKnowledgeSearchInput,
  rankKnowledgeCandidates,
  type KnowledgeCandidate,
} from "./knowledge-retrieval";

function candidate(
  id: string,
  overrides: Partial<KnowledgeCandidate> = {},
): KnowledgeCandidate {
  return {
    id,
    title: `Caso ${id}`,
    summary: "Contenuto tecnico originale in italiano",
    primarySystem: "Sovralimentazione",
    validationStatus: "IN_REVIEW",
    importedAutomatically: true,
    reviewedByHuman: false,
    reviewedAt: null,
    updatedAt: new Date("2026-08-18T10:00:00.000Z"),
    applicability: [],
    faultCodes: [],
    symptoms: [],
    components: [],
    ...overrides,
  };
}

const vwApplicability = {
  id: "app-vw",
  brand: "Volkswagen",
  model: "Golf",
  yearFrom: 2009,
  yearTo: 2013,
  engineFamily: "EA189",
  engineCode: "CBAB",
  engineCodePattern: null,
  engineMatchType: "EXACT" as const,
};

const p0299 = {
  id: "dtc-p0299",
  rawCode: "P029900",
  normalizedCode: "P0299",
  manufacturerCode: "16683",
  description: "Pressione di sovralimentazione insufficiente",
};

test("rejects a completely empty knowledge search", () => {
  assert.throws(
    () => normalizeKnowledgeSearchInput({}),
    EmptyKnowledgeSearchError,
  );
});

test("normalizes and ranks an exact DTC match", () => {
  const results = rankKnowledgeCandidates(
    [candidate("exact", { faultCodes: [p0299] })],
    { dtc: " p0299-00 " },
  );

  assert.equal(results[0].score, KNOWLEDGE_RANKING_WEIGHTS.exactDtc);
  assert.deepEqual(results[0].matchReasons, ["exact_dtc"]);
  assert.equal(results[0].matchingDtcs[0].rawCode, "P029900");
});

test("exact DTC plus exact engine outranks a DTC-only case", () => {
  const results = rankKnowledgeCandidates(
    [
      candidate("generic", { faultCodes: [p0299] }),
      candidate("specific", {
        applicability: [vwApplicability],
        faultCodes: [p0299],
      }),
    ],
    { dtc: "P0299", engineCode: "CBAB" },
  );

  assert.equal(results[0].caseId, "specific");
  assert.equal(
    results[0].score,
    KNOWLEDGE_RANKING_WEIGHTS.exactDtc +
      KNOWLEDGE_RANKING_WEIGHTS.exactEngineCode,
  );
});

test("matches an engine family", () => {
  const [result] = rankKnowledgeCandidates(
    [candidate("family", { applicability: [vwApplicability] })],
    { engineFamily: "EA189" },
  );

  assert.equal(result.score, KNOWLEDGE_RANKING_WEIGHTS.engineFamily);
  assert.deepEqual(result.matchReasons, ["engine_family"]);
});

test("supports the stored engine prefix semantics", () => {
  const [result] = rankKnowledgeCandidates(
    [
      candidate("engine-pattern", {
        applicability: [
          {
            ...vwApplicability,
            engineCode: null,
            engineCodePattern: "CAY*",
            engineMatchType: "PREFIX",
          },
        ],
      }),
    ],
    { engineCode: "CAYB" },
  );

  assert.equal(result.score, KNOWLEDGE_RANKING_WEIGHTS.enginePattern);
  assert.deepEqual(result.matchReasons, ["engine_pattern"]);
});

test("matches brand and model", () => {
  const [result] = rankKnowledgeCandidates(
    [candidate("vehicle", { applicability: [vwApplicability] })],
    { brand: "volkswagen", model: "Golf" },
  );

  assert.deepEqual(result.matchReasons, ["brand", "model"]);
  assert.equal(result.matchingApplicability[0].id, "app-vw");
});

test("matches a normalized symptom before source-language fallback", () => {
  const [result] = rankKnowledgeCandidates(
    [
      candidate("symptom", {
        symptoms: [
          {
            id: "symptom-1",
            label: "Potenza motore ridotta",
            normalizedLabel: "low_power",
            details: "Perdita di potenza in accelerazione",
          },
        ],
      }),
    ],
    { symptoms: ["low power"] },
  );

  assert.equal(result.score, KNOWLEDGE_RANKING_WEIGHTS.normalizedSymptom);
  assert.deepEqual(result.matchReasons, ["symptom"]);
});

test("matches a normalized component and manufacturer identifier", () => {
  const [result] = rankKnowledgeCandidates(
    [
      candidate("component", {
        components: [
          {
            id: "component-1",
            name: "Elettrovalvola pressione turbo",
            normalizedName: "boost_control_solenoid",
            manufacturerIdentifier: "N75",
            system: "Sovralimentazione",
          },
        ],
      }),
    ],
    { components: ["boost control solenoid"] },
  );

  assert.equal(result.score, KNOWLEDGE_RANKING_WEIGHTS.normalizedComponent);
  assert.deepEqual(result.matchReasons, ["component"]);
});

test("multiple criteria increase the deterministic score", () => {
  const full = candidate("full", {
    applicability: [vwApplicability],
    faultCodes: [p0299],
  });
  const dtcOnly = candidate("dtc-only", { faultCodes: [p0299] });
  const results = rankKnowledgeCandidates([dtcOnly, full], {
    brand: "Volkswagen",
    engineFamily: "EA189",
    dtc: "P0299",
  });

  assert.equal(results[0].caseId, "full");
  assert.ok(results[0].score > results[1].score);
});

test("excludes an irrelevant candidate", () => {
  const results = rankKnowledgeCandidates([candidate("irrelevant")], {
    dtc: "P0299",
  });

  assert.deepEqual(results, []);
});

test("requires and scores year applicability when a year is provided", () => {
  const results = rankKnowledgeCandidates(
    [
      candidate("inside", { applicability: [vwApplicability] }),
      candidate("outside", {
        applicability: [{ ...vwApplicability, id: "app-old", yearTo: 2008 }],
      }),
    ],
    { year: 2011 },
  );

  assert.equal(results.length, 1);
  assert.equal(results[0].caseId, "inside");
  assert.deepEqual(results[0].matchReasons, ["year"]);
});

test("supports manufacturer DTC lookup", () => {
  const [result] = rankKnowledgeCandidates(
    [candidate("manufacturer", { faultCodes: [p0299] })],
    { dtc: "16683" },
  );

  assert.equal(result.score, KNOWLEDGE_RANKING_WEIGHTS.manufacturerDtc);
  assert.deepEqual(result.matchReasons, ["manufacturer_dtc"]);
});

test("enforces the requested top-N limit and maximum", () => {
  const candidates = Array.from({ length: 30 }, (_, index) =>
    candidate(`case-${index.toString().padStart(2, "0")}`, {
      faultCodes: [p0299],
    }),
  );

  assert.equal(
    rankKnowledgeCandidates(candidates, { dtc: "P0299", limit: 3 }).length,
    3,
  );
  assert.equal(
    rankKnowledgeCandidates(candidates, { dtc: "P0299", limit: 100 }).length,
    25,
  );
});

test("returns all matching reason codes without duplicates", () => {
  const [result] = rankKnowledgeCandidates(
    [
      candidate("reasons", {
        applicability: [vwApplicability],
        faultCodes: [p0299],
        components: [
          {
            id: "component-1",
            name: "Turbocompressore",
            normalizedName: "turbocharger",
            manufacturerIdentifier: null,
            system: "Sovralimentazione",
          },
        ],
      }),
    ],
    {
      brand: "Volkswagen",
      engineCode: "CBAB",
      dtc: "P0299",
      components: ["turbocharger"],
      system: "Sovralimentazione",
      year: 2011,
    },
  );

  assert.deepEqual(result.matchReasons, [
    "year",
    "brand",
    "exact_engine_code",
    "exact_dtc",
    "component",
    "system",
  ]);
});

test("candidate query uses structured relations and stays bounded", () => {
  const normalized = normalizeKnowledgeSearchInput({
    brand: "Volkswagen",
    dtc: "P0299",
  });
  const query = knowledgeCandidateQuery(normalized);

  assert.equal(query.take, 250);
  assert.ok(query.select.applicability);
  assert.ok(query.select.faultCodes);
  assert.equal("rawOutput" in query.select, false);
  assert.equal("procedures" in query.select, false);
  assert.ok(buildKnowledgeCandidateWhere(normalized).AND);
});

test("case context query loads full relations and ordered procedure steps", () => {
  const query = knowledgeCaseContextQuery("case-1");

  assert.deepEqual(query.include.procedures.orderBy, { position: "asc" });
  assert.deepEqual(query.include.procedures.include.steps.orderBy, {
    position: "asc",
  });
  assert.ok(query.include.measurementSpecs.include.sourceDocument);
  assert.ok(query.include.notes.include.sourceDocument);
  assert.ok(query.include.parts.include.sourceDocument);
});

test("preserves source-language content and provenance", () => {
  const source = candidate("italian", {
    title: "Pressione turbo insufficiente",
    summary: "Controllare le tubazioni senza tradurre il testo.",
    validationStatus: "VALIDATED",
    importedAutomatically: true,
    reviewedByHuman: true,
    reviewedAt: new Date("2026-08-18T12:00:00.000Z"),
    faultCodes: [p0299],
  });
  const [result] = rankKnowledgeCandidates([source], { dtc: "P0299" });

  assert.equal(result.title, source.title);
  assert.equal(result.summary, source.summary);
  assert.deepEqual(result.provenance, {
    validationStatus: "VALIDATED",
    importedAutomatically: true,
    reviewedByHuman: true,
    reviewedAt: new Date("2026-08-18T12:00:00.000Z"),
  });
});
