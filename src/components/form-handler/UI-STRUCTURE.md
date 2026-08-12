/* ═══════════════════════════════════════════════════════════════
   FormHandler.jsx — Layout Structure Reference
   
   This file documents EVERY render section of the main FormHandler
   page so you can see what each <div> does and where it lives.
   
   Sections:
     A. Modals (rendered first, hidden unless triggered)
     B. Top Navigation (FormHandlerNavButtons / right sidebar toggle)
     C. Left Sidebar (LeftSidebarNav — form picker)
     D. Header Bar ("PHMC Tools - Form Generator and more!")
     E. Main Layout (3-column flex row)
        E1. Main Content (the form area)
        E2. Right Panel (user profile + BBCode)
           E2a. User Profile Card
           E2b. Patient Name Input (medical forms only)
           E2c. Preview + Save Buttons
           E2d. Assigned Autopsies Button (autopsy form only)
           E2e. BBCode Section (generated content)
     F. Progress Ring (fixed position, bottom-right)
   ═══════════════════════════════════════════════════════════════ */

/* ────────────────────────────────────
   A. MODALS (hidden by default)
   ────────────────────────────────────
   These are rendered first in the return() but only visible
   when their corresponding state variables are set to true.
   Each wraps its content in a portal + overlay. */

<SavedReportsModal>     // Line 1253   — Saved reports list, load/attach/delete
  props: show, onHide, onClose, reportsForSelectedUser, employeeOptions,
         loadReport, deleteReportForUser, loadReportForUser,
         handleReportSelectedForAttachment, selectedForm ...
  appearance: Full modal with dark overlay, card list, employee selector
  toggled by: handleNavToggleSavedReports()
</SavedReportsModal>

<MapModal>              // Line 1276   — GTA World map location picker
  props: show, onHide, onSelect, initialQuery, mapTargetField, selectedForm
  appearance: Full-screen modal with Leaflet map
  toggled by: "Select from Map" button on placeOfDeath field
</MapModal>

<FormHandlerNavButtons> // Line 1285   — Right sidebar toggle button
  props: onToggleSavedReports, onOpenBotConsent
  appearance: Fixed-position purple circle button at right:10px, top:10px
  what it does: Opens/closes the SidebarNav sliding panel (navigation links + tools)
</FormHandlerNavButtons>

/* ────────────────────────────────────
   C. LEFT SIDEBAR (form picker)
   ──────────────────────────────────── */

<LeftSidebarNav>        // Line 1291   — Form selection panel
  props: groupedForms, collapsedCategories, toggleCategory,
         onSelectForm, selectedForm, searchTerm, setSearchTerm,
         onPanelToggle, initialOpen
  appearance: Fixed-position panel sliding from left side
              z-index: 1051, dark surface background
  what it does: Lists all forms grouped by category with search
  special: onSelectForm callback (lines 1295-1318):
           - Preserves credential fields (phmcEmployee, coronerEmployee, etc.)
           - Loads saved progression from localStorage
           - Sets selectedForm + formValues state
</LeftSidebarNav>

/* ────────────────────────────────────
   D. HEADER BAR
   ──────────────────────────────────── */

<div class="header">    // Line 1326
  content: <h2>"PHMC Tools - Form Generator and more!"</h2>
  appearance: Simple centered header text
</div>

/* ────────────────────────────────────
   E. MAIN LAYOUT (flex row)
   ──────────────────────────────────── */

<div class="mainLayout" style="display: flex; gap: 1.5rem">  // Line 1330
  // Contains E1 + E2 side by side

  /* ── E1. MAIN CONTENT ── */

  <div class="mainContent" style="flex: 5">   // Line 1331-1353
    appearance: Dark elevated card with border-radius, shadow
                padding: 2rem, background: var(--bg-elevated)

    // EMPTY STATE: No form selected
    // Shows ONE of these three depending on state:
    if (hasFirebaseError):
      <div>Logo + "Something has gone wrong" + Firebase error message</div>
    else if (!isAuthenticated):
      <div>Logo + "Authentication Required" + sign-in prompt</div>
    else:
      <div>"Select a form from the sidebar to begin"</div>

    // FORM SELECTED STATE:
    <>
      <div>                          // Line 1370 — Form title + description
        <h2>{selectedForm.name}</h2>
        <div class="alert alert-info">{formDescription}</div>
      </div>

      <UnprocessedCKsViewer />       // Line 1379 — CK viewer for coroner forms

      <div>                          // Line 1383 — The actual form fields
        {selectedForm.fields.map(field =>
          <FormFieldRenderer          // Line 1390 — One per form field
            field={field}
            formValues={formValues}
            handleChange={handleChange}
            finalSelectOptions={finalSelectOptions}
            currentUtcTime={currentUtcTime}
            ...
          />
        )}
      </div>

      <div>                          // Line 1412 — Action buttons
        <button class="clearButton">"Clear Form"</button>
        <button class="generateButton">"Generate BBCode"</button>
        special: Generate button also logs debug employee info to console
      </div>
    </>
  </div>

  /* ── E2. RIGHT PANEL ── */

  <div class="rightPanel" style="flex: 0 0 400px">  // Line 1456
    // Fixed-width column for user info + controls

    /* ── E2a. USER PROFILE CARD ── */

    <div style="background: var(--bg-surface); border: 1px solid var(--border-accent)">
      <h3><i class="fas fa-user-circle"></i> User Profile</h3>
      <Suspense>
        <EmployeeCredentialsSection   // Line 1465
          formData={formValues}
          groupedOptions={employeeOptions}
          handleSelectChange={handleSelectChange}
          employeeType={employeeType}
          user={user}, isAuthenticated, isPhmcMember ...
          triggerFactionSync={triggerFactionSync}
          login={login}, logout={logout}
        />
      </Suspense>
    </div>

    /* ── E2b. PATIENT NAME INPUT (medical forms only) ── */

    // Line 1510 — Only shows for medical form types
    if (selectedForm is medical):
      <div>
        <label>Patient Name *</label>
        <div>Info: bot auto-finds thread</div>
        if (!name): <div>Warning: name required</div>
        <input placeholder="Enter patient name..." />
      </div>

    /* ── E2c. PREVIEW + SAVE BUTTONS ── */

    <div style="display: flex; gap: 8px">    // Line 1548
      <button>"Preview"</button>             // Line 1549 — Generate BBCode preview
      <button>"Save" / "Save and Queue"</button>  // Line 1563 — copyAndSaveReport
      special: Save button text changes based on deploy tracking state
               ("Save"/"Save and Queue"/"Copy Part 1 + Save")
    </div>

    /* ── E2d. ASSIGNED AUTOPSIES BUTTON ── */

    if (selectedForm?.firebaseKey === 'autopsy'):   // Line 1586
      <button>"Assigned Autopsies" → click opens AssignedAutopsiesModal</button>

    /* ── E2e. BBCode Section (only when generated) ── */

    if (generatedBBCode):                           // Line 1598
      // Stale BBCode warning (if generated for different form)
      <div class="warning-banner">"BBCode Not Generated for This Form"</div>

      // Auto-deploy enabled notice
      <div class="success-banner">"Auto-Deploy Enabled"</div>

      // Title display + copy
      if (DMEC category): <div>clickable title to copy</div>
      else: <div>amber warning text</div>

      // Quick links (forum URLs)
      <FormQuickLinks />

      // BBCode preview
      if (multipart):
        <div>tabbed parts with copy buttons</div>
      else:
        <pre>full BBCode text</pre>
  </div>
</div>

/* ────────────────────────────────────
   F. PROGRESS RING (floating)
   ──────────────────────────────────── */

<div style="position: fixed; bottom: 20px; right: 20px">  // Line 1949
  appearance: Small dark card with SVG circular progress ring
              Shows: {progress}% + {filled}/{total} fields + decedent name
  only shows when: selectedForm && formProgress.total > 0
</div>

/* ────────────────────────────────────
   ALSO RENDERED (below main layout):
   ──────────────────────────────────── */

<BugReportModal />              // Line 1827 — Bug report form
<AssignedAutopsiesModal />      // Line 1834 — Autopsy case loader
<BotDeployOptInModal />         // Line 1918 — Consent multi-step wizard
<ImagePreviewModal />           // Line 1940 — Full-size image viewer
