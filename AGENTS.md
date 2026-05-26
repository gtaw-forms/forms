# AGENTS.md - Project Context for AI Assistants

## Project Overview

## KEY AGENT INSTRUCTIONS: 
When performing tasks, changes and/or file modifications, write the change to changelog.md to ensure accurate tracking of file changes. 

**PHMC Forms** is a Form Utility for GTA World (GTA 5 RP) that processes BBCode and Form Inputs for EMS personnel. It contains an EMS Dashboard with medical protocols, Admin Panel, and integrates with GTA World OAuth and Discord.

> **Note:** The `/functions` directory is gitignored (line 48 of `.gitignore`). This directory contains Firebase Cloud Functions used as API/proxy endpoints. You will NOT be able to read these files via search/glob — if you need context on them, ask the user to provide relevant snippets.

## Components Structure

```
src/components/
├── Admin/           # Admin dashboard tools
├── Auth/           # Authentication handlers
├── Common/         # Shared/common components (currently empty)
├── ems-dashboard/  # EMS protocols & dashboard
├── form-handler/    # Form processing & rendering
├── Modals/         # Custom modal components
├── PR/            # PR (Progress Report) dashboard
├── Shop/          # Shop/e-commerce (WIP)
└── UI/            # Shared UI components
```

## Services & Hooks

### Services (`src/services/`)
- `gtaWorldAuth.js` - GTA World OAuth integration
- `firebaseFunctions.js` - Firebase Cloud Functions API/proxy calls
- `firebaseDebug.js` - Firebase debug utilities

### Hooks (`src/hooks/`)
- `useGtaWorldAuth` - GTA World OAuth integration
- `useImageUpload` - Image upload handling
- `useBbcodeGenerator` - BBCode generation
- `useReportLoader` - Loading report data
- `useReportSaver` - Saving report data
- `useReportAttachment` - Report attachment handling
- `useReportActions` - Report actions/dispatch
- `useModal` - Modal state management
- `useWebhooks` - Webhook integration
- `useFactionPermissions` - Faction-based permission checks
- `useUserMetrics` - User metrics tracking
- `useInactivityReload` - Auto-reload on inactivity

## Firebase Context

- **Forms are stored in Firebase** as BBCode templates (JSON schema), consult user in event of form specific errors for triage / debugging, ask them to upload to `/forms` directory and remove from `.gitignore`
- **When debugging form issues**, ask the user to provide the Firebase template/schema JSON for the specific form
- The Form Handler renders forms based on Firebase-hosted definitions