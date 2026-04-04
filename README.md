# DocFlow

Workflow capture and documentation for teams. Record how your web apps work, generate guides and test cases from those recordings, and keep everything organized in shared workspaces.

## What it does

1. **Record** — Use the DocFlow Recorder browser extension (Chrome/Edge) to capture clicks, navigation, form input, screenshots, and API calls while using any web app.
2. **Upload** — Push recordings to the server from the extension (direct) or through the web app upload form.
3. **Generate** — Pick a recording, choose a document type (guide, tutorial, test case, release note), and let AI produce the draft.
4. **Organize** — View, search, and file generated documents in workspace folders.
5. **Collaborate** — Invite teammates with role-based access (owner, admin, editor) across multiple workspaces.

## Stack

| Layer | Tech |
|-------|------|
| Frontend | React + Vite + Tailwind CSS |
| API | NestJS (Node) |
| Database | Supabase (PostgreSQL) |
| AI | OpenRouter (Azure OpenAI, OpenAI, Anthropic also supported) |
| Email | Nodemailer + SMTP (Gmail app password) |
| Auth | JWT (email/password + Google OAuth) with email verification |
| Extension | Chromium extension (Manifest V3) |

## Repo layout

```
client/     — React web app
server/     — NestJS API
extension/  — DocFlow Recorder browser extension
docs/       — Supabase schema SQL
scripts/    — Utility scripts
```

## Getting started

### Prerequisites

- Node.js 20+
- A Supabase project
- An AI provider key (OpenRouter is easiest)
- SMTP credentials for invitation/verification emails

### 1. Install

```bash
npm run install:all
```

### 2. Set up env files

```bash
cp .env.example .env
cp server/.env.example server/.env
cp client/.env.example client/.env
cp extension/.env.example extension/.env
```

Fill in your Supabase keys, AI provider key, and SMTP details. See `.env.example` for the full list.

### 3. Run the schema migration

```bash
npm run migrate:supabase
```

### 4. Start the dev servers

```bash
npm run dev
```

Client on `http://localhost:5173`, API on `http://localhost:3001`.

## Extension

Build and load unpacked in Chrome/Edge from `extension/dist`:

```bash
npm run build:extension
```

## Deployment

Client and server deploy to Vercel independently. Server uses `@vercel/node` for on-the-fly TypeScript compilation.

## Features

**Fully working:** recording capture and upload, AI document generation, document views and folder management, dashboard, workspace management and switching, member invitations with email, email verification on signup, multi-workspace membership, role-based access (owner/admin/editor), gzip-compressed uploads (bypasses Vercel 4.5MB limit), account deletion with data preservation.

**Backend ready, UI not wired up:** GitHub integration (full API + UI component exists but routes redirect), test plans (full CRUD backend + UI components exist but routes redirect).

**Partially built:** test plan runs (manual tracking only, no automated execution), realtime notifications (SSE infrastructure exists but no client consumer).
