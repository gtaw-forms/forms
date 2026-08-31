/**
 * deathRecordDraft.js — Re-export facade.
 *
 * This file maintains backward compatibility for dynamic imports in:
 *   - index.js
 *   - autoDeploy.js
 *   - death-record-check.js
 *
 * All implementation was split into focused sub-modules:
 *   - deathRecordDraftCache.js     — morgue cache + name lookup
 *   - deathRecordDraftGenerator.js — template + BBCode draft generation
 *   - deathRecordDraftUI.js        — Discord embeds, buttons, message mgmt
 *   - deathRecordDraftActions.js   — button/modal interaction handlers
 *   - deathRecordDraftFace.js      — Facebrowser post draft review/approve flow
 *   - deathRecordDraftScan.js      — Firebase listeners, CK scanning
 */

export { setDraftClient, setDraftForumClient, getDraftClient } from './deathRecordDraftUI.js';

export { initMorgueCache, updateMorgueCache, removeMorgueCache, getMorgueCache, isMorgueCacheLoaded } from './deathRecordDraftCache.js';

export { handleDraftButton, handleEditModal, handleEditFieldsModal } from './deathRecordDraftActions.js';

export { createFaceDraft, handleFaceButton, handleFaceEditModal } from './deathRecordDraftFace.js';

export { processCKReport, startMorgueListener, getPendingMorgueRecords, recheckMorgueForDraft, passivCKCheck, startCKListener, scanAndDraftCKs, recoverInterruptedDeathRecordApprovals, verifyPostedDeathRecords, VERIFY_DELAY_MS } from './deathRecordDraftScan.js';
