# AutoRepair Knowledge

A SaaS application for turning automotive technical PDF documents into structured, validated, and searchable knowledge.

The project currently contains the application and PostgreSQL/Prisma foundations, a minimal admin workflow for private source PDFs, and an OpenAI-powered pipeline that automatically imports structurally valid extraction results into relational knowledge. Human review remains available as an optional correction step. Authentication has not been implemented yet.

## Requirements

- Node.js 20.9 or newer
- pnpm 11
- A Supabase project

## Local setup

1. Install dependencies:

   ```bash
   pnpm install
   ```

2. Create the local environment file:

   ```bash
   cp .env.example .env.local
   ```

   On Windows PowerShell, use `Copy-Item .env.example .env.local`.

3. In the Supabase dashboard, open the project and click **Connect**. Copy the following PostgreSQL connection strings into `.env.local`:

   - Set `DATABASE_URL` to the **Transaction pooler** connection string. This is used by the application at runtime.
   - Set `DIRECT_URL` to the **Direct connection** string. This is used by Prisma CLI commands and future migrations.
   - Set `SUPABASE_URL` to the project URL from **Project Settings > API**.
   - Set `SUPABASE_SERVICE_ROLE_KEY` to the service-role key from **Project Settings > API**. This value must remain server-only.
   - Set `SUPABASE_PDF_BUCKET` to the name of the private Storage bucket used for source PDFs.
   - Set `OPENAI_API_KEY` to a server-side OpenAI project API key.
   - Set `OPENAI_EXTRACTION_MODEL` to the Responses API model used for extraction. The default example is `gpt-5.6-luna`.
   - Set `INGESTION_CONCURRENCY` to the maximum number of simultaneous extraction/import jobs. The recommended V1 value is `2`.

   Replace the password placeholder in each connection string with the project's database password. Keep both values server-side and never commit `.env.local`.

4. Generate the Prisma client and validate the Prisma configuration:

   ```bash
   pnpm db:generate
   pnpm db:validate
   ```

5. Start the development server:

   ```bash
   pnpm dev
   ```

6. Open [http://localhost:3000](http://localhost:3000).

## Interface languages

The interface supports English and Italian without locale prefixes in URLs. On
first access, the server checks the browser `Accept-Language` preference and
falls back to English. A manual selection is stored in the
`autorepair_ui_locale` cookie and overrides browser detection.

UI messages live in `src/i18n/messages`. This setting affects interface text
only; extracted automotive knowledge remains in the source PDF language.

## PDF storage

Create a Supabase Storage bucket before using the upload page:

- Use the same name configured in `SUPABASE_PDF_BUCKET` (the example uses `technical-pdfs`).
- Keep **Public bucket** disabled.
- Set the bucket file-size limit to at least 15 MiB.
- Allow `application/pdf` if the bucket uses an allowed MIME-type list.

The upload page is available at [http://localhost:3000/admin/documents](http://localhost:3000/admin/documents). It accepts multiple PDFs and uploads each file independently, so an invalid, duplicate, or failed file does not cancel the rest of the selection. PDF validation, hashing, duplicate detection, private Storage upload, and database writes run on the server. This V1 accepts files up to 15 MiB each. Confirm that the deployment platform's request-body limit supports this per-file size.

## PDF extraction

Newly uploaded PDFs enter a durable PostgreSQL-backed queue. The Admin dashboard drains that queue through bounded server requests, using `INGESTION_CONCURRENCY` to control simultaneous OpenAI calls. Closing the dashboard does not lose pending documents; reopening it resumes draining. This request-driven V1 avoids an unreliable in-memory worker on Vercel while keeping PostgreSQL as the queue source of truth.

For each claimed PDF, the server:

1. Creates a `PROCESSING` `IngestionRun` and marks the source document as processing.
2. Retrieves the PDF from the private Supabase bucket without creating a public URL.
3. Sends it to the OpenAI Responses API as base64 PDF file input using strict Structured Outputs.
4. Validates the returned draft again with the application schema.
5. Stores the complete, immutable extraction snapshot in `IngestionRun.rawOutput`, along with model and token usage when available.
6. Validates references, ordering, source pages, and measurement constraints before writing relational knowledge in one transaction.
7. Marks automatically imported cases `IN_REVIEW`, the run `IMPORTED`, and the document `COMPLETED`.

Queue claims are serialized in PostgreSQL and conditionally change one document from `QUEUED` to `PROCESSING` before creating its `IngestionRun`. This prevents two dashboard workers from extracting the same document and enforces the configured global concurrency limit. Each drain request handles one PDF and has a five-minute maximum duration; confirm the deployed Vercel plan supports enough execution time for representative PDFs.

Failures mark both the run and document as failed while the queue continues with later documents. Retry only moves that failed document back to `QUEUED`; prior `IngestionRun` history remains intact. A failed relational import creates no partial domain rows, while the extracted `rawOutput` remains available for diagnosis and optional correction. The review page stores corrected data in `reviewedOutput`, replaces that run's relational cases transactionally, and marks them as human-reviewed without overwriting `rawOutput`.

## Database foundation

- `prisma/schema.prisma` defines the approved automotive knowledge domain models for PostgreSQL.
- `prisma.config.ts` loads `.env.local` and uses `DIRECT_URL` for Prisma CLI operations.
- `src/lib/server/prisma.ts` exports a reusable server-side Prisma client that uses the pooled `DATABASE_URL`.
- `src/lib/server/supabase-storage.ts` contains the server-only adapter for privileged Supabase Storage operations.
- `src/lib/extraction/automotive-draft-schema.ts` defines the provider-independent extraction contract.
- `src/lib/server/extraction/openai-extraction-provider.ts` uses the OpenAI Responses API with PDF input and strict Structured Outputs.
- Generated Prisma Client code is written to `src/generated/prisma` and is not committed.

When deploying to Vercel, add all variables from `.env.example` to the project's environment variables. The build command generates Prisma Client before compiling Next.js.

## Quality checks

```bash
pnpm db:validate
pnpm format:check
pnpm typecheck
pnpm lint
pnpm test
pnpm build
```

Use `pnpm format` to apply formatting and `pnpm lint:fix` to apply safe lint fixes.

## Project structure

```text
prisma/
  schema.prisma        Prisma datasource and client generator
prisma.config.ts       Prisma CLI configuration
src/
  app/                 Next.js routes and layouts
  generated/prisma/    Generated Prisma Client (ignored by Git)
  lib/server/prisma.ts Reusable server-side Prisma Client
public/                 Static assets
```

Application source belongs under `src/`. New folders should be introduced when their first real use case is implemented rather than created as empty placeholders.

## Environment variables

`.env.example` documents all required environment variables with safe placeholders. Store local values in `.env.local` and deployment values in Vercel. Never commit real credentials.
