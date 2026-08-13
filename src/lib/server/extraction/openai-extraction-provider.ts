import "server-only";

import OpenAI from "openai";
import { zodTextFormat } from "openai/helpers/zod";

import {
  automotiveExtractionDraftSchema,
  validateAutomotiveExtractionDraft,
} from "@/lib/extraction/automotive-draft-schema";
import { EXTRACTION_INSTRUCTIONS } from "@/lib/extraction/extraction-instructions";
import type {
  ExtractPdfInput,
  ExtractionProvider,
} from "@/lib/extraction/extraction-provider";

const DEFAULT_EXTRACTION_MODEL = "gpt-5.6-luna";
const PROVIDER_VERSION = "openai-responses-source-language-v2";

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
              text: "Extract every technical case and all supported facts from this PDF, preserving human-readable content in the PDF's original language.",
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
