import React from 'react';

const getQuickLinks = (form) => {
  if (!form) return [];
  
  const links = [];
  const nameLower = form.name.toLowerCase();

  // Coroner-related
  if (nameLower.includes('coroner report')) {
    links.push({ name: 'Post Death Report', href: 'https://phmc.gta.world/posting.php?mode=post&f=267' });
  }
  if (nameLower.includes('autopsy')) {
    links.push({ name: 'Post Autopsy Report', href: 'https://phmc.gta.world/posting.php?mode=post&f=266' });
  }
  if (nameLower.includes('mass fatality')) {
    links.push({ name: 'Post Mass Fatality Report', href: 'https://phmc.gta.world/posting.php?mode=post&f=267' });
  }
  if (nameLower.includes('death record')) {
      links.push({ name: 'Post Death Record', href: 'https://phmc.gta.world/posting.php?mode=post&f=404' });
  }
  if (form.category === 'Coroner') {
      links.push({ name: 'View Coroner Case Files', href: 'https://phmc.gta.world/viewforum.php?f=266' });
  }

  // Patient/Civilian related
  if (nameLower.includes('medical record release')) {
    links.push({ name: 'Post Medical Record Release', href: 'https://phmc.gta.world/posting.php?mode=post&f=109' });
  }
  if (nameLower.includes('patient file')) {
    links.push({ name: 'Post Patient File', href: 'https://phmc.gta.world/posting.php?mode=post&f=332' });
  }
  if (nameLower.includes('update medical records')) {
    links.push({ name: 'Post Updated Medical Records', href: 'https://phmc.gta.world/posting.php?mode=post&f=332' });
  }
  if (nameLower.includes('sicknote')) {
    links.push({ name: 'Request Patient Sicknote via PM', href: 'https://phmc.gta.world/ucp.php?i=pm&mode=compose' });
  }

  // Default PHMC link
  if (form.accessType === 'PHMC' && links.length === 0) {
      links.push({ name: 'Staff Area - Medical Records', href: 'https://phmc.gta.world/viewforum.php?f=97' });
  }

  // Remove duplicates
  return [...new Map(links.map(item => [item.name, item])).values()];
};

const FormQuickLinks = ({ form }) => {
  const links = getQuickLinks(form);

  if (links.length === 0) {
    return null;
  }

  return (
    <div style={{ marginTop: '1rem', padding: '1rem', background: '#0f172a', borderRadius: 12, border: '1px solid #1e293b' }}>
      <h4 style={{ color: '#a78bfa', margin: '0 0 1rem', fontSize: '1rem', fontWeight: '600' }}>Quick Links</h4>
      <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
        {links.map(link => (
          <li key={link.name}>
            <a href={link.href} target="_blank" rel="noopener noreferrer" style={{ color: '#94a3b8', textDecoration: 'none', display: 'block', padding: '0.5rem', borderRadius: '6px', background: '#1e293b', transition: 'background 0.2s' }}
               onMouseOver={e => e.currentTarget.style.background = '#334155'}
               onMouseOut={e => e.currentTarget.style.background = '#1e293b'}
            >
              <i className="fas fa-external-link-alt" style={{ marginRight: '8px', color: '#60a5fa' }}></i>
              {link.name}
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
};

export default FormQuickLinks;
