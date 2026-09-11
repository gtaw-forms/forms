const DEFAULT_OWNER_ROLE_IDS = [
    '860257102324301864',
    '860257063182925874',
];

// PHMC guild roles (IDs overridable via env for future moves).
const DEFAULT_STAFF_ROLE_ID = '860595219472842753'; // PHMC Staff — /card etc.
const DEFAULT_SUPERVISOR_ROLE_ID = '860257102324301864'; // Supervisors+ — /reassign-autopsy etc.

function getEnvId(key, fallback) {
    const raw = process.env[key];
    return raw && raw.trim() ? raw.trim() : fallback;
}

export function staffRoleId() {
    return getEnvId('PHMC_STAFF_ROLE_ID', DEFAULT_STAFF_ROLE_ID);
}

export function supervisorRoleId() {
    return getEnvId('PHMC_SUPERVISOR_ROLE_ID', DEFAULT_SUPERVISOR_ROLE_ID);
}

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

function hasRole(interaction, roleId) {
    const roles = interaction.member?.roles?.cache;
    if (!roles || !roleId) return false;
    return roles.has(roleId);
}

// PHMC Staff + up (owner always bypasses so the owner is never locked out).
export function isPhmcStaff(interaction) {
    if (isOwnerOrWhitelisted(interaction)) return true;
    return hasRole(interaction, staffRoleId());
}

// Supervisors + up (owner/leadership bypass via the owner whitelist).
export function isSupervisorUp(interaction) {
    if (isOwnerOrWhitelisted(interaction)) return true;
    return hasRole(interaction, supervisorRoleId());
}