import type { AutomotiveExtractionDraft } from "./automotive-draft-schema";

export function createValidDraft(): AutomotiveExtractionDraft {
  return {
    document: {
      detectedTitle: "Diagnosi pressione di sovralimentazione insufficiente",
      bulletinReference: null,
      publisher: null,
      language: "it",
      claimedPageCount: 2,
      completenessNotes: "Documento completo.",
    },
    cases: [
      {
        title: "Pressione di sovralimentazione insufficiente",
        summary: "Potenza motore ridotta in accelerazione.",
        problemDescription:
          "La pressione turbo non raggiunge il valore richiesto.",
        primarySystem: "Gestione motore",
        applicability: [],
        faultCodes: [
          {
            rawCode: "P0299",
            normalizedCode: "P0299",
            manufacturerCode: null,
            description: "Pressione di sovralimentazione insufficiente",
            role: "PRIMARY",
            controlModule: null,
            sourcePage: 1,
          },
        ],
        symptoms: [
          {
            label: "potenza motore ridotta",
            normalizedLabel: "low_power",
            details: "Il veicolo accelera lentamente.",
            operatingCondition: "Durante una forte accelerazione",
            sourcePage: 1,
          },
        ],
        components: [
          {
            name: "attuatore pressione turbo",
            normalizedName: "turbo_actuator",
            manufacturerIdentifier: "N75",
            system: "Sovralimentazione",
            role: null,
            sourcePage: 2,
          },
        ],
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
