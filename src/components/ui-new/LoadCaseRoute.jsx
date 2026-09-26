import React from 'react';
import { useParams } from 'react-router-dom';
import NewUIPrototype from './index.jsx';
import LoginSplash from '../Auth/LoginSplash.jsx';
import { getCurrentUser } from '../../services/gtaWorldAuth';

/**
 * LoadCaseRoute — deep link into a single autopsy body for examination:
 *   #/load/<requestTopicId>            (singular request)
 *   #/load/<requestTopicId>/<caseIdx>  (mass-collection body)
 *
 * Renders the standard UI with the Assigned Autopsies modal opened and the
 * matching entry auto-loaded (morgue match + autopsy form fill, exactly as if
 * the ME pressed Load themselves). Logged-out visitors get the login splash
 * with a return path back here; the modal itself enforces assigned-ME or
 * supervisor-up visibility and refuses anything else.
 */
const LoadCaseRoute = () => {
    const { requestId, caseIdx } = useParams();

    let authed = false;
    try {
        authed = !!getCurrentUser();
    } catch {
        authed = false;
    }
    if (!authed) {
        return (
            <LoginSplash
                title="ME sign-in required"
                message="Sign in with your GTAW account to load this autopsy case."
                returnPath={window.location.hash || '#/'}
            />
        );
    }
    return <NewUIPrototype autoLoad={{ requestId, caseIdx: caseIdx ?? null }} />;
};

export default LoadCaseRoute;
