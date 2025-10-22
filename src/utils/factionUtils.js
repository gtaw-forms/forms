import { ref, update } from 'firebase/database';
import { database } from '../firebase';

export const updateDiscordName = async (characterId, discordName) => {
    if (!characterId) {
        throw new Error('Character ID is required to update Discord name.');
    }

    const userRef = ref(database, `factions/364/members/${characterId}`);
    
    try {
        await update(userRef, { discordName: discordName });
        console.log(`Successfully updated Discord name for character ${characterId}`);
        return { success: true };
    } catch (error) {
        console.error(`Failed to update Discord name for character ${characterId}:`, error);
        throw new Error('Failed to save Discord name to the database.');
    }
};