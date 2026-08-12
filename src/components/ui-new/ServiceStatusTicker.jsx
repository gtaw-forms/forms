import React, { useState, useEffect, useRef, useCallback } from 'react';
import { ref, onValue } from 'firebase/database';
import { database } from '../../firebase';

/**
 * ServiceStatusTicker — status bar for the topbar that stretches to fill the
 * free space between the form title and the right-hand actions.
 *
 * Renders a combined line for the faction websites (PHMC/LSPD/LSSD → ONLINE/
 * OFFLINE) and a maintenance slide when the user has one active. Slides between
 * them every few seconds; pauses on hover.
 *
 * Data sources:
 *   appMetadata/maintenance   { active, message }
 *   monitoring/forums/<name>  { status }  PHMC / LSPD / LSSD
 */
const FORUM_ORDER = ['LSPD', 'PHMC', 'LSSD'];

const ServiceStatusTicker = () => {
  const [items, setItems] = useState([]);
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const lastLen = useRef(0);

  const buildItems = useCallback((mon, maint) => {
    const m = mon || {};
    const list = [];

    // User-added maintenance status first.
    if (maint && maint.active) {
      list.push({
        id: 'maintenance',
        tone: 'amber',
        label: 'MAINTENANCE',
        detail: (maint.message || 'In progress').replace(/\s+/g, ' ').trim(),
        icon: 'fa-wrench',
      });
    }

    // Combined faction website line — PHMC: ONLINE · LSPD: ONLINE · LSSD: OFFLINE
    const forums = m.forums || {};
    const segs = [];
    let worstTone = 'ok';
    let known = 0;
    for (const name of FORUM_ORDER) {
      const f = forums[name];
      if (!f) continue;
      const status = String(f.status || '').toLowerCase();
      const online = status === 'good';
      const tone = online ? 'ok' : status === 'bad' ? 'down' : 'warn';
      if (tone === 'down') worstTone = 'down';
      else if (tone === 'warn' && worstTone !== 'down') worstTone = 'warn';
      known++;
      segs.push(
        <span className="svc-forum" key={name}>
          <span className="svc-ticker-dot" />
          <span className="svc-forum-name">{name}</span>
          <span className="svc-forum-status">{online ? 'ONLINE' : status === 'bad' ? 'OFFLINE' : 'UNKNOWN'}</span>
        </span>
      );
    }

    if (known === 0) {
      list.push({ id: 'idle', tone: 'ok', label: 'SERVER STATUS', detail: 'ALL SYSTEMS OPERATIONAL' });
    } else {
      list.push({ id: 'forums', tone: worstTone, segments: segs });
    }

    if (lastLen.current !== list.length) {
      lastLen.current = list.length;
      setIndex(0);
    }
    setItems(list);
  }, []);

  // ── Subscribe to monitoring + maintenance ──
  useEffect(() => {
    const monRef = ref(database, 'monitoring');
    const maintenanceRef = ref(database, 'appMetadata/maintenance');
    let maint = null;

    const unsubMon = onValue(monRef, (snap) => {
      buildItems(snap.val(), maint);
    });

    const unsubMaint = onValue(maintenanceRef, (snap) => {
      maint = snap.val() || null;
      onValue(monRef, (s) => buildItems(s.val(), maint), { onlyOnce: true });
    });

    return () => { unsubMon(); unsubMaint(); };
  }, [buildItems]);

  // ── Auto-advance the slide ──
  useEffect(() => {
    if (items.length <= 1 || paused) return;
    const id = setInterval(() => setIndex((i) => (i + 1) % items.length), 5000);
    return () => clearInterval(id);
  }, [items.length, paused]);

  return (
    <div
      className="svc-ticker"
      title="Server status — live from bot monitor"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      <div className="svc-ticker-track" style={{ transform: `translateX(-${index * 100}%)` }}>
        {items.map((it) => (
          <div className={`svc-ticker-item ${it.tone}`} key={it.id}>
            {it.segments ? (
              <div className="svc-forums">{it.segments}</div>
            ) : (
              <>
                <span className="svc-ticker-dot" />
                <span className="svc-ticker-icon"><i className={`fas ${it.icon || 'fa-server'}`} /></span>
                <span className="svc-ticker-label">{it.label}</span>
                <span className="svc-ticker-sep">:</span>
                <span className="svc-ticker-detail">{it.detail}</span>
              </>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

export default ServiceStatusTicker;
