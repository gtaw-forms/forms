# PHMC Forms - Error Logs To Fix (Updated)

This file contains the current lint errors and warnings as of February 3, 2026.

## Summary
- **Total Problems**: 196
- **Errors**: 43 (Critical - Build will fail)
- **Warnings**: 153 (Code Quality - Recommended)

---

## 🛠️ Critical Errors by File

### src\components\Admin\AddFormModal.jsx
- **Multiple**: Unescaped entities (`"`) in JSX at lines 936, 937, 1289. Use `&quot;`.

### src\components\Admin\AdminDashboard.jsx
- **L661**: Unescaped `'` in "Don't". Use `&apos;`.

### src\components\Admin\BulkAddFieldsModal.jsx
- **L484**: Unescaped `"` in placeholder or text. Use `&quot;`.

### src\components\Admin\CctvRequestWebhookModal.jsx
- **L342**: Unescaped `'` in "you'll". Use `&apos;`.

### src\components\Admin\DatabaseEditor.jsx
- **L509, 510**: Unescaped `"` in text. Use `&quot;`.

### src\components\Admin\FactionDataUpload.jsx
- **L733, 783**: Unescaped `'` in "all" and "Refresh". Use `&apos;`.

### src\components\Admin\FirebaseFunctionsTester.jsx
- **L109**: Unescaped `"` in "Critical Outage". Use `&quot;`.

### src\components\Admin\LsccManager.jsx
- **L389, 502**: Unescaped `"` in "Add New Keyword" and "Add New Injury Type". Use `&quot;`.

### src\components\Admin\RenameRoleKeyModal.jsx
- **L124**: Unescaped `"` in "Display Name". Use `&quot;`.

### src\components\Admin\ReviewPhraseRequestsModal.jsx
- **L192**: Unescaped `"` around `{phrase.trim()}`. Use `&quot;`.
When a user 
### src\components\Admin\UserManagementModal.jsx
- **L18, 45**: Unnecessary escape character: `\/`.

### src\components\Admin\UserStats.jsx
- **L6**: Unnecessary escape character: `\/`.

### src\components\Modals\EmployeeModal.jsx
- **L211, 218**: Unescaped `'`. Use `&apos;`.

### src\components\Modals\EmsBingoModal.jsx
- **L719**: Unescaped `"`. Use `&quot;`.

### src\components\Modals\MapModal.jsx
- **Multiple**: Unnecessary escape character: `\/`.
- **L877**: `ReactDOM.render` is deprecated. Use `createRoot`.

### src\components\Modals\OnboardingModal.jsx
- **Multiple**: Unescaped `'` at lines 400, 431, 494, 505, 579, 708. Use `&apos;`.

### src\components\form-handler\CctvRequestModal.jsx
- **L345**: Unescaped `'` in "you'll". Use `&apos;`.

### src\components\form-handler\FormFieldRenderer.jsx
- **Multiple**: Unescaped `'` at lines 710, 731. Use `&apos;`.

### src\components\form-handler\FormHandler.jsx
- **L1310**: Unescaped `"` in "Generate BBCode". Use `&quot;`.

### src\components\form-handler\UnprocessedCKsViewer.jsx
- **L159**: Unescaped `"` in text. Use `&quot;`.

### src\components\form-handler\useFormHandler.js
- **L8, 24**: Unnecessary escape character: `\/`.

### src\hooks\useFormSaver.js
- **L11, 216**: Unnecessary escape character: `\/`.

### src\hooks\useMigrationSaver.js
- **L12, 87**: Unnecessary escape character: `\/`.

### src\hooks\useReportActions.js
- **L12**: Unnecessary escape character: `\/`.

### src\hooks\useReportAttachment.js
- **L14**: Unexpected empty object pattern.
- **L135**: Unnecessary escape character: `\[`.

### src\hooks\useReportLoader.js
- **L12**: Unnecessary escape character: `\/`.

---

## 📝 Next Steps
Fix these 43 errors to enable successful production builds.