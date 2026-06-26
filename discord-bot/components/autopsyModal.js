import {
    ModalBuilder,
    TextInputBuilder,
    TextInputStyle,
    ActionRowBuilder,
} from 'discord.js';

/**
 * Build the Discord Modal for autopsy report input (3 fields).
 * Manner of Death is handled via a select menu BEFORE this modal opens.
 */
export function buildAutopsyModal() {
    const modal = new ModalBuilder()
        .setCustomId('autopsy_modal')
        .setTitle('Autopsy Report — Fill in Details');

    // ── Cause of Death (bullet list) ──
    const causeOfDeath = new TextInputBuilder()
        .setCustomId('deathCausesListItems')
        .setLabel('Cause of Death')
        .setPlaceholder('Each line becomes a bullet item\ne.g. Massive blood loss due to gunshot wounds')
        .setStyle(TextInputStyle.Paragraph)
        .setRequired(true)
        .setMaxLength(1500);

    // ── How Injury Occurred ──
    const howInjury = new TextInputBuilder()
        .setCustomId('causeOfDeath')
        .setLabel('How Injury Occurred')
        .setPlaceholder('e.g. Gunshot wound to the chest')
        .setStyle(TextInputStyle.Short)
        .setRequired(true)
        .setMaxLength(500);

    // ── Synopsis ──
    const synopsis = new TextInputBuilder()
        .setCustomId('synopsis')
        .setLabel('Synopsis (Medical Examiner Opinion)')
        .setPlaceholder('What did the ME find? Body condition, status, final cause of death...')
        .setStyle(TextInputStyle.Paragraph)
        .setRequired(true)
        .setMaxLength(3000);

    modal.addComponents(
        new ActionRowBuilder().addComponents(causeOfDeath),
        new ActionRowBuilder().addComponents(howInjury),
        new ActionRowBuilder().addComponents(synopsis),
    );

    return modal;
}
