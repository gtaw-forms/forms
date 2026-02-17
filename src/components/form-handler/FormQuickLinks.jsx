import React from 'react';

const getQuickLinks = (form, formValues, agencyDataStore, generatedBBCode, generatedTitle) => {
  if (!form) return [];
  
  const links = [];
  const nameLower = form.name.toLowerCase();
  const formId = form.id; // Use form.id for more reliable identification

  // Helper to construct PM URL with BBCode data (Proof of Concept from examplescript.js)
  const constructPmUrl = (baseUrl, recipient, subject, message) => {
    if (!baseUrl) return null;
    try {
      const url = new URL(baseUrl);
      if (recipient) url.searchParams.set('username_list', recipient);
      if (subject) url.searchParams.set('subject', subject);
      if (message) url.searchParams.set('message', message);
      return url.toString();
    } catch (e) {
      // Fallback for non-standard URLs or if URL constructor fails
      const sep = baseUrl.includes('?') ? '&' : '?';
      let finalUrl = baseUrl;
      if (recipient) finalUrl += `${sep}username_list=${encodeURIComponent(recipient)}`;
      if (subject) finalUrl += `${finalUrl.includes('?') ? '&' : '?'}subject=${encodeURIComponent(subject)}`;
      if (message) finalUrl += `${finalUrl.includes('?') ? '&' : '?'}message=${encodeURIComponent(message)}`;
      return finalUrl;
    }
  };

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
  // NEW: Custom handling for Coroner Email form
  if (formId === 'coroner_email') { 
      const departmentValue = formValues?.department;
      const departmentName = (typeof departmentValue === 'object' && departmentValue !== null && departmentValue.value)
                            ? departmentValue.value
                            : departmentValue; 

      let agency = null;
      if (departmentName && agencyDataStore) {
          agency = Object.values(agencyDataStore).find(
              (a) => a.fullName === departmentName
          );
      }
      
      if (agency) {
          if (agency.url) {
              let finalHref = agency.url;
              // If we have generated BBCode, try to enrich the PM link
              if (generatedBBCode && (agency.url.includes('mode=compose') || agency.url.includes('ucp.php'))) {
                  // Helper to extract string value from potential object-based form values
                  const getRawValue = (val) => {
                      if (typeof val === 'object' && val !== null) {
                          return val.value || val.label || '';
                      }
                      return val || '';
                  };

                  const recipientRaw = formValues?.requestingOfficer || 
                                       formValues?.requesting_officer || 
                                       formValues?.officer_name || 
                                       formValues?.officerName ||
                                       formValues?.officer || 
                                       formValues?.recipient || '';
                                       
                  const recipient = getRawValue(recipientRaw);
                  
                  // Removed generatedBBCode from the URL to avoid length blocks
                  finalHref = constructPmUrl(agency.url, recipient, generatedTitle);
              }
              links.push({ name: `${agency.fullName || departmentName}`, href: finalHref });
          }
      }
  }

  if (form.accessType === 'PHMC' && links.length === 0) {
      links.push({ name: 'Staff Area - Medical Records', href: 'https://phmc.gta.world/viewforum.php?f=97' });
  }

  // Remove duplicates
  return [...new Map(links.map(item => [item.name, item])).values()];
};

const FormQuickLinks = ({ form, formValues, agencyDataStore, generatedBBCode, generatedTitle }) => {
  const links = getQuickLinks(form, formValues, agencyDataStore, generatedBBCode, generatedTitle);

  if (links.length === 0) {
    return null;
  }

  return (
    <div style={{ marginTop: '1rem', padding: '1rem', background: '#0f172a', borderRadius: 12, border: '1px solid #1e293b' }}>
      <h4 style={{ color: '#a78bfa', margin: '0 0 1rem', fontSize: '1rem', fontWeight: '600' }}>Quick Links</h4>
      {generatedBBCode && form?.id === 'coroner_email' && (
        <p style={{ color: '#94a3b8', fontSize: '0.85rem', marginBottom: '1rem', fontStyle: 'italic' }}>
          The Officer and Subject is automatically filled in, please copy the BBCode below and click the link.
        </p>
      )}
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
