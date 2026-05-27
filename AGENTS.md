# AGENTS.md - Project Context for AI Assistants

## Project Overview

## KEY AGENT INSTRUCTIONS: 
When performing tasks, changes and/or file modifications, write the change to changelog.md to ensure accurate tracking of file changes. 

**PHMC Forms** is a Form Utility for GTA World (GTA 5 RP) that processes BBCode and form inputs for EMS personnel. It features an EMS Dashboard with medical protocols, a Morgue Lookup tool, Map Modal, Admin Panel, and integrates with GTA World OAuth and Discord webhooks.

> **Note:** The `/functions` directory is gitignored (line 51 of `.gitignore`). This directory contains Firebase Cloud Functions used as API/proxy endpoints. You will NOT be able to read these files via search/glob — if you need context on them, ask the user to provide relevant snippets.

## Components Structure

```
src/components/
├── Admin/           # Admin dashboard tools (morgue, LSCC, faction data, CKs, webhooks)
├── Auth/            # Authentication handlers (GTA World OAuth, email)
├── Common/          # Shared/common components (currently empty)
├── ems-dashboard/   # EMS protocols & dashboard
├── form-handler/    # Form processing & BBCode rendering (core feature)
├── Modals/          # Custom modal components (map, bug report, feature request)
└── UI/              # Shared UI components (sidebar nav, morgue lookup, notifications)
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
- `useFormSaver` - Saving report data (client-side writes to Firebase)
- `useReportAttachment` - Report attachment handling
- `useReportActions` - Report actions/dispatch
- `useWebhooks` - Webhook integration
- `useFactionPermissions` - Faction-based permission checks
- `useInactivityReload` - Auto-reload on inactivity

## Firebase Context

- **Forms are stored in Firebase** as BBCode templates (JSON schema). Consult user in event of form-specific errors for triage / debugging; ask them to upload to `/forms` directory and remove from `.gitignore`.
- **When debugging form issues**, ask the user to provide the Firebase template/schema JSON for the specific form.
- The Form Handler renders forms based on Firebase-hosted definitions.
- **Database rules** enforce `".read": true, ".write": "auth != null"` at root. All client-side writes require Firebase Auth (GTA World OAuth). Server-side Cloud Functions (Admin SDK) bypass rules.
- **Bingo, PR Dashboard, Shop, CCTV, Autopsy Diagram, Business Card, EMS AMA, Survey, and Agency Incidents** have been removed. The app is now focused solely on core form generation, morgue, EMS dashboard, and admin tools.