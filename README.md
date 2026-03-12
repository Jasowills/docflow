# DocFlow

DocFlow is a workflow capture and documentation platform for websites and web applications. It records browser flows with a companion extension, turns those recordings into structured documents, and keeps the output organized inside a shared workspace.

Current product flow:

- capture browser workflows with the DocFlow Recorder extension
- upload and manage recordings
- generate guides, tutorials, test cases, and release notes
- review and organize documents
- manage workspace members and invitations

## Stack

- `client/`: React + Vite + Tailwind
- `server/`: NestJS API
- `extension/`: DocFlow Recorder browser extension
- persistence: Supabase for users, workspaces, memberships, invitations, GitHub connections, and related workspace data
- legacy repositories still in use for some recordings, documents, config, and extension release data
- auth: JWT and Logto are both supported
- AI: OpenRouter is the current primary path, with provider support in place for Azure OpenAI, OpenAI, and Anthropic

## Repository Layout

```text
DocFlow/
|-- client/
|-- server/
|-- extension/
|-- docs/
|-- scripts/
|-- .env.example
`-- README.md
```

## What Works Now

- browser recording upload flow
- generated document pipeline
- documents list and detail views
- dashboard and workspace activity summary
- workspace member management and invitations
- dual auth mode support with JWT and Logto
- extension build and release publishing flow

## Current Boundaries

- recordings, documents, config, and some extension release persistence still use inherited legacy repositories
- GitHub and Test Plans backend foundations exist, but those product surfaces are not part of the current main UI flow
- mobile capture is planned, not implemented

## Prerequisites

- Node.js `20+`
- npm
- a Supabase project
- AI provider credentials
- Logto credentials if you want to run in Logto mode

## Setup

### 1. Install dependencies

```bash
npm run install:all
```

### 2. Create local env files

```bash
copy .env.example .env
copy server\.env.example server\.env
copy client\.env.example client\.env
copy extension\.env.example extension\.env
```

Fill in the values for your local environment.

Important root and server values:

- `DOCFLOW_API_BASE_URL`
- `DOCFLOW_WEB_BASE_URL`
- `AUTH_PROVIDER`
- `SUPABASE_URL`
- `SUPABASE_DB_URL`
- `SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `SUPABASE_STORAGE_BUCKET`
- `OPENROUTER_API_KEY`
- `EXTENSION_UPLOAD_TOKEN_SECRET`
- `EXTENSION_PUBLISH_SECRET`

Important client values:

- `VITE_AUTH_MODE`
- `VITE_API_BASE_URL`
- `VITE_LOGTO_ENDPOINT`
- `VITE_LOGTO_APP_ID`
- `VITE_LOGTO_API_RESOURCE`

Important extension values:

- `DOCFLOW_API_BASE_URL`
- `EXTENSION_PUBLISH_SECRET`
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `SUPABASE_STORAGE_BUCKET`

## Database Setup

Apply the current Supabase schema before running the app:

```bash
npm run migrate:supabase
```

Schema source:

- [docs/supabase-schema.sql](/C:/Users/JasonAmadi/OneDrive%20-%20Marklite/Desktop/DocFlow/docs/supabase-schema.sql)

## Local Development

Run the API and client together:

```bash
npm run dev
```

Useful scripts:

- `npm run dev:server`
- `npm run dev:client`
- `npm run build:client`
- `npm run build:server`
- `npm run build:extension`

## Extension

Build the extension:

```bash
npm run build:extension
```

The extension output is built from [extension/package.json](/C:/Users/JasonAmadi/OneDrive%20-%20Marklite/Desktop/DocFlow/extension/package.json) and can be loaded unpacked in Chrome or Edge from the generated `extension/dist` folder.

Publish a release:

```bash
npm --prefix extension run build:publish
```

That flow:

- bumps the extension version
- builds the release package
- uploads the artifact
- publishes the release through the DocFlow API
- restores the original version files automatically if publish fails

## Auth Modes

### JWT mode

Use:

- `AUTH_PROVIDER=jwt`
- `VITE_AUTH_MODE=jwt`

### Logto mode

Use:

- `AUTH_PROVIDER=logto`
- `VITE_AUTH_MODE=logto`

In Logto mode, authenticated users are provisioned or linked into DocFlow on first API access, and workspace membership is the effective role source.

## Notes

- This repo started from an inherited codebase and is still being cleaned up.
- Do not assume the Supabase migration is complete across every repository layer.
- The main user-facing product flow is centered on recording, generating, and documenting.

## References

- [AGENTS.md](/C:/Users/JasonAmadi/OneDrive%20-%20Marklite/Desktop/DocFlow/AGENTS.md)
- [docs/ROADMAP.md](/C:/Users/JasonAmadi/OneDrive%20-%20Marklite/Desktop/DocFlow/docs/ROADMAP.md)
- [docs/MIGRATION_AUDIT.md](/C:/Users/JasonAmadi/OneDrive%20-%20Marklite/Desktop/DocFlow/docs/MIGRATION_AUDIT.md)
- [docs/supabase-schema.sql](/C:/Users/JasonAmadi/OneDrive%20-%20Marklite/Desktop/DocFlow/docs/supabase-schema.sql)
