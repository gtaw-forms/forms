// Report share sidebar — the full migration-ui navigation, static.
// Gives link visitors (usually LEO officers) visual context and a way into
// the platform: records, per-kind feeds, morgue and LEO views. Targets resolve
// through MigrationUI's ?view=&filter= routing (see index.jsx).
import React from 'react';
import { Link } from 'react-router-dom';

const KIND_LINKS = [
  { kind: 'coroner', filter: 'coroner', icon: '✚', label: 'Coroner Reports' },
  { kind: 'email', filter: 'email', icon: '✉', label: 'Coroner Email' },
  { kind: 'mass', filter: 'mass', icon: '✚', label: 'Mass Fatality' },
  { kind: 'autopsy', filter: 'autopsy', icon: '◍', label: 'Autopsy Reports' },
];

export default function ReportShareSidebar() {
  return (
    <aside>
      <div className="brand">
        <div className="cross">+</div>
        <div><b>PHMC</b><span>Pillbox Hill Medical</span></div>
      </div>

      <Link to="/migration-ui" className="side-btn">
        ▤&nbsp;&nbsp;View all records
      </Link>

      <div className="nav-sec">Reports</div>
      {KIND_LINKS.map((k) => (
        <Link
          key={k.kind}
          to={`/migration-ui?view=records&filter=${k.filter}`}
          className="nav-item"
        >
          <span className="g" aria-hidden="true">{k.icon}</span>
          {k.label}
        </Link>
      ))}

      <div className="nav-sec">Records</div>
      <Link to="/migration-ui?view=morgue" className="nav-item">
        <span className="g" aria-hidden="true">○</span>
        Morgue Records
      </Link>

      <div className="nav-sec">Law Enforcement</div>
      <Link to="/migration-ui?view=leo" className="nav-item">
        <span className="g" aria-hidden="true">▤</span>
        LEO Reports
      </Link>
    </aside>
  );
}
