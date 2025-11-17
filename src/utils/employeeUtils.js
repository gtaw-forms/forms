import { database } from '../firebase';
import { ref, get } from 'firebase/database';

export const getCoronerDetails = async (employeeName) => {
    if (!employeeName) return null;
    const coronerFactionRef = ref(database, 'factions/364/members');
    const snapshot = await get(coronerFactionRef);
    if (snapshot.exists()) {
        const members = snapshot.val();
        // The members are an object with keys, so we need to find the one with the matching name
        const memberKey = Object.keys(members).find(key => members[key].name === employeeName);
        return memberKey ? members[memberKey] : null;
    }
    return null;
};

export const getPhmcDetails = async (employeeName) => {
    if (!employeeName) return null;
    const factionsRef = ref(database, 'factions');
    const snapshot = await get(factionsRef);
    if (snapshot.exists()) {
        const factions = snapshot.val();
        for (const factionId in factions) {
            if (factionId !== '364' && factions[factionId].members) {
                const members = factions[factionId].members;
                const memberKey = Object.keys(members).find(key => members[key].name === employeeName);
                if (memberKey) {
                    return members[memberKey];
                }
            }
        }
    }
    return null;
};
