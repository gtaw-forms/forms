// src/utils/bbcodeRenderer.js
// Stage T2-B of the test-strategy plan: pure, dependency-injected BBCode
// renderer factored OUT of src/hooks/useBbcodeGenerator.js WITHOUT changing
// behavior. The hook performs all enrichment (credential resolution, local
// fallbacks, decedent normalization, currentYear, placeholder init) and passes
// the fully-prepared values + coronerInfo + deps into renderBbcode, which
// reproduces the exact render pipeline the hook used to run inline.
//
// [OK] This module is browser/DOM-free and references nothing from the hook:
// no selectedForm / gtaWorldUser / factionsData / factionListData /
// resolvedCredentials / isLocalInstance / Sentry / window. Its only inputs are
// the renderBbcode({ template, form, values, coronerInfo, agencyDataStore, deps })
// arguments.

// ── Date / case-number helpers (moved verbatim out of the hook) ─────────────
const formatToNorthAmericanDate = (isoDateTime) => {
    if (!isoDateTime) return 'NO_DATE';
    try {
        const dateString = isoDateTime.split('T')[0]; // "YYYY-MM-DD"
        const parts = dateString.split('-'); // ["YYYY", "MM", "DD"]
        let date;

        if (parts.length === 3) {
            const year = parseInt(parts[0], 10);
            const month = parseInt(parts[1], 10) - 1; // Month is 0-indexed
            const day = parseInt(parts[2], 10);
            // Construct date in local timezone to avoid UTC interpretation
            date = new Date(year, month, day);
        } else {
            // If it's not a YYYY-MM-DD string, try parsing the full isoDateTime
            date = new Date(isoDateTime);
        }

        if (!isNaN(date.getTime())) {
            const month = (date.getMonth() + 1).toString().padStart(2, '0');
            const day = date.getDate().toString().padStart(2, '0');
            const year = date.getFullYear();
            return `${month}/${day}/${year}`;
        }
        
        return 'INVALID_DATE'; // Fallback
    } catch (e) {
        console.error("Error in formatToNorthAmericanDate:", e);
        return 'ERROR_DATE';
    }
};

const formatToMMM_DD_YYYY = (isoDateTime) => {
    if (!isoDateTime) return 'NO_DATE';
    try {
        const dateString = isoDateTime.split('T')[0]; // "YYYY-MM-DD"
        const parts = dateString.split('-'); // ["YYYY", "MM", "DD"]
        let date;

        if (parts.length === 3) {
            const year = parseInt(parts[0], 10);
            const month = parseInt(parts[1], 10) - 1; // Month is 0-indexed
            const day = parseInt(parts[2], 10);
            // Construct date in local timezone to avoid UTC interpretation
            date = new Date(year, month, day);
        } else {
            // If it's not a YYYY-MM-DD string, try parsing the full isoDateTime
            date = new Date(isoDateTime);
        }

        if (!isNaN(date.getTime())) {
            const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
            const month = monthNames[date.getMonth()];
            const day = date.getDate().toString().padStart(2, '0');
            const year = date.getFullYear();
            return `${month}-${day}-${year}`;
        }
        
        return isoDateTime; // Fallback to original string if all parsing fails
    } catch (e) {
        console.error("Error formatting date for title (MMM-DD-YYYY):", e);
        return isoDateTime || 'INVALID_DATE';
    }
};

const parseCaseNumber = (url) => {
    if (!url) return '';
    // Try to match phpBB t= parameter first
    const tMatch = url.match(/[?&]t=(\d+)/);
    if (tMatch) return tMatch[1];
    
    const match = url.match(/\d+$/);
    return match ? match[0] : '';
};

// ── OOC-name cleaner (moved verbatim out of the hook's performGeneration) ────
const cleanOocString = (str) => {
    if (!str) return null;
    let cleaned = str.trim();
    
    // 1. Truncate at common delimiters if they appear in the middle of a fragment
    const stopKeywords = ['|', 'this is a revised report', 'http://', 'https://', ' - '];
    let stopIndex = -1;

    for (const keyword of stopKeywords) {
        const index = cleaned.toLowerCase().indexOf(keyword);
        if (index !== -1 && (stopIndex === -1 || index < stopIndex)) {
            stopIndex = index;
        }
    }

    if (stopIndex !== -1) {
        cleaned = cleaned.substring(0, stopIndex).trim();
    }

    // 2. Discard if it contains "note-like" words (unlikely to be in a UCP/Forum name)
    const discardKeywords = ['but ', 'our ', 'this ', 'revised', 'evidence', 'detective', 'refined', 'specificity', 'report', 'determination'];
    const lowerCleaned = cleaned.toLowerCase();
    if (discardKeywords.some(k => lowerCleaned.includes(k))) {
        return null;
    }

    // 3. Discard if too many words (likely a sentence, not a name/UCP)
    if (cleaned.split(/\s+/).length > 4) {
        return null;
    }

    cleaned = cleaned.replace(/,$/, '').trim();
    
    if (cleaned && cleaned.toLowerCase() !== 'out of character images') {
        return cleaned;
    }
    return null;
};

// ── Pure render core ────────────────────────────────────────────────────────
// form = { name, id, firebaseKey, fields, titleGeneratorCode }
// deps = { getDepartmentFullName, generateDecedentBBCode, year }
export function renderBbcode({ template, form, values, coronerInfo, agencyDataStore, deps }) {
  const { getDepartmentFullName, generateDecedentBBCode, year } = deps;

  let bbcode = template;
  let finalTitle = "";

  const ctx = { ...values };
  ctx.formData = ctx;

  // Resolve department codes to full names at the context level so EVERY
  // template renders full names — including live RTDB templates that still
  // carry raw {{department}} placeholders (a local JSON edit cannot fix
  // those; the store of record is the database). Full names pass through
  // untouched, so explicit getDepartmentFullName(...) template calls are
  // unaffected (idempotent).
  if (ctx.department && typeof getDepartmentFullName === 'function') {
    ctx.department = getDepartmentFullName(ctx.department, agencyDataStore);
  }
  
  // DEBUG: Check template for coroner placeholders
  const hasCoronerRank = bbcode.includes('{{coronerRank}}');
  const hasCoronerEmployee = bbcode.includes('{{coronerEmployee}}');
  const hasCoronerBadge = bbcode.includes('{{coronerBadge}}');
  
  ctx.generateDecedentBBCode = (arr) => generateDecedentBBCode(arr, coronerInfo);

  const decedents_bbcode = generateDecedentBBCode(values.decedents, coronerInfo);
  bbcode = bbcode.replace('{{decedents_array_bbcode}}', decedents_bbcode);

  const addFallback = (src, target) => {
    // Only apply fallback if target is missing OR is an empty string (likely from placeholder initialization)
    if (values[src] !== undefined && (ctx[target] === undefined || ctx[target] === '')) {
       ctx[target] = values[src];
    }
  };
  addFallback('patientName', 'PatientName'); addFallback('PatientName', 'patientName');
  addFallback('employeeName', 'EmployeeName'); addFallback('EmployeeName', 'employeeName');
  addFallback('phmcEmployee', 'PHMCEmployee'); addFallback('PHMCEmployee', 'phmcEmployee');
  addFallback('coronerEmployee', 'CoronerEmployee'); addFallback('CoronerEmployee', 'coronerEmployee');

  if (form.name === "Coroner Email" || form.id === "coroner_email") {
    // Coroner Email title: use structured decedent data from attached report (set by useReportAttachment).
    // Falls back to regex-based title parsing for non-Version 11 reports.
    const decedentName = values.decedentName || '';
    const decedentOOC = values.decedentOOC || '';

    if (decedentName && decedentOOC) {
      const nameList = decedentName.split(',').map(n => n.trim()).filter(Boolean).join(', ');
      finalTitle = `Coroner Report - ${nameList} (( ${decedentOOC} ))`;
      console.log('[CoronerEmail] Title from structured data:', finalTitle);
    } else {
      // Flallback: parse names from attached report titles
      const collectedDecedents = [];
      const allOocNames = [];

    if (Array.isArray(values.additionalReports) && values.additionalReports.length > 0) {
      values.additionalReports.forEach(report => {
        const reportTitle = typeof report === 'string' ? 'Report' : (report.originalKey || 'Report');
        const reportBBCode = typeof report === 'string' ? '' : (report.bbCode || '');
        console.log('[CoronerEmail Debug] Processing report title:', reportTitle);

        let icSection = reportTitle;
        let oocNames = [];

        // Step 1: Strip report type prefix (e.g., "[Multi Fatality Report]" or "[DEATH-REPORT]")
        icSection = icSection.replace(/^\[.*?\]\s*/, '').replace(/^Coroner Report -\s*/, '').trim();

        // Step 2: Extract OOC names from ANYWHERE in the title (both (( )) and [ ] formats)
        // This handles both end-of-title OOC (Multi Fatality) and middle-of-title OOC (DEATH-REPORT)
        const oocMatches = icSection.match(/(?:\(\((.*?)\)\)|\[(.*?)\])/g);
        if (oocMatches) {
          oocMatches.forEach(match => {
            const oocContent = match.replace(/[[\]()]/g, ''); // Remove brackets
            const names = oocContent.split(',').map(n => cleanOocString(n.trim())).filter(Boolean);
            oocNames.push(...names);
          });
          // Remove all OOC sections from icSection so dates and IC names are clean
          icSection = icSection.replace(/(?:\(\((.*?)\)\)|\[(.*?)\])/g, '').trim();
        }

        // Step 2b: If no OOC names found in title, try to extract from bbCode body
        if (oocNames.length === 0 && reportBBCode) {
          const bbcodeOocMatches = reportBBCode.match(/\(\((.*?)\)\)/g);
          if (bbcodeOocMatches) {
            oocNames = bbcodeOocMatches.map(m => cleanOocString(m.slice(2, -2).trim())).filter(Boolean);
            console.log('[CoronerEmail Debug] Found OOC names in bbCode body (before dedup):', oocNames);
          }
        }

        // Step 2c: Deduplicate OOC names (preserve order, remove all duplicates)
        if (oocNames.length > 0) {
          const uniqueOocNames = [];
          for (const name of oocNames) {
            if (!uniqueOocNames.includes(name)) {
              uniqueOocNames.push(name);
            }
          }
          oocNames = uniqueOocNames;
          console.log('[CoronerEmail Debug] OOC names after deduplication:', oocNames);
        }

        // Step 3: Remove dates from IC section (now that OOC is removed, dates should be isolated)
        icSection = icSection
          .replace(/\s*-\s*\d{1,2}\/\d{1,2}\/\d{4}\s*$/, '') // MM/DD/YYYY
          .replace(/\s*-\s*\d{4}\/\d{1,2}\/\d{1,2}\s*$/, '') // YYYY/MM/DD
          .replace(/\s+\d{1,2}\/\d{1,2}\/\d{4}\s*$/, '') // MM/DD/YYYY without dash
          .replace(/\s+\d{4}\/\d{1,2}\/\d{1,2}\s*$/, '') // YYYY/MM/DD without dash
          .trim();

        // Step 4: Extract individual IC names (split by | or ,)
        const icNames = icSection.split(/\s*\|\s*|\s*,\s*/).map(n => n.trim()).filter(Boolean);

        // Step 5: For each IC name, expand multipliers and pair with OOC names
        let icIndex = 0;
        for (const icName of icNames) {
          const multiplierMatch = icName.match(/^(.*?)\s*\(x(\d+)\)$/);
          const baseName = multiplierMatch ? multiplierMatch[1].trim() : icName;
          const multiplier = multiplierMatch ? parseInt(multiplierMatch[2], 10) : 1;

          // Add each expanded instance
          for (let m = 0; m < multiplier; m++) {
            const ooc = oocNames[icIndex] || null;
            if (ooc && !allOocNames.includes(ooc)) {
              allOocNames.push(ooc);
            }
            collectedDecedents.push({ ic: baseName, ooc });
            icIndex++;
          }
        }

        console.log('[CoronerEmail Debug] Extracted from report - IC names:', icNames, 'OOC names:', oocNames, 'Collected:', collectedDecedents.length);
      });
    }

    // Step 6: Count unique IC names and their frequencies
    const nameCounts = {};
    collectedDecedents.forEach(({ ic, ooc: _ooc }) => {
      if (ic && ic !== 'N/A' && ic !== 'NO_NAME') {
        nameCounts[ic] = (nameCounts[ic] || 0) + 1;
      }
    });

    console.log('[CoronerEmail Debug] Final name counts:', nameCounts, 'OOC names:', allOocNames);

    // Step 7: Build title
    let titleParts = ["Coroner Report"];
    const namesList = Object.entries(nameCounts)
      .map(([name, count]) => count > 1 ? `${name} (x${count})` : name)
      .join(', ');
    
    if (namesList) {
      titleParts.push(`- ${namesList}`);
    } else {
      titleParts.push('- UNKNOWN DECEDENT');
    }
    
    if (allOocNames.length > 0) {
      titleParts.push(`(( ${allOocNames.join(', ')} ))`);
    }
    
    finalTitle = titleParts.join(' ').replace(/\s{2,}/g, ' ').trim();
    console.log('[CoronerEmail] Title from fallback parsing:', finalTitle);
    }
  }
  else if (form.firebaseKey === 'mass-ftality-test' || form.id === 'mass-fatality' || form.name?.toLowerCase().includes('mass fatality')) {
    const decedentCounts = {};
    let totalDecedents = 0;
    if (Array.isArray(values.decedents)) {
      totalDecedents = values.decedents.length;
      values.decedents.forEach((d) => {
        const name = (d.decedentName || '').trim();
        if (name) {
          decedentCounts[name] = (decedentCounts[name] || 0) + 1;
        }
      });
    }
    const namesList = Object.entries(decedentCounts)
      .map(([n, c]) => c > 1 ? `${n} (x${c})` : n)
      .join(' | ') || 'No Decedents Listed';
    const dateStr = formatToNorthAmericanDate(values.dateTime) || 'NO_DATE';
    
    const reportType = totalDecedents >= 4 ? 'Mass Fatality' : 'Multi Fatality';
    finalTitle = `[${reportType} Report] ${namesList} - ${dateStr}`;
  }
  else if (form.firebaseKey === 'death_record' || form.id === 'death_record' || form.name === 'Death Record') {
    const caseNum = parseCaseNumber(values.deathReportPostId) || parseCaseNumber(values.caseNumber) || 'UNKNOWN';
    const name = values.decedentName || 'UNKNOWN_NAME';
    const ooc = values.decedentOOC || 'N/A';
    const dod = formatToMMM_DD_YYYY(values.dateOfDeath || values.dateTime || values.formattedDateOfDeath);
    finalTitle = `[CASE #${year}-${caseNum}] ${name} ((${ooc})) | ${dod}`;
  }
  else if (form.titleGeneratorCode) {
    let workingTitle = form.titleGeneratorCode;
    form.fields?.forEach(field => {
      const placeholder = `{{${field.name}}}`;
      if (workingTitle.includes(placeholder)) {
        let value = values[field.name] ?? "";
        if (field.type === "image_upload" && value) value = `[img]${value}[/img]`;
        else if (field.type === "checkbox") value = value ? "Yes" : "No";
        else if (field.type === "multi_select" && Array.isArray(value)) value = value.join(", ");
        else if (["date", "dateTime", "pronouncedTimeOfDeath"].includes(field.name)) {
          value = formatToNorthAmericanDate(value) || value || "NO_DATE";
        }
        workingTitle = workingTitle.replace(new RegExp(placeholder.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), String(value || ""));
      }
    });
    const fallbackTitleReplacements = {
      '{{patientName}}': values.patientName || values.decedentName || "NO_NAME",
      '{{PatientName}}': values.patientName || values.decedentName || "NO_NAME",
      '{{phmcEmployee}}': values.phmcEmployee || "",
      '{{date}}': formatToNorthAmericanDate(values.dateTime || values.date) || "NO_DATE",
      '{{year}}': year,
    };
    Object.entries(fallbackTitleReplacements).forEach(([ph, val]) => {
      if (workingTitle.includes(ph)) {
        workingTitle = workingTitle.replace(new RegExp(ph.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), String(val));
      }
    });

    // Resolve [FORM_NAME] to the actual form name (some medical forms use it
    // as a title placeholder, e.g. "Consultation - Session Notes").
    if (workingTitle.includes('[FORM_NAME]')) {
      workingTitle = workingTitle.replace(/\[FORM_NAME\]/g, form.name || '');
    }
    finalTitle = workingTitle;
  }

  bbcode = bbcode.replace(/\[cb:([^\]]+)\]([^\r\n]*)(\r?\n)?/g, (match, fieldName, text, newline) => {
    const field = fieldName.trim();
    const option = text.trim();
    const value = values[field];
    
    let comparisonValue = value;
    if (typeof value === 'object' && value !== null && Object.prototype.hasOwnProperty.call(value, 'value')) {
        comparisonValue = value.value;
    }
    let isSelected = false;
    if (Array.isArray(comparisonValue)) {
      isSelected = comparisonValue.map(v => String(v).trim().toLowerCase()).includes(option.toLowerCase());
    } else {
      isSelected = String(comparisonValue || '').trim().toLowerCase() === option.toLowerCase();
    }
    return `${isSelected ? `[cbc]` : `[cb]`} ${option}${newline || ''}`;
  });

  bbcode = bbcode.replace(/\[cb:([^\]]+)\]/gi, (match, fieldName) => {
    const value = values[fieldName.trim()];
    return (value && (!Array.isArray(value) || value.length > 0)) ? "[cbc]" : "[cb]";
  });

  bbcode = bbcode.replace(/\[conditional\s+field=["']?([^"'\]\s]+)["']?(?:\s+value=["']?([^"'\]]+)["']?)?\](.*?)\[\/conditional\]/gis, (match, fieldName, expectedValue, inner) => {
    const actualValue = values[fieldName.trim()];
    let conditionMet = false;

    if (expectedValue !== undefined) { // value="..." is present
        const expected = expectedValue.trim();
        if (expected.toLowerCase() === 'true') {
            if (Array.isArray(actualValue)) {
                conditionMet = actualValue.length > 0;
            } else {
                conditionMet = !!actualValue && actualValue !== '';
            }
        } else if (expected.toLowerCase() === 'false') {
            if (Array.isArray(actualValue)) {
                conditionMet = actualValue.length === 0;
            } else {
                conditionMet = !actualValue || actualValue === '';
            }
        } else {
            if (Array.isArray(actualValue)) {
                conditionMet = actualValue.map(v => String(v).toLowerCase()).includes(String(expected).toLowerCase());
            } else {
                conditionMet = String(actualValue).toLowerCase() == String(expected).toLowerCase();
            }
        }
    } else { // no value="...", just [conditional field="..."]
        if (Array.isArray(actualValue)) {
            conditionMet = actualValue.length > 0;
        } else if (typeof actualValue === 'object' && actualValue !== null && Object.prototype.hasOwnProperty.call(actualValue, 'confirmedAt')) {
            conditionMet = !!actualValue.confirmedAt;
        } else {
            conditionMet = !!actualValue && actualValue !== "";
        }
    }

    return conditionMet ? inner.trim() : '';
  });
  
  // Handle additional reports by combining them into the deathReport placeholder
  console.log('[BBCodeDebug] Checking for additional reports. Found:', values.additionalReports);
  let deathReportContent = values.deathReport || '';
  if (Array.isArray(values.additionalReports) && values.additionalReports.length > 0) {
    const additionalReportsBBCodes = values.additionalReports.map(report => {
        const sanitizeSpoilerTitle = (title) => {
          if (!title) return 'Spoiler';
          return title.replace(/[[\]()/]/g, '').trim();
        };

        const originalKey = typeof report === 'string' ? 'Additional Report' : (report.originalKey || 'Additional Report');
        const sanitizedTitle = sanitizeSpoilerTitle(originalKey);
		let bbCodeContent = typeof report === 'string' ? report : report.bbCode;

        // If the attached report is itself a Coroner Email, extract the core report content
        // Assuming `coroner_email` is the formId for Coroner Email forms.
        if (report.formId === 'coroner_email' || report.formId === 'coroner-email') { // Handle both potential 'id' and 'firebaseKey'
            // Regex to find the content within specific spoilers that typically contain the actual report
            const reportSpoilerMatch = bbCodeContent.match(/\[altspoiler=(?:Coroner Report|DEATH INVESTIGATION REPORT|MASS FATALITY REPORT|Death Record|Mass Fatality)\]([\s\S]*?)\[\/spoiler\]/i);
            if (reportSpoilerMatch && reportSpoilerMatch[1]) {
                bbCodeContent = reportSpoilerMatch[1].trim();
            } else {
                // Fallback for cases where a specific report spoiler isn't found within the email.
                // Try to strip known email header/footer elements.
                // Identify the start of the report content: after the contact list.
                const headerEndMarker = /(\[list\].*?\[\/list\])/is;
                const headerEndMatch = bbCodeContent.match(headerEndMarker);
                if (headerEndMatch) {
                    bbCodeContent = bbCodeContent.substring(bbCodeContent.indexOf(headerEndMatch[1]) + headerEndMatch[1].length).trim();
                }

                // Identify the end of the report content: before "Kind regards"
                const footerStartMarker = /(Kind regards)/is;
                const footerStartMatch = bbCodeContent.match(footerStartMarker);
                if (footerStartMatch) {
                    bbCodeContent = bbCodeContent.substring(0, bbCodeContent.indexOf(footerStartMatch[0])).trim();
                }

                // Remove any residual {{placeholders}} that might be from a partially filled template
                bbCodeContent = bbCodeContent.replace(/\{\{.*?\}\}/g, '').trim();
                // Remove any residual ADDITONAL REPORTS section title
                bbCodeContent = bbCodeContent.replace(/\[size=85\]\[b\]ADDITIONAL REPORTS\[\/b\]\[\/size\][\s\S]*?\[size=75\]\[i\].*?\[\/i\]\[\/size\]/gi, '').trim();
                // Remove any hr tags which often delineate sections
                bbCodeContent = bbCodeContent.replace(/\[hr\][\s\S]*?\[\/hr\]/gi, '').trim();
            }
        }

        const spoiler = `[altspoiler=${sanitizedTitle}]\n${bbCodeContent}\n[/altspoiler]`;
        console.log(`[BBCodeDebug] Generated spoiler for key "${originalKey}"`);
        return spoiler;
    }).join('\n\n');
    deathReportContent = [deathReportContent, additionalReportsBBCodes].filter(Boolean).join('\n\n');
  }
  values.deathReport = deathReportContent;

  bbcode = bbcode.replace(/\{\{([a-zA-Z0-9_]+)\|((?:(?!}}).)+)\}\}/g, (match, key, placeholderText) => {
      const value = values[key];
      const isScenePhotosBug = key === 'scenePhotosBBCode' && values.scenePhotosBBCode_missing_bug;
      const isEmpty = value === null || value === undefined || value === '' || value === false || (Array.isArray(value) && value.length === 0);
      
      if (isEmpty && !isScenePhotosBug) return placeholderText;
      
      let replacement = String(value);
      const field = form.fields?.find(f => f.name === key);
      if (field) {
          if ((field.type === "image" || field.type === "image_upload")) {
              const formatItem = (item) => (typeof item === 'string' && /\.(jpg|jpeg|png|gif|webp)$/i.test(item.trim())) ? `[img]${item}[/img]` : (item || '');
              replacement = Array.isArray(value) ? value.map(formatItem).filter(Boolean).join('\n') : formatItem(value);
              
              if (isScenePhotosBug) {
                replacement = replacement ? `${replacement}\n\n(( Scene Photos are unavailable due to a bug with screenshot capture software ))` : `(( Scene Photos are unavailable due to a bug with screenshot capture software ))`;
              }
          }
          else if (field.type === "checkbox" && typeof value === "boolean") replacement = value ? "Yes" : "No";
          else if (field.type === "body_tampered" && typeof value === "boolean") replacement = value ? "Yes" : "No";
          else if (field.type === "multi_select" && Array.isArray(value)) replacement = value.join(", ");
          else if (field.type === "dynamic_text_list" && Array.isArray(value)) {
              const items = value.filter(val => val && String(val).trim() !== "");
              if (items.length > 0) {
                  const listOpen = (field.listType && field.listType !== "" && field.listType !== "none") ? `[list=${field.listType}]` : "[list]";
                  replacement = field.listType === "none" ? items.join("\n") : `${listOpen}\n[*]${items.join("\n[*]")}\n[/list]`;
              } else replacement = "";
          }
          else if (["dateTime", "pronouncedTimeOfDeath"].includes(field.name)) replacement = String(value).split("T")[0] || String(value);
      }
      return replacement;
  });

  Object.keys(values).forEach(key => {
      const placeholder = `{{${key}}}`;
      if (!bbcode.includes(placeholder)) return;
      const value = values[key];

      // Employee image signature — {{phmcSignature}} / {{coronerSignature}}:
      // render the approved signature URL as an inline image when set.
      if (/Signature$/i.test(key)) {
        console.log('[SIGTRACE] generator signature key', { key, valueType: typeof value, value: typeof value === 'string' ? value.slice(0, 60) : JSON.stringify(value), placeholderInTemplate: bbcode.includes(placeholder), validUrl: typeof value === 'string' && /^https?:\/\/\S+\.(png|jpe?g|gif|webp)(\?\S*)?$/i.test(value.trim()) });
      }
      if (/Signature$/i.test(key) && typeof value === 'string' && /^https?:\/\/\S+\.(png|jpe?g|gif|webp)(\?\S*)?$/i.test(value.trim())) {
          bbcode = bbcode.replace(new RegExp(placeholder.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "g"), `[img]${value.trim()}[/img]`);
          console.log('[SIGTRACE] generator REPLACED', placeholder, 'with [img]');
          return;
      }
      if (/Signature$/i.test(key)) { console.log('[SIGTRACE] generator DROPPED/left', placeholder, '— value empty/invalid'); return; }

      // Preserve patientID/PATIENT_ID/patientId placeholder if empty —
      // the bot fills it later via handleMedicalRecord (auto-assign or extract from topic title).
      if ((key === 'patientID' || key === 'PATIENT_ID' || key === 'patientId') && (!value || value === '')) {
          console.log(`[useBbcodeGenerator] Preserving {{${key}}} placeholder (empty) for bot to fill later`);
          return;
      }

      let replacement = String(value ?? '');
      // Department codes resolve to full names HERE (not just in the later
      // expression-eval stage): plain {{department}} placeholders substitute
      // straight from values[], so the expression-stage ctx fix alone never
      // fires for the live RTDB templates. Resolving at substitution covers
      // every template, present and future.
      if ((key === 'department' || key === 'requestingOfficerDepartment') && typeof getDepartmentFullName === 'function') {
          replacement = getDepartmentFullName(replacement, agencyDataStore);
      }
      const field = form.fields?.find(f => f.name === key);
      
      // DEBUG: Log coroner field replacements
      if (['coronerRank', 'coronerEmployee', 'coronerBadge'].includes(key)) {
        console.log(`[useBbcodeGenerator] Replacing ${placeholder}: value="${value}", replacement="${replacement}", fieldFound=${!!field}`);
      }
      
      if (field) {
          if (field.type === "medicine_block" && typeof value === 'object' && value !== null) {
              const prescribedText = value.prescribed || '';
              const proofImages = Array.isArray(value.proof) ? value.proof.map(url => `[img]${url}[/img]`).join('\n') : '';
              replacement = prescribedText;
              if (proofImages) {
                  replacement += `\n\n[b]Proof of Prescription:[/b]\n${proofImages}`;
              }
          }
          else if ((field.type === "image" || field.type === "image_upload")) {
              const formatItem = (item) => (typeof item === 'string' && /\.(jpg|jpeg|png|gif|webp)$/i.test(item.trim())) ? `[img]${item}[/img]` : (item || '');
              replacement = Array.isArray(value) ? value.map(formatItem).filter(Boolean).join('\n') : formatItem(value);
              
              if (key === 'scenePhotosBBCode' && values.scenePhotosBBCode_missing_bug) {
                  replacement = replacement ? `${replacement}\n\n(( Scene Photos are unavailable due to a bug with screenshot capture software ))` : `(( Scene Photos are unavailable due to a bug with screenshot capture software ))`;
              }
          }
          else if (field.type === "checkbox" && typeof value === "boolean") replacement = value ? "Yes" : "No";
          else if (field.type === "body_tampered" && typeof value === "boolean") replacement = value ? "Yes" : "No";
          else if (field.type === "multi_select" && Array.isArray(value)) replacement = value.join(", ");
          else if (field.type === "dynamic_text_list" && Array.isArray(value)) {
              const items = value.filter(val => val && String(val).trim() !== "");
              if (items.length > 0) {
                  const listOpen = (field.listType && field.listType !== "" && field.listType !== "none") ? `[list=${field.listType}]` : "[list]";
                  replacement = field.listType === "none" ? items.join("\n") : `${listOpen}\n[*]${items.join("\n[*]")}\n[/list]`;
              } else replacement = "";
          }
          else if (["dateTime", "pronouncedTimeOfDeath"].includes(field.name)) replacement = String(value).split("T")[0] || String(value);
          else if (field.name === "formattedDateOfDeath") replacement = formatToMMM_DD_YYYY(value);
          else if (field.name === "caseNumber") {
              const url = String(value).trim();
              const caseId = parseCaseNumber(url);
              replacement = (url.startsWith('http') && caseId) ? `[url=${url}]${caseId}[/url]` : (caseId || url);
          }
      }        
      bbcode = bbcode.replace(new RegExp(placeholder.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "g"), replacement);
  });

  // Directly replace {{originalKey}} with the computed finalTitle before other substitutions
  // This ensures the report spoiler has the correct title
  if (finalTitle) {
    bbcode = bbcode.replace(/\{\{originalKey\}\}/g, finalTitle);
  }

  // Add the generated title to context as well for any other uses
  ctx.originalKey = finalTitle;

  bbcode = bbcode.replace(/{{(.+?)}}/g, (match, expr) => {
    const trimmed = expr.trim();
    // Preserve patientID placeholder for the bot to fill later
    if ((trimmed === 'patientID' || trimmed === 'PATIENT_ID' || trimmed === 'patientId') && (!ctx[trimmed] || ctx[trimmed] === '')) {
        return match;
    }
    if (trimmed.includes(":") && !/[+\-*/()=?<>!&|]/g.test(trimmed)) return trimmed;
    try {
      const fn = new Function('ctx', 'getDepartmentFullName', 'agencyDataStore', 'generateDecedentBBCode', `with (ctx) { return ${trimmed}; }`);
      const result = fn(ctx, getDepartmentFullName, agencyDataStore, generateDecedentBBCode);
      if (typeof result === 'object' && result !== null && Object.prototype.hasOwnProperty.call(result, 'confirmedAt')) return String(result.confirmedAt);
      return Array.isArray(result) ? result.join(", ") : String(result || "");
    } catch (e) { return ""; }
  });

  const isCoronerEmailFinal = form.name === "Coroner Email" || form.id === "coroner_email";
  if (isCoronerEmailFinal) {
      console.log('[CoronerEmailTitleDebug] Original finalTitle:', finalTitle);
      if (bbcode.includes('[bold]') || bbcode.includes('[/bold]')) {
          bbcode = bbcode.replace(/\[bold\]/gi, '[b]').replace(/\[\/bold\]/gi, '[/b]');
      }
  }

  // DEBUG: Check if coronerRank/coronerEmployee/coronerBadge placeholders still exist
  const unreplacedPlaceholders = bbcode.match(/\{\{(coroner[A-Za-z]+)\}\}/g) || [];
  if (unreplacedPlaceholders.length > 0) {
    console.warn('[useBbcodeGenerator] Unreplaced coronerRank/coronerEmployee/coronerBadge placeholders:', unreplacedPlaceholders);
  }

  return { bbcode, finalTitle, originalKey: ctx.originalKey };
}