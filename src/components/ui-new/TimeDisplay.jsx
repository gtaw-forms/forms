import React, { useState, useEffect, useCallback } from 'react';

const PREF_KEY = 'phmc_time_format';

const getPref = () => localStorage.getItem(PREF_KEY) !== '24h'; // default 12h
const setPref = (val) => localStorage.setItem(PREF_KEY, val ? '12h' : '24h');

const fmt12 = (d, utc) => {
  const h = utc ? d.getUTCHours() : d.getHours();
  const m = utc ? d.getUTCMinutes() : d.getMinutes();
  const s = utc ? d.getUTCSeconds() : d.getUTCSeconds();
  const ampm = h >= 12 ? 'PM' : 'AM';
  const h12 = h % 12 || 12;
  const p = n => n.toString().padStart(2, '0');
  return `${h12}:${p(m)}:${p(s)} ${ampm}`;
};

const fmt24 = (d, utc) => {
  const p = n => n.toString().padStart(2, '0');
  if (utc) {
    return `${d.getUTCFullYear()}-${p(d.getUTCMonth() + 1)}-${p(d.getUTCDate())} ${p(d.getUTCHours())}:${p(d.getUTCMinutes())}:${p(d.getUTCSeconds())} UTC`;
  }
  return `${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
};

const TimeDisplay = ({ compact }) => {
  const [is12h, setIs12h] = useState(getPref);
  const [now, setNow] = useState(new Date());

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  const toggle = useCallback(() => {
    setIs12h(prev => { const n = !prev; setPref(n); return n; });
  }, []);

  const serverTime = is12h ? fmt12(now, true) : fmt24(now, true);
  const localTime = is12h ? fmt12(now, false) : fmt24(now, false);

  if (compact) {
    return (
      <div style={{ fontSize: 10.5, color: 'var(--text-faint)', fontFamily: 'var(--mono)', marginBottom: 2, cursor: 'pointer' }} onClick={toggle} title="Click to toggle 12h/24h">
        Server: {serverTime} | Local: {localTime}
      </div>
    );
  }

  return (
    <div style={{ fontSize: 10.5, color: 'var(--text-faint)', fontFamily: 'var(--mono)', marginBottom: 2, cursor: 'pointer', display: 'flex', justifyContent: 'space-between' }} onClick={toggle} title="Click to toggle 12h/24h">
      <span>Server Time: {serverTime}</span>
      <span>Your Time: {localTime}</span>
    </div>
  );
};

export default TimeDisplay;
