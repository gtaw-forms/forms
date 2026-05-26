// src/utils/adminLogger.js
import { captureMessage, captureException } from "@sentry/react";
import { triggerWebhookProxy } from '../services/firebaseFunctions';

export const getUserContext = () => {
    const userAgent = navigator.userAgent || "N/A";
    let timeZone = "N/A";
    try {
        timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    } catch (e) {
        console.warn("Could not determine user timezone:", e);
    }
    return { userAgent, timeZone };
};

export const logAdminAction = async (adminEmail, action, details, context = null, userAgent = null, timeZone = null, gtaAuthUsername = null, characterData = null) => {
    const userIdentifier = gtaAuthUsername ? `${gtaAuthUsername} (${adminEmail})` : (adminEmail || "Unknown");

    let description = context
        ? `**Action:** ${action || "Unknown Action"}\n**Admin:** ${userIdentifier}\n**Category:** ${context}`
        : `**Action:** ${action || "Unknown Action"}\n**Admin:** ${userIdentifier}`;

    if (characterData && characterData.debugInfo) {
        const { debugInfo } = characterData;
        if (debugInfo.foundMember && debugInfo.charactersChecked?.length > 0) {
            const primaryCharacter = characterData.faction;
            description += `\n**Primary Character:** ${primaryCharacter?.characterName || 'Unknown'} (ID: ${primaryCharacter?.characterId || 'N/A'}) - Rank ${primaryCharacter?.scriptRank || 'N/A'}`;
            
            if (debugInfo.charactersChecked.length > 1) {
                description += `\n**All Characters:** ${debugInfo.charactersChecked.length} total`;
            }
        }
    }

    const fields = [
        { name: "Details", value: `\`\`\`${details ? String(details).substring(0, 1000) : 'N/A'}\`\`\``, inline: false }
    ];

    if (characterData && characterData.debugInfo?.charactersChecked?.length > 0) {
        const characterDetails = characterData.debugInfo.charactersChecked.map((char, index) => {
            return `${index + 1}. ${char.name || 'Unknown'} (ID: ${char.id || 'N/A'})`;
        }).join('\n');
        
        const factionMembers = characterData.debugInfo.charactersChecked.filter(char => 
            characterData.faction && char.id === characterData.faction.characterId
        );
        
        let characterField = `**All Characters (${characterData.debugInfo.charactersChecked.length}):**\n${characterDetails}`;
        
        if (characterData.debugInfo.foundMember) {
            characterField += `\n\n**PHMC Member:** ${characterData.faction?.characterName || 'Unknown'} (Rank ${characterData.faction?.scriptRank || 'N/A'})`;
            characterField += `\n**Access Level:** ${characterData.accessLevel || 'none'}`;
        } else {
            characterField += `\n\n**PHMC Status:** Not a faction member`;
        }
        
        fields.push({
            name: "Character Information", 
            value: characterField.substring(0, 1024),
            inline: false 
        });
    }

    const embed = {
        title: "Admin Action Logged",
        color: 0xFFA500,
        description: description,
        fields: fields,
        timestamp: new Date().toISOString(),
        footer: { text: `PHMC Tools | ${timeZone}` }
    };

    try {
        await triggerWebhookProxy('admin', { embeds: [embed] });
        console.log(`Admin action logged to Discord: ${action}`);
    } catch (error) {
        console.error('Error sending admin action webhook:', error);
        captureException(error, { 
            extra: { 
                context: 'Admin Action Webhook via Proxy',
            } 
        });
    }
};