import React from 'react';

const getQuickLinks = (form, formValues, agencyDataStore) => {
  if (!form) return [];
  
  const links = [];
  const nameLower = form.name.toLowerCase();
  const formId = form.id; // Use form.id for more reliable identification

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

  // NEW: Custom handling for Coroner Email form
  if (formId === 'coroner_email') { // Assuming the ID is 'coroner-email'
      const departmentValue = formValues?.department;
      // departmentName is now the full name, e.g., "Los Santos Police Department"
      const departmentName = (typeof departmentValue === 'object' && departmentValue !== null && departmentValue.value)
                            ? departmentValue.value
                            : departmentValue; // Fallback to raw value if not an object

      // NEW: Find agency by fullName instead of key
      let agency = null;
      if (departmentName && agencyDataStore) {
          agency = Object.values(agencyDataStore).find(
              (a) => a.fullName === departmentName
          );
      }
      
      if (agency) {
          if (agency.url) {
              links.push({ name: `${agency.fullName || departmentName} - Dispatch/Internal`, href: agency.url });
          }
          if (agency.website) {
              links.push({ name: `${agency.fullName || departmentName} Website`, href: `https://${agency.website}` });
          }
      }
  }

  if (form.accessType === 'PHMC' && links.length === 0) {
      links.push({ name: 'Staff Area - Medical Records', href: 'https://phmc.gta.world/viewforum.php?f=97' });
  }

  // Remove duplicates
  return [...new Map(links.map(item => [item.name, item])).values()];
};

const FormQuickLinks = ({ form, formValues, agencyDataStore }) => {
  const links = getQuickLinks(form, formValues, agencyDataStore);

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
