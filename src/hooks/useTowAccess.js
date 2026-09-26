import { useState, useEffect, useMemo, useCallback } from 'react';
import { database } from '../firebase';
import { ref, onValue } from 'firebase/database';

export const TOW_LOCAL_ACCESS_KEY = 'phmc_tow_access_poc';

export const isTowLocalHost = () =>
    typeof window !== 'undefined' &&
    (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1');

// Client mirror of the function leadership gate (tow-supervisor flag,
// accessLevel admin/management, superadmin). Token-side enforcement lives
// in requireTowManager — this only controls what the UI offers.
export function isLeadershipAccess(accessLevel) {
    return ['superadmin', 'admin', 'management'].includes(String(accessLevel || '').toLowerCase());
}

function readLocalAccess() {
    try {
        const raw = localStorage.getItem(TOW_LOCAL_ACCESS_KEY);
        const list = raw ? JSON.parse(raw) || [] : [];
        return Array.isArray(list) ? list : [];
    } catch {
        return [];
    }
}

/**
 * Tow Reports access: PHMC members auto-pass, contractors pass via UCP-name
 * grant, tow-supervisors carry the supervisor flag. Localhost stays open
 * (dev) and reads the browser store; prod reads RTDB `tow-access`.
 */
export function useTowAccess({ isAuthenticated, characterName, ucpName, isPhmcMember }) {
    const [accessList, setAccessList] = useState([]);
    const local = isTowLocalHost();

    const reload = useCallback(() => {
        if (isTowLocalHost()) setAccessList(readLocalAccess());
    }, []);

    useEffect(() => {
        if (local) {
            setAccessList(readLocalAccess());
            return;
        }
        if (!isAuthenticated) {
            setAccessList([]);
            return;
        }
        const unsub = onValue(
            ref(database, 'tow-access'),
            (snap) => {
                const data = snap.val() || {};
                setAccessList(Object.entries(data).map(([id, v]) => ({ id, ...(v || {}) })));
            },
            () => {}
        );
        return () => unsub();
    }, [isAuthenticated, local]);

    const names = useMemo(
        () => [(characterName || ''), (ucpName || '')].map((s) => String(s || '').trim().toLowerCase()).filter(Boolean),
        [characterName, ucpName]
    );
    const myGrant = useMemo(
        () => accessList.find((a) => names.includes(String(a.ucpName || '').trim().toLowerCase())) || null,
        [accessList, names]
    );
    const hasAccess = local || !!isPhmcMember || !!myGrant;
    const isTowSupervisor = !!(myGrant && myGrant.supervisor === true);

    return { accessList, hasAccess, isTowSupervisor, myGrant, isLocal: local, reload };
}
