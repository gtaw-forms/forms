# Refactoring Plan: Dynamic Form Management

**Goal:** Migrate all static form definitions and associated logic (`titleGenerator`, `BBCode generator functions`, `form field components`) from the codebase into Firebase Realtime Database. This will enable dynamic form creation and modification via the admin panel and significantly reduce static code.

**Current State:**
*   `src/formDefinitions.js`: Hardcoded form definitions, including `generator` functions (for BBCode) and `componentLoader` functions (for React form fields).
*   `src/components/Admin/AddFormModal.jsx`: Admin interface for creating/editing forms, currently saves basic form structure to Firebase.
*   `src/components/form-handler/FormHandler.jsx`: Renders forms dynamically based on `selectedForm` (fetched from Firebase) and generates BBCode.
*   `src/components/useReportManagement.js`: Uses `getFormDefinition` for key generation and validation.
*   Various `phmc-bbcode-generators/`, `phmc-field-data/`, `phmc-recruitment-generators/`, `phmc-civilian-fields/` directories containing specific logic and components.

---

## Phase 1: Database Schema & Admin Panel Enhancements

**Objective:** Ensure the Firebase database schema for forms can fully encapsulate all necessary form definition properties and enhance the admin panel (`AddFormModal.jsx`) to manage these properties.

*   [x] **Add `titleGeneratorCode` to Firebase schema:** Store the JavaScript code for title generation as a string in Firebase.
    *   [x] Update `AddFormModal.jsx` to manage `titleGeneratorCode` (state, useEffect, save, input field).
    *   [x] Update `useReportManagement.js` to execute `titleGeneratorCode` from Firebase (using `new Function()`).
*   [ ] **Add `generatorCode` to Firebase schema:** Store the JavaScript code for BBCode generation as a string.
    *   [ ] Update `AddFormModal.jsx` to manage `generatorCode`.
    *   [ ] Update `FormHandler.jsx`'s `generateBBCode` to execute `generatorCode` from Firebase.
*   [ ] **Add `fieldDefinitions` (or similar) to Firebase schema:** Store detailed definitions for custom/complex field types if the generic renderer needs more information beyond `type`, `label`, `name`.
    *   *Consideration:* The current generic renderer in `FormHandler.jsx` handles `input`, `textarea`, `select`, `checkbox`, `image`, `hr`, `small_header`. If forms only use these basic types, a separate `componentLoaderCode` might not be necessary. If more complex, custom components are needed, a strategy for dynamic component loading (or a mapping) will be required.

---

## Phase 2: Dynamic Form Data Loading & Usage

**Objective:** Modify all parts of the application that currently rely on `src/formDefinitions.js` to fetch form definitions dynamically from Firebase.

*   [ ] **`src/components/useReportManagement.js`:**
    *   [ ] Update `loadReportForUser` to fetch the form definition (including `generatorCode` and `titleGeneratorCode`) from Firebase based on `bbCodeVersion` (or `formId`).
    *   [ ] Remove calls to `getFormDefinition` from `src/formDefinitions.js`.
*   [ ] **`src/MainApp.jsx`:**
    *   [ ] Update how `currentFormDefinition` is obtained. It should be fetched from Firebase, not `src/formDefinitions.js`.
    *   [ ] Re-evaluate the `componentLoaders` and `FieldComponent` logic. If Phase 4 (Generic Field Rendering) is successful, this will need a major overhaul or removal.
*   [ ] **`src/components/form-handler/FormHandler.jsx`:**
    *   [ ] Confirm `selectedForm` is correctly populated with all necessary dynamic properties (e.g., `generatorCode`, `titleGeneratorCode`) from Firebase. (Already fetches forms from Firebase).

---

## Phase 3: Dynamic BBCode Generation (from Firebase)

**Objective:** Execute BBCode generation logic directly from the string stored in Firebase.

*   [ ] **`src/components/form-handler/FormHandler.jsx`:**
    *   [ ] Modify the `generateBBCode` function. Instead of its current `if/else` logic for field types, it should call a dynamic `generatorCode` function (fetched from `selectedForm` in Firebase) that takes `formValues` and `selectedForm` as arguments.
    *   [ ] The `generatorCode` (string) will be executed using `new Function()`.
    *   *Consideration:* The current `generateBBCode` iterates through fields and replaces placeholders. A dynamically executed `generatorCode` would typically be a single function that takes `formData` and produces the entire BBCode string. This would simplify `FormHandler.jsx`'s `generateBBCode` significantly.
*   [ ] **Retirement Candidates:** Once `generatorCode` is fully dynamic, the following directories can be considered for retirement:
    *   [ ] `phmc-bbcode-generators/`
    *   [ ] `phmc-recruitment-generators/`

---

## Phase 4: Generic Form Field Rendering (Replacing Hardcoded Components)

**Objective:** Eliminate the need for static React components for form fields by using a generic renderer based on Firebase-stored field definitions.

*   [ ] **`src/components/form-handler/FormHandler.jsx`:**
    *   [ ] The existing `selectedForm.fields?.map` loop already provides generic rendering for basic types (`input`, `textarea`, `select`, `checkbox`, `image`, `hr`, `small_header`).
    *   [ ] **Confirm Coverage:** Verify that this generic renderer covers ALL necessary field types for all forms. If a form requires a highly custom UI element, either:
        *   Extend the generic renderer to support it (e.g., new `type` property like `custom_date_picker`).
        *   Or, define a separate strategy for dynamic custom component loading (more complex, might retain some `componentLoader` function reference to a hardcoded component).
*   [ ] **`src/MainApp.jsx`:**
    *   [ ] Remove the `FieldComponent` lazy loading and rendering logic if the generic renderer in `FormHandler.jsx` can handle all cases. `MainApp.jsx` currently lazy-loads specific field components based on `currentFormDefinition.componentLoader`. This needs to be decoupled.
*   [ ] **Retirement Candidates:** Once all form fields are rendered generically from Firebase data:
    *   [ ] `phmc-field-data/`
    *   [ ] `phmc-civilian-fields/`

---

## Phase 5: Final Cleanup and Deletion

**Objective:** Remove all redundant static files and code.

*   [ ] **Delete `src/formDefinitions.js`:** Once no code references this file.
*   [ ] **Delete Generator/Field Component Directories:**
    *   [ ] `phmc-bbcode-generators/`
    *   [ ] `phmc-field-data/`
    *   [ ] `phmc-recruitment-generators/`
    *   [ ] `phmc-civilian-fields/`
*   [ ] **Review Imports:** Ensure no lingering imports from these retired files/directories.
