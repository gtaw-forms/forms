/**
 * formsStatsImage.js — render the /forms-stats breakdown (person x month table,
 * per-person totals, monthly chart) to a PNG via an SVG + sharp composite.
 * No browser needed — same technique as cardGenerator.js.
 */

import sharp from 'sharp';

const NAVY = '#0d2a5c';
const BLUE = '#0d47a1';
const BAR = '#2f6fed';
const BAR_OTHER = '#9db4dd';
const BG = '#f1f4f9';
const MUTED = '#64748b';
const MONTH_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

const MAX_MONTHS = 24;
const MAX_PEOPLE_ROWS = 15;

const escapeXml = (str) =>
    String(str ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&apos;');

const shortMonth = (ym) => {
    const m = Number(String(ym).slice(5, 7));
    return MONTH_SHORT[m - 1] || ym;
};

/**
 * @param {object} input
 * @param {string} input.title — e.g. 'PHMC — Autopsy Reports per Person, May–Oct 2026'
 * @param {string} input.subtitle — source line under the title
 * @param {string[]} input.months — ['2026-05', ...] axis order
 * @param {{name:string,counts:Object,total:number}[]} input.people — sorted desc
 * @param {Object} input.monthTotals — month -> total
 * @param {number} input.grandTotal
 * @param {string} input.footer — small-print source line at the bottom
 * @returns {Promise<Buffer>} PNG bytes
 */
export async function renderFormsStatsImage({ title, subtitle, months, people, monthTotals, grandTotal, footer }) {
    if (!Array.isArray(months) || months.length === 0) throw new Error('No months in range.');
    if (months.length > MAX_MONTHS) throw new Error(`Range covers ${months.length} months (max ${MAX_MONTHS}) — narrow from/to.`);
    if (!Array.isArray(people) || people.length === 0 || !grandTotal) throw new Error('No reports in this range.');

    // Cap rows: top N + one aggregated "Other" row.
    let rows = [...people];
    let otherCount = 0;
    if (rows.length > MAX_PEOPLE_ROWS) {
        const rest = rows.slice(MAX_PEOPLE_ROWS);
        otherCount = rest.length;
        const agg = { name: `Other (${otherCount})`, counts: {}, total: 0, other: true };
        for (const k of months) agg.counts[k] = 0;
        for (const p of rest) for (const k of months) { agg.counts[k] += p.counts[k] || 0; agg.total += p.counts[k] || 0; }
        rows = [...rows.slice(0, MAX_PEOPLE_ROWS), agg];
    }

    const W = 1400;
    const PAD = 48;
    const IW = W - PAD * 2;
    const FONT = 'Arial, Helvetica, sans-serif';

    const top = people[0];
    let busiest = months[0];
    for (const k of months) if ((monthTotals[k] || 0) > (monthTotals[busiest] || 0)) busiest = k;

    let svg = '';
    let y = 0;
    const add = (s) => { svg += s; };

    // Background
    add(`<rect x="0" y="0" width="${W}" height="__H__" fill="${BG}"/>`);
    y = 40;

    // Header
    add(`<rect x="${PAD}" y="${y}" width="46" height="46" rx="10" fill="${BLUE}"/>`);
    add(`<text x="${PAD + 23}" y="${y + 23}" font-family="${FONT}" font-size="28" font-weight="bold" fill="#ffffff" text-anchor="middle" dominant-baseline="central">+</text>`);
    add(`<text x="${PAD + 60}" y="${y + 23}" font-family="${FONT}" font-size="30" font-weight="bold" fill="${NAVY}">${escapeXml(title)}</text>`);
    y += 58;
    add(`<text x="${PAD}" y="${y}" font-family="${FONT}" font-size="15" fill="${MUTED}">${escapeXml(subtitle)}</text>`);
    y += 32;

    // Headline cards
    const cards = [
        [String(grandTotal), `${months.length === 1 ? 'REPORT' : 'REPORTS'} (${months.length} MO)`],
        [String(people.length), people.length === 1 ? 'STAFFER' : 'STAFF'],
        [`${top.name} · ${top.total}`, months.length === 1 ? 'MOST IN MONTH' : 'MOST IN RANGE'],
        [String(monthTotals[busiest] || 0), `BUSIEST MONTH (${shortMonth(busiest).toUpperCase()})`],
    ];
    const cardW = (IW - 3 * 14) / 4;
    const cardH = 88;
    cards.forEach(([v, l], i) => {
        const x = PAD + i * (cardW + 14);
        add(`<rect x="${x}" y="${y}" width="${cardW}" height="${cardH}" rx="12" fill="#ffffff"/>`);
        add(`<rect x="${x}" y="${y}" width="${cardW}" height="4" fill="${BLUE}"/>`);
        add(`<text x="${x + 18}" y="${y + 38}" font-family="${FONT}" font-size="27" font-weight="bold" fill="${NAVY}">${escapeXml(v)}</text>`);
        add(`<text x="${x + 18}" y="${y + 62}" font-family="${FONT}" font-size="12.5" font-weight="bold" fill="${MUTED}">${escapeXml(l)}</text>`);
    });
    y += cardH + 22;

    const panelStart = (innerH) => {
        add(`<rect x="${PAD}" y="${y}" width="${IW}" height="${innerH}" rx="12" fill="#ffffff"/>`);
        return y + 22;
    };

    // ── Table panel ──
    const rowH = 30;
    const headH = 32;
    const nameCol = 190;
    const totCol = 64;
    const monthCol = (IW - 44 - nameCol - totCol) / months.length;
    const tableH = 22 + 26 + headH + rowH * (rows.length + 1) + 22;
    let ty = panelStart(tableH);
    add(`<text x="${PAD + 22}" y="${ty}" font-family="${FONT}" font-size="19" font-weight="bold" fill="${NAVY}">Breakdown by staffer</text>`);
    ty += 14;
    // header
    add(`<rect x="${PAD + 22}" y="${ty}" width="${IW - 44}" height="${headH}" rx="7" fill="${NAVY}"/>`);
    const colX = (i) => PAD + 22 + nameCol + i * monthCol;
    add(`<text x="${PAD + 32}" y="${ty + headH / 2}" font-family="${FONT}" font-size="13" font-weight="bold" fill="#ffffff" dominant-baseline="central">Staffer</text>`);
    months.forEach((k, i) => {
        add(`<text x="${(colX(i) + monthCol / 2).toFixed(1)}" y="${ty + headH / 2}" font-family="${FONT}" font-size="12.5" font-weight="bold" fill="#ffffff" text-anchor="middle" dominant-baseline="central">${shortMonth(k)}</text>`);
    });
    add(`<text x="${(colX(months.length) + totCol / 2).toFixed(1)}" y="${ty + headH / 2}" font-family="${FONT}" font-size="12.5" font-weight="bold" fill="#ffffff" text-anchor="middle" dominant-baseline="central">Total</text>`);
    ty += headH;
    rows.forEach((p, ri) => {
        if (ri % 2 === 1) add(`<rect x="${PAD + 22}" y="${ty}" width="${IW - 44}" height="${rowH}" fill="#f6f9fd"/>`);
        const cy = ty + rowH / 2;
        add(`<text x="${PAD + 32}" y="${cy}" font-family="${FONT}" font-size="13.5" font-weight="bold" fill="${NAVY}" dominant-baseline="central">${escapeXml(p.name)}</text>`);
        months.forEach((k, i) => {
            const n = p.counts[k] || 0;
            add(`<text x="${(colX(i) + monthCol / 2).toFixed(1)}" y="${cy}" font-family="${FONT}" font-size="13.5" fill="${n === 0 ? '#c3cad4' : '#1e293b'}" text-anchor="middle" dominant-baseline="central">${n}</text>`);
        });
        add(`<text x="${(colX(months.length) + totCol / 2).toFixed(1)}" y="${cy}" font-family="${FONT}" font-size="14" font-weight="bold" fill="${NAVY}" text-anchor="middle" dominant-baseline="central">${p.total}</text>`);
        ty += rowH;
    });
    // totals row
    add(`<rect x="${PAD + 22}" y="${ty}" width="${IW - 44}" height="${rowH}" rx="7" fill="${NAVY}"/>`);
    {
        const cy = ty + rowH / 2;
        add(`<text x="${PAD + 32}" y="${cy}" font-family="${FONT}" font-size="13.5" font-weight="bold" fill="#ffffff" dominant-baseline="central">Monthly total</text>`);
        months.forEach((k, i) => {
            add(`<text x="${(colX(i) + monthCol / 2).toFixed(1)}" y="${cy}" font-family="${FONT}" font-size="13.5" font-weight="bold" fill="#ffffff" text-anchor="middle" dominant-baseline="central">${monthTotals[k] || 0}</text>`);
        });
        add(`<text x="${(colX(months.length) + totCol / 2).toFixed(1)}" y="${cy}" font-family="${FONT}" font-size="14" font-weight="bold" fill="#ffffff" text-anchor="middle" dominant-baseline="central">${grandTotal}</text>`);
    }
    y += tableH + 18;

    // ── Per-person bars panel ──
    const barRowH = 30;
    const barsH = 22 + 26 + barRowH * rows.length + 22;
    let by = panelStart(barsH);
    add(`<text x="${PAD + 22}" y="${by}" font-family="${FONT}" font-size="19" font-weight="bold" fill="${NAVY}">Total per staffer</text>`);
    by += 16;
    const labelW = 180;
    const numW = 56;
    const trackX = PAD + 22 + labelW;
    const trackW = IW - 44 - labelW - numW;
    const maxTotal = Math.max(...rows.map((p) => p.total), 1);
    rows.forEach((p) => {
        const cy = by + barRowH / 2;
        add(`<text x="${PAD + 22}" y="${cy}" font-family="${FONT}" font-size="13.5" font-weight="bold" fill="${NAVY}" dominant-baseline="central">${escapeXml(p.name)}</text>`);
        const w = Math.max(3, (p.total / maxTotal) * trackW);
        add(`<rect x="${trackX}" y="${by + 4}" width="${trackW}" height="22" rx="6" fill="#e8edf4"/>`);
        add(`<rect x="${trackX}" y="${by + 4}" width="${w.toFixed(1)}" height="22" rx="6" fill="${p.other ? BAR_OTHER : BAR}"/>`);
        add(`<text x="${trackX + trackW + 10}" y="${cy}" font-family="${FONT}" font-size="14" font-weight="bold" fill="${NAVY}" dominant-baseline="central">${p.total}</text>`);
        by += barRowH;
    });
    y += barsH + 18;

    // ── Monthly chart panel ──
    const chartH = 210;
    const chH = 22 + 26 + chartH + 22;
    let chY = panelStart(chH);
    add(`<text x="${PAD + 22}" y="${chY}" font-family="${FONT}" font-size="19" font-weight="bold" fill="${NAVY}">Reports per month</text>`);
    chY += 20;
    const maxM = Math.max(...months.map((k) => monthTotals[k] || 0), 1);
    const slotW = (IW - 44) / months.length;
    const barW = Math.min(64, slotW * 0.52);
    months.forEach((k, i) => {
        const v = monthTotals[k] || 0;
        const h = Math.max(6, (v / maxM) * (chartH - 60));
        const cx = PAD + 22 + slotW * i + slotW / 2;
        add(`<text x="${cx.toFixed(1)}" y="${chY + (chartH - 60 - h)}" font-family="${FONT}" font-size="14" font-weight="bold" fill="${NAVY}" text-anchor="middle">${v}</text>`);
        add(`<rect x="${(cx - barW / 2).toFixed(1)}" y="${(chY + (chartH - 60 - h) + 6).toFixed(1)}" width="${barW.toFixed(1)}" height="${h.toFixed(1)}" rx="6" fill="${BAR}"/>`);
        add(`<text x="${cx.toFixed(1)}" y="${chY + chartH - 34}" font-family="${FONT}" font-size="13" font-weight="bold" fill="${MUTED}" text-anchor="middle">${shortMonth(k)}</text>`);
    });
    y += chH + 14;

    // Footer
    add(`<text x="${PAD}" y="${y}" font-family="${FONT}" font-size="12.5" fill="#7c8aa0">${escapeXml(footer || subtitle)}</text>`);
    y += 30;

    const full = `<svg width="${W}" height="${y}" xmlns="http://www.w3.org/2000/svg">${svg.replace('__H__', String(y))}</svg>`;
    return sharp(Buffer.from(full)).png().toBuffer();
}
