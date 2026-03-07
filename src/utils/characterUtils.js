// Helper function to get character data from GTA World OAuth user
export const getCharacterData = (gtaWorldUser) => {
    if (!gtaWorldUser) return null;

    // Debug: Log faction member data and OAuth details (only once per session)
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

    // Priority 1: Try faction data with character info (this is the character they're logged in with for the faction)
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

    // Priority 2: Try to get character data from the proper location (characters array)
    const apiChars = gtaWorldUser?.userData?.character || gtaWorldUser?.userData?.characters || gtaWorldUser?.character || gtaWorldUser?.characters || [];
    const factionChars = gtaWorldUser?.allFactionCharacters || [];
    
    // Combine them to ensure we don't miss anything, base on API chars if available
    const characterArray = apiChars.length > 0 ? apiChars : factionChars;
    
    if (Array.isArray(characterArray) && characterArray.length > 0) {
        // Find the "best" character to show
        let character = characterArray[0].character || characterArray[0];
        
        // If we have a specific active character name in the parent user object, try to match it
        const activeName = gtaWorldUser.characterName || gtaWorldUser.character_name;
        if (activeName) {
            const match = characterArray.find(c => {
                const cData = c.character || c;
                const cName = cData.characterName || cData.name || `${cData.firstname || ''} ${cData.lastname || ''}`.trim();
                return cName.toLowerCase() === activeName.toLowerCase();
            });
            if (match) character = match.character || match;
        }
        
        // Look for faction enrichment for the selected character
        const charId = character.characterId || character.id;
        const factionMatch = factionChars.find(fc => {
            const fcData = fc.character || fc;
            return (fcData.characterId || fcData.id) == charId;
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

    // Final fallback
    return {
        id: gtaWorldUser.id,
        firstname: '',
        lastname: '',
        fullName: gtaWorldUser.username || 'GTAW User',
        memberid: gtaWorldUser.id
    };
};

// Helper function to get character name with proper fallbacks
export const getCharacterName = (gtaWorldUser) => {
    const characterData = getCharacterData(gtaWorldUser);
    return characterData ? characterData.fullName : 'GTAW User';
};

// Helper function to get character ID (for badge numbers)
export const getCharacterID = (gtaWorldUser) => {
    const characterData = getCharacterData(gtaWorldUser);
    return characterData ? characterData.id : gtaWorldUser?.id;
};

// Helper function to clean rank by removing dash characters
export const cleanRank = (rank) => {
    if (!rank) return 'GTAW User';
    return rank.replace(/-/g, ' ').trim();
};

export const formatCharacterNameForDisplay = (characterName) => {
    if (!characterName) return '';
    return characterName
        .replace(/_/g, ' ') // Replace underscores with spaces
        .split(' ')         // Split by spaces
        .map(word => word.charAt(0).toUpperCase() + word.slice(1)) // Capitalize first letter of each word
        .join(' ');         // Join back with spaces
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
    // Try to get database rank first
    const dbRank = getDatabaseRank(gtaWorldUser, factionsData);
    if (dbRank) return cleanRank(dbRank);
    
    // Fallback to cleaned faction rank
    if (gtaWorldUser?.faction?.rank) {
        return cleanRank(gtaWorldUser.faction.rank);
    }
    
    return 'GTAW User';
};