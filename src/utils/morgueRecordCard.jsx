import { createRoot } from 'react-dom/client';
import domtoimage from 'dom-to-image';
import MorgueRecordCard from '../components/ui-new/MorgueRecordCard';
import { oocFromParsedName } from './doePlaceholders';
import { uploadDataUrlToImgLink } from './imageUploadUtils';

/**
 * morgueRecordCard.jsx — render a MorgueRecordCard off-screen, capture it to
 * PNG with dom-to-image (same lib as the map screenshot flow). The card uses
 * literal inline colors so the export needs no app CSS.
 *
 * Two destinations share one capture:
 * - downloadMorgueRecordCard(record) — saves the PNG to disk.
 * - uploadMorgueRecordCard(record) — uploads via the ImgLink proxy (same
 *   host/album as the form image uploader) and returns the URL.
 */

const CARD_WIDTH = 860;
const SCALE = 2; // 2x export for crisp text

/** "Morgue Record - Anthony Sorrentino - 86847.png" (OOC preferred). */
export function morgueRecordCardFilename(record) {
  const r = record || {};
  const ooc = oocFromParsedName(r.name || '');
  const who = (ooc || String(r.name || 'Unknown').replace(/\(\([^()]*\)\)/g, '').trim() || 'Unknown');
  const safe = (s) => String(s).replace(/[\\/:*?"<>|]/g, '').replace(/\s+/g, ' ').trim() || 'Unknown';
  return `Morgue Record - ${safe(who)} - ${safe(r.caseId || 'record')}.png`;
}

export async function renderMorgueRecordCard(record) {
  if (!record) throw new Error('No record to export.');
  const host = document.createElement('div');
  host.style.cssText = 'position:fixed;left:-12000px;top:0;pointer-events:none;';
  document.body.appendChild(host);
  const root = createRoot(host);
  try {
    root.render(<MorgueRecordCard record={record} />);
    // Let React commit + fonts/layout settle before capture.
    await new Promise((r) => setTimeout(r, 350));
    const node = host.firstChild;
    if (!node) throw new Error('Card failed to render.');
    const w = CARD_WIDTH;
    const h = node.offsetHeight;
    return await domtoimage.toPng(node, {
      width: w * SCALE,
      height: h * SCALE,
      cacheBust: true,
      style: {
        transform: `scale(${SCALE})`,
        transformOrigin: 'top left',
        margin: '0',
      },
    });
  } finally {
    root.unmount();
    host.remove();
  }
}

export async function downloadMorgueRecordCard(record) {
  const dataUrl = await renderMorgueRecordCard(record);
  const a = document.createElement('a');
  a.download = morgueRecordCardFilename(record);
  a.href = dataUrl;
  document.body.appendChild(a);
  a.click();
  a.remove();
  return dataUrl;
}

/** Capture the card and upload it; resolves to the ImgLink URL. */
export async function uploadMorgueRecordCard(record) {
  const dataUrl = await renderMorgueRecordCard(record);
  const result = await uploadDataUrlToImgLink(dataUrl);
  return result.url;
}
