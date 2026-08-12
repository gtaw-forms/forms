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
// Employee Credential Resolver (single source of truth)
// ---------------------------------------------------------------------------
// The OAuth `faction` object is only populated when an OAuth character id
// matches a roster key. For users whose OAuth payload carries the UCP account
// id instead of the character id (e.g. Sarah Bell: account `50230` vs roster
// char `156863`), `faction` can be null while the author name still resolves
// via getCharacterData() — the old narrow sync chain then left
// coronerEmployee / coronerRank / coronerBadge blank in saved reports.
//
// Returns:
//   { employeeName, rank, badge, discord, phNumber, firstName, lastName, matchedBy }
//   matchedBy: 'id' | 'name' | 'none'
export const resolveEmployeeCredentials = (gtaWorldUser, { phmcListData = [], coronerListData = [], cleanRank = null } = {}) => {
    const empty = {
        employeeName: null,
        rank: '',
        badge: '',
        discord: '',
        phNumber: '',
        firstName: '',
        lastName: '',
        matchedBy: 'none',
    };
    if (!gtaWorldUser) return empty;

    // 1. Name — same breadth as getCharacterData()/getCharacterName() (the
    //    author-resolution path that always worked).
    const characterData = getCharacterData(gtaWorldUser);
    const oauthName = characterData?.fullName
        || gtaWorldUser?.faction?.characterName
        || gtaWorldUser?.activeCharacter?.characterName
        || gtaWorldUser?.characterName
        || null;
    if (!oauthName || oauthName === 'GTAW User') return empty;

    const factionDataInner = gtaWorldUser?.faction || gtaWorldUser?.activeCharacter || null;
    const oauthCharacterId = factionDataInner?.characterId || factionDataInner?.id
        || gtaWorldUser?.character?.[0]?.characterId || gtaWorldUser?.character?.[0]?.id || null;

    const allEmployees = [...phmcListData, ...coronerListData];
    const normalizeId = (v) => (v == null || v === '' ? null : String(v));
    const oauthIdStr = normalizeId(oauthCharacterId);

    // 2. Roster match — by character id first (only when it equals a roster
    //    key / member.characterId — never treat a UCP account id as the
    //    character id), then by name (case-insensitive).
    let dbMatch = null;
    let matchedBy = 'none';
    if (oauthIdStr) {
        dbMatch = allEmployees.find((e) => {
            const keyId = normalizeId(e.characterId) || normalizeId(e.id);
            return keyId && keyId === oauthIdStr;
        }) || null;
        if (dbMatch) matchedBy = 'id';
    }
    if (!dbMatch) {
        const lowerName = String(oauthName).trim().toLowerCase();
        dbMatch = allEmployees.find((e) =>
            String(e.characterName || e.name || '').trim().toLowerCase() === lowerName
        ) || null;
        if (dbMatch) matchedBy = 'name';
    }

    const cleanRankFn = (rank) => (cleanRank ? cleanRank(String(rank)) : String(rank || '').trim());
    const rawRank = factionDataInner?.rank
        ? factionDataInner.rank
        : (factionDataInner?.scriptRank || dbMatch?.rank || '');
    // Badge = the roster record KEY when we have a roster match. Never use the
    // raw gtawCharacterId when it is only the UCP account id (Fix F).
    const resolvedBadge = dbMatch
        ? (normalizeId(dbMatch.characterId) || normalizeId(dbMatch.id) || dbMatch.badge || '')
        : (normalizeId(factionDataInner?.characterId) || factionDataInner?.badge || '');

    return {
        employeeName: oauthName,
        rank: rawRank ? cleanRankFn(rawRank) : '',
        badge: String(resolvedBadge || ''),
        discord: dbMatch?.discordName || dbMatch?.discord || gtaWorldUser.username || '',
        phNumber: dbMatch?.phNumber || '50056',
        firstName: factionDataInner?.firstname || characterData?.firstname || (oauthName.split(' ')[0] || ''),
        lastName: factionDataInner?.lastname || characterData?.lastname || (oauthName.split(' ').slice(1).join(' ') || ''),
        matchedBy,
    };
};

// ---------------------------------------------------------------------------
// Faction Member Updates
// ---------------------------------------------------------------------------
