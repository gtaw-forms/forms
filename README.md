# PHMC Forms

A BBCode form generation utility for EMS personnel on GTA World (GTA V RP). Built with React + Vite and Firebase.

## Features

- **Form Handler** — Renders dynamic forms from Firebase-hosted BBCode templates; generates formatted BBCode output
- **EMS Dashboard** — Medical protocols and EMS reference
- **Morgue Lookup** — Search and view morgue records
- **Map Modal** — Location-aware map overlay for reports
- **Admin Panel** — Manage morgue records, LSCC data, faction data, CKs, and Discord webhooks
- **GTA World OAuth** — Sign in via GTA World, with role-based access control
- **Webhook Integration** — Report saves and admin actions broadcast to Discord

## Project Structure

```
src/
├── components/
│   ├── Admin/           # Admin tools (morgue, LSCC, faction data, CKs, webhooks)
│   ├── Auth/            # GTA World OAuth & email sign-in
│   ├── ems-dashboard/   # EMS medical protocols
│   ├── form-handler/    # BBCode form rendering (core)
│   ├── Modals/          # Map, bug report, feature request modals
│   └── UI/              # Sidebar nav, morgue lookup, notifications
├── contexts/            # React Context providers (auth, data, modals, notifications)
├── hooks/               # Custom hooks (form saving, BBCode generation, report loading, etc.)
├── services/            # Firebase functions proxy, GTA World auth, debug utilities
└── firebase.js          # Firebase app initialization
```

## Getting Started

### Prerequisites
- Node.js v18+
- Firebase project with Realtime Database, Functions, and Auth enabled

### 1. Clone
```
git clone https://github.com/cross/phmc-forms.git
cd phmc-forms
```

### 2. Install
```
npm install
```

### 3. Environment Variables
Copy `.env.example` to `.env` and fill in your Firebase config and Discord webhook URLs. All vars must be prefixed with `VITE_`.

### 4. Run Dev Server
```
npm run dev
```
Default port: 3000 (configure in `vite.config.js`).

### 5. Build for Production
```
npm run build
```
Output goes to `build/`.

## Firebase Database Rules

```
".read": true,
".write": "auth != null"
```

All client-side writes require Firebase Auth (GTA World OAuth). Server-side Cloud Functions use the Admin SDK and bypass these rules.

## Deployment

Deploy the `build/` folder to any static hosting (Firebase Hosting, Vercel, Netlify, etc.). Deploy Firebase Functions separately via `firebase deploy --only functions`.