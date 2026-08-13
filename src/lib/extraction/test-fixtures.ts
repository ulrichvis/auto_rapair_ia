import type { AutomotiveExtractionDraft } from "./automotive-draft-schema";

export function createValidDraft(): AutomotiveExtractionDraft {
  return {
    document: {
      detectedTitle: "Turbocharger diagnosis",
      bulletinReference: null,
      publisher: null,
      language: "en",
      claimedPageCount: 2,
      completenessNotes: null,
    },
    cases: [
      {
        title: "Low boost pressure",
        summary: null,
        problemDescription: null,
        primarySystem: "Engine management",
        applicability: [],
        faultCodes: [
          {
            rawCode: "P0299",
            normalizedCode: "P0299",
            manufacturerCode: null,
            description: "Turbocharger underboost",
            role: "PRIMARY",
            controlModule: null,
            sourcePage: 1,
          },
        ],
        symptoms: [],
        components: [],
        causes: [],
        solutions: [],
        procedures: [],
        measurements: [],
        notes: [],
        parts: [],
      },
    ],
  };
}
