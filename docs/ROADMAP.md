# DocFlow Roadmap

## Phase 1: Fork Foundation

- Create a clean DocFlow workspace
- Remove inherited secrets and environment coupling
- Rebrand root package metadata, README, and extension naming
- Preserve reusable recording and generation architecture

## Phase 2: Domain Reset

- Remove RouteCTRL, Business Central, and ERP-specific product language
- Rename shared models to generic workflow terms
- Rewrite prompt defaults for websites and web applications
- Keep release notes generation as a first-class document type

## Phase 3: Auth Migration

- Replace Microsoft Entra / MSAL with JWT-based application auth
- Add register, login, refresh token, logout, forgot password, reset password
- Support onboarding choice: Individual or Team

## Phase 4: Supabase Migration

- Replace Cosmos DB repositories with Supabase/Postgres repositories
- Define schema for users, workspaces, memberships, invitations, recordings, documents, folders, and audit logs
- Move binary asset storage to Supabase Storage or equivalent

## Phase 5: Team and User Management

- Workspace creation
- Invite members by email
- Role management: owner, admin, editor, viewer
- Shared visibility rules for recordings and documents

## Phase 6: Product UX

- Public landing page
- Auth pages
- Team/individual onboarding
- Dashboard redesign for generic product teams
- Better settings and account management

## Phase 7: Extension Refactor

- Rebrand to DocFlow Recorder
- Remove RouteCTRL-only domain restrictions
- Focus on websites and web applications
- Keep mobile capture marked as coming soon

## Phase 8: Delivery Readiness

- Rewrite setup docs
- Finalize environment templates
- Add migration notes
- Validate end-to-end recording, generation, and team collaboration flows
