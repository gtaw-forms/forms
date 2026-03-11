# PHMC Forms Workspace Analysis
## Code Bloat, Redundancy, and Improvement Opportunities

**Analysis Date:** March 11, 2026  
**Scope:** src/hooks/, src/components/, src/utils/, src/services/

---

## Executive Summary

The phmc-forms codebase has significant opportunities for consolidation and refactoring. Key findings:
- **6 duplicate sanitization functions** across different files
- **15+ duplicated data-fetching patterns** in admin components
- **Multiple modal management systems** creating complexity
- **Scattered image upload logic** across several contexts
- **Inconsistent API layer** with mixed Firebase operations throughout components
- **Bloated FormHandler.jsx** (~1800 lines) with multiple concerns

---

## 1. CODE DUPLICATION ANALYSIS

### 1.1 Sanitization Functions (CRITICAL - 6 Instances)

**Issue:** The `comprehensiveSanitize()` function is defined identically in **5 separate files**:

| File | Usage |
|------|-------|
| [src/hooks/useFormSaver.js](src/hooks/useFormSaver.js#L9) | Form author sanitization |
| [src/components/form-handler/useFormHandler.js](src/components/form-handler/useFormHandler.js#L6) | Form handler author |
| [src/components/Admin/UserStats.jsx](src/components/Admin/UserStats.jsx#L4) | Employee name sanitization |
| [src/hooks/useReportLoader.js](src/hooks/useReportLoader.js#L10) | User ID sanitization (used 4x) |
| [src/hooks/useReportActions.js](src/hooks/useReportActions.js#L10) | User ID sanitization (used 2x) |

**Additionally:** [src/components/Admin/UserManagementModal.jsx](src/components/Admin/UserManagementModal.jsx#L44) defines `sanitizeForFirebasePath()` - a slightly different variant.

**Impact:**
- Maintenance nightmare: Bug fixes must be applied in 6 places
- Code review complexity doubles
- Inconsistency risk if functions drift

**Recommendation:** Create centralized utility module:
```javascript
// src/utils/sanitizationUtils.js
export const comprehensiveSanitize = (str) => { /* ... */ };
export const sanitizeForFirebasePath = (str) => { /* ... */ };
```

---

### 1.2 Image Upload Patterns (HIGH - 3+ Variations)

**Issue:** Image upload logic duplicated/scattered across:

| Location | Pattern |
|----------|---------|
| [src/hooks/useImageUpload.js](src/hooks/useImageUpload.js#L32-L95) | Full ImgBB upload with formData |
| [src/utils/imageUploadUtils.js](src/utils/imageUploadUtils.js#L31-L53) | ImgBB proxy wrapper |
| [src/utils/imageUploadUtils.js](src/utils/imageUploadUtils.js#L57-L86) | Imgur proxy wrapper |
| [src/utils/imageUploadUtils.js](src/utils/imageUploadUtils.js#L170-L210) | Progress-tracking variant |
| [src/components/Modals/MapModal.jsx](src/components/Modals/MapModal.jsx#L153) | Custom inline usage |

**Scope:** Used across:
- FormHandler/ImageUploader
- WebhookProvider
- MapModal
- AgencyIncidentModal
- EmsDashboard
- HallOfFameManager

**Issues:**
- Different components passing `null` vs undefined to `setFormData`
- Inconsistent error handling
- Multiple upload path variants (direct API, proxy functions)
- OCR logic tightly coupled to ImageUploader component

---

### 1.3 Firebase Data Fetching Pattern (MEDIUM - 15+ Instances)

**Common Pattern (Identical Structure):**
```javascript
const [data, setData] = useState([]);
const [loading, setLoading] = useState(false);
const [error, setError] = useState(null);

const fetchData = useCallback(async () => {
  setLoading(true);
  setError(null);
  try {
    const db = getDatabase();
    const ref = ref(db, 'path');
    const snapshot = await get(ref);
    if (snapshot.exists()) {
      const list = Object.keys(snapshot.val()).map(key => ({ 
        id: key, ...snapshot.val()[key] 
      }));
      setData(list);
    }
  } catch (err) {
    setError(err);
  } finally {
    setLoading(false);
  }
}, []);
```

**Affected Components (Examples):**
- [src/components/Admin/SuperAdminManager.jsx](src/components/Admin/SuperAdminManager.jsx#L14-L36) - `fetchSuperAdmins()`
- [src/components/Admin/UserStats.jsx](src/components/Admin/UserStats.jsx#L20-L32) - `fetchEmployees()`
- [src/components/Admin/WebhookLogs.jsx](src/components/Admin/WebhookLogs.jsx#L11-L32) - `fetchLogs()`
- [src/components/Admin/HallOfFameManager.jsx](src/components/Admin/HallOfFameManager.jsx#L21-L38) - `fetchEntries()`
- [src/components/Admin/LsccManager.jsx](src/components/Admin/LsccManager.jsx#L97-140) - `fetchData()`
- [src/components/Admin/MetricsDashboard.jsx](src/components/Admin/MetricsDashboard.jsx#L15-27) - `fetchMetrics()`
- [src/components/Admin/EmployeeManager.jsx](src/components/Admin/EmployeeManager.jsx#L40-132) - `fetchAndProcessData()`
- [src/components/Admin/WebhookManager.jsx](src/components/Admin/WebhookManager.jsx#L44-66) - `loadWebhooks()`

**Recommendation:** Create a reusable hook:
```javascript
// src/hooks/useFirebaseQuery.js
export const useFirebaseQuery = (path, transform = null) => {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  
  const fetch = useCallback(async () => { /* ... */ }, [path, transform]);
  
  useEffect(() => { fetch(); }, [fetch]);
  
  return { data, loading, error, refetch: fetch };
};
```

---

## 2. FILE ORGANIZATION AND STRUCTURE ISSUES

### 2.1 Components Directory Bloat

**Problem:** Components directory has weak separation of concerns:

```
components/
├── Admin/              (31 files, heavily mixed concerns)
│   ├── AdminDashboard.jsx        (~1000 lines, router/dashboard)
│   ├── AddFormModal.jsx          (~720 lines, form builder)
│   ├── FactionDataUpload.jsx    (~700 lines, CSV upload logic)
│   ├── DatabaseEditor.jsx        (~600 lines, CRUD operations)
│   ├── LsccManager.jsx          (~400 lines, protocol management)
│   ├── WebhookManager.jsx        (~350 lines, webhook UI)
│   ├── UserManagementModal.jsx  (~350 lines, user operations)
│   └── [27 more files...]       (varying sizes)
├── Modals/             (22 files, pure UI components)
├── form-handler/       (13 files, form logic)
├── ems-dashboard/      (2 files)
└── UI/                 (15 files)
```

**Issues:**
- **Admin folder is a dumping ground** - mixes admin panels, managers, modals, and utilities
- **No clear sublayering** - all at same depth regardless of complexity
- **Related managers scattered** - EmployeeManager, EmployeeModal, EmployeeNewDetails in different folders
- **Utility components mixed with containers** - ErrorBoundary, LoadingSpinner alongside router components

**Recommended Structure:**
```
components/
├── Admin/
│   ├── Dashboards/           (large admin views)
│   │   ├── AdminDashboard.jsx
│   │   ├── MetricsDashboard.jsx
│   │   └── WebhookLogs.jsx
│   ├── Managers/             (CRUD interfaces)
│   │   ├── EmployeeManager/
│   │   │   ├── EmployeeManager.jsx
│   │   │   └── EmployeeManager.module.css
│   │   ├── FormsManager/
│   │   ├── FactionDataManager/
│   │   └── WebhookManager/
│   ├── Editors/              (form/data editors)
│   │   ├── DatabaseEditor.jsx
│   │   └── AddFormModal.jsx
│   └── ToolsPanel.jsx        (coordinator)
├── Modals/                   (modal overlays only)
├── UI/                       (reusable UI primitives)
└── FormHandler/              (form-specific logic)
```

---

### 2.2 Modal Management Fragmentation

**Problem:** Modal state spread across multiple systems:

| System | Location | Modal Count |
|--------|----------|------------|
| `useModal()` hook | [src/hooks/useModal.js](src/hooks/useModal.js) | 12+ state vars |
| `ModalProvider` | [src/contexts/ModalProvider.jsx](src/contexts/ModalProvider.jsx) | 12+ duplicates (!) |
| `useFormHandler` component | [src/components/form-handler/FormHandler.jsx](src/components/form-handler/FormHandler.jsx#L81-L103) | 7 local states |
| `FeatureRequestModal` | [src/contexts/FeatureRequestModal.jsx](src/contexts/FeatureRequestModal.jsx) | Standalone context |

**Redundancy:** ModalProvider and useModal export **identical state for 12 modals** - one doesn't use the other!

**Issue Examples:**
```javascript
// In useModal.js AND ModalProvider.jsx (DUPLICATED):
const [showEmsBingoModal, setShowEmsBingoModal] = useState(false);
const [showEasterEggModal, setShowEasterEggModal] = useState(false);
const [showAgencySelector, setShowAgencySelector] = useState(false);
// ... 9 more duplicates
```

**Recommendation:**
1. Delete `useModal.js` - use `ModalProvider.jsx` exclusively
2. Move FormHandler modals to proper manager components
3. Consolidate all modal state into ModalProvider (with selectors if needed)

---

## 3. HOOK REDUNDANCY

### 3.1 Overlapping Responsibilities

**Problem:** Several hooks do overlapping things:

| Hook | Purpose | Lines |
|------|---------|-------|
| [useImageUpload.js](src/hooks/useImageUpload.js) | Image upload with form state updates | 111 |
| [useFormSaver.js](src/hooks/useFormSaver.js) | Report saving with sanitization | 300+ |
| [useReportActions.js](src/hooks/useReportActions.js) | Report delete/duplicate with sanitization | 200+ |
| [useReportLoader.js](src/hooks/useReportLoader.js) | Report loading with sanitization | 400+ |

**Issue:** useFormSaver, useReportActions, and useReportLoader all:
- Duplicate `comprehensiveSanitize()`
- Replicate Firebase read/write patterns
- Handle nearly identical error cases
- Share admin logging logic

**Recommendation:** Create a unified report management layer:
```javascript
// src/hooks/useReportManagement.js
export const useReportManagement = () => {
  const saveReport = useCallback(async (report) => { /* ... */ }, []);
  const loadReport = useCallback(async (userId, reportId) => { /* ... */ }, []);
  const deleteReport = useCallback(async (userId, reportId) => { /* ... */ }, []);
  const duplicateReport = useCallback(async (userId, reportId) => { /* ... */ }, []);
  
  return { saveReport, loadReport, deleteReport, duplicateReport };
};
```

---

### 3.2 Single-Purpose Hooks That Could Be Merged

| Hook | Responsibility |
|------|-----------------|
| [useGtaWorldAuth.js](src/hooks/useGtaWorldAuth.js) | GTA auth state + character management |
| [useFactionPermissions.js](src/hooks/useFactionPermissions.js) | Faction permission checks |
| [useUserMetrics.js](src/hooks/useUserMetrics.js) | User action tracking |

**These might benefit from consolidation into a single `useUserSession()` hook** that provides auth, permissions, and metrics together, reducing context/hook drilling.

---

## 4. COMPONENT REDUNDANCY

### 4.1 Similar Modal Implementations

Multiple modals implement similar patterns without reusing base logic:

| Modal | Lines | Responsibilities |
|-------|-------|-----------------|
| [EmployeeModal.jsx](src/components/Modals/EmployeeModal.jsx) | ~400 | Form + Firebase write + validation |
| [EmployeeNewDetails.jsx](src/components/Modals/EmployeeNewDetails.jsx) | ~350 | Similar form + same write pattern |
| [EmployeeCredentialsSection.jsx](src/components/Modals/EmployeeCredentialsSection.jsx) | ~200 | Employee record display |
| [CctvRequestWebhookModal.jsx](src/components/Admin/CctvRequestWebhookModal.jsx) | ~600 | Request form + webhook dispatch |

**Issue:** Employees have **3+ modal/section components** with overlapping state management and validation.

**Recommended:** Consolidate to `EmployeeModal` with configurable tabs/modes.

---

### 4.2 Modal Styling Inconsistency

Modals use **3 different styling approaches**:

1. **CSS Module-based:** `BaseModal.jsx` + `BaseModal.css` (proper)
2. **Inline styles:** `EmployeeModal.jsx` hardcodes colors
3. **Mix of both:** Most modals blend approaches

**Example:**
```jsx
// EmployeeModal.jsx - hardcoded
const modalOverlayStyle = {
  backgroundColor: 'rgba(0, 0, 0, 0.7)',
  // ...
};

// vs BaseModal.jsx - CSS vars
var(--modal-bg)
```

**Recommendation:** Enforce BaseModal usage with CSS module inheritance.

---

## 5. UTILITY FUNCTIONS: SCATTERED AND INCONSISTENT

### 5.1 Utility File Inventory

| File | Responsibilities | Lines |
|------|-----------------|-------|
| [textUtils.js](src/utils/textUtils.js) | Text cleaning (1 export) | ? |
| [dateTimeUtils.js](src/utils/dateTimeUtils.js) | Date formatting | ? |
| [imageUploadUtils.js](src/utils/imageUploadUtils.js) | Image upload (proxy versions) | 210 |
| [webhookUtils.js](src/utils/webhookUtils.js) | Discord webhook sending | 35 |
| [formValidation.js](src/utils/formValidation.js) | Form schema validation | ? |
| [errorUtils.js](src/utils/errorUtils.js) | Error handling + Discord logging | 350+ |
| [fbcodeHelpers.js](src/utils/bbcodeHelpers.js) | BBCode generation | ? |
| [adminLogger.js](src/utils/adminLogger.js) | Admin action logging | ? |
| [employeeUtils.js](src/utils/employeeUtils.js) | Employee data filtering | ? |
| [mapImageUploadUtils.js](src/utils/mapImageUploadUtils.js) | Map screenshot capture | ? |
| [characterUtils.js](src/utils/characterUtils.js) | Character data handling | ? |
| [factionUtils.js](src/utils/factionUtils.js) | Faction data operations | ? |

**Issues:**
- **12+ utility files** with unclear separation
- **No consistent file naming** (bbcodeHelpers vs imageploadUtils)
- **Mixed concerns** - adminLogger does logging + context retrieval
- **Implicit dependencies** - utils imported sporadically without package boundaries

**Recommendation:** Organize into logical packages:
```
utils/
├── sanitization/
│   ├── comprehensiveSanitize.js
│   ├── firebasePathSanitize.js
│   └── index.js
├── imageUpload/
│   ├── uploadImageToImgBB.js
│   ├── uploadImageWithFallback.js
│   └── index.js
├── firebase/
│   ├── firestoreHelpers.js
│   └── realtimeDbHelpers.js
├── webhooks/
│   ├── discord/
│   └── index.js
└── index.js (public API)
```

---

## 6. API/SERVICE LAYER INCONSISTENCY

### 6.1 Firebase Operations Scattered Throughout React Components

**Problem:** Firebase calls mixed into components instead of centralized service layer.

**Examples:**

| Component | Firebase Operations |
|-----------|-------------------|
| [UserStats.jsx](src/components/Admin/UserStats.jsx#L25-L60) | `getDatabase()`, `ref()`, `get()` |
| [WebhookManager.jsx](src/components/Admin/WebhookManager.jsx#L44) | Multiple `ref()` calls inline |
| [LsccManager.jsx](src/components/Admin/LsccManager.jsx#L105-115) | `ref()`, `onValue()` mixed |
| [AdminAuthAndActions.jsx](src/components/Admin/AdminAuthAndActions.jsx#L60-85) | Firebase directly in component |

**Contrast:** Proper service pattern:
- [src/services/gtaWorldAuth.js](src/services/gtaWorldAuth.js) - Abstracts OAuth
- [src/services/firebaseFunctions.js](src/services/firebaseFunctions.js) - Wraps Cloud Functions

**Recommendation:** Create service layer:
```javascript
// src/services/reportsService.js
export class ReportsService {
  static async fetchUserReports(userId) { /* ... */ }
  static async saveReport(userId, report) { /* ... */ }
  static async deleteReport(userId, reportId) { /* ... */ }
  static async fetchMetrics() { /* ... */ }
}

// src/services/webhookService.js
export class WebhookService {
  static async listWebhooks() { /* ... */ }
  static async sendWebhook(url, payload) { /* ... */ }
  static async fetchLogs() { /* ... */ }
}
```

---

### 6.2 Authentication/Authorization Scattered

auth info accessed from:
- `useGtaWorldAuth()` hook
- `AuthContext.jsx` getIdTokenResult
- `gtaWorldAuth.js` localStorage manipulation
- sessionStorage direct access in multiple components

**Better approach:** Single auth service managing all auth state + Firebase custom claims integration.

---

## 7. DEAD CODE & UNUSED IMPORTS

### 7.1 Observable Patterns

**Notable:** 
- `useModal.js` hook exists but ModalProvider duplicates it
- Multiple `uploadImageToImgBB` exports with same name (alias pattern)
- FormRequestModal.module.css in Modals folder but form requests handled elsewhere
- Unused localStorage keys inconsistency (`lastSelectedFormName` vs others)

**Recommendation:** Run dead code analysis:
```bash
# ESLint with unused-imports plugin
npm install --save-dev eslint-plugin-unused-imports
```

---

## 8. SPECIFIC FILE COMPLEXITY ISSUES

### 8.1 FormHandler.jsx - The Monolith

**Stats:**
- ~1800 lines
- 40+ useState hooks
- 20+ useCallback hooks
- 15+ useEffect hooks
- Renders 8+ different modals

**Issues:**
- Single responsibility principle violated
- Hard to test
- Difficult to reason about
- Prop drilling nightmare

**Responsibilities Mixed:**
1. Form selection/navigation
2. Form field management
3. BB code generation
4. Report saving
5. Image uploading
6. Validation
7. Modal management
8. Report attachment handling
9. Map interactions

**Recommendation:** Break into:
```
components/form-handler/
├── FormHandler.jsx           (orchestrator only)
├── FormSelector.jsx          (form list/search)
├── FormEditor.jsx            (field editing)
├── FormValidation.jsx        (validation logic)
├── FormActions.jsx           (save/load/delete)
└── hooks/
    ├── useFormHandler.js     (refactored logic)
    └── useFormState.js       (state management)
```

---

### 8.2 AdminDashboard.jsx - Router + Dashboard in One

**Stats:**
- ~1000 lines
- Routes to sub-components
- Manages multiple admin sections
- Passes props to 10+ child managers

**Recommendation:** Split:
```
components/Admin/
├── AdminDashboard.jsx        (slim coordinator)
├── sections/
│   ├── DatabaseSection.jsx
│   ├── UsersSection.jsx
│   ├── FormsSection.jsx
│   └── WebhooksSection.jsx
```

---

## 9. CONTEXT OVERUSE

**Issue:** Too many scattered contexts:

| Context | Purpose | Lines |
|---------|---------|-------|
| AuthContext | Auth state | 60 |
| DataContext | Form data cache | 800+ (!) |
| NotificationContext | Toast messages | ~100 |
| SettingsProvider | Settings | ? |
| WebhookProvider | Webhook state | 200+ |
| ModalProvider | Modal state | 100+ |
| SeasonalEffectsContext | Seasonal UI | ? |
| FormContext | Form defaults | ? |

**Issue:** DataContext is 800+ lines - caches forms, agencies, factions, verified admins, all with complex cache logic.

**Recommendation:** 
- Split DataContext into separate contexts
- Use Zustand or Redux if state becomes complex
- Consider React Query for server state

---

## 10. TOP PRIORITY REFACTORING OPPORTUNITIES

### Quick Wins (1-2 hours each):

1. ✅ **Extract `comprehensiveSanitize` to shared utility** 
   - Impacts: 6 files
   - Testing benefit: Medium
   - Maintenance benefit: High

2. ✅ **Consolidate duplicate ModalProvider + useModal**
   - Impacts: 2 files
   - Maintenance benefit: High

3. ✅ **Create `useFirebaseQuery` hook**
   - Impacts: 8+ components
   - Code reduction: ~200 lines per component

4. ✅ **Extract modal styling into base module**
   - Impacts: 15+ modal components
   - Consistency benefit: High

### Medium Effort (4-8 hours):

5. 🔄 **Create service layer for Reports/Webhooks/Factions**
   - Impacts: 15+ components
   - Testing benefit: High
   - Decoupling benefit: High

6. 🔄 **Reorganize Admin folder structure**
   - Impacts: 31 files
   - Future maintainability: Very High

7. 🔄 **Extract FormHandler sub-components**
   - Impacts: 1 file + 8+ new files
   - Testability: High
   - Complexity reduction: High

### Major Refactoring (16+ hours):

8. ⚠️ **Implement unified image upload architecture**
   - Consolidate: useImageUpload, imageUploadUtils, MapModal variants
   - Testing benefit: Very High
   - Integration benefit: High

9. ⚠️ **Split DataContext into domain-specific contexts**
   - Reduce: 800 lines
   - Clarity: High
   - Performance tuning: Medium

10. ⚠️ **Create comprehensive auth service**
    - Impacts: useGtaWorldAuth, AuthContext, gtaWorldAuth.js
    - Security benefit: Medium
    - Clarity: High

---

## SUMMARY TABLE: Redundancy by Category

| Category | Count | Severity | Effort |
|----------|-------|----------|--------|
| Duplicate sanitization functions | 6 | 🔴 HIGH | 1h |
| Identical fetch patterns | 15+ | 🟡 MEDIUM | 4h |
| Modal implementations | 22 | 🟡 MEDIUM | 8h |
| Scattered Firebase calls | 20+ | 🔴 HIGH | 6h |
| Unused/duplicated hooks | 3 | 🟠 LOW | 2h |
| Unorganized utilities | 12 files | 🟡 MEDIUM | 12h |
| Context overuse | 8 contexts | 🟠 LOW | 8h |
| **Total estimated refactoring** | | | **41+ hours** |

---

## Files to Review First

1. [ [src/hooks/useFormSaver.js](src/hooks/useFormSaver.js) ] - Contains first sanitization duplicate
2. [ [src/utils/imageUploadUtils.js](src/utils/imageUploadUtils.js) ] - Image upload consistency
3. [ [src/components/form-handler/FormHandler.jsx](src/components/form-handler/FormHandler.jsx) ] - Monolith
4. [ [src/components/Admin/AdminDashboard.jsx](src/components/Admin/AdminDashboard.jsx) ] - Router + dashboard mix
5. [ [src/contexts/DataContext.jsx](src/contexts/DataContext.jsx) ] - Over-complex cache logic
6. [ [src/hooks/useModal.js](src/hooks/useModal.js) ] vs [ [src/contexts/ModalProvider.jsx](src/contexts/ModalProvider.jsx) ] - Duplication

---

**End of Analysis**
