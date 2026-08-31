// src/hooks/useBbcodeGenerator.js
import { useState, useCallback } from 'react';
import * as Sentry from "@sentry/react";
import { getDepartmentFullName } from '../utils/bbcodeHelpers';
import generateDecedentBBCode from '../phmc-bbcode-generators/generateMassFatality';
import { formatCharacterNameForDisplay, resolveEmployeeCredentials, getOAuthShapeFlags } from '../utils/identityUtils';
import { cleanRankText } from '../utils/textUtils';

const useBbcodeGenerator = (selectedForm, formValues, finalSelectOptions, agencyDataStore, gtaWorldUser, factionsData, factionListData = [], resolvedCredentials = null) => {
  const [generatedBBCode, setGeneratedBBCode] = useState("");
  const [generatedTitle, setGeneratedTitle] = useState("");
  const [showBBCode, setShowBBCode] = useState(false);
  // const [limitWarning, setLimitWarning] = useState("");

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
  };  const parseCaseNumber = (url) => {
    if (!url) return '';
    // Try to match phpBB t= parameter first
    const tMatch = url.match(/[?&]t=(\d+)/);
    if (tMatch) return tMatch[1];
    
    const match = url.match(/\d+$/);
    return match ? match[0] : '';
  };

  const generateBBCode = useCallback(() => {
    if (!selectedForm?.template) {
      setGeneratedBBCode("");
      setGeneratedTitle(""); 
      // setLimitWarning("");
      return;
    }

    const performGeneration = (decedentsOverride = null) => {
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

      // Helper to find a member in factionsData across all factions
      const findMemberAcrossFactions = (name) => {
        if (!factionsData) return null;
        for (const faction of Object.values(factionsData)) {
          if (faction.members) {
            const entry = Object.entries(faction.members).find(([, m]) => m.characterName === name || m.name === name);
            if (entry) {
                const [sn, member] = entry;
                return {
                    sn: sn !== 'undefined' ? sn : (member.badge || member.characterId || member.ucpId || 'N/A'),
                    rank: (member.rank || 'Staff').replace(/^\s*[-–—]\s*|\s*[-–—]\s*$/g, '').replace(/\s{2,}/g, ' ').trim(),
                    member
                };
            }
          }
        }
        return null;
      };

      // Check if we're in a local environment.
      // Previously checked !gtaWorldUser.faction?.firstname, but the OAuth faction
      // object never carries a firstname field (it only has characterId/characterName/
      // rank/scriptRank), so that check was true for every real login and stamped
      // LocalEmployee/LocalRank onto empty coroner fields. Only treat the app as a
      // "local instance" when running on a dev host WITHOUT any GTAW auth.
      const isLocalDevHost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
      const isLocalInstance = isLocalDevHost && !gtaWorldUser;

      // Comprehensive diagnostic for the historical "LocalEmployee" bug.
      // Captures the exact session/faction/form state whenever an authenticated,
      // non-dev user would hit the local fallback or ends up with empty coroner
      // credentials at BBCode generation, so we can trace why the credential sync
      // failed to populate the form.
      const captureCoronerCredentialDiagnostic = (reason, extra = {}) => {
        try {
          if (isLocalDevHost) {
            console.warn(`[BBCode] ${reason} (dev host, not sent to Sentry)`, extra);
            return;
          }
          const faction = gtaWorldUser?.faction || null;
          const oauthShape = getOAuthShapeFlags(gtaWorldUser);
          const rootChars = gtaWorldUser?.character || gtaWorldUser?.characters;
          const userDataChars = gtaWorldUser?.userData?.character || gtaWorldUser?.userData?.characters;
          const firstChar = (Array.isArray(rootChars) && rootChars[0])
            || (Array.isArray(userDataChars) && userDataChars[0])
            || null;
          const firstCharData = firstChar?.character || firstChar;
          Sentry.captureMessage(`[BBCode] ${reason}`, {
            level: 'error',
            tags: {
              bbcode_diagnostic: 'coroner_credentials',
              reason,
              has_gtaw_user: String(!!gtaWorldUser),
              has_faction: String(!!faction),
              is_faction_member: String(oauthShape.isFactionMember ?? 'unknown'),
              login_role: oauthShape.loginRole || 'unknown',
            },
            extra: {
              source: 'useBbcodeGenerator',
              form_id: selectedForm?.id || selectedForm?.firebaseKey || null,
              form_name: selectedForm?.name || null,
              access_type: selectedForm?.accessType || null,
              hostname: window.location.hostname,
              faction_keys: faction ? Object.keys(faction) : null,
              faction_character_name: faction?.characterName || null,
              faction_character_id: faction?.characterId ?? faction?.id ?? null,
              faction_has_firstname: faction ? String('firstname' in faction) : 'no-faction',
              faction_rank: faction?.rank || null,
              faction_script_rank: faction?.scriptRank ?? null,
              oauth_username: gtaWorldUser?.username || null,
              account_id: oauthShape.accountId,
              has_active_character: String(oauthShape.activeCharacterPresent),
              active_character_name: gtaWorldUser?.activeCharacter?.characterName || null,
              has_character_array: String(oauthShape.hasCharacterArray),
              has_user_data_character_array: String(oauthShape.hasUserDataCharacterArray),
              has_all_faction_characters: String(oauthShape.hasAllFactionCharacters),
              first_character_name: firstCharData?.name || firstCharData?.characterName || (firstCharData ? `${firstCharData.firstname || ''} ${firstCharData.lastname || ''}`.trim() : null),
              first_character_id: firstCharData?.id ?? firstCharData?.characterId ?? null,
              roster_count: Array.isArray(factionListData) ? factionListData.length : 0,
              form_coroner_employee: formValues?.coronerEmployee || null,
              form_coroner_rank: formValues?.coronerRank || null,
              form_coroner_badge: formValues?.coronerBadge || null,
              form_coroner_first_name: formValues?.coronerFirstName || null,
              form_coroner_last_name: formValues?.coronerLastName || null,
              form_phmc_employee: formValues?.phmcEmployee || null,
              form_phmc_rank: formValues?.phmcRank || null,
              form_phmc_badge: formValues?.phmcBadge || null,
              ...extra,
            },
          });
        } catch (e) {
          console.error('[BBCode] Failed to capture coroner credential diagnostic:', e);
        }
      };

      // After the template substitution the only way the local placeholders can
      // survive is a genuinely empty set of coroner credentials on a real login —
      // capture the state so the next occurrence is fully diagnosable.
      const isCoronerForm = selectedForm?.name?.toLowerCase().includes('coroner')
        || selectedForm?.name?.toLowerCase().includes('death')
        || selectedForm?.name?.toLowerCase().includes('mass fatality');

      // Process formValues to extract primitive values from select objects and format employee names
      const processedFormValues = Object.entries(formValues).reduce((acc, [key, value]) => {
        // Find the field definition from selectedForm.fields
        const fieldDef = selectedForm.fields?.find(f => f.name === key);
        
        // Define common employee-related field names that should always be formatted if they are strings
        const commonEmployeeFields = ['coronerEmployee', 'phmcEmployee', 'employeeName', 'selectEmployee', 'investigator', 'requestingOfficer'];
        
        // For local instances, use default template data for coroner-related fields
        let processedValue = value;
        if (isLocalInstance) {
          if (key === 'coronerRank' && (!value || value === '')) {
            processedValue = 'LocalRank';
          } else if (key === 'coronerEmployee' && (!value || value === '')) {
            processedValue = 'LocalEmployee';
          } else if (key === 'coronerBadge' && (!value || value === '')) {
            processedValue = 'LocalBadge';
          } else if (key === 'phmcRank' && (!value || value === '')) {
            processedValue = 'LocalRank';
          } else if (key === 'phmcEmployee' && (!value || value === '')) {
            processedValue = 'LocalEmployee';
          }
        }

        if ((fieldDef?.type === 'employee_select' || commonEmployeeFields.includes(key)) && typeof processedValue === 'string') {
          if (/\(SN:/i.test(processedValue)) {
            // Already rendered in the standard identity format — never re-wrap.
            acc[key] = processedValue.trim();
          } else {
            const match = findMemberAcrossFactions(processedValue);
            const displayName = formatCharacterNameForDisplay(processedValue);
            if (match) {
              acc[key] = `${match.rank} ${displayName} (SN: ${match.sn})`;
            } else {
              // Fallback: the standard format is king even when the roster
              // lookup misses (factionsData not loaded yet / name mismatch).
              // Rebuild the identity from the form's sibling credential fields,
              // then from the authoritative OAuth/roster resolver (same source
              // the save-time backfill uses) when those are blank — so a
              // "Performed by" line never ships a bare name.
              const siblingRankKey = { coronerEmployee: 'coronerRank', phmcEmployee: 'phmcRank' }[key] || `${key}Rank`;
              const siblingBadgeKey = { coronerEmployee: 'coronerBadge', phmcEmployee: 'phmcBadge' }[key] || `${key}Badge`;
              const pick = (v) => {
                if (v == null) return '';
                if (typeof v === 'object') return (v && (v.value || v.label)) || '';
                return String(v);
              };
              let cleanedRank = cleanRankText(pick(formValues[siblingRankKey]));
              let badge = pick(formValues[siblingBadgeKey]);
              // Only attribute the signed-in ME's OWN identity (coronerEmployee /
              // phmcEmployee) to their own fields — NEVER to requestingOfficer /
              // investigator / etc., or the ME's rank+SN get stamped onto another
              // person's name (e.g. "Coroner Investigator Supervisor Catalina Romero
              // (SN: 159303)").
              const isOwnIdentity = key === 'coronerEmployee' || key === 'phmcEmployee';
              if (isOwnIdentity && (!cleanedRank || !badge)) {
                // Prefer the render-time resolved-credentials memo (the same
                // authoritative resolver the save-time backfill uses — proven to
                // match), then fall back to a fresh resolve.
                if (resolvedCredentials?.employeeName) {
                  if (!cleanedRank) cleanedRank = cleanRankText(resolvedCredentials.rank);
                  if (!badge) badge = String(resolvedCredentials.badge || '');
                }
                if (!cleanedRank || !badge) {
                  const resolved = resolveEmployeeCredentials(gtaWorldUser, { factionListData, cleanRank: cleanRankText });
                  if (resolved?.employeeName) {
                    if (!cleanedRank) cleanedRank = cleanRankText(resolved.rank);
                    if (!badge) badge = String(resolved.badge || '');
                  }
                  if (!cleanedRank || !badge) {
                    console.warn(`[BBCode] ${key} degraded to bare name — resolved.employeeName=${resolved?.employeeName || 'null'} matchedBy=${resolved?.matchedBy || 'n/a'} rosterSize=${(factionListData || []).length} user=${gtaWorldUser ? 'present' : 'null'}`);
                  }
                }
              }
              acc[key] = cleanedRank
                ? (badge ? `${cleanedRank} ${displayName} (SN: ${badge})` : `${cleanedRank} ${displayName}`)
                : displayName;
            }
          }
        } else if (fieldDef && fieldDef.type === 'multi_employee_select' && Array.isArray(processedValue)) {
          acc[key] = processedValue.map(name => {
            const match = findMemberAcrossFactions(name);
            if (match) {
              return `${match.rank} ${formatCharacterNameForDisplay(name)} (SN: ${match.sn})`;
            }
            return formatCharacterNameForDisplay(name);
          }).join(', ');
        } else if (
          typeof processedValue === 'object' &&
          processedValue !== null &&
          !Array.isArray(processedValue) && 
          Object.prototype.hasOwnProperty.call(processedValue, 'value') &&
          Object.prototype.hasOwnProperty.call(processedValue, 'label')
        ) {
          acc[key] = processedValue.value;
        } else {
          acc[key] = processedValue;
        }
        return acc;
      }, {});


      // Add currentYear to processedFormValues for easy templating
      processedFormValues.currentYear = new Date().getFullYear();

      // Ensure all template variables are initialized
      const placeholders = new Set(selectedForm.template.match(/\{\{([a-zA-Z0-9_]+)\}\}/g)?.map(p => p.replace(/[{}]/g, '')) || []);
      placeholders.forEach(key => {
        if (processedFormValues[key] === undefined) {
          processedFormValues[key] = '';
        }
      });

      // For local instances, fill in coroner defaults if they're not provided
      if (isLocalInstance) {
        if (!processedFormValues.coronerRank || processedFormValues.coronerRank === '') {
          processedFormValues.coronerRank = 'LocalRank';
        }
        if (!processedFormValues.coronerEmployee || processedFormValues.coronerEmployee === '') {
          processedFormValues.coronerEmployee = 'LocalEmployee';
        }
        if (!processedFormValues.coronerBadge || processedFormValues.coronerBadge === '') {
          processedFormValues.coronerBadge = 'LocalBadge';
        }
        console.log('[useBbcodeGenerator] Applied local instance defaults:', {
          coronerRank: processedFormValues.coronerRank,
          coronerEmployee: processedFormValues.coronerEmployee,
          coronerBadge: processedFormValues.coronerBadge
        });
      }

      // ── Last-chance credential fill (Fix B) ──
      // If an authenticated, non-dev user somehow reaches BBCode generation
      // with empty employee identity (credential-sync race or a stale
      // progression restore), resolve it here from OAuth + roster so a live
      // post never ships blanks. Uses the SAME resolver as the save path
      // (Fix C) so rank is cleaned and badge = roster key — no drift between
      // the preview and the saved/posted report (Fix D).
      if (gtaWorldUser && !isLocalInstance) {
        const empType = selectedForm?.accessType === 'Coroner' ? 'coroner' : 'phmc';
        const preEmployee = String(processedFormValues[`${empType}Employee`] || '').trim();
        const preRank = String(processedFormValues[`${empType}Rank`] || '').trim();
        const preBadge = String(processedFormValues[`${empType}Badge`] || '').trim();
        const needsName = !preEmployee;
        const needsRank = !preRank;
        const needsBadge = !preBadge;
        if (needsName || needsRank || needsBadge) {
          const resolved = resolveEmployeeCredentials(gtaWorldUser, {
            factionListData,
            cleanRank: cleanRankText,
          });
          const missingFields = [
            needsName && 'employee',
            needsRank && 'rank',
            needsBadge && 'badge',
          ].filter(Boolean);
          if (resolved.employeeName) {
            if (needsName) processedFormValues[`${empType}Employee`] = resolved.employeeName;
            if (needsRank) processedFormValues[`${empType}Rank`] = resolved.rank;
            if (needsBadge) processedFormValues[`${empType}Badge`] = resolved.badge;
            // Normalize a bare-name coronerEmployee into the standard identity
            // format. The reducer's employee fallback can degrade to a bare name
            // if the roster wasn't loaded at that moment; if we can resolve now,
            // stamp the rank + SN so mass-fatality/coroner reports never ship a
            // naked name (e.g. "The Sadie Voss, arrived…").
            const nameField = `${empType}Employee`;
            const curName = String(processedFormValues[nameField] || '').trim();
            if (curName && !/\(SN:/i.test(curName) && cleanRankText(resolved.rank)) {
              processedFormValues[nameField] =
                `${cleanRankText(resolved.rank)} ${curName}${resolved.badge ? ` (SN: ${resolved.badge})` : ''}`;
            }
            captureCoronerCredentialDiagnostic('CredentialFallbackApplied', {
              employee_type: empType,
              missing_fields: missingFields,
              form_values_before: {
                employee: preEmployee || null,
                rank: preRank || null,
                badge: preBadge || null,
              },
              matched_by: resolved.matchedBy,
              oauth_name: resolved.employeeName,
              oauth_character_id: resolved.oauthCharacterId || null,
              roster_key: resolved.rosterKey || null,
              roster_badge: resolved.badge || null,
              resolved_rank: resolved.rank || null,
              still_missing: [
                !String(processedFormValues[`${empType}Employee`] || '').trim() && 'employee',
                !String(processedFormValues[`${empType}Rank`] || '').trim() && 'rank',
                !String(processedFormValues[`${empType}Badge`] || '').trim() && 'badge',
              ].filter(Boolean),
            });
          } else {
            captureCoronerCredentialDiagnostic('CredentialFallbackFailed', {
              employee_type: empType,
              missing_fields: missingFields,
              form_values_before: {
                employee: preEmployee || null,
                rank: preRank || null,
                badge: preBadge || null,
              },
              matched_by: resolved.matchedBy,
              oauth_name: null,
              oauth_character_id: resolved.oauthCharacterId || null,
              roster_key: null,
              still_missing: missingFields,
            });
          }
        }
      }

      // Normalize decedents if it's an object-based array
      if (processedFormValues.decedents && typeof processedFormValues.decedents === 'object' && !Array.isArray(processedFormValues.decedents)) {
          processedFormValues.decedents = Object.values(processedFormValues.decedents);
      }
      
      // Apply override if provided
      if (decedentsOverride) {
          processedFormValues.decedents = decedentsOverride;
      }

      // Custom handling for request-medical-files form to inject OAuth names
      if (selectedForm?.id === 'request-medical-files' && gtaWorldUser) {
        let oauthFirstName = gtaWorldUser?.faction?.firstname || gtaWorldUser?.activeCharacter?.firstname || null;
        let oauthLastName = gtaWorldUser?.faction?.lastname || gtaWorldUser?.activeCharacter?.lastname || null;

        if ((!oauthFirstName || !oauthLastName) && processedFormValues.patientName) {
          const patientNameParts = String(processedFormValues.patientName).trim().split(' ');
          if (patientNameParts.length > 0) {
            oauthFirstName = patientNameParts[0];
            oauthLastName = patientNameParts.slice(1).join(' '); 
          }
        }

        if (oauthFirstName && !processedFormValues.patientFirstName) {
          processedFormValues.patientFirstName = oauthFirstName;
        }
        if (oauthLastName && !processedFormValues.patientLastName) {
          processedFormValues.patientLastName = oauthLastName;
        }
      }

      if ((selectedForm?.name === 'Coroner Report' || selectedForm?.id === 'death_record') && !processedFormValues.placeOfDeath) {
          if (Array.isArray(processedFormValues.decedents) && processedFormValues.decedents.length > 0) {
              const firstDecedent = processedFormValues.decedents[0];
              if (firstDecedent && firstDecedent.decedentLocation) {
                  processedFormValues.placeOfDeath = firstDecedent.decedentLocation;
              }
          }
      }

      let bbcode = selectedForm.template;
      let finalTitle = "";

      const ctx = { ...processedFormValues };
      ctx.formData = ctx;
      
      // DEBUG: Check template for coroner placeholders
      const hasCoronerRank = bbcode.includes('{{coronerRank}}');
      const hasCoronerEmployee = bbcode.includes('{{coronerEmployee}}');
      const hasCoronerBadge = bbcode.includes('{{coronerBadge}}');
      
      // Prepare coroner info for decedents generator
      // For local instances, use default template data if not provided
      const coronerInfo = {
        coronerRank: isLocalInstance 
          ? (processedFormValues.coronerRank || processedFormValues.phmcRank || 'LocalRank')
          : (processedFormValues.coronerRank || processedFormValues.phmcRank || 'Coroner'),
        coronerEmployee: isLocalInstance
          ? (processedFormValues.coronerEmployee || processedFormValues.phmcEmployee || processedFormValues.employeeName || 'LocalEmployee')
          : (processedFormValues.coronerEmployee || processedFormValues.phmcEmployee || processedFormValues.employeeName || 'Unknown Coroner')
      };

      ctx.generateDecedentBBCode = (arr) => generateDecedentBBCode(arr, coronerInfo);

      const decedents_bbcode = generateDecedentBBCode(processedFormValues.decedents, coronerInfo);
      bbcode = bbcode.replace('{{decedents_array_bbcode}}', decedents_bbcode);

      const addFallback = (src, target) => {
        // Only apply fallback if target is missing OR is an empty string (likely from placeholder initialization)
        if (processedFormValues[src] !== undefined && (ctx[target] === undefined || ctx[target] === '')) {
           ctx[target] = processedFormValues[src];
        }
      };
      addFallback('patientName', 'PatientName'); addFallback('PatientName', 'patientName');
      addFallback('employeeName', 'EmployeeName'); addFallback('EmployeeName', 'employeeName');
      addFallback('phmcEmployee', 'PHMCEmployee'); addFallback('PHMCEmployee', 'phmcEmployee');
      addFallback('coronerEmployee', 'CoronerEmployee'); addFallback('CoronerEmployee', 'coronerEmployee');

      if (selectedForm.name === "Coroner Email" || selectedForm.id === "coroner_email") {
        // Coroner Email title: use structured decedent data from attached report (set by useReportAttachment).
        // Falls back to regex-based title parsing for non-Version 11 reports.
        const decedentName = processedFormValues.decedentName || '';
        const decedentOOC = processedFormValues.decedentOOC || '';

        if (decedentName && decedentOOC) {
          const nameList = decedentName.split(',').map(n => n.trim()).filter(Boolean).join(', ');
          finalTitle = `Coroner Report - ${nameList} (( ${decedentOOC} ))`;
          console.log('[CoronerEmail] Title from structured data:', finalTitle);
        } else {
          // Flallback: parse names from attached report titles
          const collectedDecedents = [];
          const allOocNames = [];

        if (Array.isArray(processedFormValues.additionalReports) && processedFormValues.additionalReports.length > 0) {
          processedFormValues.additionalReports.forEach(report => {
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
                const oocContent = match.replace(/[\[\]()]/g, ''); // Remove brackets
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
        collectedDecedents.forEach(({ ic, ooc }) => {
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
      else if (selectedForm.firebaseKey === 'mass-ftality-test' || selectedForm.id === 'mass-fatality' || selectedForm.name?.toLowerCase().includes('mass fatality')) {
        const decedentCounts = {};
        let totalDecedents = 0;
        if (Array.isArray(processedFormValues.decedents)) {
          totalDecedents = processedFormValues.decedents.length;
          processedFormValues.decedents.forEach((d) => {
            const name = (d.decedentName || '').trim();
            if (name) {
              decedentCounts[name] = (decedentCounts[name] || 0) + 1;
            }
          });
        }
        const namesList = Object.entries(decedentCounts)
          .map(([n, c]) => c > 1 ? `${n} (x${c})` : n)
          .join(' | ') || 'No Decedents Listed';
        const dateStr = formatToNorthAmericanDate(processedFormValues.dateTime) || 'NO_DATE';
        
        const reportType = totalDecedents >= 4 ? 'Mass Fatality' : 'Multi Fatality';
        finalTitle = `[${reportType} Report] ${namesList} - ${dateStr}`;
      }
      else if (selectedForm.firebaseKey === 'death_record' || selectedForm.id === 'death_record' || selectedForm.name === 'Death Record') {
        const year = new Date().getFullYear();
        const caseNum = parseCaseNumber(processedFormValues.deathReportPostId) || parseCaseNumber(processedFormValues.caseNumber) || 'UNKNOWN';
        const name = processedFormValues.decedentName || 'UNKNOWN_NAME';
        const ooc = processedFormValues.decedentOOC || 'N/A';
        const dod = formatToMMM_DD_YYYY(processedFormValues.dateOfDeath || processedFormValues.dateTime || processedFormValues.formattedDateOfDeath);
        finalTitle = `[CASE #${year}-${caseNum}] ${name} ((${ooc})) | ${dod}`;
      }
      else if (selectedForm.titleGeneratorCode) {
        let workingTitle = selectedForm.titleGeneratorCode;
        selectedForm.fields?.forEach(field => {
          const placeholder = `{{${field.name}}}`;
          if (workingTitle.includes(placeholder)) {
            let value = processedFormValues[field.name] ?? "";
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
          '{{patientName}}': processedFormValues.patientName || processedFormValues.decedentName || "NO_NAME",
          '{{PatientName}}': processedFormValues.patientName || processedFormValues.decedentName || "NO_NAME",
          '{{phmcEmployee}}': processedFormValues.phmcEmployee || "",
          '{{date}}': formatToNorthAmericanDate(processedFormValues.dateTime || processedFormValues.date) || "NO_DATE",
          '{{year}}': new Date().getFullYear(),
        };
        Object.entries(fallbackTitleReplacements).forEach(([ph, val]) => {
          if (workingTitle.includes(ph)) {
            workingTitle = workingTitle.replace(new RegExp(ph.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), String(val));
          }
        });

        // Resolve [FORM_NAME] to the actual form name (some medical forms use it
        // as a title placeholder, e.g. "Consultation - Session Notes").
        if (workingTitle.includes('[FORM_NAME]')) {
          workingTitle = workingTitle.replace(/\[FORM_NAME\]/g, selectedForm.name || '');
        }
        finalTitle = workingTitle;
      }

      bbcode = bbcode.replace(/\[cb:([^\]]+)\]([^\r\n]*)(\r?\n)?/g, (match, fieldName, text, newline) => {
        const field = fieldName.trim();
        const option = text.trim();
        const value = processedFormValues[field];
        
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
        const value = processedFormValues[fieldName.trim()];
        return (value && (!Array.isArray(value) || value.length > 0)) ? "[cbc]" : "[cb]";
      });

      bbcode = bbcode.replace(/\[conditional\s+field=["']?([^"'\]\s]+)["']?(?:\s+value=["']?([^"'\]]+)["']?)?\](.*?)\[\/conditional\]/gis, (match, fieldName, expectedValue, inner) => {
        const actualValue = processedFormValues[fieldName.trim()];
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
      console.log('[BBCodeDebug] Checking for additional reports. Found:', processedFormValues.additionalReports);
      let deathReportContent = processedFormValues.deathReport || '';
      if (Array.isArray(processedFormValues.additionalReports) && processedFormValues.additionalReports.length > 0) {
        const additionalReportsBBCodes = processedFormValues.additionalReports.map(report => {
            const sanitizeSpoilerTitle = (title) => {
              if (!title) return 'Spoiler';
              return title.replace(/[\[\]()/]/g, '').trim();
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
      processedFormValues.deathReport = deathReportContent;

      bbcode = bbcode.replace(/\{\{([a-zA-Z0-9_]+)\|((?:(?!}}).)+)\}\}/g, (match, key, placeholderText) => {
          const value = processedFormValues[key];
          const isScenePhotosBug = key === 'scenePhotosBBCode' && processedFormValues.scenePhotosBBCode_missing_bug;
          const isEmpty = value === null || value === undefined || value === '' || value === false || (Array.isArray(value) && value.length === 0);
          
          if (isEmpty && !isScenePhotosBug) return placeholderText;
          
          let replacement = String(value);
          const field = selectedForm.fields?.find(f => f.name === key);
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

      Object.keys(processedFormValues).forEach(key => {
          const placeholder = `{{${key}}}`;
          if (!bbcode.includes(placeholder)) return;
          const value = processedFormValues[key];

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
          const field = selectedForm.fields?.find(f => f.name === key);
          
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
                  
                  if (key === 'scenePhotosBBCode' && processedFormValues.scenePhotosBBCode_missing_bug) {
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

      const isCoronerEmailFinal = selectedForm.name === "Coroner Email" || selectedForm.id === "coroner_email";
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

      // ── LocalEmployee / LocalRank diagnostic ──
      // Only meaningful for a real (authenticated, non-dev) user. Catches both the
      // root cause (empty coroner credentials despite a signed-in user) and any
      // local placeholder that somehow survives substitution.
      if (gtaWorldUser && isCoronerForm) {
        const hasLocalPlaceholder = bbcode.includes('LocalEmployee') || bbcode.includes('LocalRank') || bbcode.includes('LocalBadge');
        const hasEmptyCoronerIdentity = !processedFormValues.coronerEmployee
          && !processedFormValues.phmcEmployee
          && !processedFormValues.employeeName;
        if (hasLocalPlaceholder || hasEmptyCoronerIdentity) {
          captureCoronerCredentialDiagnostic(
            hasLocalPlaceholder ? 'LocalPlaceholderInGeneratedBBCode' : 'EmptyCoronerCredentialsAuthenticated',
            {
              has_local_employee: bbcode.includes('LocalEmployee'),
              has_local_rank: bbcode.includes('LocalRank'),
              has_local_badge: bbcode.includes('LocalBadge'),
              has_empty_coroner_identity: String(hasEmptyCoronerIdentity),
              final_title: finalTitle || null,
              generated_title: ctx?.originalKey || null,
            }
          );
        }
      }

      return { bbcode, finalTitle };
    };

    const { bbcode, finalTitle } = performGeneration();

    setShowBBCode(true);
    setGeneratedBBCode(bbcode);
    setGeneratedTitle(finalTitle);

    // Return the generated values so callers (e.g. Save & Queue) can use them synchronously
    return { bbcode, finalTitle };
  }, [selectedForm, formValues, finalSelectOptions, agencyDataStore, gtaWorldUser, factionsData, factionListData, resolvedCredentials]);

  const clearBBCode = useCallback(() => {
    setGeneratedBBCode("");
    setGeneratedTitle("");
    setShowBBCode(false);
  }, []);

  return {
    generatedBBCode,
    generatedTitle,
    showBBCode,
    setShowBBCode,
    generateBBCode,
    clearBBCode,
    // limitWarning
  };
};


export default useBbcodeGenerator;