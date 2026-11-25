import { createRoot } from 'react-dom/client';
import domtoimage from 'dom-to-image';
import MorgueRecordCard from '../components/ui-new/MorgueRecordCard';

/**
 * morgueRecordCard.js — render a MorgueRecordCard off-screen, capture it to
 * PNG with dom-to-image (same lib as the map screenshot flow), and download
 * it. The card uses literal inline colors so the export needs no app CSS.
 */

const CARD_WIDTH = 860;
const SCALE = 2; // 2x export for crisp text

export async function downloadMorgueRecordCard(record) {
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
    const dataUrl = await domtoimage.toPng(node, {
      width: w * SCALE,
      height: h * SCALE,
      cacheBust: true,
      style: {
        transform: `scale(${SCALE})`,
        transformOrigin: 'top left',
        margin: '0',
      },
    });
    const a = document.createElement('a');
    a.download = `morgue-case-${record.caseId || 'record'}.png`;
    a.href = dataUrl;
    document.body.appendChild(a);
    a.click();
    a.remove();
  } finally {
    root.unmount();
    host.remove();
  }
}
