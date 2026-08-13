import assert from "node:assert/strict";
import test from "node:test";

import { validateAutomotiveExtractionDraft } from "../extraction/automotive-draft-schema";
import {
  buildKnowledgeImportPlan,
  KnowledgeImportValidationError,
  type ImportValidationCode,
} from "./knowledge-import-plan";

function completeDraft() {
  return validateAutomotiveExtractionDraft({
    document: {
      detectedTitle: "Diagnosi pressione turbo",
      bulletinReference: "TSB-IT-1",
      publisher: "Editore tecnico",
      language: "it",
      claimedPageCount: 4,
      completenessNotes: "Documento completo.",
    },
    cases: [
      {
        title: "Pressione di sovralimentazione insufficiente",
        summary: "Potenza motore ridotta.",
        problemDescription: "La pressione non raggiunge il valore richiesto.",
        primarySystem: "Sovralimentazione",
        applicability: [
          {
            reference: "motore-cbab",
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
            variantNotes: "Solo motore CBAB",
            sourcePage: 1,
          },
        ],
        faultCodes: [
          {
            rawCode: "P0299",
            normalizedCode: "P0299",
            manufacturerCode: "16683",
            description: "Pressione di sovralimentazione insufficiente",
            role: "PRIMARY",
            controlModule: "ECU motore",
            sourcePage: 1,
          },
        ],
        symptoms: [
          {
            label: "potenza motore ridotta",
            normalizedLabel: "low_power",
            details: null,
            operatingCondition: "In accelerazione",
            sourcePage: 1,
          },
        ],
        components: [
          {
            reference: "valvola-n75",
            name: "elettrovalvola pressione turbo",
            normalizedName: "boost_control_solenoid",
            manufacturerIdentifier: "N75",
            system: "Sovralimentazione",
            role: null,
            sourcePage: 2,
          },
        ],
        causes: [
          {
            description: "Elettrovalvola bloccata",
            componentReference: "valvola-n75",
            category: null,
            certainty: "LIKELY",
            priority: 1,
            conditionText: null,
            sourcePage: 2,
          },
        ],
        solutions: [
          {
            type: "REPLACE",
            description: "Sostituire l'elettrovalvola se difettosa.",
            componentReference: "valvola-n75",
            conditionText: "Dopo conferma diagnostica",
            priority: 1,
            sourcePage: 4,
          },
        ],
        procedures: [
          {
            type: "DIAGNOSTIC",
            title: "Controllo pressione",
            description: null,
            position: 2,
            steps: [
              {
                reference: "test-n75",
                position: 3,
                instruction: "Misurare la tensione sulla N75.",
                precondition: "Motore acceso",
                expectedResult: "Valore entro specifica",
                ifPass: null,
                ifFail: "Controllare il cablaggio",
                toolsText: "Multimetro",
                componentReference: "valvola-n75",
                applicabilityReference: "motore-cbab",
                sourcePage: 3,
              },
            ],
          },
        ],
        measurements: [
          {
            procedureStepReference: "test-n75",
            componentReference: "valvola-n75",
            applicabilityReference: "motore-cbab",
            parameter: "Tensione comando N75",
            measurementType: "VOLTAGE",
            targetValue: 0.76,
            minValue: 0.7,
            maxValue: 0.8,
            tolerancePlus: null,
            toleranceMinus: null,
            unit: "V",
            expectedText: null,
            conditionText: "Motore al minimo",
            durationSeconds: null,
            repeatCount: 1,
            isApproximate: false,
            isExample: false,
            sourcePage: 3,
          },
        ],
        notes: [
          {
            procedureStepReference: "test-n75",
            applicabilityReference: "motore-cbab",
            type: "WARNING",
            text: "Verificare il VIN prima della sostituzione.",
            externalReference: null,
            sourcePage: 4,
          },
        ],
        parts: [
          {
            componentReference: "valvola-n75",
            applicabilityReference: "motore-cbab",
            partNumber: "1K0906627A",
            description: "Elettrovalvola pressione turbo",
            role: null,
            vinVerificationRequired: true,
            sourcePage: 4,
          },
        ],
      },
    ],
  });
}

function expectIssue(action: () => unknown, code: ImportValidationCode) {
  assert.throws(action, (error) => {
    assert.ok(error instanceof KnowledgeImportValidationError);
    assert.ok(error.issues.some((issue) => issue.code === code));
    return true;
  });
}

test("builds a complete import plan and resolves all relationships", () => {
  const plan = buildKnowledgeImportPlan(completeDraft(), { maxSourcePage: 4 });
  assert.deepEqual(plan.references[0].causeComponents, [0]);
  assert.deepEqual(plan.references[0].solutionComponents, [0]);
  assert.deepEqual(plan.references[0].steps[0][0], {
    component: 0,
    applicability: 0,
  });
  assert.deepEqual(plan.references[0].measurements[0], {
    procedureStep: { procedure: 0, step: 0 },
    component: 0,
    applicability: 0,
  });
});

test("rejects an invalid year range", () => {
  const draft = completeDraft();
  draft.cases[0].applicability[0].yearFrom = 2013;
  expectIssue(() => buildKnowledgeImportPlan(draft), "INVALID_YEAR_RANGE");
});

test("rejects an invalid measurement range", () => {
  const draft = completeDraft();
  draft.cases[0].measurements[0].minValue = 2;
  expectIssue(
    () => buildKnowledgeImportPlan(draft),
    "INVALID_MEASUREMENT_RANGE",
  );
});

test("rejects an unresolved component reference", () => {
  const draft = completeDraft();
  draft.cases[0].causes[0].componentReference = "componente-assente";
  expectIssue(
    () => buildKnowledgeImportPlan(draft),
    "UNRESOLVED_COMPONENT_REFERENCE",
  );
});

test("rejects an unresolved applicability reference", () => {
  const draft = completeDraft();
  draft.cases[0].procedures[0].steps[0].applicabilityReference =
    "variante-assente";
  expectIssue(
    () => buildKnowledgeImportPlan(draft),
    "UNRESOLVED_APPLICABILITY_REFERENCE",
  );
});

test("rejects an unresolved procedure step reference", () => {
  const draft = completeDraft();
  draft.cases[0].measurements[0].procedureStepReference = "passaggio-assente";
  expectIssue(
    () => buildKnowledgeImportPlan(draft),
    "UNRESOLVED_STEP_REFERENCE",
  );
});

test("preserves procedure and step ordering values", () => {
  const plan = buildKnowledgeImportPlan(completeDraft());
  assert.equal(plan.draft.cases[0].procedures[0].position, 2);
  assert.equal(plan.draft.cases[0].procedures[0].steps[0].position, 3);
});

test("rejects duplicate procedure and step positions", () => {
  const procedureDraft = completeDraft();
  procedureDraft.cases[0].procedures.push(
    structuredClone(procedureDraft.cases[0].procedures[0]),
  );
  expectIssue(
    () => buildKnowledgeImportPlan(procedureDraft),
    "DUPLICATE_PROCEDURE_POSITION",
  );

  const stepDraft = completeDraft();
  stepDraft.cases[0].procedures[0].steps.push(
    structuredClone(stepDraft.cases[0].procedures[0].steps[0]),
  );
  expectIssue(
    () => buildKnowledgeImportPlan(stepDraft),
    "DUPLICATE_STEP_POSITION",
  );
});

test("preserves source pages on every planned fact", () => {
  const plan = buildKnowledgeImportPlan(completeDraft(), { maxSourcePage: 4 });
  assert.equal(plan.draft.cases[0].measurements[0].sourcePage, 3);
  assert.equal(plan.draft.cases[0].parts[0].sourcePage, 4);
});

test("preserves Italian source text without translation", () => {
  const plan = buildKnowledgeImportPlan(completeDraft());
  assert.equal(
    plan.draft.cases[0].title,
    "Pressione di sovralimentazione insufficiente",
  );
  assert.equal(
    plan.draft.cases[0].causes[0].description,
    "Elettrovalvola bloccata",
  );
});

test("preserves normalized helper fields separately", () => {
  const plan = buildKnowledgeImportPlan(completeDraft());
  assert.equal(plan.draft.cases[0].symptoms[0].label, "potenza motore ridotta");
  assert.equal(plan.draft.cases[0].symptoms[0].normalizedLabel, "low_power");
  assert.equal(
    plan.draft.cases[0].components[0].normalizedName,
    "boost_control_solenoid",
  );
});

test("plans multiple technical cases from one source document", () => {
  const draft = completeDraft();
  const secondCase = structuredClone(draft.cases[0]);
  secondCase.title = "Secondo caso tecnico";
  draft.cases.push(secondCase);
  const plan = buildKnowledgeImportPlan(draft);
  assert.equal(plan.references.length, 2);
  assert.equal(plan.draft.cases[1].title, "Secondo caso tecnico");
});

test("rejects a source page outside the known PDF", () => {
  const draft = completeDraft();
  draft.cases[0].parts[0].sourcePage = 5;
  expectIssue(
    () => buildKnowledgeImportPlan(draft, { maxSourcePage: 4 }),
    "INVALID_SOURCE_PAGE",
  );
});

test("rejects invalid enum values before import planning", () => {
  const draft = completeDraft();
  const invalid = structuredClone(draft) as unknown as {
    cases: Array<{ faultCodes: Array<{ role: string }> }>;
  };
  invalid.cases[0].faultCodes[0].role = "UNKNOWN_ROLE";
  assert.throws(() => validateAutomotiveExtractionDraft(invalid));
});
