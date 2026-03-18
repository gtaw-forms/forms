// src/utils/adminLogger.js
import { captureMessage, captureException } from "@sentry/react";
import { triggerFetchExternalUrl } from '../services/firebaseFunctions';

// Helper to get user agent and timezone
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
    const webhookURL = import.meta.env.VITE_DISCORD_WEBHOOK_ADMIN || import.meta.env.VITE_ADMIN_ACTION_DISCORD_WEBHOOK_URL || import.meta.env.VITE_DEV_WEBHOOK;
    if (!webhookURL) {
        console.warn("Admin action webhook URL not configured. Skipping log.");
        captureMessage("Admin Action Webhook URL not configured", "warning");
        return;
    }

    // Use OAuth username if available, otherwise fall back to email
    const userIdentifier = gtaAuthUsername ? `${gtaAuthUsername} (${adminEmail})` : (adminEmail || "Unknown");

    // Simplified description for a cleaner look
    let description = context
        ? `**Action:** ${action || "Unknown Action"}\n**Admin:** ${userIdentifier}\n**Category:** ${context}`
        : `**Action:** ${action || "Unknown Action"}\n**Admin:** ${userIdentifier}`;

    // Add character information if available
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

    // Add detailed character information as a separate field if available
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
            value: characterField.substring(0, 1024), // Discord field limit
            inline: false 
        });
    }

    const embed = {
        title: "Admin Action Logged",
        color: 0xFFA500, // Orange
        description: description,
        fields: fields,
        timestamp: new Date().toISOString(),
        footer: { text: `PHMC Tools | ${timeZone}` }
    };

    try {
        const payload = {
            url: webhookURL,
            method: 'POST',
            customHeaders: { 'Content-Type': 'application/json' },
            body: { embeds: [embed] }
        };

        const result = await triggerFetchExternalUrl(payload);
        
        if (result && result.status >= 200 && result.status < 300) {
            console.log(`Admin action logged to Discord: ${action}`);
        } else {
            // The proxy function now throws on non-ok responses, so this part might only catch network-level issues reported by the function.
            const errorMessage = result?.data?.message || result?.statusText || 'An unknown error occurred';
            console.error(`Failed to send admin action webhook via proxy. Status: ${result?.status}`, errorMessage);
            captureMessage(`Admin Action Discord webhook failed via proxy: ${errorMessage}`, "error");
        }
    } catch (error) {
        console.error('Error sending admin action webhook via proxy:', error);
        captureException(error, { 
            extra: { 
                context: 'Admin Action Webhook Submission via Proxy',
                webhookURL,
            } 
        });
    }
};