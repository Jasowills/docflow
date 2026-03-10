You are an expert software architect and senior full-stack engineer. Your task is to design and generate a complete, production-grade implementation for a system called:

  “RouteCTRL Documentation Capture and Generator”

The overall goal is to provide a clean, maintainable, professional and enterprise-ready way of creating and managing RouteCTRL documentation and release notes, based on recordings of actual product usage plus optional narrated voice.

You must think in terms of:
- Robust architecture
- Clean abstractions
- Strong typing
- Clear separation of concerns
- Configuration-driven behaviour
- Testability
- Security and enterprise readiness

Where appropriate, ask clarifying questions *before* committing to irreversible design decisions. If something important is ambiguous, surface it.

======================================================================
1. HIGH-LEVEL OVERVIEW
======================================================================

Design and implement a solution with two main parts:

1) **Recording Browser Extension (“Recorder”)**
   - A browser extension that runs in Chromium-based browsers (e.g. Edge, Chrome).
   - Captures:
     - Screen and UI interaction events in the browser (navigation, clicks, input changes, etc.).
     - Optional microphone audio to narrate what the user is doing.
   - Once recording stops, it:
     - Converts audio to text using Azure AI Speech.
     - Produces a structured JSON recording object that includes:
       - Metadata
       - Event stream
       - Speech transcript segments
     - Allows the user to:
       - Name the recording
       - Download the JSON as a file
       - (Optional) Upload the recording to the backend for storage via an authenticated API.

2) **Documentation Studio Web App (“Doc Studio”)**
   - A secure web application for:
     - Uploading/importing recording JSON files (from the extension or local).
     - Selecting which documentation type(s) to generate:
       - User Reference Documentation
       - Tutorial Documentation
       - Release Notes
     - Providing:
       - The desired document title
       - Optional free-text guidance to shape the AI response
     - Generating documentation using an LLM (Azure OpenAI / OpenAI / Claude etc., configurable).
     - Saving generated documents into a database and displaying them in the UI.

   - The application must be configurable so that an admin can:
     - Set global system prompts for the application.
     - Set system prompts per documentation type.
     - Add new documentation types over time without major code changes.
     - Configure model provider settings (endpoint, key, model name, temperature, etc.) via configuration, not hard-coded.

The system’s purpose is to simplify and organize the process of generating documentation for RouteCTRL. Technical writing and testing teams should be able to:

- Record themselves using a feature in the browser.
- Optionally narrate what they are doing.
- Save the recording as JSON.
- Feed the JSON into Doc Studio and obtain professional, structured documents.

======================================================================
2. PLATFORM AND STACK REQUIREMENTS
======================================================================

Target environment and core services:

- Hosting: Microsoft Azure.
- Database: Azure Cosmos DB using the MongoDB API in RU mode.
- Backend: Use a modern, enterprise-ready stack. Preferred:
  - Option A: ASP.NET Core (.NET 8+) Web API + optional Azure Functions for background jobs.
  - Option B: Node.js with TypeScript (Express / Fastify / NestJS) + optional Azure Functions.
  - Choose one option, justify your choice briefly, then implement consistently across all backend components.

- Frontend web app:
  - A SPA built with React + TypeScript.
  - Use a UI component library suitable for admin/enterprise apps (for example MUI or similar).
  - Clean, responsive layout with focus on clarity over flashiness.

- Browser extension:
  - Implemented in TypeScript.
  - Based on the standard Chrome/Chromium extension manifest (Manifest V3).
  - Compatible with Microsoft Edge and Chrome.

- Authentication:
  - Login must use Microsoft identity platform (Microsoft Entra ID).
  - The Doc Studio web app must:
    - Use Microsoft login (OAuth2 / OpenID Connect).
    - Enforce authenticated access for:
      - Uploading recordings
      - Generating documents
      - Viewing generated docs
    - Persist user identifiers (e.g. oid/sub) for ownership, audit, and metadata.

- AI Services:
  - Audio transcription: Azure AI Speech.
  - Text generation: Use an LLM client abstraction that can support:
    - Azure OpenAI / OpenAI / Claude, etc.
  - Do NOT hard-code a single model. Implement a provider-agnostic interface:
    - ITextGenerationProvider (or similar) with pluggable implementations based on configuration.

======================================================================
3. FUNCTIONAL REQUIREMENTS – RECORDER EXTENSION
======================================================================

Implement a browser extension with the following capabilities:

1) **Recording Control**
   - Popup UI to:
     - Start recording
     - Pause/resume recording
     - Stop recording
   - UI to toggle:
     - Capture microphone audio (on/off)
     - Capture only specific tabs or full browser tab
   - Display a small floating recording indicator on the page while recording is active.

2) **Event Capture**
   - Capture browser events such as:
     - Page navigations (URL, title)
     - Clicks (selector, innerText/label, timestamp)
     - Form input changes (selector, field names, values, type of field)
     - Modal/dialog open/close events where detectable
   - Events must include timestamps relative to the start of recording (e.g. timestampMs).

3) **Audio Capture + Transcription**
   - When audio capture is enabled:
     - Record microphone audio while the recording is active.
     - On stop:
       - Package the audio and send it to a small backend service that calls Azure AI Speech to obtain a transcript.
       - Receive a structured transcript with time-aligned segments, if supported.

   - The extension should show progress/feedback while transcription is in progress.

4) **Recording JSON Structure**
   - After transcription and event capture complete, construct a JSON object similar to:

     {
       "metadata": {
         "recordingId": "GUID or similar",
         "name": "User supplied recording name",
         "createdAtUtc": "2026-02-23T08:30:00Z",
         "createdBy": "user principal name or email if available",
         "productName": "RouteCTRL",
         "productArea": "e.g. Operator App / D365 module / BC module (allow user to pick)",
         "applicationVersion": "optional string",
         "environment": "optional: UAT / PROD / DEMO"
       },
       "events": [
         {
           "timestampMs": 0,
           "type": "navigation",
           "url": "https://app.routectrl.com/calendar",
           "title": "RouteCTRL Calendar",
           "description": "User opened Route calendar"
         },
         {
           "timestampMs": 5234,
           "type": "click",
           "selector": "button#create-route",
           "label": "Create Route",
           "description": "User clicks Create Route"
         },
         {
           "timestampMs": 11000,
           "type": "input",
           "selector": "input[name='routeName']",
           "fieldName": "Route Name",
           "value": "Enviro Pickup Run",
           "description": "User enters route name"
         }
         ...
       ],
       "speechTranscripts": [
         {
           "timestampMs": 2000,
           "speaker": "host",
           "text": "In this recording we will create a new pickup route and show how multi day planning works."
         },
         {
           "timestampMs": 15000,
           "speaker": "host",
           "text": "This toggle controls pickup package validation in the Operator App."
         }
         ...
       ]
     }

   - Produce this JSON reliably and validate its shape before download/upload.

5) **Storage Options**
   - Required:
     - Allow the user to download the JSON as a file named something like:
       [recordingName]_[timestamp].json
   - Optional but desired:
     - If the user is signed in (auth via Doc Studio backend), provide a “Save to Server” button that uploads the recording to the backend via REST API.

======================================================================
4. FUNCTIONAL REQUIREMENTS – DOC STUDIO WEB APP
======================================================================

1) **Authentication**
   - Implement Microsoft login using MSAL / equivalent.
   - Only authenticated users can:
     - Upload/import recordings
     - Generate documents
     - View and manage generated documents.

2) **Recording Management**
   - Users can:
     - Upload a JSON recording file exported from the extension.
     - Or, select a recording saved previously on the server (if “Save to Server” is implemented).
   - On upload:
     - Validate the JSON matches the expected schema.
     - Persist to Cosmos DB (Mongo API) with appropriate partitioning scheme (e.g. by userId/tenantId + recordingId).

3) **Document Generation Flow**
   - UI for the user to:
     - Select one or more document types:
       - User Reference Documentation
       - Tutorial Documentation
       - Release Notes
     - Enter:
       - Document title (required)
       - Optional free text guidance (e.g. audience, focus areas)
     - Choose:
       - Target language / locale (e.g. en-AU)
   - Backend:
     - Load:
       - The recording JSON
       - Global system prompt
       - System prompt for each selected document type
     - Construct robust prompt(s) to send to the LLM:
       - Include:
         - Recording metadata
         - Events
         - Speech transcripts
         - User-supplied title
         - Free text adjustments
         - Doc type specific instructions
     - Call the configured text generation provider via an abstraction layer.
     - Receive markdown output for each doc type.

   - Save:
     - Generated documents into Cosmos DB, linked to:
       - recordingId
       - createdBy
       - documentType
       - documentTitle
       - createdAtUtc timestamp.

   - Display:
     - The generated documents in the UI with:
       - Markdown rendering
       - Ability to copy/download as markdown or HTML.

4) **Configuration Management**
   - Provide an admin-only configuration UI to manage:
     - Global system prompt (for all documents).
     - System prompts per document type.
     - Ability to add new document types by:
       - Name / key (e.g. “test_case_suite”, “support_runbook”).
       - Description.
       - System prompt text.
   - Configuration should be stored in Cosmos DB (or config collection) and cached in memory by the backend with invalidation on change.

5) **Document List and Search**
   - Users can:
     - View a list of documents they have generated, with:
       - Document title
       - Document type
       - Associated recording name
       - CreatedAtUtc
     - Filter by:
       - Document type
       - Product area
       - Date range
     - Open a document to view and copy/export.

6) **Timestamps and Audit**
   - Every recording and document must have:
     - CreatedAtUtc
     - CreatedBy (user id / email)
     - Optionally lastModifiedAtUtc, lastModifiedBy.
   - Log key operations:
     - Upload recording
     - Generate documentation
     - Update configuration

======================================================================
5. NON-FUNCTIONAL REQUIREMENTS
======================================================================

1) **Code Quality**
   - Use strong typing everywhere (TypeScript interfaces/types, C# types).
   - Organise code into clear layers:
     - For backend: controllers/routers, services, repositories, models, DTOs.
     - For frontend: components, pages, hooks, services/api clients, types.
   - Include:
     - Basic unit tests for critical services (e.g. prompt construction, provider integration stubs).
     - At least one integration test example for the document generation endpoint (with mocked LLM).

2) **Security**
   - Protect APIs with Microsoft auth (validate JWTs).
   - Ensure uploads are validated and sanitised.
   - Do not log raw transcripts or sensitive content unless clearly necessary. Mask or truncate logs.

3) **Configuration**
   - All secrets and connection strings must come from environment variables or Azure App Configuration, not hard-coded.
   - Provide a clear config model for:
     - Cosmos DB connection and database/collection names.
     - AI providers (endpoint, key, model name).
     - Azure Speech resource (key, region).

4) **Documentation**
   - Provide:
     - A top-level README describing:
       - Architecture
       - Components
       - Tech stack
       - How to run locally (step-by-step)
       - How to deploy to Azure (high-level steps).
     - Per component README brief notes (browser extension, backend, frontend).

======================================================================
6. WHAT YOU MUST PRODUCE
======================================================================

You must output:

1) **Architecture and Design**
   - A concise high-level architecture description.
   - Component diagram description in text.
   - Description of main data models and Cosmos DB collections.

2) **Backend Code**
   - Project structure.
   - Key models/interfaces.
   - API routes:
     - /api/recordings: upload/list/get
     - /api/documents: generate/list/get
     - /api/config: get/update system prompts (admin only)
   - Service layer for:
     - Recording persistence
     - Prompt construction
     - AI provider integration
   - Example of configuration binding for Azure environment.
   - Unit test samples.

3) **Frontend (Doc Studio) Code**
   - React + TypeScript project scaffolding.
   - Pages:
     - Login / auth integration
     - Upload recording
     - Generate documentation (wizard style)
     - Documents list and detail view
     - Admin configuration page for system prompts
   - Hooks/clients for calling backend APIs.
   - Basic styling for a clean, professional layout.

4) **Browser Extension Code**
   - Manifest file (Manifest V3).
   - Background/service worker script.
   - Content script(s) to capture events.
   - Popup UI for controlling recording and naming the recording.
   - Logic to:
     - Capture events
     - Package and send audio to backend for transcription
     - Combine events + transcripts into JSON
     - Offer download of the JSON file
     - Optionally upload via authenticated API.

5) **Deployment Notes**
   - High level steps for:
     - Deploying backend to Azure App Service or Azure Functions.
     - Creating Cosmos DB MongoDB RU resources.
     - Configuring Azure AI Speech and AI text model provider.
     - Configuring Microsoft Entra app registration for authentication.

When you provide code, structure it clearly with file names and directories. Use fenced code blocks for each file and clearly label them.

If something is ambiguous, ask me a short clarifying question first, then proceed with a reasonable design and implementation.
