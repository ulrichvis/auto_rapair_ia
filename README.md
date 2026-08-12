# AutoRepair Knowledge

A SaaS application for turning automotive technical PDF documents into structured, validated, and searchable knowledge.

The project currently contains the application and PostgreSQL/Prisma foundations, plus a minimal admin workflow for storing source PDFs. Authentication and PDF extraction have not been implemented yet.

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

## PDF storage

Create a Supabase Storage bucket before using the upload page:

- Use the same name configured in `SUPABASE_PDF_BUCKET` (the example uses `technical-pdfs`).
- Keep **Public bucket** disabled.
- Set the bucket file-size limit to at least 4 MiB.
- Allow `application/pdf` if the bucket uses an allowed MIME-type list.

The upload page is available at [http://localhost:3000/admin/documents](http://localhost:3000/admin/documents). PDF validation, hashing, duplicate detection, private Storage upload, and database writes run on the server. This V1 accepts files up to 4 MiB so uploads remain within Vercel's server-function request limit.

## Database foundation

- `prisma/schema.prisma` defines the approved automotive knowledge domain models for PostgreSQL.
- `prisma.config.ts` loads `.env.local` and uses `DIRECT_URL` for Prisma CLI operations.
- `src/lib/server/prisma.ts` exports a reusable server-side Prisma client that uses the pooled `DATABASE_URL`.
- `src/lib/server/supabase-storage.ts` contains the server-only adapter for privileged Supabase Storage operations.
- Generated Prisma Client code is written to `src/generated/prisma` and is not committed.

When deploying to Vercel, add all variables from `.env.example` to the project's environment variables. The build command generates Prisma Client before compiling Next.js.

## Quality checks

```bash
pnpm db:validate
pnpm format:check
pnpm lint
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
