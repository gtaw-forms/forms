// src/hooks/useBbcodeGenerator.js
import { useState, useCallback } from 'react';
import * as Sentry from "@sentry/react";
import { getDepartmentFullName } from '../utils/bbcodeHelpers';
import generateDecedentBBCode from '../phmc-bbcode-generators/generateMassFatality';
import { renderBbcode } from '../utils/bbcodeRenderer';
import { formatCharacterNameForDisplay, resolveEmployeeCredentials, getOAuthShapeFlags } from '../utils/identityUtils';
import { cleanRankText } from '../utils/textUtils';

const useBbcodeGenerator = (selectedForm, formValues, finalSelectOptions, agencyDataStore, gtaWorldUser, factionsData, factionListData = [], resolvedCredentials = null) => {
  const [generatedBBCode, setGeneratedBBCode] = useState("");
  const [generatedTitle, setGeneratedTitle] = useState("");
  const [showBBCode, setShowBBCode] = useState(false);
  // const [limitWarning, setLimitWarning] = useState("");

  const generateBBCode = useCallback(() => {
    if (!selectedForm?.template) {
      setGeneratedBBCode("");
      setGeneratedTitle(""); 
      // setLimitWarning("");
      return;
    }

    const performGeneration = (decedentsOverride = null) => {
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

      // Delegate the entire render pipeline to the extracted pure core (Stage
      // T2-B). All enrichment (credential fill, local defaults, currentYear,
      // placeholder init, decedent normalization) is complete above; renderBbcode
      // reproduces the exact substitution + title logic that used to be inline.
      const { bbcode, finalTitle, originalKey } = renderBbcode({
        template: selectedForm.template,
        form: {
          name: selectedForm.name,
          id: selectedForm.id,
          firebaseKey: selectedForm.firebaseKey,
          fields: selectedForm.fields,
          titleGeneratorCode: selectedForm.titleGeneratorCode,
        },
        values: processedFormValues,
        coronerInfo,
        agencyDataStore,
        deps: {
          getDepartmentFullName,
          generateDecedentBBCode,
          year: new Date().getFullYear(),
        },
      });

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
              generated_title: originalKey || null,
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
  }, [selectedForm, formValues, agencyDataStore, gtaWorldUser, factionsData, factionListData, resolvedCredentials]);

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