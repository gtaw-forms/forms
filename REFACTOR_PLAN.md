# PHMC Forms Refactor & Optimization Plan

## 🎯 Goal
Reduce project complexity, improve load times, and eliminate redundant component architectures.

---

## 🏗️ Phase 1: Consolidation & Redundancy Removal
*   **Character Selection**: Merge `CharacterSelectionModal.jsx` and `CharacterSelector.jsx`. Create a single source of truth for character picking.
*   **Modal Standardization**: Ensure all modals are migrated to the `BaseModal` system. Delete any legacy overlay code.
*   **Identity Logic**: Centralize character name formatting (e.g., `firstname + lastname`) into a utility function to remove repeated parsing logic across 5+ components.

## 🔪 Phase 2: Decomposing "God Components"
*   **FormFieldRenderer (54KB)**: 
    *   Create a `fields/` subdirectory.
    *   Move logic for `AnatomyPicker`, `MapField`, `Signature`, and `DepartmentSelect` into isolated components.
    *   The renderer should only act as a router/wrapper.
*   **FormHandler (75KB)**:
    *   Extract the "Navigation Drawer" and "Form Meta" (History, Drafts) logic into separate sub-components.
    *   Isolate the "Validation Debugger" into a development-only utility.

## 🚀 Phase 3: Performance (Lazy Loading)
*   **Route-Based Splitting**: Lazy load the `AdminDashboard` and `FormHandler` routes.
*   **Tab-Based Splitting (Admin)**: 
    *   The `AdminDashboard` currently imports 7+ Manager components at the top level.
    *   Refactor to use `React.lazy()` for: `EmployeeManager`, `FormsManager`, `WebhookLogs`, `LsccManager`, etc.
*   **Feature Splitting**: Lazy load the `MapModal` and `CctvDashboard` as they contain heavy libraries (Leaflet).

## 🛠️ Phase 4: Architectural Abstraction
*   **The "Manager" Pattern**: 
    *   Identify commonalities between `AgencyIncidentManager`, `EmployeeManager`, and `HallOfFameManager`.
    *   Create a `GenericManager` component that accepts `columns` and `dataRef` props.
*   **Custom Hooks**: 
    *   Move repetitive Firebase `onValue` listeners into a reusable `useFirebaseCollection(path)` hook.

## 🧹 Phase 5: Structural Hygiene
*   **Data Relocation**: Move `src/components/cctv example/*.json` to `src/data/cctv/`.
*   **Example Cleanup**: Move `src/components/form-handler/example.json` to a `tests/` or `data/` folder.
*   **Dead Code**: Remove `KeywordEditModal.css` (empty) and any other 0-byte files identified in the audit.
*   **Internal Tools**: Move `FirebaseFunctionsTester` and `OAuthUrlDiagnostic` to a dedicated `src/components/Admin/Tools` folder and ensure they are not imported by default.

---

## ✅ Success Metrics
1.  **Main Bundle Size**: Reduction of at least 20%.
2.  **File Count**: Significant reduction in `src/components/Modals`.
3.  **Maintainability**: No single component file should exceed 25KB (with the exception of core logic handlers).
