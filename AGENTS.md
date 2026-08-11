# Project Instructions

## Project purpose

This is a SaaS for building a structured automotive technical knowledge database from technical PDF documents.

### Phase 1

- Admin uploads automotive technical PDFs.
- Information is extracted from PDFs.
- Extracted information is reviewed and corrected by a human.
- Validated information is stored as structured data in PostgreSQL.
- Original PDFs are preserved for source traceability.
- The application must support many different types and structures of technical PDFs.

Typical knowledge includes:

- vehicles
- brands and models
- engines and engine codes
- DTC and fault codes
- symptoms
- components
- possible causes
- diagnostic procedures and ordered diagnostic steps
- measurements and expected values
- repair solutions
- warnings and technical notes

### Phase 2

A conversational AI assistant for mechanics will query the validated structured database.

The database, not the original PDFs, should be the primary knowledge source for the future AI assistant.

## Tech stack

- Next.js App Router
- TypeScript
- PostgreSQL on Supabase
- Prisma ORM
- Supabase Storage
- Tailwind CSS
- GitHub
- Vercel

## Architecture principles

- PostgreSQL is the source of truth.
- Keep PDF ingestion logic separated from domain and business logic.
- Preserve traceability between extracted knowledge and source PDF/page whenever possible.
- Use versioned database migrations.
- Prefer structured relational data for knowledge that needs to be searched or related.
- JSON can be used when justified, but should not replace important searchable domain relationships.
- Keep the architecture simple and conventional.
- Avoid premature abstractions and over-engineering.
- Avoid unnecessary vendor lock-in.
- Avoid unnecessary dependencies.
- Never commit secrets.
- Maintain clear separation between draft or extracted data and human-validated knowledge.
- Design with future multi-user SaaS evolution in mind, without implementing unnecessary SaaS complexity yet.

## Code rules

- Use strict TypeScript.
- Prefer readable, maintainable code.
- Follow existing project conventions.
- Inspect existing code before modifying it.
- Make focused changes.
- Do not implement unrelated features.
- Do not silently make major architectural decisions. Explain important architectural choices before implementing them.
- Run relevant lint, type-check, and build checks after changes.
- Keep environment variable documentation in `.env.example`.
- Keep README setup instructions current when infrastructure changes.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
