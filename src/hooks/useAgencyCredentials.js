import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { triggerGetAgencyCredentials } from '../services/firebaseFunctions';

/**
 * Load the shared faction-forum account credentials via the PHMC-staff-gated
 * Firebase function. Credentials are stored only on the VPS — never in the
 * client bundle.
 *
 * Requires the user to be PHMC staff. The server gate is mirrored client-side
 * (isFactionMember / isSuperAdmin / accessLevel >= 1 / @gmail.com) so
 * non-employees NEVER call the function — otherwise the permission-denied
 * rejection would surface as an unhandled error via the global handler.
 *
 * Returns {} for non-staff / not signed in / function unavailable.
 */
export function useAgencyCredentials() {
    const { user } = useAuth();
    const uid = user?.uid;
    const [creds, setCreds] = useState({});
    const [loaded, setLoaded] = useState(false);

    useEffect(() => {
        if (!uid || !user) {
            setCreds({});
            setLoaded(true);
            return;
        }
        let cancelled = false;
        setLoaded(false);

        user.getIdTokenResult()
            .then(({ claims }) => {
                if (cancelled) return;
                const email = String(claims.email || '').toLowerCase();
                const isStaff = claims.isFactionMember === true
                    || claims.isSuperAdmin === true
                    || (claims.accessLevel || 0) >= 1
                    || email.endsWith('@gmail.com');

                if (!isStaff) {
                    // Non-employee — never request credentials.
                    setCreds({});
                    setLoaded(true);
                    return;
                }

                triggerGetAgencyCredentials()
                    .then((data) => {
                        if (!cancelled) setCreds(data || {});
                    })
                    .catch(() => {
                        // Credentials are optional — fail silently (no console noise).
                        if (!cancelled) setCreds({});
                    })
                    .finally(() => {
                        if (!cancelled) setLoaded(true);
                    });
            })
            .catch(() => {
                // Couldn't read token claims — don't call the function.
                if (!cancelled) {
                    setCreds({});
                    setLoaded(true);
                }
            });

        return () => { cancelled = true; };
    }, [uid, user]);

    return { creds, loaded };
}
