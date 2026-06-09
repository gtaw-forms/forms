import { ref, get, update } from 'firebase/database';
import { database } from '../firebase';

// ---------------------------------------------------------------------------
// Character Data Extraction (from GTA World OAuth)
// ---------------------------------------------------------------------------

export const getCharacterData = (gtaWorldUser) => {
    if (!gtaWorldUser) return null;

    if (gtaWorldUser && !window.gtawDebugLogged) {
        console.log('[GTAW Debug] OAuth User Data:', {
            username: gtaWorldUser.username,
            faction: gtaWorldUser.faction,
            factionData: gtaWorldUser.factionData,
            userData: gtaWorldUser.userData,
            characterArray: gtaWorldUser?.userData?.character || gtaWorldUser?.userData?.characters || gtaWorldUser?.character || gtaWorldUser?.characters,
            fullRank: gtaWorldUser?.faction?.rank,
            cleanedRank: gtaWorldUser?.faction?.rank ? gtaWorldUser.faction.rank.replace(/-/g, ' ').trim() : null
        });
        window.gtawDebugLogged = true;
    }

    if (gtaWorldUser.faction) {
        const factionChar = gtaWorldUser.faction;
        return {
            id: factionChar.characterId || factionChar.id || gtaWorldUser.id,
            firstname: factionChar.firstname || '',
            lastname: factionChar.lastname || '',
            fullName: factionChar.characterName || `${factionChar.firstname || ''} ${factionChar.lastname || ''}`.trim() || gtaWorldUser.username,
            memberid: gtaWorldUser.id
        };
    }

    const apiChars = gtaWorldUser?.userData?.character || gtaWorldUser?.userData?.characters || gtaWorldUser?.character || gtaWorldUser?.characters || [];
    const factionChars = gtaWorldUser?.allFactionCharacters || [];

    const characterArray = apiChars.length > 0 ? apiChars : factionChars;

    if (Array.isArray(characterArray) && characterArray.length > 0) {
        let character = characterArray[0].character || characterArray[0];

        const activeName = gtaWorldUser.characterName || gtaWorldUser.character_name;
        if (activeName) {
            const match = characterArray.find(c => {
                const cData = c.character || c;
                const cName = cData.characterName || cData.name || `${cData.firstname || ''} ${cData.lastname || ''}`.trim();
                return cName.toLowerCase() === activeName.toLowerCase();
            });
            if (match) character = match.character || match;
        }

        const charId = String(character.characterId || character.id);
        const factionMatch = factionChars.find(fc => {
            const fcData = fc.character || fc;
            const fcId = String(fcData.characterId || fcData.id);
            return fcId === charId;
        });

        return {
            id: charId,
            firstname: character.firstname || '',
            lastname: character.lastname || '',
            fullName: character.characterName || character.name || `${character.firstname || ''} ${character.lastname || ''}`.trim() || factionMatch?.character?.characterName,
            memberid: gtaWorldUser.id,
            rank: factionMatch?.character?.rank || character.rank
        };
    }

    return {
        id: gtaWorldUser.id,
        firstname: '',
        lastname: '',
        fullName: gtaWorldUser.username || 'GTAW User',
        memberid: gtaWorldUser.id
    };
};

export const getCharacterName = (gtaWorldUser) => {
    const characterData = getCharacterData(gtaWorldUser);
    return characterData ? characterData.fullName : 'GTAW User';
};

export const getCharacterID = (gtaWorldUser) => {
    const characterData = getCharacterData(gtaWorldUser);
    return characterData ? characterData.id : gtaWorldUser?.id;
};

export const cleanRank = (rank) => {
    if (!rank) return 'GTAW User';
    return rank.replace(/-/g, ' ').trim();
};

export const formatCharacterNameForDisplay = (characterName) => {
    if (!characterName) return '';
    return characterName
        .replace(/_/g, ' ')
        .split(' ')
        .map(word => word.charAt(0).toUpperCase() + word.slice(1))
        .join(' ');
};

export const getDatabaseRank = (gtaWorldUser, factionsData) => {
    if (!gtaWorldUser || !factionsData) return null;

    const characterName = getCharacterName(gtaWorldUser);
    if (!characterName || characterName === 'GTAW User') return null;

    for (const factionId in factionsData) {
        const faction = factionsData[factionId];
        if (faction.members) {
            const members = Object.values(faction.members);
            const employee = members.find(member =>
                member.characterName && member.characterName.toLowerCase() === characterName.toLowerCase()
            );
            if (employee) {
                return employee.rank || null;
            }
        }
    }

    return null;
};

export const getDisplayRank = (gtaWorldUser, factionsData) => {
    const dbRank = getDatabaseRank(gtaWorldUser, factionsData);
    if (dbRank) return cleanRank(dbRank);

    if (gtaWorldUser?.faction?.rank) {
        return cleanRank(gtaWorldUser.faction.rank);
    }

    return 'GTAW User';
};

// ---------------------------------------------------------------------------
// Faction Member Updates
// ---------------------------------------------------------------------------

export const updateDiscordName = async (characterId, discordName) => {
    if (!characterId) {
        throw new Error('Character ID is required to update Discord name.');
    }

    const userRef = ref(database, `factions/364/members/${characterId}`);

    try {
        await update(userRef, {
            discordName: discordName,
            discord: discordName
        });
        console.log(`Successfully updated Discord name for character ${characterId}`);
        return { success: true };
    } catch (error) {
        console.error(`Failed to update Discord name for character ${characterId}:`, error);
        throw new Error('Failed to save Discord name to the database.');
    }
};
