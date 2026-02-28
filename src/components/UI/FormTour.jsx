import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import styles from './FormTour.module.css';

// --- Tour Data and Logic ---

const generalTourSteps = [
  { 
    title: "Welcome to PHMC!", 
    content: "This quick guide will show you how to navigate our automated form system.", 
    selector: '[data-tour="left-panel"]' 
  },
  { title: "Form Library", content: "This is your library. Search or browse for any PHMC form here.", selector: '[data-tour="left-panel"]' },
  { title: "Your Credentials", content: "This is your Employee Card. We sync your character data from GTA World. If you have multiple PHMC Characters, you can Swap Character here.", selector: '[data-tour="right-panel-top"]' },
  { title: "The Workspace", content: "Once a form is selected, you'll fill it out in this main area.", selector: '[data-tour="main-content"]' },
  { title: "Finish & Save", content: "Generate, preview, and copy your BBCode here. We automatically save a backup if you accidentially 'clear-form'.", selector: '[data-tour="right-panel-bottom"]' }
];

const sectionExplanations = {
  'coroner-report': [
    {
      title: "Scene Information",
      content: "Captures the 'when and where'. Record dispatch time and time of death.",
      selector: '[data-tour-id="sec-scene-info"], [data-tour-id="field-dt-dispatched"], [data-tour-id="field-dt-death"]'
    },
    {
      title: "Request Details",
      content: "Log which officer and department formally requested a copy of your report.",
      selector: '[data-tour-id="sec-request-details"], [data-tour-id="field-req-check"], [data-tour-id="field-req-dept"]'
    },
    {
      title: "Decedent Identification",
      content: "Identify the deceased. Use 'John/Jane Doe' for PKs, use IC name for CKs.",
      selector: '[data-tour-id="sec-decedent-id"], [data-tour-id="field-info-pkck"], [data-tour-id="field-dec-name"], [data-tour-id="field-dec-ooc"], [data-tour-id="field-dec-type"], [data-tour-id="field-dec-manner"]'
    },
    {
      title: "Investigation Findings",
      content: "Detail the location via the map button or provide a text area, cause of death, and a clear overview of the incident.",
      selector: '[data-tour-id="sec-findings"], [data-tour-id="field-find-place"], [data-tour-id="field-find-cause"], [data-tour-id="field-find-synopsis"]'
    },
    {
      title: "Evidence & Documentation",
      content: "If you've used the Evidence Locker, please add the EL# code here by checking the box, provide screenshots of the body, /cdamages, /cdna and a single photo of the morgue screen with the Decedent's information on it.",
      selector: '[data-tour-id="sec-evidence"], [data-tour-id="field-evid-locker"], [data-tour-id="field-evid-scene"], [data-tour-id="field-evid-morgue"], [data-tour-id="field-evid-notes"]'
    }
  ],
  'testing-compact-mode': [
    {
      title: "Basic Information",
      content: "Fill in the patient's basic identification and the date of the consultation.",
      selector: '[data-tour-id="field-1764264247509"], [data-tour-id="field-1764262583850"], [data-tour-id="field-1764262644561"], [data-tour-id="field-1764262715474"]'
    },
    {
      title: "Anamnesis",
      content: "Record the reason for the visit and the department the patient is assigned to.",
      selector: '[data-tour-id="field-1764264257565"], [data-tour-id="field-1764264315094"], [data-tour-id="field-1764264327870"]'
    },
    {
      title: "Vitals",
      content: "Input the patient's basic vital signs including Temperature, Heart Rate, Breathing, and Blood Pressure.",
      selector: '[data-tour-id="field-1764264338364"], [data-tour-id="field-1764265128726"], [data-tour-id="field-1764265143942"], [data-tour-id="field-1764265158022"], [data-tour-id="field-1764265166950"]'
    },
    {
      title: "Clinical Findings",
      content: "Document your clinical findings from general health condition to specific tests like ECG, Sono, and Lab Results.",
      selector: '[data-tour-id="field-1764265179293"], [data-tour-id="field-1764265197312"], [data-tour-id="field-1764265230341"], [data-tour-id="field-1764265237622"], [data-tour-id="field-1764265247309"], [data-tour-id="field-1764265271782"], [data-tour-id="field-1764265297446"], [data-tour-id="field-1764265309326"]'
    },
    {
      title: "Diagnosis & Therapy",
      content: "State the primary and secondary diagnoses, and outline the treatment plan including medications and follow-up.",
      selector: '[data-tour-id="field-1764265317038"], [data-tour-id="field-1764265330784"], [data-tour-id="field-1764265345782"], [data-tour-id="field-1764265359454"], [data-tour-id="field-1764265382941"], [data-tour-id="field-1767818058676"], [data-tour-id="field-1764265397807"]'
    }
  ],
  'er_protocol': [
    {
      title: "Basic Information",
      content: "Enter the Patient ID, date, and your current ER role.",
      selector: '[data-tour-id="field-1764461252697"], [data-tour-id="field-1764461198921"], [data-tour-id="field-1764461224258"], [data-tour-id="field-1764461239409"]'
    },
    {
      title: "Anamnesis",
      content: "Detail the chief complaint, mechanism of injury, and the severity index.",
      selector: '[data-tour-id="field-1764461266266"], [data-tour-id="field-1764461558361"], [data-tour-id="field-1764461575898"], [data-tour-id="field-1764461627298"]'
    },
    {
      title: "Vital Signs",
      content: "Record all essential patient vitals accurately.",
      selector: '[data-tour-id="field-1764461637434"], [data-tour-id="field-1764461662849"], [data-tour-id="field-1764461680298"], [data-tour-id="field-1764461703906"], [data-tour-id="field-1764461717978"]'
    },
    {
      title: "Clinical Findings",
      content: "Document findings from general health assessment, lung auscultation, and specific tests like ECG and Sono.",
      selector: '[data-tour-id="field-1764461724634"], [data-tour-id="field-1764461749146"], [data-tour-id="field-1764461762530"], [data-tour-id="field-1764461775467"], [data-tour-id="field-1764461791299"], [data-tour-id="field-1764461805218"], [data-tour-id="field-1764461814108"], [data-tour-id="field-1764461846483"]'
    },
    {
      title: "Diagnosis & Therapy",
      content: "State your diagnoses and the required therapy, including any admission details or medication.",
      selector: '[data-tour-id="field-1764461854403"], [data-tour-id="field-1764461871315"], [data-tour-id="field-1764461887346"], [data-tour-id="field-1764461922242"], [data-tour-id="field-1764461936299"], [data-tour-id="field-1764461947107"], [data-tour-id="field-1767820378257"], [data-tour-id="field-1764462010395"]'
    }
  ],
  'psych-eval': [
    {
      title: "Basic Information",
      content: "Start with the patient ID, date, and your current rank.",
      selector: '[data-tour-id="field-1764291987257"], [data-tour-id="field-1764292014920"], [data-tour-id="field-1764292068753"]'
    },
    {
      title: "Anamnesis & Presenting Problem",
      content: "Detail the chief complaint and provide a thorough description of the symptoms and stressors.",
      selector: '[data-tour-id="field-1764292080888"], [data-tour-id="field-1764292093900"], [data-tour-id="field-1764292104355"], [data-tour-id="field-1764292130104"], [data-tour-id="field-1764292142617"], [data-tour-id="field-1764292156385"], [data-tour-id="field-1764292167619"]'
    },
    {
      title: "Mental Status Examination",
      content: "Conduct a comprehensive mental status check covering appearance, behavior, speech, mood, and cognitive functions.",
      selector: '[data-tour-id="field-1764292173113"], [data-tour-id="field-1764292291570"], [data-tour-id="field-1764293276411"], [data-tour-id="field-1764293321090"], [data-tour-id="field-1764293337411"], [data-tour-id="field-1764293357986"], [data-tour-id="field-1764293382435"], [data-tour-id="field-1764293399123"], [data-tour-id="field-1764293424203"], [data-tour-id="field-1764293444036"]'
    },
    {
      title: "Histories",
      content: "Document the patient's psychiatric, medical, and substance use history.",
      selector: '[data-tour-id="field-1764293486267"], [data-tour-id="field-1764293481987"], [data-tour-id="field-1764293516571"], [data-tour-id="field-1764293533683"], [data-tour-id="field-1764293552931"], [data-tour-id="field-1764293563383"], [data-tour-id="field-1764293696004"], [data-tour-id="field-1764293707268"], [data-tour-id="field-1764293719604"], [data-tour-id="field-1764293724539"], [data-tour-id="field-1764293745980"], [data-tour-id="field-1764293757443"], [data-tour-id="field-1764293765259"]'
    },
    {
      title: "Psychosocial & Risk",
      content: "Evaluate psychosocial factors and perform a formal risk assessment.",
      selector: '[data-tour-id="field-1764293867780"], [data-tour-id="field-1764293880531"], [data-tour-id="field-1764293892763"], [data-tour-id="field-1764293909300"], [data-tour-id="field-1764293916555"], [data-tour-id="field-1764293928516"], [data-tour-id="field-1764293981444"], [data-tour-id="field-1764294013883"]'
    },
    {
      title: "Diagnosis & Therapy",
      content: "Complete the evaluation with findings, diagnosis, and a therapy/treatment plan.",
      selector: '[data-tour-id="field-1764294020147"], [data-tour-id="field-1764294039708"], [data-tour-id="field-1764294070868"], [data-tour-id="field-1764294085142"], [data-tour-id="field-1764294090775"], [data-tour-id="field-1764294125795"], [data-tour-id="field-1764294139492"], [data-tour-id="field-1764294232996"], [data-tour-id="field-1764294290453"], [data-tour-id="field-1764294335766"], [data-tour-id="field-1764294697229"], [data-tour-id="field-1764294708694"], [data-tour-id="field-1764294720909"], [data-tour-id="field-1764294729261"]'
    }
  ],
  'session_notes': [
    {
      title: "Basic Information",
      content: "Enter basic patient and session details.",
      selector: '[data-tour-id="field-1764289113499"], [data-tour-id="field-1764289123563"], [data-tour-id="field-1764289155850"], [data-tour-id="field-1764289211187"]'
    },
    {
      title: "Anamnesis & Findings",
      content: "Record the chief complaint and your session findings, including optional mental state details.",
      selector: '[data-tour-id="field-1764289368908"], [data-tour-id="field-1764289753989"], [data-tour-id="field-1764289761812"], [data-tour-id="field-1764289785364"], [data-tour-id="field-1765246022937-usuo5yb32"]'
    },
    {
      title: "Diagnosis & Therapy",
      content: "Finalize the notes with diagnosis, therapy, and follow-up requirements.",
      selector: '[data-tour-id="field-1764289796604"], [data-tour-id="field-1764290031141"], [data-tour-id="field-1764289831260"], [data-tour-id="field-1764289846548"], [data-tour-id="field-1764289889700"], [data-tour-id="field-1764289906077"], [data-tour-id="field-1764289922068"]'
    }
  ],
  'mass-ftality-test': {
    'sec-scene-info': "Capture the incident location and dispatch time of the mass casualty event.",
    'sec-request-details': "Log the department and officer who formally requested this mass fatality report.",
    'sec-findings': "Provide a detailed overview of the scene and your initial investigation findings.",
    'sec-decedent': "Identify and document each decedent found at the scene. You can add as many as needed."
  },
  'coroner_email': [
    {
      title: "Request Details",
      content: "Fill in the details of the officer and department requesting the report. Otherwise you can press 'next' to skip this section.",
      selector: '[data-tour-name="requestingOfficer"], [data-tour-name="department"]'
    },
    {
      title: "Attach Reports",
      content: "When you attach a report, it will automatically add the Requesting Officer and Department for you, just a quick and efficient process.",
      selector: '[data-tour-type="attach_report_button"] [data-tour-target="button"]'
    },
    {
      title: "Coroner Contact Info",
      content: "Your contact information (Phone & Discord) is automatically synced from your profile. (Both are optional, otherwise it'll default to PHMC default information.)",
      selector: '[data-tour-name="Coroner Contact Info "], [data-tour-name="coronerPHNumber"], [data-tour-name="coronerDiscord"]'
    }
  ],
  'er-protocol': {
    // Placeholders for ER Protocol
  }
};

const useTourSteps = (tourType, form) => {
  return useMemo(() => {
    if (tourType === 'general') {
      return generalTourSteps;
    }
    if (tourType === 'form-specific' && form) {
      const explanations = sectionExplanations[form.id];
      if (!explanations) return [];

      // If explanations is already an array of steps, use it directly
      if (Array.isArray(explanations)) return explanations;

      // Otherwise, auto-generate steps based on field mapping
      return (form.fields || [])
        .filter(field => explanations[field.id] || explanations[field.name] || explanations[field.type])
        .map(field => ({
          title: field.label || field.name,
          content: explanations[field.id] || explanations[field.name] || explanations[field.type],
          selector: `[data-tour-id="${field.id}"]`
        }));
    }
    return [];
  }, [tourType, form]);
};


// --- Tour Component ---

const FormTour = ({ tourType, selectedForm, onComplete, onSkip, showNotification }) => {
  const steps = useTourSteps(tourType, selectedForm);
  const [currentStep, setCurrentStep] = useState(0);
  const [spotlightStyle, setSpotlightStyle] = useState({ opacity: 0 });
  const [tooltipStyle, setTooltipStyle] = useState({ opacity: 0 });
  const tooltipRef = useRef(null);
  const lastTourKey = useRef(null);

  // Reset to the first step ONLY if the tour type or selected form changes
  useEffect(() => {
    const tourKey = `${tourType}-${selectedForm?.id || 'general'}`;
    if (lastTourKey.current !== tourKey) {
      setCurrentStep(0);
      lastTourKey.current = tourKey;
    }
  }, [tourType, selectedForm?.id]);

  // Handle case where no steps are found for a form-specific tour
  useEffect(() => {
    if (tourType === 'form-specific' && steps.length === 0 && selectedForm) {
      showNotification("No specific section guide is available for this form yet.", "warning");
      onComplete();
    }
  }, [steps.length, tourType, selectedForm, onComplete, showNotification]);

  const updatePosition = useCallback(() => {
    if (!steps || steps.length === 0) return;
    const step = steps[currentStep];
    if (!step) return;

    const elements = document.querySelectorAll(step.selector);

    if (elements.length > 0) {
      let rect;
      const padding = 8;

      if (tourType === 'form-specific' && elements.length === 1 && elements[0].getAttribute('data-tour-type') === 'section') {
        // Legacy "highlight entire section" logic for single section headers
        const element = elements[0];
        let elementsToHighlight = [element];
        let nextSibling = element.nextElementSibling;
        while (nextSibling) {
          if (nextSibling.getAttribute('data-tour-type') === 'section') break;
          elementsToHighlight.push(nextSibling);
          nextSibling = nextSibling.nextElementSibling;
        }

        const rects = elementsToHighlight
          .map(el => el.getBoundingClientRect())
          .filter(r => r.width > 0 && r.height > 0);

        if (rects.length > 0) {
          const top = Math.min(...rects.map(r => r.top));
          const left = Math.min(...rects.map(r => r.left));
          const right = Math.max(...rects.map(r => r.right));
          const bottom = Math.max(...rects.map(r => r.bottom));
          rect = { top, left, width: right - left, height: bottom - top, bottom, right };
        }
      } else {
        // Multi-element or specific element targeting
        const rects = Array.from(elements)
          .map(el => el.getBoundingClientRect())
          .filter(r => r.width > 0 && r.height > 0);

        if (rects.length > 0) {
          const top = Math.min(...rects.map(r => r.top));
          const left = Math.min(...rects.map(r => r.left));
          const right = Math.max(...rects.map(r => r.right));
          const bottom = Math.max(...rects.map(r => r.bottom));
          rect = { top, left, width: right - left, height: bottom - top, bottom, right };
        }
      }

      // Only update if we have a valid rect
      if (rect && rect.width > 0 && rect.height > 0) {
        setSpotlightStyle({
          top: rect.top - padding,
          left: rect.left - padding,
          width: rect.width + padding * 2,
          height: rect.height + padding * 2,
          opacity: 1
        });

        // Tooltip positioning logic
        const tooltipWidth = 320;
        const tooltipHeight = 180; // Estimated
        let left = rect.left + rect.width / 2 - tooltipWidth / 2;
        
        // Position the tooltip near the bottom of the highlighted area
        let top = rect.bottom + 25;

        // Vertical safety
        if (top + tooltipHeight > window.innerHeight) {
          const potentialTop = rect.top - tooltipHeight - 20;
          if (potentialTop > 10) {
            top = potentialTop;
          } else {
            top = window.innerHeight - tooltipHeight - 20;
          }
        }

        if (top < 10) top = 10;
        if (left < 10) left = 10;
        if (left + tooltipWidth > window.innerWidth - 10) left = window.innerWidth - tooltipWidth - 10;
        
        setTooltipStyle({
          top: top,
          left: left,
          opacity: 1
        });
      }
    } else {
      // Fallback for elements not found
      setSpotlightStyle({ opacity: 0 });
      setTooltipStyle({
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
        opacity: 1
      });
    }
  }, [currentStep, steps, tourType]);

  // Trigger scroll when step changes
  useEffect(() => {
    if (steps && steps[currentStep]) {
      const element = document.querySelector(steps[currentStep].selector);
      if (element) {
        const rect = element.getBoundingClientRect();
        const isVeryLarge = rect.height > window.innerHeight * 0.7;
        
        // If the element is very large (like the workspace), scroll to the top of it instead of centering
        // Or if it's already mostly visible, don't move it much
        element.scrollIntoView({ 
          behavior: 'smooth', 
          block: isVeryLarge ? 'start' : 'center',
          inline: 'nearest'
        });
      }
    }
  }, [currentStep, steps]);

  // Continuous position sync during the tour (handles smooth scroll and manual scroll)
  useEffect(() => {
    updatePosition();
    
    // Listen for events that change element positions
    window.addEventListener('resize', updatePosition);
    window.addEventListener('scroll', updatePosition, true);

    // Also run an interval for a short bit after step changes to catch the smooth scroll movement
    const syncInterval = setInterval(updatePosition, 30);
    
    // Stop the interval after 1.5s to save resources
    const timeout = setTimeout(() => clearInterval(syncInterval), 1500);

    return () => {
      window.removeEventListener('resize', updatePosition);
      window.removeEventListener('scroll', updatePosition, true);
      clearInterval(syncInterval);
      clearTimeout(timeout);
    };
  }, [updatePosition, currentStep]);

  const handleNext = () => {
    if (currentStep < steps.length - 1) {
      setCurrentStep(currentStep + 1);
    } else {
      onComplete();
    }
  };

  const handlePrev = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  if (!steps || steps.length === 0) {
    return null; // Don't render anything if there are no steps
  }

  const step = steps[currentStep];

  return (
    <div className={styles.overlay}>
      <div className={styles.spotlight} style={spotlightStyle} />
      <div className={styles.tooltip} style={tooltipStyle} ref={tooltipRef}>
        <span className={styles.title}>{step.title}</span>
        <div className={styles.content}>{step.content}</div>
        <div className={styles.footer}>
          <div className={styles.stepIndicator}>
            Step {currentStep + 1} of {steps.length}
          </div>
          <div className={styles.buttonGroup}>
            <button className={styles.btnSkip} onClick={onSkip}>Skip</button>
            {currentStep > 0 && (
              <button className={`${styles.btn} ${styles.btnSecondary}`} onClick={handlePrev}>Back</button>
            )}
            <button className={`${styles.btn} ${styles.btnPrimary}`} onClick={handleNext}>
              {currentStep === steps.length - 1 ? 'Finish' : 'Next'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default FormTour;
