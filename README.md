# AutoRepair Knowledge

A SaaS application for turning automotive technical PDF documents into structured, validated, and searchable knowledge.

This repository currently contains the application foundation only. Database access, Supabase, authentication, PDF ingestion, and domain features have not been implemented yet.

## Requirements

- Node.js 20.9 or newer
- pnpm 11

## Local setup

1. Install dependencies:

   ```bash
   pnpm install
   ```

2. Create a local environment file:

   ```bash
   cp .env.example .env.local
   ```

   On Windows PowerShell, use `Copy-Item .env.example .env.local`.

3. Start the development server:

   ```bash
   pnpm dev
   ```

4. Open [http://localhost:3000](http://localhost:3000).

## Quality checks

```bash
pnpm lint
pnpm format:check
pnpm build
```

Use `pnpm format` to apply formatting and `pnpm lint:fix` to apply safe lint fixes.

## Project structure

```text
src/
  app/
    globals.css  Global styles and Tailwind import
    layout.tsx   Root layout and metadata
    page.tsx     Home route
public/          Static assets
```

Application source belongs under `src/`. New folders should be introduced when their first real use case is implemented rather than created as empty placeholders.

## Environment variables

No environment variables are required for the current scaffold. Add future variables to `.env.example` with safe placeholder values, and keep secrets in `.env.local` or the deployment platform.
