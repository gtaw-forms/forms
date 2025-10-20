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
            cleanedRank: gtaWorldUser?.faction?.rank ? gtaWorldUser.faction.rank.replace(/-/g, '').trim() : null
        });
        window.gtawDebugLogged = true;
    }

    // Priority 1: Try faction data with character info (this is the character they're logged in with for the faction)
    if (gtaWorldUser.faction && gtaWorldUser.factionData) {
        return {
            id: gtaWorldUser.factionData.characterId || gtaWorldUser.faction.characterId, // Use character ID from factionData
            firstname: gtaWorldUser.faction.firstname || '',
            lastname: gtaWorldUser.faction.lastname || '',
            fullName: `${gtaWorldUser.faction.firstname || ''} ${gtaWorldUser.faction.lastname || ''}`.trim() || gtaWorldUser.faction.characterName || gtaWorldUser.username,
            memberid: gtaWorldUser.id
        };
    }

    // Priority 2: Fallback to faction data if available (legacy support)
    if (gtaWorldUser.faction) {
        return {
            id: gtaWorldUser.faction.characterId || gtaWorldUser.id, // Prefer character ID over member ID
            firstname: gtaWorldUser.faction.firstname || '',
            lastname: gtaWorldUser.faction.lastname || '',
            fullName: `${gtaWorldUser.faction.firstname || ''} ${gtaWorldUser.faction.lastname || ''}`.trim() || gtaWorldUser.faction.characterName || gtaWorldUser.username,
            memberid: gtaWorldUser.id
        };
    }

    // Priority 3: Try to get character data from the proper location (characters array)
    const characterArray = gtaWorldUser?.userData?.character || gtaWorldUser?.userData?.characters || gtaWorldUser?.character || gtaWorldUser?.characters || [];
    
    if (Array.isArray(characterArray) && characterArray.length > 0) {
        // If we have faction info but no character data, try to find the matching character
        const factionCharacterId = gtaWorldUser?.faction?.characterId;
        let character = characterArray[0]; // Default to first character
        
        // If we have a faction character ID, try to find the matching character
        if (factionCharacterId) {
            const matchingCharacter = characterArray.find(char => char.id === factionCharacterId);
            if (matchingCharacter) {
                character = matchingCharacter;
            }
        }
        
        return {
            id: character.id, // This should be the character ID (5573 for Alyson Frost)
            firstname: character.firstname || '',
            lastname: character.lastname || '',
            fullName: `${character.firstname || ''} ${character.lastname || ''}`.trim(),
            memberid: character.memberid // This is the member ID (43132)
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

// Helper function to get database rank by looking up character in staff collections
export const getDatabaseRank = (gtaWorldUser, phmcListData = [], coronerListData = []) => {
    if (!gtaWorldUser) return null;
    
    const characterName = getCharacterName(gtaWorldUser);
    if (!characterName || characterName === 'GTAW User') return null;
    
    // Try to find in PHMC staff first
    const phmcEmployee = phmcListData.find(employee => 
        employee.name && employee.name.toLowerCase() === characterName.toLowerCase()
    );
    
    if (phmcEmployee) {
        return phmcEmployee.category || phmcEmployee.rank || null;
    }
    
    // Try to find in Coroner staff
    const coronerEmployee = coronerListData.find(employee => 
        employee.name && employee.name.toLowerCase() === characterName.toLowerCase()
    );
    
    if (coronerEmployee) {
        return coronerEmployee.rank || coronerEmployee.category || null;
    }
    
    return null;
};

// Helper function to clean rank by removing dash characters
export const cleanRank = (rank) => {
    if (!rank) return 'GTAW User';
    return rank.replace(/-/g, '').trim();
};

// Helper function to get display rank (database rank if available, otherwise cleaned faction rank)
export const getDisplayRank = (gtaWorldUser, phmcListData = [], coronerListData = []) => {
    // Try to get database rank first
    const dbRank = getDatabaseRank(gtaWorldUser, phmcListData, coronerListData);
    if (dbRank) return cleanRank(dbRank);
    
    // Fallback to cleaned faction rank
    if (gtaWorldUser?.faction?.rank) {
        return cleanRank(gtaWorldUser.faction.rank);
    }
    
    return 'GTAW User';
};