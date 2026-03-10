# Migration Audit

This file captures the highest-priority areas still tied to the inherited RouteCTRL implementation.

## Highest Priority Replacement Areas

### 1. Authentication

Current state:

- Client uses MSAL and Microsoft Entra ID
- Server uses Azure AD JWT strategy
- Session events and login flow are Entra-specific

Primary files:

- `client/src/auth/*`
- `client/src/pages/LoginPage.tsx`
- `server/src/auth/azure-ad.strategy.ts`
- `server/src/auth/auth.controller.ts`
- `server/src/auth/*.guard.ts`

Target state:

- JWT-based DocFlow auth
- Register, login, refresh, logout
- Individual and team onboarding

### 2. Database and Storage

Current state:

- Server is wired for Cosmos DB / MongoDB
- Repository layer assumes Mongo collection access patterns

Primary files:

- `server/src/database/*`
- `server/src/recordings/*.repository.ts`
- `server/src/documents/*.repository.ts`
- `server/src/admin/admin.repository.ts`
- `server/src/extensions/extensions.repository.ts`

Target state:

- Supabase Postgres repositories
- Supabase Storage for assets where needed

### 3. Shared Model Names

Current state:

- Shared imports still use `@docflow/shared`
- Recording metadata contains RouteCTRL-specific fields such as `applicationVersion`

Primary files:

- `client/src/shared/*`
- `server/src/shared/*`
- `client/tsconfig.json`
- `server/tsconfig.json`

Target state:

- `@docflow/shared`
- generic workflow metadata fields

### 4. Prompt and Domain Language

Current state:

- Prompts still mention RouteCTRL, Business Central, Dynamics, operators, ERP workflows

Primary files:

- `server/src/admin/admin.repository.ts`
- `server/src/documents/prompt-builder.service.ts`

Target state:

- prompts tailored for websites and web applications
- mobile capture marked as coming soon
- release notes retained as a first-class output

### 5. Extension

Current state:

- Extension branding is partly updated, but message channels, host restrictions, storage keys, and metadata are still RouteCTRL-specific
- Content script still assumes ERP pages and Dynamics contexts

Primary files:

- `extension/src/background.ts`
- `extension/src/content.ts`
- `extension/src/popup.ts`
- `extension/src/types.ts`
- `extension/publish.mjs`

Target state:

- DocFlow Recorder
- generic website/web-app capture
- no RouteCTRL-only URL restrictions

### 6. UI Copy and Product Identity

Current state:

- Dashboard, login, getting started, upload, and generation flows still reference RouteCTRL and Business Central

Primary files:

- `client/src/pages/*`
- `client/src/components/layout/Layout.tsx`
- `client/src/lib/extension-bridge.ts`

Target state:

- DocFlow product language
- website/web app workflow terminology
- onboarding for Individual vs Team

## Suggested Next Implementation Order

1. Replace shared package alias and metadata naming
2. Introduce JWT auth module scaffold
3. Introduce Supabase config and repository scaffold
4. Add public landing page and onboarding shell
5. Refactor extension host restrictions and metadata


