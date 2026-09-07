const DEFAULT_OWNER_ROLE_IDS = [
    '860257102324301864',
    '860257063182925874',
];

function getOwnerRoleIds() {
    const raw = process.env.BOT_OWNER_ROLE_IDS;
    if (raw && raw.trim()) {
        return raw.split(',').map((s) => s.trim()).filter(Boolean);
    }
    return DEFAULT_OWNER_ROLE_IDS;
}

export function isOwnerOrWhitelisted(interaction) {
    const ownerId = process.env.BOT_OWNER_ID;
    if (ownerId && interaction.user.id === ownerId) return true;

    const roles = interaction.member?.roles?.cache;
    if (!roles) return false;

    return getOwnerRoleIds().some((id) => roles.has(id));
}