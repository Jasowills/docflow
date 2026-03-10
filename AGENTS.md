# AGENTS.md

## Purpose

This file is the working context for agents operating inside `DocFlow`.

Use it to understand:
- what DocFlow is
- what has already been implemented
- what is still inherited from the original fork
- what the current technical boundaries are
- what order future work should follow

Do not treat this file as product copy. It is an execution reference.

## Product Summary

DocFlow is an AI workflow documentation platform for:
- websites
- web applications
- team-based product workflows

It is intended to support:
- workflow capture through a browser extension
- AI-generated documentation
- test case generation
- test plan management
- release notes generation
- workspace collaboration
- GitHub integration
- future Playwright-first execution flows
- future mobile application capture

This product is no longer RouteCTRL-specific.

## Repo Location

Primary workspace:

- `C:\Users\JasonAmadi\Desktop\DocFlow`

Main folders:

- `client/` React + Vite frontend
- `server/` NestJS backend
- `extension/` browser extension
- `docs/` migration and planning notes

## Current Architecture

Frontend:
- React
- Vite
- Tailwind

Backend:
- NestJS

Auth:
- Dual-mode currently supported
- Internal JWT auth still works
- Logto auth is now wired and can be enabled by env

Persistence:
- Supabase is now used for:
  - users
  - workspaces
  - workspace members
  - workspace invitations
  - GitHub connections
  - test plans
- Legacy Mongo-compatible storage is still used for:
  - recordings
  - documents
  - admin/config
  - extension releases
  - some inherited content repositories

AI:
- Azure OpenAI
- OpenAI
- Anthropic

Extension:
- retained from the original app
- partially rebranded to DocFlow Recorder
- still needs deeper cleanup of inherited assumptions

## Current Auth Truth

### JWT Mode

Files:
- [auth-context.tsx](C:\Users\JasonAmadi\Desktop\DocFlow\client\src\auth\auth-context.tsx)
- [auth.service.ts](C:\Users\JasonAmadi\Desktop\DocFlow\server\src\auth\auth.service.ts)
- [jwt.strategy.ts](C:\Users\JasonAmadi\Desktop\DocFlow\server\src\auth\jwt.strategy.ts)

Used when:
- `VITE_AUTH_MODE=jwt`
- `AUTH_PROVIDER=jwt`

### Logto Mode

Files:
- [main.tsx](C:\Users\JasonAmadi\Desktop\DocFlow\client\src\main.tsx)
- [AuthCallbackPage.tsx](C:\Users\JasonAmadi\Desktop\DocFlow\client\src\pages\AuthCallbackPage.tsx)
- [auth-context.tsx](C:\Users\JasonAmadi\Desktop\DocFlow\client\src\auth\auth-context.tsx)
- [jwt.strategy.ts](C:\Users\JasonAmadi\Desktop\DocFlow\server\src\auth\jwt.strategy.ts)

Used when:
- `VITE_AUTH_MODE=logto`
- `AUTH_PROVIDER=logto`

Important behavior:
- Logto users are provisioned or linked into local DocFlow users on first authenticated API access
- workspace membership role is now the authoritative role source for permissions

## Completed Phases

### Phase 1: Fork Foundation

Completed:
- Created `DocFlow` as a separate app folder
- Reset top-level branding and env scaffolding
- Added root docs and migration notes

### Phase 2: Domain Reset

Completed:
- shifted shared models and prompts away from RouteCTRL/ERP language
- generalized product terminology toward websites and web apps

Note:
- some inherited copy and assets still remain in the UI and extension

### Phase 3: Auth Migration

Completed:
- removed active MSAL dependency from the main client auth path
- introduced internal JWT auth
- added Individual vs Team account handling at registration

### Phase 4: Supabase Migration

Completed:
- Supabase provider added
- users repository moved to Supabase
- default workspaces and memberships now provision in Supabase

Not yet completed:
- recordings/documents/config are still on the legacy repository layer

### Phase 5: GitHub + Test Plan Foundation

Completed:
- GitHub integration endpoints
- GitHub connection persistence
- repo listing endpoint
- Test Plans backend model and endpoints
- login provider discovery endpoint

### Phase 6: Real Logto Integration

Completed:
- Logto client wiring
- callback route
- dual auth mode support
- backend bearer validation for both internal JWT and Logto
- local DocFlow user/workspace provisioning for Logto users

### Phase 7: Product Surface for New Features

Completed:
- GitHub page
- Test Plans page
- Workspace page
- sidebar navigation for these areas
- dashboard entry points for GitHub and Test Plans

## Current User-Facing Pages Added for DocFlow

Implemented:
- Login
- Auth callback
- Getting Started
- Dashboard
- Recordings
- Upload Recording
- Generate
- Documents
- GitHub
- Test Plans
- Workspace
- Admin / Config

## Workspace / Team Management Status

Implemented:
- current workspace details endpoint
- list workspace members
- list invitations
- invite members
- update member roles
- revoke invitations

Files:
- [workspaces.controller.ts](C:\Users\JasonAmadi\Desktop\DocFlow\server\src\workspaces\workspaces.controller.ts)
- [workspaces.service.ts](C:\Users\JasonAmadi\Desktop\DocFlow\server\src\workspaces\workspaces.service.ts)
- [workspaces.repository.ts](C:\Users\JasonAmadi\Desktop\DocFlow\server\src\auth\workspaces.repository.ts)
- [WorkspacePage.tsx](C:\Users\JasonAmadi\Desktop\DocFlow\client\src\pages\WorkspacePage.tsx)

Not yet implemented:
- invite acceptance flow
- email delivery for invites
- workspace switching
- multiple-workspace membership UX

## GitHub Integration Status

Implemented:
- connection status
- manual token connect/disconnect
- list repositories
- GitHub page in UI

Files:
- [github.controller.ts](C:\Users\JasonAmadi\Desktop\DocFlow\server\src\integrations\github.controller.ts)
- [github.service.ts](C:\Users\JasonAmadi\Desktop\DocFlow\server\src\integrations\github.service.ts)
- [GithubPage.tsx](C:\Users\JasonAmadi\Desktop\DocFlow\client\src\pages\GithubPage.tsx)

Not yet implemented:
- GitHub App flow
- full OAuth callback flow
- repo-specific sync/background jobs
- PR/issue/workflow integration

## Test Plans Status

Implemented:
- create test plan
- list test plans
- attach repo, branch, environment metadata
- Test Plans page in UI

Files:
- [test-plans.controller.ts](C:\Users\JasonAmadi\Desktop\DocFlow\server\src\test-plans\test-plans.controller.ts)
- [test-plans.service.ts](C:\Users\JasonAmadi\Desktop\DocFlow\server\src\test-plans\test-plans.service.ts)
- [TestPlansPage.tsx](C:\Users\JasonAmadi\Desktop\DocFlow\client\src\pages\TestPlansPage.tsx)

Not yet implemented:
- test plan detail page
- attaching generated test suites to plans
- execution runs
- run history
- automation orchestration

## Known Legacy Areas Still Needing Migration

High priority:
- recordings repository
- documents repository
- admin/config repository
- extension release repository
- extension host restrictions and leftover RouteCTRL assumptions

Important note:
- do not assume the storage migration is complete just because auth/workspaces are on Supabase

## Environment Notes

Root examples:
- [.env.example](C:\Users\JasonAmadi\Desktop\DocFlow\.env.example)
- [server/.env.example](C:\Users\JasonAmadi\Desktop\DocFlow\server\.env.example)
- [client/.env.example](C:\Users\JasonAmadi\Desktop\DocFlow\client\.env.example)
- [extension/.env.example](C:\Users\JasonAmadi\Desktop\DocFlow\extension\.env.example)

Important auth vars:
- `AUTH_PROVIDER`
- `VITE_AUTH_MODE`
- `LOGTO_ENDPOINT`
- `LOGTO_APP_ID`
- `LOGTO_APP_SECRET`
- `LOGTO_API_RESOURCE`
- `VITE_LOGTO_ENDPOINT`
- `VITE_LOGTO_APP_ID`
- `VITE_LOGTO_API_RESOURCE`

Important current caveat:
- Supabase schema must include the latest `docflow_users` external identity fields and workspace tables

Reference:
- [supabase-schema.sql](C:\Users\JasonAmadi\Desktop\DocFlow\docs\supabase-schema.sql)

## Build Status

As of the latest implementation pass:
- `client/npm.cmd run build` passes
- `server/npm.cmd run build` passes

Recurring non-blocking note:
- Vite chunk-size warning still appears on client build

## Safe Next Order of Work

1. Finish workspace lifecycle
- invite acceptance
- email delivery
- multiple workspace support
- workspace switcher

2. Improve GitHub integration
- replace manual PAT entry with GitHub App or proper OAuth
- persist selected repos per workspace

3. Expand Test Plans
- plan detail page
- attach generated test cases / suites
- execution run model

4. Add automation foundation
- Playwright first
- execution jobs
- run status and artifacts
- repo-linked scaffolds

5. Migrate legacy repositories to Supabase
- recordings
- documents
- config
- extension releases

6. Refactor extension fully
- remove inherited RouteCTRL assumptions
- generic website/web app capture only

7. Add public marketing/product UX
- landing page
- pricing/account surfaces
- team onboarding flow refinements

## Guardrails for Future Changes

- Do not reintroduce RouteCTRL-specific product language.
- Prefer extending Supabase-backed models over adding new legacy storage dependencies.
- Keep Playwright as the default future automation direction; Selenium is secondary.
- Treat GitHub sign-in and GitHub repo access as separate concerns.
- Preserve dual auth mode until Logto is fully stable in all environments.
- When changing permissions, use workspace membership role as the source of truth.
- Before removing JWT mode entirely, verify all extension and local development flows against Logto.

## Related Docs

- [README.md](C:\Users\JasonAmadi\Desktop\DocFlow\README.md)
- [docs/ROADMAP.md](C:\Users\JasonAmadi\Desktop\DocFlow\docs\ROADMAP.md)
- [docs/MIGRATION_AUDIT.md](C:\Users\JasonAmadi\Desktop\DocFlow\docs\MIGRATION_AUDIT.md)
- [docs/supabase-schema.sql](C:\Users\JasonAmadi\Desktop\DocFlow\docs\supabase-schema.sql)
