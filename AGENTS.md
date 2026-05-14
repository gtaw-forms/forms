# AGENTS.md - Project Context for AI Assistants

## Project Overview

**PHMC Forms** is a Form Utility for GTA World (GTA 5 RP) that processes BBCode and Form Inputs for EMS personnel. It contains an EMS Dashboard with medical protocols, Admin Panel, and integrates with GTA World OAuth and Discord.

## ShopDashboard Context
**STATUS: Active Development / Proof of Concept**

The ShopDashboard (`src/components/Shop/ShopDashboard.jsx`) is a fun side project actively being developed with agentic coding assistance. The products are placeholder items for testing/shell purposes:

- Evelyn Fund, Advanced Med-kit, Surgeon Coat (PHMC items)
- Fire Extinguisher, Firefighter Helmet, Death Insurance (LSFD items)
- Faster Death Processing, Priority Queue, Custom Title (Donations)

### Features Being Enhanced
- Left sidebar with category navigation (PHMC, LSFD, Donations)
- Search filtering
- Collapsible cart panel (bottom-right)
- Order tracking overlay
- Modern dark theme with gradients/glassmorphism

## Components Structure

```
src/components/
├── Admin/           # Admin dashboard tools
├── Auth/           # Authentication handlers
├── ems-dashboard/  # EMS protocols & dashboard
├── form-handler/    # Form processing & rendering
├── Modals/         # Custom modal components
├── Shop/          # Shop/e-commerce (WIP)
└── UI/            # Shared UI components
```

## Services & Hooks

- `useGtaWorldAuth` - GTA World OAuth integration
- `useImageUpload` - Image upload handling
- `useBbcodeGenerator` - BBCode generation
- `useReportLoader/Saver` - Report management
- Firebase Functions for API/proxy operations

## Firebase Context

- **Forms are stored in Firebase** as BBCode templates (JSON schema), consult user in event of form specific errors for triage / debugging, ask them to upload to `/forms` directory and remove from `.gitignore`
- **When debugging form issues**, ask the user to provide the Firebase template/schema JSON for the specific form
- The Form Handler renders forms based on Firebase-hosted definitions