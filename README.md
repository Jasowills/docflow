# DocFlow

DocFlow is an AI workflow documentation platform for websites and web applications. Teams can record product flows, generate user documentation, tutorials, test cases, and release notes, and collaborate in shared workspaces. Mobile app capture is planned as a follow-up feature.

This repository is a fork-in-progress from the earlier RouteCTRL-focused documenter. JWT auth is now in place, and the current migration phase is moving persistence toward Supabase-backed users and workspaces before the remaining document and recording repositories are ported.

## Product Direction

- Record website and web app workflows with a browser extension
- Generate user documentation, tutorials, test cases, and release notes
- Support individual and team accounts during onboarding
- Provide workspace-level collaboration, folders, invites, and member management
- Add Logto-based authentication and GitHub sign-in
- Connect GitHub repositories and build test plans around selected repos
- Expand to mobile capture in a future release

## Planned Architecture

- Frontend: React + Vite
- Backend: NestJS
- Database: Supabase Postgres
- Storage: Supabase Storage for screenshots, preview images, and future generated assets
- Auth: JWT-based application auth
- Identity roadmap: Logto as the primary authentication provider
- AI providers: Azure OpenAI, OpenAI, OpenRouter, Anthropic
- Capture: Browser extension retained and rebranded as DocFlow Recorder

## Repository Layout

```text
DocFlow/
├── client/         React application
├── server/         NestJS API
├── extension/      Browser extension recorder
├── .env.example    Root environment contract
└── docs/           Planning and migration notes
```

## Current Status

- New DocFlow workspace created on Desktop
- JWT auth is active across client and server
- Supabase schema for users, workspaces, members, and invitations is defined in [docs/supabase-schema.sql](/C:/Users/JasonAmadi/Desktop/DocFlow/docs/supabase-schema.sql)
- Auth users and default workspace provisioning are now wired to Supabase
- Logto provider config, GitHub integration endpoints, and Test Plan APIs are scaffolded
- Recordings, documents, config, audit, and extension releases still use the copied legacy data layer and will be migrated next

For now, local development still needs a Mongo-compatible connection string for the legacy repositories until Phase 4 is fully completed.

## Getting Started

### 1. Install dependencies

```bash
npm run install:all
```

### 2. Configure environments

Copy the example files and fill in your local values:

```bash
copy .env.example .env
copy server\\.env.example server\\.env
copy client\\.env.example client\\.env
copy extension\\.env.example extension\\.env
```

### 3. Run the apps

```bash
npm run dev
```

This starts:

- the NestJS API
- the React app

Build the extension separately when needed:

```bash
npm run build:extension
```

## Planned Onboarding

When the DocFlow product onboarding is implemented, users will create an account and choose one of:

- Individual
- Team

Team onboarding will include workspace creation, inviting members, and role-based collaboration.

## Roadmap

See [docs/ROADMAP.md](/C:/Users/JasonAmadi/Desktop/DocFlow/docs/ROADMAP.md) for the phased implementation plan for:

- JWT auth migration
- Supabase migration
- landing page
- team management
- generic workflow capture
- release notes generation

## Notes

- This fork intentionally keeps the existing extension and document-generation structure as a starting point.
- The current codebase still contains RouteCTRL-specific references and Microsoft ERP assumptions. Those are expected to be removed in later phases.
