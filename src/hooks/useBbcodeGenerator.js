// src/hooks/useBbcodeGenerator.js
import { useState, useCallback } from 'react';
import { getUtcFormattedDateTime } from '../utils/dateTimeUtils';
import { getDepartmentFullName } from '../utils/bbcodeHelpers';
import generateDecedentBBCode from '../phmc-bbcode-generators/generateMassFatality';
import { formatCharacterNameForDisplay } from '../utils/characterUtils';

const useBbcodeGenerator = (selectedForm, formValues, finalSelectOptions, agencyDataStore, gtaWorldUser, factionsData) => {
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
                    rank: member.rank || 'Staff',
                    member
                };
            }
          }
        }
        return null;
      };

      // Check if we're in a local environment
      const isLocalInstance = !gtaWorldUser || !gtaWorldUser.faction?.firstname;

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
          const match = findMemberAcrossFactions(processedValue);
          if (match) {
            acc[key] = `${match.rank} ${formatCharacterNameForDisplay(processedValue)} (SN: ${match.sn})`;
          } else {
            acc[key] = formatCharacterNameForDisplay(processedValue);
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

      // DEBUG: Log local instance detection and processed values
      console.log('[useBbcodeGenerator] isLocalInstance:', isLocalInstance);
      console.log('[useBbcodeGenerator] formValues input:', formValues);
      console.log('[useBbcodeGenerator] processedFormValues:', processedFormValues);
      console.log('[useBbcodeGenerator] coronerRank:', processedFormValues.coronerRank);
      console.log('[useBbcodeGenerator] coronerEmployee:', processedFormValues.coronerEmployee);
      console.log('[useBbcodeGenerator] coronerBadge:', processedFormValues.coronerBadge);

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

      if ((selectedForm?.name === 'Coroner Report' || selectedForm?.id === 'death-record') && !processedFormValues.placeOfDeath) {
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
      console.log('[useBbcodeGenerator] Template has coroner placeholders:', { hasCoronerRank, hasCoronerEmployee, hasCoronerBadge });
      
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
        let decedentName = processedFormValues.decedentName || processedFormValues.patientName || "UNKNOWN DECEDENT";
        const decedentOOC = processedFormValues.decedentOOC || "N/A";
        const cleanedDecedentNameMatch = String(decedentName).match(/^(.*?)(?:\s*\(.*|\s*\[.*)/);
        if (cleanedDecedentNameMatch && cleanedDecedentNameMatch[1]) {
          decedentName = cleanedDecedentNameMatch[1].trim();
        }
        finalTitle = `[Death-Report] - ${decedentName} ((${decedentOOC}))`;
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
      else if (selectedForm.firebaseKey === 'death-record' || selectedForm.id === 'death-record' || selectedForm.name === 'Death Record') {
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
          isSelected = comparisonValue.map(v => String(v).trim()).includes(option);
        } else {
          isSelected = String(comparisonValue || '').trim() === option;
        }
        return `${isSelected ? `[cbc]` : `[cb]`} ${option}${newline || ''}`;
      });

      bbcode = bbcode.replace(/\[cb:([^\]]+)\]/gi, (match, fieldName) => {
        const value = processedFormValues[fieldName.trim()];
        return (value && (!Array.isArray(value) || value.length > 0)) ? "[cbc]" : "[cb]";
      });

      bbcode = bbcode.replace(/\[conditional\s+field=["']?([^"'\]\s]+)["']?\](.*?)\[\/conditional\]/gis, (match, fieldName, inner) => {
        const currentValue = processedFormValues[fieldName.trim()];
        let conditionMet = (typeof currentValue === 'object' && currentValue !== null && Object.prototype.hasOwnProperty.call(currentValue, 'confirmedAt')) ? !!currentValue.confirmedAt : !!currentValue;
        return conditionMet ? inner.trim() : '';
      });

      bbcode = bbcode.replace(/\[conditional\s+field=["']?([^"'\]\s]+)["']?\s+value=["']?([^"'\]]+)["']?\](.*?)\[\/conditional\]/gis, (match, fieldName, expectedValue, inner) => {
        const actualValue = processedFormValues[fieldName.trim()];
        const expected = expectedValue.trim();
        const conditionMet = Array.isArray(actualValue) ? actualValue.map(v => String(v)).includes(String(expected)) : String(actualValue) == String(expected);
        return conditionMet ? inner.trim() : '';
      });
      
      // Handle additional reports by combining them into the deathReport placeholder
      console.log('[BBCodeDebug] Checking for additional reports. Found:', processedFormValues.additionalReports);
      let deathReportContent = processedFormValues.deathReport || '';
      if (Array.isArray(processedFormValues.additionalReports) && processedFormValues.additionalReports.length > 0) {
        const additionalReportsBBCodes = processedFormValues.additionalReports.map(report => {
            let bbCodeContent = typeof report === 'string' ? report : report.bbCode;
            const originalKey = typeof report === 'string' ? 'Additional Report' : (report.originalKey || 'Additional Report');

            // If the attached report is itself a Coroner Email, extract the core report content
            // Assuming `coroner_email` is the formId for Coroner Email forms.
            if (report.formId === 'coroner_email' || report.formId === 'coroner-email') { // Handle both potential 'id' and 'firebaseKey'
                // Regex to find the content within specific altspoilers that typically contain the actual report
                const reportSpoilerMatch = bbCodeContent.match(/\[altspoiler=(?:Coroner Report|DEATH INVESTIGATION REPORT|MASS FATALITY REPORT|Death Record|Mass Fatality)\]([\s\S]*?)\[\/altspoiler\]/i);
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

            const spoiler = `[altspoiler=${originalKey}]\n${bbCodeContent}\n[/altspoiler]`;
            console.log(`[BBCodeDebug] Generated spoiler for key "${originalKey}"`);
            return spoiler;
        }).join('\n\n');
        console.log('[BBCodeDebug] All additional reports processed into BBCode:', additionalReportsBBCodes);
        deathReportContent = [deathReportContent, additionalReportsBBCodes].filter(Boolean).join('\n\n');
      }
      processedFormValues.deathReport = deathReportContent;
      console.log('[BBCodeDebug] Final deathReport content:', deathReportContent);

      bbcode = bbcode.replace(/\{\{([a-zA-Z0-9_]+)\|((?:(?!}}).)+)\}\}/g, (match, key, placeholderText) => {
          const value = processedFormValues[key];
          const isEmpty = value === null || value === undefined || value === '' || value === false || (Array.isArray(value) && value.length === 0);
          if (isEmpty) return placeholderText;
          
          let replacement = String(value);
          const field = selectedForm.fields?.find(f => f.name === key);
          if (field) {
              if ((field.type === "image" || field.type === "image_upload") && value) {
                  const formatItem = (item) => (typeof item === 'string' && /\.(jpg|jpeg|png|gif|webp)$/i.test(item.trim())) ? `[img]${item}[/img]` : (item || '');
                  replacement = Array.isArray(value) ? value.map(formatItem).filter(Boolean).join('\n') : formatItem(value);
              }
              else if (field.type === "checkbox" && typeof value === "boolean") replacement = value ? "Yes" : "No";
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
          let replacement = String(value ?? '');
          const field = selectedForm.fields?.find(f => f.name === key);
          
          // DEBUG: Log coroner field replacements
          if (['coronerRank', 'coronerEmployee', 'coronerBadge'].includes(key)) {
            console.log(`[useBbcodeGenerator] Replacing ${placeholder}: value="${value}", replacement="${replacement}", fieldFound=${!!field}`);
          }
          
          if (field) {
              if ((field.type === "image" || field.type === "image_upload") && value) {
                  const formatItem = (item) => (typeof item === 'string' && /\.(jpg|jpeg|png|gif|webp)$/i.test(item.trim())) ? `[img]${item}[/img]` : (item || '');
                  replacement = Array.isArray(value) ? value.map(formatItem).filter(Boolean).join('\n') : formatItem(value);
              }
              else if (field.type === "checkbox" && typeof value === "boolean") replacement = value ? "Yes" : "No";
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
        if (trimmed.includes(":") && !/[+\-*/()=?<>!&|]/g.test(trimmed)) return trimmed;
        try {
          const fn = new Function('ctx', 'getDepartmentFullName', 'agencyDataStore', 'generateDecedentBBCode', `with (ctx) { return ${trimmed}; }`);
          const result = fn(ctx, getDepartmentFullName, agencyDataStore, generateDecedentBBCode);
          if (typeof result === 'object' && result !== null && Object.prototype.hasOwnProperty.call(result, 'confirmedAt')) return String(result.confirmedAt);
          return Array.isArray(result) ? result.join(", ") : String(result || "");
        } catch (e) { return ""; }
      });

      const isCoronerEmailFinal = selectedForm.name === "Coroner Email" || selectedForm.id === "coroner_email";
      if (isCoronerEmailFinal && (bbcode.includes('[bold]') || bbcode.includes('[/bold]'))) {
          bbcode = bbcode.replace(/\[bold\]/gi, '[b]').replace(/\[\/bold\]/gi, '[/b]');
      }

      // DEBUG: Check if coronerRank/coronerEmployee/coronerBadge placeholders still exist
      const unreplacedPlaceholders = bbcode.match(/\{\{(coroner[A-Za-z]+)\}\}/g) || [];
      if (unreplacedPlaceholders.length > 0) {
        console.warn('[useBbcodeGenerator] Unreplaced coronerRank/coronerEmployee/coronerBadge placeholders:', unreplacedPlaceholders);
      }

      return { bbcode, finalTitle };
    };

    const { bbcode, finalTitle } = performGeneration();

    setShowBBCode(true);
    setGeneratedBBCode(bbcode);
    setGeneratedTitle(finalTitle);
  }, [selectedForm, formValues, finalSelectOptions, agencyDataStore, gtaWorldUser, factionsData]);

  return {
    generatedBBCode,
    generatedTitle,
    showBBCode,
    setShowBBCode,
    generateBBCode,
    // limitWarning
  };
};


export default useBbcodeGenerator;