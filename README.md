# DocFlow

Workflow capture and documentation for teams. Record how your web apps work, generate guides and test cases from those recordings, and keep everything organized in shared workspaces.

## What it does

1. **Record** — Use the DocFlow Recorder browser extension (Chrome/Edge) to capture clicks, navigation, form input, and screenshots while using any web app.
2. **Upload** — Push recordings to the server from the extension or through the web app upload form.
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
scripts/    — Utility scripts (schema migration, screenshots)
```

## Getting started

### Prerequisites

- Node.js 20+
- A Supabase project
- An AI provider key (OpenRouter is easiest)
- SMTP credentials if you want invitation/verification emails to work

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

Fill in your Supabase keys, AI provider key, and SMTP details in the server `.env`. See `.env.example` for the full list.

### 3. Run the schema migration

```bash
npm run migrate:supabase
```

### 4. Start the dev servers

```bash
npm run dev
```

Client opens on `http://localhost:5173`, API on `http://localhost:3001`.

## Extension

Build and load unpacked in Chrome/Edge from `extension/dist`:

```bash
npm run build:extension
```

## Deployment

The client and server each deploy to Vercel independently. The server's `vercel.json` uses `@vercel/node` to compile TypeScript on the fly. Client is a static SPA build.

## Current status

**Working:** recording upload, document generation, document views, dashboard, workspace management, multi-workspace support with switching, member invitations, email verification, role-based access (owner/admin/editor).

**Partially built:** GitHub integration backend exists, test plans backend exists — neither has a full UI yet.
