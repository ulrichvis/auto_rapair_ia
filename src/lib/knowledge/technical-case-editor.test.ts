import assert from "node:assert/strict";
import test from "node:test";

import { buildKnowledgeImportPlan } from "../import/knowledge-import-plan";
import {
  technicalCaseEditQuery,
  technicalCaseToEditDraft,
  type TechnicalCaseEditRecord,
} from "./technical-case-editor";

test("edit query loads every editable relation and linked media safeguards", () => {
  const query = technicalCaseEditQuery("case-1");

  assert.equal(query.where.id, "case-1");
  assert.ok(query.include.applicability);
  assert.ok(query.include.faultCodes);
  assert.ok(query.include.symptoms);
  assert.ok(query.include.components);
  assert.ok(query.include.causes);
  assert.ok(query.include.solutions);
  assert.ok(query.include.procedures.include.steps);
  assert.ok(query.include.measurementSpecs);
  assert.ok(query.include.notes);
  assert.ok(query.include.parts);
  assert.ok(query.include.media);
});

test("maps imported relational knowledge to an editable source-language draft", () => {
  const technicalCase = {
    id: "case-1",
    title: "Pressione di sovralimentazione insufficiente",
    summary: "Potenza motore ridotta.",
    problemDescription: "Il valore richiesto non viene raggiunto.",
    primarySystem: "Sovralimentazione",
    sources: [
      {
        isPrimary: true,
        sourceDocument: {
          id: "document-1",
          originalFilename: "diagnosi.pdf",
          title: "Diagnosi turbo",
          bulletinReference: "TSB-1",
          publisher: "Officina",
          language: "it",
          pageCount: 3,
          claimedPageCount: 3,
        },
      },
    ],
    applicability: [
      {
        id: "app-1",
        brand: "Volkswagen",
        model: "Golf",
        generationOrPlatform: null,
        yearFrom: 2008,
        yearTo: 2012,
        engineLabel: "2.0 TDI",
        engineFamily: "EA189",
        engineCode: "CBAB",
        engineCodePattern: null,
        engineMatchType: "EXACT",
        fuelType: "Diesel",
        transmission: null,
        variantNotes: null,
        sourcePage: 1,
        sourceDocumentId: "document-1",
      },
    ],
    faultCodes: [
      {
        rawCode: "P0299",
        normalizedCode: "P0299",
        manufacturerCode: null,
        description: "Pressione turbo insufficiente",
        role: "PRIMARY",
        controlModule: null,
        sourcePage: 1,
        sourceDocumentId: "document-1",
      },
    ],
    symptoms: [],
    components: [
      {
        id: "component-1",
        name: "Attuatore pressione turbo",
        normalizedName: "turbo_actuator",
        manufacturerIdentifier: "N75",
        system: "Sovralimentazione",
        role: null,
        sourcePage: 2,
        sourceDocumentId: "document-1",
      },
    ],
    causes: [
      {
        description: "Attuatore bloccato",
        componentId: "component-1",
        category: null,
        certainty: "PROBABLE",
        priority: 1,
        conditionText: null,
        sourcePage: 2,
        sourceDocumentId: "document-1",
      },
    ],
    solutions: [],
    procedures: [
      {
        type: "DIAGNOSTIC",
        title: "Controllo attuatore",
        description: null,
        position: 1,
        steps: [
          {
            id: "step-1",
            position: 1,
            instruction: "Misurare la tensione.",
            precondition: "Motore acceso",
            expectedResult: null,
            ifPass: null,
            ifFail: null,
            toolsText: "Multimetro",
            componentId: "component-1",
            applicabilityId: "app-1",
            sourcePage: 2,
            sourceDocumentId: "document-1",
          },
        ],
      },
    ],
    measurementSpecs: [
      {
        procedureStepId: "step-1",
        componentId: "component-1",
        applicabilityId: "app-1",
        parameter: "Tensione sensore",
        measurementType: "VOLTAGE",
        targetValue: { toString: () => "0.76" },
        minValue: null,
        maxValue: null,
        tolerancePlus: null,
        toleranceMinus: null,
        unit: "V",
        expectedText: null,
        conditionText: "Motore al minimo",
        durationSeconds: null,
        repeatCount: null,
        isApproximate: false,
        isExample: false,
        sourcePage: 2,
        sourceDocumentId: "document-1",
      },
    ],
    notes: [],
    parts: [],
  } as unknown as TechnicalCaseEditRecord;

  const edit = technicalCaseToEditDraft(technicalCase);
  const draftCase = edit.draft.cases[0];

  assert.equal(edit.sourceDocumentId, "document-1");
  assert.equal(edit.draft.document.language, "it");
  assert.equal(draftCase.title, technicalCase.title);
  assert.equal(draftCase.causes[0].certainty, "LIKELY");
  assert.equal(
    draftCase.causes[0].componentReference,
    draftCase.components[0].reference,
  );
  assert.equal(draftCase.measurements[0].targetValue, 0.76);
  assert.equal(draftCase.measurements[0].unit, "V");
  assert.equal(draftCase.measurements[0].sourcePage, 2);
  assert.equal(
    draftCase.measurements[0].procedureStepReference,
    draftCase.procedures[0].steps[0].reference,
  );
  assert.doesNotThrow(() =>
    buildKnowledgeImportPlan(edit.draft, { maxSourcePage: 3 }),
  );
});
