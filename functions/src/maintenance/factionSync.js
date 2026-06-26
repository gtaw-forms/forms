import { db, admin } from '../utils/firebase.js';
import { sendWebhook } from '../utils/helpers.js';

const FACTION_DATA_URL = "https://ucp.gta.world/view/faction/364/populate?draw=2&columns[0][data]=actions&columns[0][name]=actions&columns[0][searchable]=true&columns[0][orderable]=true&columns[0][search][value]=&columns[0][search][regex]=false&columns[1][data]=id&columns[1][name]=characters.id&columns[1][searchable]=true&columns[1][orderable]=true&columns[1][search][value]=&columns[1][search][regex]=false&columns[2][data]=name&columns[2][name]=name&columns[2][searchable]=true&columns[2][orderable]=true&columns[2][search][value]=&columns[2][search][regex]=false&columns[3][data]=rank&columns[3][name]=rank&columns[3][searchable]=true&columns[3][orderable]=true&columns[3][search][value]=&columns[3][search][regex]=false&columns[4][data]=scriptrank&columns[4][name]=scriptrank&columns[4][searchable]=true&columns[4][orderable]=true&columns[4][search][value]=&columns[4][search][regex]=false&columns[5][data]=lastduty&columns[5][name]=lastduty&columns[5][searchable]=true&columns[5][orderable]=true&columns[5][search][value]=&columns[5][search][regex]=false&columns[6][data]=lastonline&columns[6][name]=lastonline&columns[6][searchable]=true&columns[6][orderable]=true&columns[6][search][value]=&columns[6][search][regex]=false&columns[7][data]=abas&columns[7][name]=abas&columns[7][searchable]=true&columns[7][orderable]=true&columns[7][search][value]=&columns[7][search][regex]=false&order[0][column]=3&order[0][dir]=desc&start=0&length=1000&search[value]=&search[regex]=false&type=members&filters=&searchTerm=";

const RTDB_PATH = '/factions/364/members';
const AUTH_STATE_PATH = '/factions/364/ucp_auth_state';

/**
 * Syncs faction data from GTA World UCP to Firebase RTDB.
 */
export const syncFactionMembers = async (triggerSource = 'scheduled') => {
    console.log(`[Faction Sync] Starting sync. Trigger: ${triggerSource}`);

    try {
        // 1. Get Auth State from DB
        const authSnapshot = await db.ref(AUTH_STATE_PATH).once('value');
        if (!authSnapshot.exists()) {
            throw new Error("UCP Auth State not found in database. Please upload it via the Admin panel.");
        }
        const authData = authSnapshot.val();

        // 2. Prepare Cookies
        if (!authData.cookies || !Array.isArray(authData.cookies)) {
            throw new Error("Invalid Auth State format in database.");
        }
        const cookieHeader = authData.cookies
            .map(c => `${c.name}=${c.value}`)
            .join('; ');

        // 3. Fetch Data from UCP
        const response = await fetch(FACTION_DATA_URL, {
            headers: {
                'Cookie': cookieHeader,
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Accept': 'application/json, text/javascript, */*; q=0.01',
                'X-Requested-With': 'XMLHttpRequest'
            }
        });

        if (!response.ok) {
            if (response.status === 401 || response.status === 302) {
                throw new Error("UCP Session Expired. Please refresh and upload a new auth state.");
            }
            throw new Error(`UCP Fetch Failed: ${response.status} ${response.statusText}`);
        }

        const data = await response.json();
        const membersData = data?.data ?? [];

        if (!Array.isArray(membersData) || membersData.length === 0) {
            throw new Error("UCP returned no member data. Response might be invalid.");
        }

        // 4. Merge with Existing Data (to preserve Discord info)
        const existingSnapshot = await db.ref(RTDB_PATH).once('value');
        const existingData = existingSnapshot.val() || {};

        // 5. Transform Data
        const membersObject = membersData.reduce((acc, member) => {
            const characterIdMatch = member.id ? String(member.id).match(/character\/(\d+)/) : null;
            const characterId = characterIdMatch && characterIdMatch[1] ? parseInt(characterIdMatch[1], 10) : null;

            if (!characterId) return acc;

            let characterName = (member.firstname && member.lastname) ? `${member.firstname.trim()} ${member.lastname.trim()}` : null;
            if (!characterName && member.name) {
                const nameMatch = String(member.name).match(/>([^<]+)</);
                if (nameMatch && nameMatch[1]) characterName = nameMatch[1].trim();
            }

            const rank = member.rank ? String(member.rank).trim() : null;
            const scriptRank = (member.scriptrank !== undefined) ? parseInt(member.scriptrank, 10) : null;

            if (!characterName || !rank || scriptRank === null) return acc;

            acc[characterId] = {
                characterName,
                rank,
                scriptRank,
                lastDuty: member.lastduty || null,
                lastOnline: member.lastonline || null,
                activity: member.abas || null,
                discordName: existingData[characterId]?.discordName || null,
                discord: existingData[characterId]?.discord || null
            };

            return acc;
        }, {});

        const count = Object.keys(membersObject).length;
        if (count === 0) {
            throw new Error("No valid members found after transformation.");
        }

        // 6. Save to Database
        await db.ref(RTDB_PATH).set(membersObject);

        // Update Metadata
        await db.ref('factions/364/metadata').update({
            lastUpdated: new Date().toISOString(),
            uploadedBy: `Cloud Function (${triggerSource})`,
            statistics: {
                totalRecords: membersData.length,
                validRecords: count
            }
        });

        // Invalidate Client Cache
        await db.ref('appMetadata/factionsDataVersion').set(Date.now());

        console.log(`[Faction Sync] Successfully synced ${count} members.`);

        // 7. Notify via Webhook (Optional/Throttled)
        if (triggerSource === 'manual') {
            await sendWebhook({
                embeds: [{
                    title: "Faction Member Sync Successful",
                    description: `Synced **${count}** members from UCP.`,
                    color: 0x28a745,
                    footer: { text: "PHMC Tools - Automated Sync" }
                }]
            });
        }

        return { success: true, count };

    } catch (error) {
        console.error(`[Faction Sync] Error: ${error.message}`);
        
        await sendWebhook({
            embeds: [{
                title: "Faction Member Sync FAILED",
                description: `Error: ${error.message}`,
                color: 0xd9534f,
                footer: { text: "PHMC Tools - Automated Sync" }
            }]
        });

        return { success: false, error: error.message };
    }
};
