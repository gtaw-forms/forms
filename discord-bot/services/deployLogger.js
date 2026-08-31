/**
 * Deploy Logger — standardized function-call logging, Discord webhook helpers,
 * and a single-message live progress embed for deploy lifecycle tracking.
 *
 * logFnCall:       [DEPLOY] [FUNC module/fnName] - description | k=v
 * sendWebhook:     Send content/embed to the bot-spam log channel
 * logStep:         Progress-step embed for deploy pipeline
 * DeployProgressEmbed: Single live-updating embed edited at each step
 *
 * This module has zero state dependencies — safe to import from anywhere.
 */

import { EmbedBuilder } from 'discord.js';
import { sendLogMessage } from './logChannel.js';

const TAG = 'DEPLOY';

/**
 * Log a function entry point with a standardized format.
 * Use at the top of every major function for an auditable call trail.
 *
 * @param {string} modulePath - Short module name (e.g., 'deployHandlers')
 * @param {string} fnName     - Function name (e.g., 'handlePM')
 * @param {string} description - What this invocation does
 * @param {object} [meta]     - Optional key-value pairs appended as | k=v
 */
export function logFnCall(modulePath, fnName, description, meta = {}) {
    const metaStr = Object.keys(meta).length
        ? ' | ' + Object.entries(meta).map(([k, v]) => `${k}=${v}`).join(' ')
        : '';
    console.log(`[${TAG}] [FUNC ${modulePath}/${fnName}] - ${description}${metaStr}`);
}

/**
 * Send a webhook-style notification to the bot-spam channel.
 * Thin wrapper around sendLogMessage with consistent error handling.
 */
export async function sendWebhook(content, embed) {
    try {
        await sendLogMessage(content, embed);
    } catch (err) {
        console.error(`[${TAG}] Deploy notification failed:`, err.message);
    }
}

/**
 * Post a clear, user-facing failure alert to the log channel for ANY deploy type
 * (topic, PM, medical record, autopsy, crosspost). Self-healing handles the repair;
 * this exists so staff see failures immediately and can investigate.
 *
 * @param {string} label   — human-readable report label
 * @param {string} type    — deploy type ('topic', 'pm', 'medical-record', 'autopsy-reply', ...)
 * @param {string} key     — report key
 * @param {string} reason  — failure reason
 */
export async function notifyDeployFailure(label, type, key, reason) {
    const embed = new EmbedBuilder()
        .setColor(0xdc3545)
        .setTitle('DEPLOY FAILED')
        .setDescription([
            `**Report:** ${label}`,
            `**Key:** \`${key}\``,
            `**Type:** ${type}`,
            `**Reason:** ${reason || 'Unknown error'}`,
            '',
            'The retry / self-healing sweep will handle this automatically. Check `pm2 logs phmc-bot` for details.',
        ].join('\n'))
        .setFooter({ text: 'PHMC Bot — Auto Deploy' })
        .setTimestamp();
    await sendWebhook(null, embed);
}

/**
 * Send a step-by-step progress webhook with a consistent format.
 * Styled with a left border color to show progress vs success vs failure.
 */
export async function logStep(label, detail, { color = 0x007bff, isFinal = false } = {}) {
    await sendWebhook(null, {
        title: label,
        description: detail,
        color,
        footer: { text: isFinal ? '' : 'PHMC Bot — Step' },
        timestamp: new Date().toISOString(),
    });
}

/**
 * DeployProgressEmbed — single live-updating embed for a deploy's entire lifecycle.
 * Posts ONE message, then edits it at each step so the channel sees one clean progress log.
 *
 * Usage:
 *   const progress = new DeployProgressEmbed(state.discordClient, process.env.BOT_LOG_CHANNEL_ID);
 *   await progress.start(`Deploying ${reportTitle}`);
 *   await progress.addStep('Logging in', 'ok');
 *   await progress.addStep('Reply posted', 'ok', `#${topicId}`);
 *   await progress.finalize('complete' | 'failed');
 */
export class DeployProgressEmbed {
    constructor(client, channelId, buildLabel) {
        this.client = client;
        this.channelId = channelId;
        this.buildLabel = buildLabel || null;
        this.messageId = null;
        this.steps = [];
        this.status = 'pending';
        this.title = '';
    }

    /**
     * Post the initial embed. Call once at the start of a deploy.
     * @param {string} title - Report title or key
     */
    async start(title) {
        this.title = title || 'Deploy Progress';
        if (!this.client || !this.channelId) {
            console.warn('[PROGRESS] No Discord client or channel — skipping embed');
            return;
        }
        try {
            const channel = await this.client.channels.fetch(this.channelId);
            const msg = await channel.send({ embeds: [this._build()] });
            this.messageId = msg.id;
        } catch (err) {
            console.warn(`[PROGRESS] Failed to post initial embed: ${err.message}`);
        }
    }

    /**
     * Resume editing an existing embed (for queue -> deploy handoff).
     * Call instead of start() when a queued embed already exists.
     */
    async resume(messageId, channelId, title) {
        this.messageId = messageId;
        this.channelId = channelId;
        this.title = title || this.title;
        if (!this.client || !this.channelId || !this.messageId) return;
        try {
            const channel = await this.client.channels.fetch(this.channelId);
            await channel.messages.edit(this.messageId, { embeds: [this._build()] });
        } catch (err) {
            console.warn(`[PROGRESS] Failed to resume embed: ${err.message}`);
        }
    }

    /**
     * Add a step to the progress log and edit the embed.
     * @param {string} name - Step label (e.g. "PHMC Login", "Searching Case Mgmt")
     * @param {'pending'|'ok'|'fail'|'skip'} status
     * @param {string} [detail] - Optional detail text
     */
    async addStep(name, status, detail = '') {
        this.steps.push({ name, status, detail, time: new Date().toLocaleTimeString() });
        if (status === 'fail') this.status = 'failed';
        if (!this.messageId || !this.client) return;
        try {
            const channel = await this.client.channels.fetch(this.channelId);
            await channel.messages.edit(this.messageId, { embeds: [this._build()] });
        } catch (err) {
            console.warn(`[PROGRESS] Failed to edit embed: ${err.message}`);
        }
    }

    /**
     * Finalize the embed with complete/failed status.
     */
    async finalize(status) {
        this.status = status === 'complete' ? 'complete' : 'failed';
        if (!this.messageId || !this.client) return;
        try {
            const channel = await this.client.channels.fetch(this.channelId);
            await channel.messages.edit(this.messageId, { embeds: [this._build()] });
        } catch (err) {
            console.warn(`[PROGRESS] Failed to finalize embed: ${err.message}`);
        }
    }

    _build() {
        const color = this.status === 'complete' ? 0x28a745
            : this.status === 'failed' ? 0xdc3545
            : 0x007bff;

        const desc = this.steps.map(s => {
            const icon = s.status === 'ok' ? '✅'
                : s.status === 'fail' ? '❌'
                : s.status === 'skip' ? '⏭️'
                : s.status === 'warn' ? '⚠️'
                : '⏳';
            const detail = s.detail ? ` — ${s.detail}` : '';
            return `${icon} **${s.name}**${detail} *(${s.time})*`;
        }).join('\n') || 'Starting...';

        return new EmbedBuilder()
            .setColor(color)
            .setTitle(this.title)
            .setDescription(desc)
            .setFooter({ text: `${this.status === 'pending' ? 'Deploying...' : this.status === 'complete' ? 'Complete' : 'Failed'}${this.buildLabel ? ` · client build ${this.buildLabel}` : ''}` })
            .setTimestamp();
    }
}
