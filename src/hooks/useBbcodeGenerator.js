// src/hooks/useBbcodeGenerator.js
import { useState, useCallback } from 'react';
import { getUtcFormattedDateTime } from '../utils/dateTimeUtils';
import { getDepartmentFullName } from '../utils/bbcodeHelpers';
import generateDecedentBBCode from '../phmc-bbcode-generators/generateMassFatality';

const useBbcodeGenerator = (selectedForm, formValues, finalSelectOptions, agencyDataStore) => {
  const [generatedBBCode, setGeneratedBBCode] = useState("");
  const [generatedTitle, setGeneratedTitle] = useState("");
  const [showBBCode, setShowBBCode] = useState(false);

  const generateBBCode = useCallback(() => {
    if (!selectedForm?.template) {
      setGeneratedBBCode("");
      setGeneratedTitle("");
      return;
    }

    console.log("--- BBCode Generation Triggered ---");
    console.log("Selected Form:", selectedForm.name);
    console.log("Form Values:", formValues);

    let bbcode = selectedForm.template;
    let title = "";

    // Evaluation context with fallbacks
    const ctx = { ...formValues };
    ctx.formData = ctx;

    const addFallback = (src, target) => {
      if (formValues[src] !== undefined && ctx[target] === undefined) {
        ctx[target] = formValues[src];
      }
    };
    addFallback('patientName', 'PatientName'); addFallback('PatientName', 'patientName');
    addFallback('employeeName', 'EmployeeName'); addFallback('EmployeeName', 'employeeName');
    addFallback('phmcEmployee', 'PHMCEmployee'); addFallback('PHMCEmployee', 'phmcEmployee');
    addFallback('coronerEmployee', 'CoronerEmployee'); addFallback('CoronerEmployee', 'coronerEmployee');

    // ──────────────────────────────────────────────────────────────
    // 1. SPECIAL CORONER EMAIL TITLE
    // ──────────────────────────────────────────────────────────────
    if (selectedForm.name === "Coroner Email" || selectedForm.id === "coroner_email") {
      const names = [];
      if (formValues.decedentName) names.push(formValues.decedentName.trim());
      if (!names.length && formValues.patientName) names.push(formValues.patientName.trim());
      if (Array.isArray(formValues.decedents)) {
        formValues.decedents.forEach(d => {
          const n = (d.name || d.decedentName || d.fullName || "").trim();
          if (n) names.push(n);
        });
      }
      const display = names.length ? names.join(", ") : "Unknown Decedent";
      const attached = Array.isArray(formValues.attachedReportTitles)
        ? formValues.attachedReportTitles.filter(Boolean)
        : [];
      const suffix = attached.length ? " — " + attached.join(" | ") : "";
      title = `[Coroner Email] ${display}${suffix}`;
      setGeneratedTitle(title);
    }

    // ──────────────────────────────────────────────────────────────
    // 2. TITLE GENERATION (Smart + DMEC aware)
    // ──────────────────────────────────────────────────────────────
    else if (selectedForm.titleGeneratorCode) {
      try {
        let rawTitle = selectedForm.titleGeneratorCode.trim();
        const cleanDate = formValues.dateTime?.split("T")[0] || new Date().toISOString().split("T")[0];
        const isDmec = selectedForm.category === "DMEC";

        const employeeName = isDmec
          ? (formValues.coronerEmployee || formValues.employeeName || "Unknown Coroner")
          : (formValues.phmcEmployee || formValues.employeeName || "Unknown Staff");

        const patientName = formValues.patientName || formValues.decedentName || "Unknown Patient";

        rawTitle = rawTitle
          .replace(/{{patientName}}/gi, patientName)
          .replace(/{{decedentName}}/gi, patientName)
          .replace(/{{employeeName}}/gi, employeeName)
          .replace(/{{coronerEmployee}}/gi, employeeName)
          .replace(/{{phmcEmployee}}/gi, employeeName)
          .replace(/{{date}}/gi, cleanDate)
          .replace(/{{typeOfDeath}}/gi, formValues.typeOfDeath || "Unknown");

        selectedForm.fields?.forEach(f => {
          const ph = `{{${f.name}}}`;
          if (rawTitle.includes(ph)) {
            const val = formValues[f.name] ?? "Unknown";
            rawTitle = rawTitle.replace(new RegExp(ph.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), String(val));
          }
        });

        rawTitle = rawTitle.replace(/{{[^}]+}}/g, "Unknown");
        title = rawTitle;
        setGeneratedTitle(title);
      } catch (err) {
        console.error("Title generation failed:", err);
        setGeneratedTitle(`${selectedForm.name} (Title Error)`);
      }
    } else {
      setGeneratedTitle(selectedForm.name || "Untitled Report");
    }

    // ──────────────────────────────────────────────────────────────
    // 3. CBC CHECKBOXES — RUN FIRST AND SAFE
    // ──────────────────────────────────────────────────────────────
    bbcode = bbcode.replace(/\[cb:([^\]]+)\]([^\[\]]*)/g, (match, fieldName, text) => {
      const field = fieldName.trim();
      const option = text.trim();
      if (!field || !option) return match;

      const value = formValues[field];

      if (Array.isArray(value)) {
        const selected = value.map(v => String(v).trim()).includes(option);
        return selected ? `[cbc] ${option}` : `[cb] ${option}`;
      }

      const selected = String(value || "").trim() === option;
      return selected ? `[cbc] ${option}` : `[cb] ${option}`;
    });

    bbcode = bbcode.replace(/\[cb:([^\]]+)\]/gi, (match, fieldName) => {
      const field = fieldName.trim();
      const value = formValues[field];
      const hasValue = value && (!Array.isArray(value) || value.length > 0);
      return hasValue ? "[cbc]" : "[cb]";
    });

    // ──────────────────────────────────────────────────────────────
    // 4. CONDITIONAL BLOCKS
    // ──────────────────────────────────────────────────────────────
    bbcode = bbcode.replace(/\[condition:([^\]]+)\](.*?)\[\/condition\]/gs, (match, condition, inner) => {
      const [field, expected] = condition.split('=').map(s => s.trim());
      const value = formValues[field];
      const met = Array.isArray(value)
        ? value.map(v => String(v).trim()).includes(expected)
        : String(value || "").trim() === expected;
      return met ? inner : '';
    });

    // ──────────────────────────────────────────────────────────────
    // 5. FIELD REPLACEMENT — SAFE PER-FIELD
    // ──────────────────────────────────────────────────────────────
    selectedForm.fields?.forEach(field => {
      const placeholder = `{{${field.name}}}`;
      if (!bbcode.includes(placeholder)) return;

      let value = formValues[field.name] ?? "";

      if (field.type === "image_upload" && value) value = `[img]${value}[/img]`;
      else if (field.type === "checkbox" && typeof value === "boolean") value = value ? "Yes" : "No";
      else if (field.type === "multi_select" && Array.isArray(value)) value = value.join(", ");
      else if (["dateTime", "pronouncedTimeOfDeath"].includes(field.name)) value = value.split("T")[0] || value;

      const escaped = placeholder.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      bbcode = bbcode.replace(new RegExp(escaped, "g"), String(value));
    });

    // ──────────────────────────────────────────────────────────────
    // 6. JS EXPRESSIONS — LAST
    // ──────────────────────────────────────────────────────────────
    bbcode = bbcode.replace(/{{(.+?)}}/g, (match, expr) => {
      const trimmed = expr.trim();
      if (trimmed.includes(":") && !/[+\-*/()]/g.test(trimmed)) return trimmed;

      try {
        const fn = new Function('ctx', 'getDepartmentFullName', 'agencyDataStore', 'generateDecedentBBCode',
          `with (ctx) { return ${trimmed}; }`
        );
        const result = fn(ctx, getDepartmentFullName, agencyDataStore, generateDecedentBBCode);
        return Array.isArray(result) ? result.join(", ") : String(result || "");
      } catch (e) {
        console.warn("Expression failed:", trimmed, e);
        return "";
      }
    });

    // ──────────────────────────────────────────────────────────────
    // FINAL OUTPUT
    // ──────────────────────────────────────────────────────────────
    setGeneratedBBCode(bbcode);
    setShowBBCode(true);
  }, [selectedForm, formValues, agencyDataStore]);

  return {
    generatedBBCode,
    generatedTitle,
    showBBCode,
    setShowBBCode,
    generateBBCode,
  };
};

export default useBbcodeGenerator;