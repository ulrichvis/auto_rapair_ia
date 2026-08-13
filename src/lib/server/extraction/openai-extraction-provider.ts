import "server-only";

import OpenAI from "openai";
import { zodTextFormat } from "openai/helpers/zod";

import {
  automotiveExtractionDraftSchema,
  validateAutomotiveExtractionDraft,
} from "@/lib/extraction/automotive-draft-schema";
import type {
  ExtractPdfInput,
  ExtractionProvider,
} from "@/lib/extraction/extraction-provider";

const DEFAULT_EXTRACTION_MODEL = "gpt-5.6-luna";
const PROVIDER_VERSION = "openai-responses-v1";

const EXTRACTION_INSTRUCTIONS = `You extract unvalidated automotive technical knowledge drafts from PDF content.

Rules:
1. Never invent missing technical information.
2. Use null or empty arrays when information is absent.
3. Preserve uncertainty; classify causes only as POSSIBLE, LIKELY, or CONFIRMED from document evidence.
4. Distinguish PRIMARY, RELATED, and CONSEQUENTIAL DTCs only when supported.
5. Preserve all vehicle, engine, transmission, and variant conditions.
6. Never extract a numeric measurement without its technical context when context is available.
7. Never convert an illustrative or example measurement into an authoritative specification; set isExample and isApproximate accurately.
8. Preserve units exactly enough to avoid technical ambiguity.
9. Preserve one-based source page numbers for every fact when identifiable.
10. Do not infer applicability the PDF does not state.
11. Ignore the filename as a source of technical metadata; PDF content is authoritative.
12. Preserve warnings, limitations, exceptions, and technical notes.
13. Preserve diagnostic procedure and step ordering.
14. If variants require opposite procedures or values, keep them explicitly separated with conditions.
15. Extract all distinct technical cases in the document.
16. Do not extract images or create media records.
17. Component and applicability references must be stable descriptive strings that clearly match entries in the same case.
18. Normalized labels and codes must preserve the original technical meaning.
19. Inspect page images, diagrams, tables, photos, and diagnostic screenshots as carefully as extracted text.

Return only the strict structured draft.`;

export class OpenAIExtractionProvider implements ExtractionProvider {
  private readonly client: OpenAI | undefined;
  private readonly apiKey: string | undefined;
  private readonly model: string;

  constructor(options?: { apiKey?: string; model?: string; client?: OpenAI }) {
    this.client = options?.client;
    this.apiKey = options?.apiKey ?? process.env.OPENAI_API_KEY;
    this.model =
      options?.model ??
      process.env.OPENAI_EXTRACTION_MODEL ??
      DEFAULT_EXTRACTION_MODEL;
  }

  async extractPdf({ filename, pdf }: ExtractPdfInput) {
    if (!this.client && !this.apiKey) {
      throw new Error("OPENAI_API_KEY must be configured.");
    }

    const client = this.client ?? new OpenAI({ apiKey: this.apiKey });
    const response = await client.responses.parse({
      model: this.model,
      store: false,
      reasoning: { effort: "medium" },
      input: [
        {
          role: "developer",
          content: [{ type: "input_text", text: EXTRACTION_INSTRUCTIONS }],
        },
        {
          role: "user",
          content: [
            {
              type: "input_file",
              filename,
              file_data: `data:application/pdf;base64,${pdf.toString("base64")}`,
            },
            {
              type: "input_text",
              text: "Extract every technical case and all supported facts from this PDF.",
            },
          ],
        },
      ],
      text: {
        format: zodTextFormat(
          automotiveExtractionDraftSchema,
          "automotive_technical_draft",
        ),
      },
    });

    if (!response.output_parsed) {
      throw new Error("OpenAI returned no structured extraction draft.");
    }

    const draft = validateAutomotiveExtractionDraft(response.output_parsed);

    return {
      draft,
      model: this.model,
      providerVersion: PROVIDER_VERSION,
      usage: {
        inputTokens: response.usage?.input_tokens ?? null,
        outputTokens: response.usage?.output_tokens ?? null,
        totalTokens: response.usage?.total_tokens ?? null,
      },
    };
  }
}
