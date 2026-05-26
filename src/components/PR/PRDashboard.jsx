import React, { useState, useRef, useCallback, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import domtoimage from 'dom-to-image';
import { useNotification } from '../../contexts/NotificationContext';
import { useData } from '../../contexts/DataContext';
import { TEMPLATES, BLANK_TEMPLATE, buildTextShadow, buildWebkitTextStroke } from './templates';
import './PRDashboard.css';

const ColorPicker = ({ value, onChange }) => {
  const [hex, setHex] = useState(value);
  const [editing, setEditing] = useState(false);
  const ref = useRef(null);
  useEffect(() => { if (!editing) setHex(value); }, [value, editing]);
  const submit = () => {
    const raw = hex.startsWith('#') ? hex : '#' + hex;
    if (/^#[0-9a-fA-F]{6}$/.test(raw)) onChange(raw); else setHex(value);
    setEditing(false);
  };
  return (
    <div className="pr-color-row">
      <button className="pr-color-swatch" style={{ background: value }} onClick={() => ref.current?.click()} />
      <input ref={ref} type="color" value={value} onChange={e => { onChange(e.target.value); setHex(e.target.value); }} style={{ display: 'none' }} />
      <input type="text" className="pr-hex-input" value={editing ? hex : value}
        onFocus={() => { setHex(value); setEditing(true); }}
        onChange={e => setHex(e.target.value)} onBlur={submit}
        onKeyDown={e => e.key === 'Enter' && submit()} />
    </div>
  );
};

const FONT_SIZES = [12, 14, 16, 18, 20, 22, 24, 28, 32, 36, 42, 48, 56, 64, 72];
const FONT_FAMILIES = [
  'Arial, sans-serif', '"Arial Black", sans-serif', '"Open Sans", sans-serif', 'Georgia, serif',
  '"Times New Roman", serif', '"Courier New", monospace', 'Verdana, sans-serif',
  'Tahoma, sans-serif', '"Trebuchet MS", sans-serif', 'Impact, sans-serif',
  '"Comic Sans MS", cursive',
];
const FILE_TYPES = ['image/png', 'image/jpeg', 'image/gif', 'image/webp'];
const FONT_FILE_TYPES = ['.ttf', '.otf', '.woff', '.woff2'];

function cloneTemplate(template) {
  return template.textBoxes.map(tb => ({ type: 'text', ...tb, effects: JSON.parse(JSON.stringify(tb.effects)) }));
}

/* ── BBCode parser ── */
function parseBBCodeToElements(bbcode, canvasWidth) {
  const elements = [];
  let idCounter = 0;
  const genId = () => `text_${Date.now()}_${idCounter++}`;

  const padding = 160;
  const maxWidth = canvasWidth - padding;
  const baseLineHeight = 26;
  let y = 60;

  const wrapText = (text, fontSize, maxChars) => {
    if (text.length <= maxChars) return [text];
    const words = text.split(' ');
    const wrapped = [];
    let current = '';
    for (const word of words) {
      const test = current ? current + ' ' + word : word;
      if (test.length <= maxChars || !current) {
        current = test;
      } else {
        wrapped.push(current);
        current = word;
      }
    }
    if (current) wrapped.push(current);
    return wrapped;
  };

  const processSegment = (segment) => {
    let text = segment;
    let fontSize = 16;
    let fontWeight = 'normal';
    let textAlign = 'left';
    let color = '#1a1a1a';

    const imgMatch = text.match(/\[img\](.*?)\[\/img\]/i);
    if (imgMatch) {
      const imgUrl = imgMatch[1].trim();
      const imgWidth = 220;
      elements.push({
        id: genId(),
        type: 'image',
        x: (canvasWidth - imgWidth) / 2,
        y,
        width: imgWidth,
        height: 200,
        src: imgUrl,
        defaultText: '',
        fontSize: 0,
        fontFamily: '',
        color: '',
        fontWeight: '',
        textAlign: 'center',
        effects: { glow: null, shadow: null, outline: null, stretch: { enabled: false, value: 100 }, thicken: { enabled: false, value: 100 } },
      });
      y += 210;
      return null;
    }

    if (text.includes('[center]')) { textAlign = 'center'; text = text.replace(/\[center\]/g, '').replace(/\[\/center\]/g, ''); }
    if (text.includes('[justify]')) { textAlign = 'justify'; text = text.replace(/\[justify\]/g, '').replace(/\[\/justify\]/g, ''); }
    else { text = text.replace(/\[\/justify\]/g, ''); }
    if (text.includes('[bold]')) { fontWeight = 'bold'; text = text.replace(/\[bold\]/g, '').replace(/\[\/bold\]/g, ''); }
    if (text.includes('[size=150]')) { fontSize = 24; text = text.replace(/\[size=150\]/g, '').replace(/\[\/size\]/g, ''); }
    else if (text.includes('[size=120]')) { fontSize = 20; text = text.replace(/\[size=120\]/g, '').replace(/\[\/size\]/g, ''); }
    else { text = text.replace(/\[size=\d+\]/g, '').replace(/\[\/size\]/g, ''); }

    text = text.replace(/\[br\]/g, '').replace(/\[\/br\]/g, '');
    text = text.replace(/\[altspoiler=[^\]]*\]/g, '').replace(/\[\/altspoiler\]/g, '');
    text = text.replace(/\{\{([^|}]+)\|?[^}]*\}\}/g, (match, key) => {
      return `[${key}]`;
    });

    text = text.trim();
    if (!text) return null;

    return { text, fontSize, fontWeight, textAlign, color };
  };

  const lines = bbcode.split('\n');
  let inDivbox = false;
  let divboxStartY = null;
  let divboxColor = '#ffffff';

  for (let i = 0; i < lines.length; i++) {
    let line = lines[i].trim();
    if (!line) { y += baseLineHeight * 0.3; continue; }

    const divboxMatch = line.match(/\[divbox=(\w+)\]/);
    if (divboxMatch) {
      inDivbox = true;
      divboxStartY = y;
      divboxColor = divboxMatch[1] === 'white' ? '#ffffff' : divboxMatch[1] === 'black' ? '#000000' : `#${divboxMatch[1]}`;
      line = line.replace(/\[divbox=[^\]]*\]/g, '');
    }

    if (line.includes('[/divbox]')) {
      if (inDivbox && divboxStartY !== null) {
        elements.unshift({
          id: genId(),
          type: 'divbox',
          x: 60,
          y: divboxStartY - 10,
          width: canvasWidth - 120,
          height: (y - divboxStartY) + 60,
          defaultText: '',
          fontSize: 0,
          fontFamily: '',
          color: divboxColor,
          fontWeight: '',
          textAlign: 'left',
          effects: { glow: null, shadow: null, outline: null, stretch: { enabled: false, value: 100 }, thicken: { enabled: false, value: 100 } },
        });
      }
      inDivbox = false;
      divboxStartY = null;
      line = line.replace(/\[\/divbox\]/g, '');
      if (!line.trim()) continue;
    }

    const parts = line.split(/\[hr\]\[\/hr\]/);
    for (let j = 0; j < parts.length; j++) {
      const part = parts[j].trim();
      if (!part) {
        elements.push({
          id: genId(),
          type: 'hr',
          x: 80,
          y: y + 8,
          width: maxWidth,
          height: 2,
          defaultText: '',
          fontSize: 0,
          fontFamily: '',
          color: '#cccccc',
          fontWeight: 'normal',
          textAlign: 'left',
          effects: { glow: null, shadow: null, outline: null, stretch: { enabled: false, value: 100 }, thicken: { enabled: false, value: 100 } },
        });
        y += baseLineHeight * 0.8;
        continue;
      }

      const parsed = processSegment(part);
      if (!parsed) continue;

      const charWidth = parsed.fontSize * 0.55;
      const maxChars = Math.floor(maxWidth / charWidth);
      const wrappedLines = wrapText(parsed.text, parsed.fontSize, maxChars);

      for (const wrappedLine of wrappedLines) {
        elements.push({
          id: genId(),
          type: 'text',
          x: parsed.textAlign === 'center' ? 80 : 80,
          y,
          width: maxWidth,
          height: Math.max(parsed.fontSize * 1.6, 30),
          defaultText: wrappedLine,
          fontSize: parsed.fontSize,
          fontFamily: '"Times New Roman", serif',
          color: parsed.color,
          fontWeight: parsed.fontWeight,
          textAlign: parsed.textAlign,
          effects: { glow: null, shadow: null, outline: null, stretch: { enabled: false, value: 100 }, thicken: { enabled: false, value: 100 } },
        });
        y += baseLineHeight * (parsed.fontSize / 16) + 4;
      }
    }
  }

  return elements;
}

/* ── Autopsy BBCode template ── */
const AUTOPSY_BBCODE = `[divbox=white][center][img]https://i.ibb.co/0pgw9hHm/phmc.png[/img][/center]

[bold][size=150][br][/br][center]DEPARTMENT OF PATHOLOGY AND FORENSIC MEDICINE[/size][/bold][/center]
[center][size=120]Autopsy Report by Medical Examiner[/size][/center][hr][/hr][justify][br][/br]I performed an autopsy on the body of [bold]{{decedentName}} (({{decedentOOC}}))[/bold] at PHMC's Department of Pathology and Forensic Medicine on {{autopsyStartTime}}.
[bold]DNA PROFILE:[/bold] {{dnaProfile}}
[bold]PLACE OF DEATH:[/bold] {{placeOfDeath}}

From the anatomic findings and pertinent history, I ascribe the death to:
{{deathCausesListItems}}
[bold]MANNER OF DEATH:[/bold] {{deathType}}
[bold]HOW INJURY OCCURRED:[/bold] {{causeOfDeath}}
{{autopsyDiagramBBCode}} 
[bold]Anatomic Summary:[/bold]
{{anatomicSummaryListItems}}
[bold]External Examination:[/bold]
{{externalExamination}}[br][/br]
[bold]Clothing:[/bold]
The body was not clothed and the clothing was not available at the time of autopsy.[br][/br]
[bold]Initial Incision:[/bold]
The body cavities are entered through the standard coronal and the standard Y-shaped incisions.[br][/br]
[bold]Internal Examination:[/bold]
Consistent with the stated cause of death, nothing out of the ordinary was observed.
[br][/br]
[bold]Histologic Sections:[/bold]
Representative sections from various organs are preserved in one storage jar in %10 formalin.[br][/br]
[bold]Toxicology:[/bold]
Femoral blood, EDTA blood, urine, stomach contents and vitreous have been submitted to the lab. A comprehensive screen was requested.
[bold]RESULTS:[/bold] BAC: {{bacLevel}} | Narcotics: {{narcoticTraces}}[br][/br]
[bold]Photography:[/bold]
{{photographySectionBBCode|Decedent Autopsy Photography Attached.}}[br][/br]
[bold]Radiology:[/bold]
The body is fluoroscoped and two x-rays were taken; {{RadiologyResult}}

[altspoiler=Metal Objects extracted]
{{casings}}
[/altspoiler]
[br][/br]
[bold]Opinion:[/bold]
{{synopsis}}[br][/br]
[bold]Performed by:[/bold]
{{coronerEmployee}} [br][/br]
[bold]Approved by:[/bold]
Chief Medical Examiner-Coroner Anne Carter[/justify][/divbox]`;

const PRDashboard = () => {
  const navigate = useNavigate();
  const { showNotification } = useNotification();
  const { morgueRecords } = useData();
  const canvasRef = useRef(null);
  const fileInputRef = useRef(null);
  const fontInputRef = useRef(null);

  const [selectedTemplate, setSelectedTemplate] = useState(TEMPLATES[0]);
  const [elements, setElements] = useState(() => cloneTemplate(TEMPLATES[0]));
  const [selectedId, setSelectedId] = useState(null);
  const [exporting, setExporting] = useState(false);
  const [canvasBgUrl, setCanvasBgUrl] = useState(null);
  const [canvasCustomSize, setCanvasCustomSize] = useState(null);
  const [customFonts, setCustomFonts] = useState([]);
  const [canvasBgName, setCanvasBgName] = useState(null);

  const [showMorgueImporter, setShowMorgueImporter] = useState(false);
  const [morgueSearch, setMorgueSearch] = useState('');

  const [showMorgueReview, setShowMorgueReview] = useState(false);
  const [morgueReviewData, setMorgueReviewData] = useState(null);

  const [showChangelog, setShowChangelog] = useState(false);
  const [changelogName, setChangelogName] = useState('');
  const [savedProjects, setSavedProjects] = useState(() => {
    try {
      const stored = localStorage.getItem('pr_dashboard_projects');
      return stored ? JSON.parse(stored) : [];
    } catch { return []; }
  });

  const selectedEl = elements.find(el => el.id === selectedId) || null;
  const [dragState, setDragState] = useState(null);

  /* ── drag to move ── */
  useEffect(() => {
    if (!dragState) return;
    const { id, origX, origY, startX, startY } = dragState;
    const onMouseMove = (e) => {
      const dx = e.clientX - startX;
      const dy = e.clientY - startY;
      setElements(prev => prev.map(el =>
        el.id === id ? { ...el, x: origX + dx, y: origY + dy } : el
      ));
    };
    const onMouseUp = () => setDragState(null);
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
    return () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };
  }, [dragState]);

  const handleDragStart = useCallback((e, el) => {
    if (e.target.getAttribute('contentEditable') === 'true') return;
    setSelectedId(el.id);
    setDragState({ id: el.id, startX: e.clientX, startY: e.clientY, origX: el.x, origY: el.y });
  }, []);

  /* ── keyboard nudge ── */
  useEffect(() => {
    const handler = (e) => {
      if (!selectedId) return;
      const step = e.shiftKey ? 10 : 1;
      let dx = 0, dy = 0;
      if (e.key === 'ArrowUp') dy = -step;
      else if (e.key === 'ArrowDown') dy = step;
      else if (e.key === 'ArrowLeft') dx = -step;
      else if (e.key === 'ArrowRight') dx = step;
      else return;
      e.preventDefault();
      setElements(prev => prev.map(el =>
        el.id === selectedId ? { ...el, x: el.x + dx, y: el.y + dy } : el
      ));
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [selectedId]);

  /* ── template switching ── */
  const switchTemplate = useCallback((template) => {
    setSelectedTemplate(template);
    setElements(cloneTemplate(template));
    setSelectedId(null);
    if (template.bgImage) {
      const imgUrl = new URL(`../../assets/${template.bgImage}`, import.meta.url).href;
      const img = new Image();
      img.onload = () => {
        setCanvasCustomSize({ width: template.width, height: template.height });
        setCanvasBgUrl(imgUrl);
        setCanvasBgName(template.bgImage);
      };
      img.onerror = () => {
        setCanvasCustomSize({ width: template.width, height: template.height });
        setCanvasBgUrl(null);
        setCanvasBgName(null);
      };
      img.src = imgUrl;
    } else {
      setCanvasBgUrl(null);
      setCanvasCustomSize(null);
      setCanvasBgName(null);
    }
  }, []);

  /* ── element mutation helpers ── */
  const updateEl = useCallback((id, changes) => {
    setElements(prev => prev.map(el => el.id === id ? { ...el, ...changes } : el));
  }, []);

  const updateEffect = useCallback((id, effectType, changes) => {
    setElements(prev => prev.map(el => {
      if (el.id !== id || el.type !== 'text') return el;
      const effects = { ...el.effects };
      effects[effectType] = effects[effectType] ? { ...effects[effectType], ...changes } : changes;
      return { ...el, effects };
    }));
  }, []);

  const toggleEffect = useCallback((id, effectType) => {
    setElements(prev => prev.map(el => {
      if (el.id !== id || el.type !== 'text') return el;
      const effects = { ...el.effects };
      if (effects[effectType]?.enabled) {
        effects[effectType] = { ...effects[effectType], enabled: false };
      } else {
        if (effectType === 'stretch' || effectType === 'thicken') {
          effects[effectType] = effects[effectType] || { enabled: true, value: 100 };
          effects[effectType] = { ...effects[effectType], enabled: true };
        } else {
          effects[effectType] = effects[effectType]
            ? { ...effects[effectType], enabled: true }
            : { enabled: true, color: '#000000', size: 5 };
        }
      }
      return { ...el, effects };
    }));
  }, []);

  const deleteElement = useCallback((id) => {
    setElements(prev => prev.filter(el => el.id !== id));
    setSelectedId(prev => prev === id ? null : prev);
  }, []);

  /* ── add text box (appends to current canvas) ── */
  const addTextBox = useCallback(() => {
    const id = `text_${Date.now()}`;
    const yOffset = elements.length * 70;
    const newEl = {
      id, type: 'text',
      x: 60, y: 60 + yOffset, width: 400, height: 60,
      defaultText: 'Double-click to edit',
      fontSize: 28, fontFamily: 'Arial, sans-serif',
      color: '#ffffff', fontWeight: 'bold', textAlign: 'center',
      effects: { glow: null, shadow: null, outline: null, stretch: { enabled: false, value: 100 }, thicken: { enabled: false, value: 100 } },
    };
    setElements(prev => [...prev, newEl]);
    setSelectedId(id);
  }, [elements.length]);

  /* ── upload image as canvas background ── */
  const handleImageUpload = useCallback((e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!FILE_TYPES.includes(file.type)) {
      showNotification('Unsupported file type. Use PNG, JPG, GIF, or WebP.', 'exclamation-triangle');
      return;
    }
    const reader = new FileReader();
    reader.onload = (ev) => {
      const img = new Image();
      img.onload = () => {
        setCanvasCustomSize({ width: img.naturalWidth, height: img.naturalHeight });
        setCanvasBgUrl(ev.target.result);
        setCanvasBgName(file.name);
        setElements([]);
        setSelectedId(null);
      };
      img.src = ev.target.result;
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  }, [showNotification]);

  /* ── upload custom font ── */
  const handleFontUpload = useCallback((e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const ext = '.' + file.name.split('.').pop().toLowerCase();
    if (!FONT_FILE_TYPES.includes(ext)) {
      showNotification('Unsupported font format. Use TTF, OTF, WOFF, or WOFF2.', 'exclamation-triangle');
      return;
    }
    const name = file.name.replace(/\.[^/.]+$/, '');
    const reader = new FileReader();
    reader.onload = async (ev) => {
      try {
        const font = new FontFace(name, `url(${ev.target.result})`);
        await font.load();
        document.fonts.add(font);
        setCustomFonts(prev => prev.find(f => f.name === name) ? prev : [...prev, { name, url: ev.target.result }]);
        showNotification(`Font "${name}" loaded!`, 'check-circle');
      } catch (err) {
        showNotification(`Font "${name}" failed to load: ${err.message}`, 'exclamation-triangle');
      }
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  }, [showNotification]);

  /* ── log positions ── */
  const logPositions = useCallback(() => {
    console.log('==============================');
    console.log('  PR DESIGN — ELEMENT POSITIONS');
    console.log('==============================');
    if (canvasBgName) {
      console.log(`[BG] Image  "${canvasBgName}"  ${canvasCustomSize?.width || '?'}×${canvasCustomSize?.height || '?'}`);
    }
    elements.forEach((el, i) => {
      const tag = `[${i}]`;
      if (el.type === 'text') {
        const preview = (el.defaultText || '').substring(0, 40).replace(/\n/g, '\\n');
        const eff = el.effects || {};
        const parts = [];
        ['glow','shadow','outline','stretch','thicken'].forEach(k => {
          const v = eff[k];
          if (!v) { parts.push(`${k}:OFF`); return; }
          if (k === 'stretch' || k === 'thicken') {
            parts.push(`${k}:${v.enabled ? 'ON ' + (v.value || 100) + '%' : 'OFF'}`);
          } else if (k === 'glow') {
            parts.push(`${k}:${v.enabled ? 'ON ' + (v.color || '#000') + ' ' + (v.size || 0) + 'px' : 'OFF'}`);
          } else if (k === 'shadow') {
            parts.push(`${k}:${v.enabled ? 'ON ' + (v.color || '#000') + ' ' + (v.offsetX||0) + ',' + (v.offsetY||0) + ' blur' + (v.blur||0) : 'OFF'}`);
          } else if (k === 'outline') {
            parts.push(`${k}:${v.enabled ? 'ON ' + (v.color || '#000') + ' ' + (v.width || 0) + 'px' : 'OFF'}`);
          }
        });
        console.log(
          `${tag} Text  "${preview}"  x:${el.x}  y:${el.y}  w:${el.width}  h:${el.height}  ` +
          `font:${el.fontSize}px  align:${el.textAlign}  color:${el.color}  custom-font:${el.fontFamily}  effects:${parts.join(', ')}`
        );
      }
    });
    console.log('==============================');
    showNotification(`Logged ${elements.length + (canvasBgName ? 1 : 0)} element(s) to console (F12 → Console tab)`, 'info-circle');
  }, [elements, showNotification, canvasBgName, canvasCustomSize]);

  /* ── morgue import mapping ── */
  const MORGUE_FIELD_MAP = {
    title: 'title',
    body: 'body',
  };

  const importMorgueRecord = useCallback((record) => {
    if (!record) return;

    const sanitizeMorgueText = (text) => {
      if (!text) return '';
      return String(text).replace(/\r\n/g, '\n').replace(/\r/g, '\n').trim();
    };

    const data = {};
    if (record.caseId) data.caseNumber = record.caseId;
    if (record.name) {
      const sanitizedName = sanitizeMorgueText(record.name);
      const oocMatch = sanitizedName.match(/\(\(\s*(.*?)\s*\)\)/);
      if (oocMatch) {
        data.decedentName = sanitizedName.replace(/\(\(\s*(.*?)\s*\)\)/, '').trim();
        data.decedentOOC = oocMatch[1].trim();
      } else {
        data.decedentName = sanitizedName;
      }
    }

    const lowerName = (record.name || "").toLowerCase();
    const lowerCod = (record.causeOfDeath || "").toLowerCase();
    const isPk = lowerName.includes('pk') || lowerCod.includes('pk');
    const isCk = lowerName.includes('ck') || lowerCod.includes('ck');
    data.deathType = isCk ? 'CK' : (isPk ? 'PK' : 'Unknown');

    if (record.location) data.placeOfDeath = sanitizeMorgueText(record.location);
    if (record.dnaProfile) data.dnaProfile = record.dnaProfile;
    if (record.sex) data.sex = record.sex;
    if (record.timeOfDeath) data.dateTime = record.timeOfDeath;
    if (record.bac) data.bacLevel = record.bac;
    if (record.narcotics) data.narcoticTraces = sanitizeMorgueText(record.narcotics);

    let externalExam = "Morgue Technician Description (auto-generated from Morgue Records)\n\n";
    if (record.physicalDescription) externalExam += `Physical Description: ${sanitizeMorgueText(record.physicalDescription)}\n\n`;
    if (record.tattoos && record.tattoos !== 'None' && record.tattoos !== 'Unknown') {
      const sanitizedTattoos = sanitizeMorgueText(record.tattoos);
      if (!record.physicalDescription || !record.physicalDescription.includes(record.tattoos)) {
        externalExam += `Tattoos/Marks: ${sanitizedTattoos}\n\n`;
      }
    }
    const ageText = record.estimatedAge && record.estimatedAge !== 'Unknown' ? `Est. Age: ${record.estimatedAge}` : null;
    if (ageText && (!record.physicalDescription || !record.physicalDescription.includes(record.estimatedAge))) {
      externalExam += `${ageText}\n`;
    }
    if (record.height && record.height !== 'Unknown') externalExam += `Height: ${record.height}\n`;
    if (record.weight && record.weight !== 'Unknown') externalExam += `Weight: ${record.weight}\n`;
    data.externalExamination = externalExam.trim();

    const causeOfDeathSuggestionsMap = {
      'gunshot wound': ["Massive blood loss due to gunshot wounds", "Damage to vital organs by gunshot", "Internal hemorrhage from gunshot wounds", "Acute blood loss from gunshot wounds"],
      'stab wound': ["Exsanguination due to stab wounds", "Damage to vital organs by stab wound", "Internal hemorrhage from stab wounds"],
      'blunt force trauma': ["Massive internal bleeding from blunt force trauma", "Traumatic brain injury", "Damage to vital organs from blunt force trauma"],
    };

    if (record.findings && Array.isArray(record.findings)) {
      const uniqueWoundTypes = new Set();
      let hasGunshotToHead = false;

      data.anatomicSummaryListItems = record.findings.map(f => {
        const type = sanitizeMorgueText(f.type || '');
        const part = sanitizeMorgueText(f.part || '');
        const typeLower = type.toLowerCase();
        const partLower = part.toLowerCase();
        if (!typeLower || typeLower.includes('wound type') || partLower.includes('body part') || typeLower === 'blood loss' || part === '—' || part === 'N/A') return null;
        const dist = f.dist ? f.dist.replace(/[^\d.]/g, '') : '';
        const distParsed = parseFloat(dist);
        const distRounded = !isNaN(distParsed) ? Math.floor(distParsed) : null;
        uniqueWoundTypes.add(typeLower);
        if (typeLower.includes('gunshot wound') && partLower === 'head') hasGunshotToHead = true;
        if (typeLower.includes('gunshot wound')) {
          const rangeText = distRounded !== null ? `, estimated range ${distRounded}m` : '';
          return `• Gunshot Wound to ${part}${rangeText}`;
        }
        const hideDist = typeLower.includes('blunt force trauma') || typeLower.includes('stab wound');
        return `• ${type} to ${part}${(distRounded !== null && !hideDist) ? ` (${distRounded}m)` : ''}`;
      }).filter(Boolean);

      const suggestedCauses = [];
      uniqueWoundTypes.forEach(woundType => {
        if (causeOfDeathSuggestionsMap[woundType]) suggestedCauses.push(...causeOfDeathSuggestionsMap[woundType]);
      });
      if (hasGunshotToHead && uniqueWoundTypes.has('gunshot wound')) {
        suggestedCauses.push("Multiple gunshot wounds, with a fatal penetrating trauma to the head");
      }
      data.deathCausesListItems = [...new Set(suggestedCauses)].map(c => `• ${c}`);
    }

    if (record.bullets && Array.isArray(record.bullets) && record.bullets.length > 0) {
      data.casings = record.bullets.map(b => `Bullet found with striation marks (${sanitizeMorgueText(b.type)}) #${b.id}`).join('\n');
      data.RadiologyResult = `${record.bullets.length} projectiles/slugs were identified via fluoroscopy and recovered during the autopsy.`;
    } else {
      data.casings = 'No metal objects were extracted.';
      data.RadiologyResult = 'no fragments or unusual findings are revealed.';
    }

    const now = new Date();
    const pad = (n) => n.toString().padStart(2, '0');
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const day = pad(now.getUTCDate());
    const month = months[now.getUTCMonth()];
    const year = now.getUTCFullYear();
    const hours = pad(now.getUTCHours());
    const minutes = pad(now.getUTCMinutes());
    data.autopsyStartTime = `${day}/${month}/${year} - ${hours}:${minutes}`;
    data.causeOfDeath = sanitizeMorgueText(record.causeOfDeath) || '';
    data.synopsis = '';
    data.coronerEmployee = '';
    data.photographySectionBBCode = 'Scene Photography has been enclosed to this report in different exhibits.';
    data.autopsyDiagramBBCode = '';

    setMorgueReviewData({ data, record, filledBBCode: null });
    setShowMorgueImporter(false);
    setMorgueSearch('');
    setShowMorgueReview(true);
  }, [showNotification]);

  /* ── apply morgue review ── */
  const applyMorgueReview = useCallback(() => {
    if (!morgueReviewData) return;

    const { data, record } = morgueReviewData;

    let filledBBCode = AUTOPSY_BBCODE;
    Object.keys(data).forEach(key => {
      const placeholder = new RegExp(`\\{\\{${key}\\}\\}`, 'g');
      let value = data[key];
      if (Array.isArray(value)) {
        value = value.join('\n');
      }
      value = value !== undefined && value !== null ? String(value) : '';
      filledBBCode = filledBBCode.replace(placeholder, value);
    });

    const baseElements = parseBBCodeToElements(filledBBCode, 1200);

    setCanvasCustomSize({ width: 1200, height: Math.max(2000, baseElements.length * 32 + 200) });
    setCanvasBgUrl(null);
    setCanvasBgName(`Autopsy Report - ${record.name}`);
    setElements(baseElements);
    setSelectedId(null);
    setShowMorgueReview(false);
    setMorgueReviewData(null);
    showNotification(`Imported morgue record: ${record.name} (${Object.keys(data).filter(k => data[k]).length} fields)`, 'check-circle');
  }, [morgueReviewData, showNotification]);

  /* ── import autopsy BBCode ── */
  const importAutopsyBBCode = useCallback((bbcode) => {
    const parsedElements = parseBBCodeToElements(bbcode || AUTOPSY_BBCODE, 1414);
    if (parsedElements.length === 0) {
      showNotification('No text elements found in BBCode.', 'exclamation-triangle');
      return;
    }

    setCanvasCustomSize({ width: 1414, height: 2000 });
    setCanvasBgUrl(null);
    setCanvasBgName('Autopsy Report (BBCode)');
    setElements(parsedElements);
    setSelectedId(null);
    showNotification(`Imported autopsy BBCode: ${parsedElements.length} text elements`, 'check-circle');
  }, [showNotification]);

  /* ── save project ── */
  const saveProject = useCallback(() => {
    const name = changelogName.trim() || `Project ${new Date().toLocaleString()}`;
    const project = {
      id: `proj_${Date.now()}`,
      name,
      savedAt: new Date().toISOString(),
      elements,
      canvasBgUrl,
      canvasCustomSize,
      canvasBgName,
      selectedTemplateId: selectedTemplate.id,
    };
    const updated = [project, ...savedProjects.filter(p => p.id !== project.id)];
    setSavedProjects(updated);
    localStorage.setItem('pr_dashboard_projects', JSON.stringify(updated));
    setChangelogName('');
    setShowChangelog(false);
    showNotification(`Saved "${name}"`, 'check-circle');
  }, [changelogName, elements, canvasBgUrl, canvasCustomSize, canvasBgName, selectedTemplate, savedProjects, showNotification]);

  /* ── load project ── */
  const loadProject = useCallback((project) => {
    setElements(project.elements || []);
    setCanvasBgUrl(project.canvasBgUrl || null);
    setCanvasCustomSize(project.canvasCustomSize || null);
    setCanvasBgName(project.canvasBgName || null);
    const tmpl = TEMPLATES.find(t => t.id === project.selectedTemplateId) || TEMPLATES[0];
    setSelectedTemplate(tmpl);
    setSelectedId(null);
    setShowChangelog(false);
    showNotification(`Loaded "${project.name}"`, 'check-circle');
  }, [showNotification]);

  /* ── delete project ── */
  const deleteProject = useCallback((id) => {
    const updated = savedProjects.filter(p => p.id !== id);
    setSavedProjects(updated);
    localStorage.setItem('pr_dashboard_projects', JSON.stringify(updated));
    showNotification('Project deleted.', 'info-circle');
  }, [savedProjects, showNotification]);

  /* ── export ── */
  const doExport = async (format) => {
    if (!canvasRef.current) return;
    setExporting(true);
    try {
      const dataUrl = format === 'png'
        ? await domtoimage.toPng(canvasRef.current, { bgColor: canvasBgUrl ? '#ffffff' : 'transparent' })
        : await domtoimage.toJpeg(canvasRef.current, { quality: 0.95, bgColor: '#ffffff' });
      const slug = canvasCustomSize ? 'custom' : selectedTemplate.name.replace(/\s+/g, '_');
      const link = document.createElement('a');
      link.download = `${slug}.${format}`;
      link.href = dataUrl;
      link.click();
      showNotification(`Exported as ${format.toUpperCase()}!`, 'check-circle');
    } catch (err) {
      showNotification('Export failed: ' + (err.message || 'Unknown error'), 'exclamation-triangle');
    } finally {
      setExporting(false);
    }
  };

  /* ── canvas styles ── */
  const selectedBoxStyle = (el) => ({
    position: 'absolute',
    left: el.x, top: el.y, width: el.width, height: el.height,
    fontSize: el.fontSize,
    fontFamily: el.fontFamily,
    color: el.color,
    fontWeight: el.fontWeight,
    textShadow: buildTextShadow(el.effects),
    WebkitTextStroke: buildWebkitTextStroke(el.effects),
    cursor: selectedId === el.id ? 'grab' : 'pointer',
    border: selectedId === el.id ? '2px dashed #6c63ff' : '2px solid transparent',
    borderRadius: selectedId === el.id ? 4 : 0,
    background: selectedId === el.id ? 'rgba(108, 99, 255, 0.06)' : 'transparent',
    overflow: 'visible',
    padding: 4,
    transition: 'border 0.15s, background 0.15s',
    userSelect: 'none',
  });

  const imageStyle = (el) => ({
    position: 'absolute',
    left: el.x, top: el.y, width: el.width, height: el.height,
    border: selectedId === el.id ? '2px dashed #6c63ff' : '2px solid transparent',
    borderRadius: selectedId === el.id ? 4 : 0,
    cursor: 'pointer',
    objectFit: 'cover',
    transition: 'border 0.15s',
  });

  /* ── render ── */
  return (
    <div className="pr-container">
      {/* ─── Toolbar ─── */}
      <div className="pr-toolbar">
        <div className="pr-toolbar-left">
          <h5 className="pr-logo"><i className="fas fa-paint-brush"></i> PR Dashboard</h5>
          <div className="pr-toolbar-divider"></div>
          <select className="pr-tool-select" value={selectedTemplate.id}
            onChange={e => switchTemplate(TEMPLATES.find(t => t.id === e.target.value))}>
            {TEMPLATES.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
          </select>
          <div className="pr-toolbar-divider"></div>
          <button className="pr-btn pr-btn-secondary" onClick={addTextBox}>
            <i className="fas fa-font"></i> Add Text
          </button>
          <button className="pr-btn pr-btn-secondary" onClick={() => fileInputRef.current?.click()}>
            <i className="fas fa-image"></i> Add Image
          </button>
          <input ref={fileInputRef} type="file" accept="image/png,image/jpeg,image/gif,image/webp"
            style={{ display: 'none' }} onChange={handleImageUpload} />
          <button className="pr-btn pr-btn-secondary" onClick={() => fontInputRef.current?.click()}>
            <i className="fas fa-text-height"></i> Add Font
          </button>
          <input ref={fontInputRef} type="file" accept=".ttf,.otf,.woff,.woff2"
            style={{ display: 'none' }} onChange={handleFontUpload} />
          <div className="pr-toolbar-divider"></div>
          <button className="pr-btn pr-btn-accent" onClick={() => setShowMorgueImporter(true)}>
            <i className="fas fa-file-import"></i> Import Morgue
          </button>
          <button className="pr-btn pr-btn-accent" onClick={() => importAutopsyBBCode()}>
            <i className="fas fa-file-medical"></i> Autopsy BBCode
          </button>
          <div className="pr-toolbar-divider"></div>
          <button className="pr-btn pr-btn-ghost pr-btn-save" onClick={() => setShowChangelog(true)}>
            <i className="fas fa-save"></i> Save / Load
          </button>
        </div>

        <div className="pr-toolbar-right">
          <button className="pr-btn pr-btn-ghost pr-btn-log" onClick={logPositions}>
            <i className="fas fa-code"></i> Log Positions
          </button>
          <div className="pr-toolbar-divider"></div>
          <div className="pr-export-group">
            <button className="pr-btn pr-btn-primary" onClick={() => doExport('png')} disabled={exporting}>
              <i className="fas fa-image"></i> PNG
            </button>
            <button className="pr-btn pr-btn-secondary" onClick={() => doExport('jpg')} disabled={exporting}>
              <i className="fas fa-file-image"></i> JPG
            </button>
          </div>
          <button className="pr-btn pr-btn-ghost" onClick={() => navigate('/')}>
            <i className="fas fa-arrow-left"></i> Back
          </button>
        </div>
      </div>

      {/* ─── Workspace ─── */}
      <div className="pr-workspace">
        <div className="pr-canvas-area">
          <div ref={canvasRef} className="pr-canvas"
            style={{
              width: canvasCustomSize?.width || selectedTemplate.width,
              height: canvasCustomSize?.height || selectedTemplate.height,
              background: canvasBgUrl ? `url(${canvasBgUrl}) center/contain no-repeat #000` : selectedTemplate.background,
            }}
            onClick={() => setSelectedId(null)}
          >
            {elements.map(el => el.type === 'image' ? (
              <img key={el.id} src={el.src} alt="" style={imageStyle(el)}
                draggable={false}
                onClick={e => { e.stopPropagation(); setSelectedId(el.id); }} />
            ) : el.type === 'divbox' ? (
              <div key={el.id} style={{
                position: 'absolute',
                left: el.x, top: el.y, width: el.width, height: el.height,
                background: el.color || '#ffffff',
                border: '2px solid #000000',
                borderRadius: 4,
                cursor: dragState?.id === el.id ? 'grabbing' : 'pointer',
                opacity: 0.9,
                zIndex: 0,
              }}
                onMouseDown={e => handleDragStart(e, el)}
                onClick={e => { e.stopPropagation(); if (!dragState) setSelectedId(el.id); }}>
                {selectedId === el.id && (
                  <div style={{ position: 'absolute', top: -18, right: 0, fontSize: 10, color: '#6c63ff', opacity: 0.7, pointerEvents: 'none', whiteSpace: 'nowrap' }}>
                    divbox: x:{el.x} y:{el.y} {el.width}×{el.height}
                  </div>
                )}
              </div>
            ) : el.type === 'hr' ? (
              <div key={el.id} style={{
                position: 'absolute',
                left: el.x, top: el.y, width: el.width, height: el.height,
                background: el.color,
                opacity: 0.6,
                cursor: dragState?.id === el.id ? 'grabbing' : 'pointer',
                border: selectedId === el.id ? '1px dashed #6c63ff' : 'none',
                borderRadius: selectedId === el.id ? 2 : 0,
              }}
                onMouseDown={e => handleDragStart(e, el)}
                onClick={e => { e.stopPropagation(); if (!dragState) setSelectedId(el.id); }}>
                {selectedId === el.id && (
                  <div style={{ position: 'absolute', top: -18, right: 0, fontSize: 10, color: '#6c63ff', opacity: 0.7, pointerEvents: 'none' }}>
                    x:{el.x} y:{el.y} {el.width}×{el.height}
                  </div>
                )}
              </div>
            ) : (
              <div key={el.id} style={{
                ...selectedBoxStyle(el),
                cursor: dragState?.id === el.id ? 'grabbing' : selectedBoxStyle(el).cursor,
                zIndex: dragState?.id === el.id ? 999 : 1,
                filter: selectedId === el.id && !dragState ? 'brightness(1.1)' : 'none',
              }}
                onMouseDown={e => handleDragStart(e, el)}
                onClick={e => { e.stopPropagation(); if (!dragState) setSelectedId(el.id); }}>
                <div
                  contentEditable={selectedId === el.id}
                  suppressContentEditableWarning
                  onBlur={e => updateEl(el.id, { defaultText: e.currentTarget.textContent })}
                  style={{
                    width: '100%',
                    height: '100%',
                    outline: 'none',
                    wordBreak: 'break-word',
                    overflowY: 'auto',
                    cursor: selectedId === el.id ? 'text' : 'inherit',
                    textAlign: el.textAlign,
                    whiteSpace: 'pre-wrap',
                    transform: (() => {
                      const tx = [];
                      const s = el.effects?.stretch;
                      if (s?.enabled) tx.push(`scaleX(${(s.value || 100) / 100})`);
                      const t = el.effects?.thicken;
                      if (t?.enabled) tx.push(`scaleY(${(t.value || 100) / 100})`);
                      return tx.length ? tx.join(' ') : 'none';
                    })(),
                    transformOrigin: 'left top',
                  }}>
                  {el.defaultText}
                </div>
                {selectedId === el.id && (
                  <>
                    <div style={{ position: 'absolute', top: -20, right: 0, fontSize: 10, color: '#6c63ff', opacity: 0.7, pointerEvents: 'none' }}>
                      x:{el.x} y:{el.y} {el.width}×{el.height}
                    </div>
                    <div style={{ position: 'absolute', top: -2, left: -2, width: 8, height: 8, borderTop: '2px solid #6c63ff', borderLeft: '2px solid #6c63ff', pointerEvents: 'none' }} />
                    <div style={{ position: 'absolute', top: -2, right: -2, width: 8, height: 8, borderTop: '2px solid #6c63ff', borderRight: '2px solid #6c63ff', pointerEvents: 'none' }} />
                    <div style={{ position: 'absolute', bottom: -2, left: -2, width: 8, height: 8, borderBottom: '2px solid #6c63ff', borderLeft: '2px solid #6c63ff', pointerEvents: 'none' }} />
                    <div style={{ position: 'absolute', bottom: -2, right: -2, width: 8, height: 8, borderBottom: '2px solid #6c63ff', borderRight: '2px solid #6c63ff', pointerEvents: 'none' }} />
                  </>
                )}
              </div>
            ))}
          </div>
        </div>

         {/* ─── Properties Panel ─── */}
        {selectedEl && (
          <div className="pr-properties-panel">
            <div className="pr-panel-sticky">
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                <h6 className="pr-panel-title" style={{ margin: 0 }}>
                  {selectedEl.type === 'image' ? 'Image Properties' : 'Text Properties'}
                </h6>
                <button className="pr-btn-delete" onClick={() => deleteElement(selectedEl.id)}
                  title="Delete element">
                  <i className="fas fa-trash"></i>
                </button>
              </div>

              {/* Position (shared) */}
              <div className="pr-prop-row">
                <div className="pr-prop-group" style={{ flex: 1 }}>
                  <label className="pr-prop-label">X</label>
                  <input type="number" className="pr-prop-input"
                    value={selectedEl.x} onChange={e => updateEl(selectedEl.id, { x: Number(e.target.value) })} />
                </div>
                <div className="pr-prop-group" style={{ flex: 1 }}>
                  <label className="pr-prop-label">Y</label>
                  <input type="number" className="pr-prop-input"
                    value={selectedEl.y} onChange={e => updateEl(selectedEl.id, { y: Number(e.target.value) })} />
                </div>
                <div className="pr-prop-group" style={{ flex: 1 }}>
                  <label className="pr-prop-label">W</label>
                  <input type="number" className="pr-prop-input" min={1}
                    value={selectedEl.width} onChange={e => updateEl(selectedEl.id, { width: Number(e.target.value) })} />
                </div>
                <div className="pr-prop-group" style={{ flex: 1 }}>
                  <label className="pr-prop-label">H</label>
                  <input type="number" className="pr-prop-input" min={1}
                    value={selectedEl.height} onChange={e => updateEl(selectedEl.id, { height: Number(e.target.value) })} />
                </div>
              </div>
              <p className="pr-nudge-hint">Arrow keys to nudge · Shift+Arrow ×10</p>

              {selectedEl.type === 'image' ? (
                <>
                  <div className="pr-panel-divider" />
                  {selectedEl.src && (
                    <img src={selectedEl.src} alt="preview"
                      style={{ width: '100%', borderRadius: 6, border: '1px solid var(--pr-border)', marginBottom: 8 }} />
                  )}
                </>
              ) : (
                <>
                  <div className="pr-panel-divider" />
                  <div className="pr-prop-group">
                    <label className="pr-prop-label">Content</label>
                    <textarea className="pr-prop-input pr-prop-textarea" rows={3}
                      value={selectedEl.defaultText}
                      onChange={e => updateEl(selectedEl.id, { defaultText: e.target.value })} />
                  </div>

                  <div className="pr-prop-group">
                    <label className="pr-prop-label">Font Family</label>
                    <select className="pr-prop-input"
                      value={selectedEl.fontFamily}
                      onChange={e => updateEl(selectedEl.id, { fontFamily: e.target.value })}>
                      {FONT_FAMILIES.map(f => <option key={f} value={f} style={{ fontFamily: f }}>{f.split(',')[0].replace(/"/g, '')}</option>)}
                      {customFonts.map(f => (
                        <option key={f.name} value={f.name} style={{ fontFamily: f.name }}>{f.name} (custom)</option>
                      ))}
                    </select>
                  </div>
                  <div className="pr-prop-row">
                    <div className="pr-prop-group" style={{ flex: 1 }}>
                      <label className="pr-prop-label">Size</label>
                      <select className="pr-prop-input"
                        value={selectedEl.fontSize}
                        onChange={e => updateEl(selectedEl.id, { fontSize: Number(e.target.value) })}>
                        {FONT_SIZES.map(s => <option key={s} value={s}>{s}px</option>)}
                      </select>
                    </div>
                    <div className="pr-prop-group" style={{ flex: 1 }}>
                      <label className="pr-prop-label">Weight</label>
                      <select className="pr-prop-input"
                        value={selectedEl.fontWeight}
                        onChange={e => updateEl(selectedEl.id, { fontWeight: e.target.value })}>
                        <option value="normal">Normal</option>
                        <option value="600">Semi-Bold</option>
                        <option value="bold">Bold</option>
                      </select>
                    </div>
                  </div>

                  <div className="pr-prop-group">
                    <label className="pr-prop-label">Color</label>
                    <ColorPicker value={selectedEl.color} onChange={val => updateEl(selectedEl.id, { color: val })} />
                  </div>

                  <div className="pr-prop-group">
                    <label className="pr-prop-label">Alignment</label>
                    <div className="pr-align-group">
                      {['left', 'center', 'right'].map(a => (
                        <button key={a}
                          className={`pr-align-btn ${selectedEl.textAlign === a ? 'active' : ''}`}
                          onClick={() => updateEl(selectedEl.id, { textAlign: a })}>
                          <i className={`fas fa-align-${a}`}></i>
                        </button>
                      ))}
                    </div>
                  </div>
                </>
              )}
            </div>

            {selectedEl.type === 'text' && (
              <div className="pr-panel-scroll">
                <div className="pr-panel-divider" />
                <h6 className="pr-panel-title">Effects</h6>

                {/* Glow */}
                <div className="pr-effect-group">
                  <div className="pr-effect-header">
                    <span className="pr-effect-name">Glow</span>
                    <label className="pr-toggle">
                      <input type="checkbox" checked={selectedEl.effects?.glow?.enabled || false}
                        onChange={() => toggleEffect(selectedEl.id, 'glow')} />
                      <span className="pr-toggle-slider"></span>
                    </label>
                  </div>
                  {selectedEl.effects?.glow?.enabled && (
                    <div className="pr-effect-options">
                      <div className="pr-prop-row">
                        <div className="pr-prop-group" style={{ flex: 1 }}>
                          <label className="pr-prop-label">Color</label>
                          <ColorPicker value={selectedEl.effects.glow.color || '#6c63ff'}
                            onChange={val => updateEffect(selectedEl.id, 'glow', { color: val })} />
                        </div>
                        <div className="pr-prop-group" style={{ flex: 1 }}>
                          <label className="pr-prop-label">Size</label>
                          <input type="range" className="pr-range" min={1} max={30}
                            value={selectedEl.effects.glow.size || 5}
                            onChange={e => updateEffect(selectedEl.id, 'glow', { size: Number(e.target.value) })} />
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {/* Shadow */}
                <div className="pr-effect-group">
                  <div className="pr-effect-header">
                    <span className="pr-effect-name">Shadow</span>
                    <label className="pr-toggle">
                      <input type="checkbox" checked={selectedEl.effects?.shadow?.enabled || false}
                        onChange={() => toggleEffect(selectedEl.id, 'shadow')} />
                      <span className="pr-toggle-slider"></span>
                    </label>
                  </div>
                  {selectedEl.effects?.shadow?.enabled && (
                    <div className="pr-effect-options">
                      <div className="pr-prop-group">
                        <label className="pr-prop-label">Color</label>
                        <ColorPicker value={selectedEl.effects.shadow.color || '#000000'}
                          onChange={val => updateEffect(selectedEl.id, 'shadow', { color: val })} />
                      </div>
                      <div className="pr-prop-row">
                        <div className="pr-prop-group" style={{ flex: 1 }}>
                          <label className="pr-prop-label">X</label>
                          <input type="range" className="pr-range" min={-10} max={10}
                            value={selectedEl.effects.shadow.offsetX || 0}
                            onChange={e => updateEffect(selectedEl.id, 'shadow', { offsetX: Number(e.target.value) })} />
                        </div>
                        <div className="pr-prop-group" style={{ flex: 1 }}>
                          <label className="pr-prop-label">Y</label>
                          <input type="range" className="pr-range" min={-10} max={10}
                            value={selectedEl.effects.shadow.offsetY || 0}
                            onChange={e => updateEffect(selectedEl.id, 'shadow', { offsetY: Number(e.target.value) })} />
                        </div>
                      </div>
                      <div className="pr-prop-row">
                        <div className="pr-prop-group" style={{ flex: 1 }}>
                          <label className="pr-prop-label">Blur</label>
                          <input type="range" className="pr-range" min={0} max={20}
                            value={selectedEl.effects.shadow.blur || 4}
                            onChange={e => updateEffect(selectedEl.id, 'shadow', { blur: Number(e.target.value) })} />
                        </div>
                        <span className="pr-range-value">{selectedEl.effects.shadow.blur || 4}</span>
                      </div>
                    </div>
                  )}
                </div>

                {/* Outline */}
                <div className="pr-effect-group">
                  <div className="pr-effect-header">
                    <span className="pr-effect-name">Outline</span>
                    <label className="pr-toggle">
                      <input type="checkbox" checked={selectedEl.effects?.outline?.enabled || false}
                        onChange={() => toggleEffect(selectedEl.id, 'outline')} />
                      <span className="pr-toggle-slider"></span>
                    </label>
                  </div>
                  {selectedEl.effects?.outline?.enabled && (
                    <div className="pr-effect-options">
                      <div className="pr-prop-row">
                        <div className="pr-prop-group" style={{ flex: 1 }}>
                          <label className="pr-prop-label">Color</label>
                          <ColorPicker value={selectedEl.effects.outline.color || '#000000'}
                            onChange={val => updateEffect(selectedEl.id, 'outline', { color: val })} />
                        </div>
                        <div className="pr-prop-group" style={{ flex: 1 }}>
                          <label className="pr-prop-label">Width</label>
                          <input type="range" className="pr-range" min={1} max={5}
                            value={selectedEl.effects.outline.width || 1}
                            onChange={e => updateEffect(selectedEl.id, 'outline', { width: Number(e.target.value) })} />
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {/* Stretch */}
                <div className="pr-effect-group">
                  <div className="pr-effect-header">
                    <span className="pr-effect-name">Stretch</span>
                    <label className="pr-toggle">
                      <input type="checkbox" checked={selectedEl.effects?.stretch?.enabled || false}
                        onChange={() => toggleEffect(selectedEl.id, 'stretch')} />
                      <span className="pr-toggle-slider"></span>
                    </label>
                  </div>
                  {selectedEl.effects?.stretch?.enabled && (
                    <div className="pr-effect-options">
                      <div className="pr-prop-row">
                        <div className="pr-prop-group" style={{ flex: 1 }}>
                          <label className="pr-prop-label">Width</label>
                          <input type="range" className="pr-range" min={50} max={200}
                            value={selectedEl.effects.stretch.value || 100}
                            onChange={e => updateEffect(selectedEl.id, 'stretch', { value: Number(e.target.value) })} />
                        </div>
                        <span className="pr-range-value">{selectedEl.effects.stretch.value || 100}%</span>
                      </div>
                    </div>
                  )}
                </div>

                {/* Thicken */}
                <div className="pr-effect-group">
                  <div className="pr-effect-header">
                    <span className="pr-effect-name">Thicken</span>
                    <label className="pr-toggle">
                      <input type="checkbox" checked={selectedEl.effects?.thicken?.enabled || false}
                        onChange={() => toggleEffect(selectedEl.id, 'thicken')} />
                      <span className="pr-toggle-slider"></span>
                    </label>
                  </div>
                  {selectedEl.effects?.thicken?.enabled && (
                    <div className="pr-effect-options">
                      <div className="pr-prop-row">
                        <div className="pr-prop-group" style={{ flex: 1 }}>
                          <label className="pr-prop-label">Height</label>
                          <input type="range" className="pr-range" min={50} max={200}
                            value={selectedEl.effects.thicken.value || 100}
                            onChange={e => updateEffect(selectedEl.id, 'thicken', { value: Number(e.target.value) })} />
                        </div>
                        <span className="pr-range-value">{selectedEl.effects.thicken.value || 100}%</span>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ─── Morgue Importer Modal ─── */}
      {showMorgueImporter && (
        <div className="pr-morgue-modal-overlay" onClick={() => setShowMorgueImporter(false)}>
          <div className="pr-morgue-modal" onClick={e => e.stopPropagation()}>
            <div className="pr-morgue-modal-header">
              <h5><i className="fas fa-file-import"></i> Import Morgue Record</h5>
              <button className="pr-morgue-close" onClick={() => setShowMorgueImporter(false)}>
                <i className="fas fa-times"></i>
              </button>
            </div>
            <div className="pr-morgue-search">
              <input
                type="text"
                placeholder="Search by name, case #, or location..."
                value={morgueSearch}
                onChange={e => { setMorgueSearch(e.target.value); }}
              />
            </div>
            <div className="pr-morgue-list">
              {(() => {
                const filtered = (morgueRecords || [])
                  .filter(r =>
                    (r.name || '').toLowerCase().includes(morgueSearch.toLowerCase()) ||
                    String(r.caseId || '').toLowerCase().includes(morgueSearch.toLowerCase()) ||
                    (r.location || '').toLowerCase().includes(morgueSearch.toLowerCase())
                  )
                  .sort((a, b) => (Number(b.caseId) || 0) - (Number(a.caseId) || 0));
                if (filtered.length === 0) {
                  return <div className="pr-morgue-empty">No records found.</div>;
                }
                return filtered.map(r => (
                  <div key={r.firebaseKey || r.caseId} className="pr-morgue-item"
                    onClick={() => importMorgueRecord(r)}>
                    <div className="pr-morgue-item-case">#{r.caseId}</div>
                    <div className="pr-morgue-item-name">{r.name}</div>
                    <div className="pr-morgue-item-meta">
                      {r.sex && <span><i className="fas fa-venus-mars"></i> {r.sex}</span>}
                      {r.estimatedAge && <span><i className="fas fa-birthday-cake"></i> {r.estimatedAge}</span>}
                      {r.timeOfDeath && <span><i className="fas fa-clock"></i> {r.timeOfDeath}</span>}
                      {r.location && <span><i className="fas fa-map-marker-alt"></i> {r.location}</span>}
                    </div>
                    {r.causeOfDeath && r.causeOfDeath !== 'Unknown' && (
                      <div className="pr-morgue-item-cause">
                        <i className="fas fa-skull"></i> {r.causeOfDeath.substring(0, 80)}{r.causeOfDeath.length > 80 ? '...' : ''}
                      </div>
                    )}
                  </div>
                ));
              })()}
            </div>
          </div>
        </div>
      )}

      {/* ─── Morgue Review Modal ─── */}
      {showMorgueReview && morgueReviewData && (
        <div className="pr-morgue-modal-overlay" onClick={() => { setShowMorgueReview(false); setMorgueReviewData(null); }}>
          <div className="pr-morgue-modal pr-morgue-modal-review" onClick={e => e.stopPropagation()}>
            <div className="pr-morgue-modal-header">
              <h5><i className="fas fa-clipboard-check"></i> Review Autopsy Report</h5>
              <button className="pr-morgue-close" onClick={() => { setShowMorgueReview(false); setMorgueReviewData(null); }}>
                <i className="fas fa-times"></i>
              </button>
            </div>
            <div className="pr-review-content">
              <div className="pr-review-section">
                <h6><i className="fas fa-user"></i> Decedent Information</h6>
                <div className="pr-review-grid">
                  <div className="pr-review-item">
                    <label>Name</label>
                    <span>{morgueReviewData.data.decedentName || 'Unknown'} {morgueReviewData.data.decedentOOC ? `((${morgueReviewData.data.decedentOOC}))` : ''}</span>
                  </div>
                  <div className="pr-review-item">
                    <label>Case #</label>
                    <span>{morgueReviewData.data.caseNumber || 'N/A'}</span>
                  </div>
                  <div className="pr-review-item">
                    <label>Sex</label>
                    <span>{morgueReviewData.data.sex || 'Unknown'}</span>
                  </div>
                  <div className="pr-review-item">
                    <label>DNA Profile</label>
                    <span>{morgueReviewData.data.dnaProfile || 'N/A'}</span>
                  </div>
                  <div className="pr-review-item">
                    <label>Location</label>
                    <span>{morgueReviewData.data.placeOfDeath || 'Unknown'}</span>
                  </div>
                  <div className="pr-review-item">
                    <label>Time of Death</label>
                    <span>{morgueReviewData.data.dateTime || 'Unknown'}</span>
                  </div>
                </div>
              </div>

              <div className="pr-review-section">
                <h6><i className="fas fa-skull-crossbones"></i> Findings</h6>
                {morgueReviewData.data.anatomicSummaryListItems && morgueReviewData.data.anatomicSummaryListItems.length > 0 ? (
                  <ul className="pr-review-findings">
                    {morgueReviewData.data.anatomicSummaryListItems.map((item, i) => (
                      <li key={i}>{item.startsWith('• ') ? item.substring(2) : item}</li>
                    ))}
                  </ul>
                ) : (
                  <p className="pr-review-warning"><i className="fas fa-exclamation-triangle"></i> No findings extracted from morgue record.</p>
                )}
                {morgueReviewData.data.casings && (
                  <div className="pr-review-casings">
                    <strong>Casings/Bullets:</strong>
                    <pre>{morgueReviewData.data.casings}</pre>
                  </div>
                )}
              </div>

              <div className="pr-review-section">
                <h6><i className="fas fa-file-medical"></i> Medical Examiner Input</h6>

                <div className="pr-review-field">
                  <label>Manner of Death</label>
                  <div className="pr-review-death-type">
                    {['PK', 'CK', 'Unknown'].map(type => (
                      <button key={type}
                        className={`pr-review-type-btn ${morgueReviewData.data.deathType === type ? 'active' : ''}`}
                        onClick={() => setMorgueReviewData(prev => ({ ...prev, data: { ...prev.data, deathType: type } }))}>
                        {type}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="pr-review-field">
                  <label>Cause of Death / How Injury Occurred</label>
                  <textarea
                    className="pr-review-textarea"
                    rows={3}
                    value={morgueReviewData.data.causeOfDeath || ''}
                    onChange={e => setMorgueReviewData(prev => ({ ...prev, data: { ...prev.data, causeOfDeath: e.target.value } }))}
                    placeholder="e.g., Gunshot wounds, blunt force trauma, etc."
                  />
                </div>

                <div className="pr-review-field">
                  <label>Suggested Causes of Death (for report)</label>
                  <textarea
                    className="pr-review-textarea"
                    rows={4}
                    value={morgueReviewData.data.deathCausesListItems || ''}
                    onChange={e => setMorgueReviewData(prev => ({ ...prev, data: { ...prev.data, deathCausesListItems: e.target.value } }))}
                    placeholder="e.g., Massive blood loss due to gunshot wounds"
                  />
                </div>

                <div className="pr-review-field">
                  <label>Medical Examiner Synopsis / Opinion</label>
                  <textarea
                    className="pr-review-textarea pr-review-textarea-large"
                    rows={6}
                    value={morgueReviewData.data.synopsis || ''}
                    onChange={e => setMorgueReviewData(prev => ({ ...prev, data: { ...prev.data, synopsis: e.target.value } }))}
                    placeholder="Write your professional opinion on the cause and manner of death..."
                  />
                </div>
              </div>
            </div>

            <div className="pr-review-actions">
              <button className="pr-btn pr-btn-ghost" onClick={() => { setShowMorgueReview(false); setMorgueReviewData(null); }}>
                <i className="fas fa-times"></i> Cancel
              </button>
              <button className="pr-btn pr-btn-primary" onClick={applyMorgueReview}>
                <i className="fas fa-check"></i> Apply to Canvas
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── Changelog / Save-Load Modal ─── */}
      {showChangelog && (
        <div className="pr-morgue-modal-overlay" onClick={() => setShowChangelog(false)}>
          <div className="pr-morgue-modal" onClick={e => e.stopPropagation()}>
            <div className="pr-morgue-modal-header">
              <h5><i className="fas fa-save"></i> Save / Load Project</h5>
              <button className="pr-morgue-close" onClick={() => setShowChangelog(false)}>
                <i className="fas fa-times"></i>
              </button>
            </div>
            <div className="pr-changelog-save">
              <input
                type="text"
                placeholder="Project name (optional)..."
                value={changelogName}
                onChange={e => setChangelogName(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && saveProject()}
              />
              <button className="pr-btn pr-btn-primary" onClick={saveProject}>
                <i className="fas fa-save"></i> Save Current
              </button>
            </div>
            <div className="pr-morgue-list">
              {savedProjects.length === 0 ? (
                <div className="pr-morgue-empty">No saved projects yet.</div>
              ) : (
                savedProjects.map(p => (
                  <div key={p.id} className="pr-morgue-item pr-saved-project">
                    <div className="pr-saved-project-info" onClick={() => loadProject(p)}>
                      <div className="pr-morgue-item-name">{p.name}</div>
                      <div className="pr-morgue-item-meta">
                        <span><i className="fas fa-clock"></i> {new Date(p.savedAt).toLocaleString()}</span>
                        <span><i className="fas fa-layer-group"></i> {p.elements?.length || 0} elements</span>
                      </div>
                    </div>
                    <button className="pr-saved-delete" onClick={() => deleteProject(p.id)} title="Delete">
                      <i className="fas fa-trash"></i>
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      <style>{`
        .pr-btn-accent {
          background: linear-gradient(135deg, #6c63ff, #e94560);
          color: #fff;
          border: none;
          padding: 6px 14px;
          border-radius: 6px;
          font-size: 0.85rem;
          font-weight: 600;
          cursor: pointer;
          transition: transform 0.15s, box-shadow 0.15s;
        }
        .pr-btn-accent:hover {
          transform: translateY(-1px);
          box-shadow: 0 4px 12px rgba(108, 99, 255, 0.4);
        }
        .pr-btn-save {
          background: linear-gradient(135deg, #2ecc71, #27ae60);
          color: #fff;
          border: none;
          padding: 6px 14px;
          border-radius: 6px;
          font-size: 0.85rem;
          font-weight: 600;
          cursor: pointer;
          transition: transform 0.15s, box-shadow 0.15s;
        }
        .pr-btn-save:hover {
          transform: translateY(-1px);
          box-shadow: 0 4px 12px rgba(46, 204, 113, 0.4);
        }
        .pr-changelog-save {
          display: flex;
          gap: 8px;
          padding: 12px 20px;
          border-bottom: 1px solid #30363d;
        }
        .pr-changelog-save input {
          flex: 1;
          padding: 8px 12px;
          background: #0d1117;
          border: 1px solid #30363d;
          border-radius: 6px;
          color: #f0f6fc;
          font-size: 0.85rem;
          outline: none;
        }
        .pr-changelog-save input:focus {
          border-color: #2ecc71;
        }
        .pr-saved-project {
          display: flex;
          align-items: center;
          gap: 8px;
        }
        .pr-saved-project-info {
          flex: 1;
          cursor: pointer;
        }
        .pr-saved-delete {
          background: none;
          border: none;
          color: #8b949e;
          padding: 8px;
          cursor: pointer;
          border-radius: 4px;
          font-size: 0.9rem;
        }
        .pr-saved-delete:hover {
          background: rgba(233, 69, 96, 0.2);
          color: #e94560;
        }
        .pr-morgue-modal-overlay {
          position: fixed;
          inset: 0;
          background: rgba(0, 0, 0, 0.7);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 10000;
          backdrop-filter: blur(4px);
        }
        .pr-morgue-modal {
          background: #161b22;
          border: 1px solid #30363d;
          border-radius: 12px;
          width: 500px;
          max-height: 80vh;
          display: flex;
          flex-direction: column;
          box-shadow: 0 20px 60px rgba(0, 0, 0, 0.5);
        }
        .pr-morgue-modal-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 16px 20px;
          border-bottom: 1px solid #30363d;
        }
        .pr-morgue-modal-header h5 {
          margin: 0;
          color: #f0f6fc;
          font-size: 1rem;
        }
        .pr-morgue-close {
          background: none;
          border: none;
          color: #8b949e;
          font-size: 1.2rem;
          cursor: pointer;
          padding: 4px 8px;
          border-radius: 4px;
        }
        .pr-morgue-close:hover {
          background: #21262d;
          color: #f0f6fc;
        }
        .pr-morgue-search {
          padding: 12px 20px;
          border-bottom: 1px solid #30363d;
        }
        .pr-morgue-search input {
          width: 100%;
          padding: 8px 12px;
          background: #0d1117;
          border: 1px solid #30363d;
          border-radius: 6px;
          color: #f0f6fc;
          font-size: 0.85rem;
          outline: none;
        }
        .pr-morgue-search input:focus {
          border-color: #6c63ff;
        }
        .pr-morgue-list {
          flex: 1;
          overflow-y: auto;
          padding: 8px;
        }
        .pr-morgue-empty {
          text-align: center;
          color: #8b949e;
          padding: 40px 20px;
          font-size: 0.9rem;
        }
        .pr-morgue-item {
          padding: 12px 16px;
          border-radius: 8px;
          cursor: pointer;
          transition: background 0.15s;
          border: 1px solid transparent;
        }
        .pr-morgue-item:hover {
          background: #21262d;
          border-color: #30363d;
        }
        .pr-morgue-item-case {
          font-size: 0.7rem;
          color: #6c63ff;
          font-weight: 700;
          margin-bottom: 2px;
        }
        .pr-morgue-item-name {
          color: #f0f6fc;
          font-weight: 600;
          font-size: 0.95rem;
          margin-bottom: 4px;
        }
        .pr-morgue-item-meta {
          display: flex;
          gap: 12px;
          font-size: 0.75rem;
          color: #8b949e;
        }
        .pr-morgue-item-meta span {
          display: flex;
          align-items: center;
          gap: 4px;
        }
        .pr-morgue-item-cause {
          margin-top: 6px;
          font-size: 0.75rem;
          color: #e94560;
          display: flex;
          align-items: center;
          gap: 4px;
        }
        .pr-morgue-modal-review {
          width: 700px;
          max-height: 90vh;
        }
        .pr-review-content {
          flex: 1;
          overflow-y: auto;
          padding: 16px 20px;
        }
        .pr-review-section {
          margin-bottom: 20px;
        }
        .pr-review-section h6 {
          margin: 0 0 12px;
          color: #6c63ff;
          font-size: 0.9rem;
          display: flex;
          align-items: center;
          gap: 8px;
          padding-bottom: 8px;
          border-bottom: 1px solid #30363d;
        }
        .pr-review-grid {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 12px;
        }
        .pr-review-item {
          background: #0d1117;
          padding: 10px 12px;
          border-radius: 6px;
          border: 1px solid #30363d;
        }
        .pr-review-item label {
          display: block;
          font-size: 0.7rem;
          color: #8b949e;
          text-transform: uppercase;
          margin-bottom: 4px;
        }
        .pr-review-item span {
          color: #f0f6fc;
          font-size: 0.85rem;
        }
        .pr-review-findings {
          margin: 0;
          padding-left: 20px;
          color: #f0f6fc;
          font-size: 0.85rem;
        }
        .pr-review-findings li {
          margin-bottom: 6px;
        }
        .pr-review-warning {
          color: #f59e0b;
          font-size: 0.85rem;
          display: flex;
          align-items: center;
          gap: 8px;
          background: rgba(245, 158, 11, 0.1);
          padding: 10px 12px;
          border-radius: 6px;
          border: 1px solid rgba(245, 158, 11, 0.3);
        }
        .pr-review-casings {
          margin-top: 12px;
          background: #0d1117;
          padding: 10px 12px;
          border-radius: 6px;
          border: 1px solid #30363d;
        }
        .pr-review-casings strong {
          color: #8b949e;
          font-size: 0.75rem;
          display: block;
          margin-bottom: 6px;
        }
        .pr-review-casings pre {
          margin: 0;
          color: #f0f6fc;
          font-size: 0.8rem;
          white-space: pre-wrap;
          font-family: inherit;
        }
        .pr-review-field {
          margin-bottom: 16px;
        }
        .pr-review-field label {
          display: block;
          font-size: 0.8rem;
          color: #8b949e;
          margin-bottom: 6px;
          font-weight: 600;
        }
        .pr-review-textarea {
          width: 100%;
          padding: 10px 12px;
          background: #0d1117;
          border: 1px solid #30363d;
          border-radius: 6px;
          color: #f0f6fc;
          font-size: 0.85rem;
          font-family: inherit;
          resize: vertical;
          outline: none;
        }
        .pr-review-textarea:focus {
          border-color: #6c63ff;
        }
        .pr-review-textarea-large {
          min-height: 120px;
        }
        .pr-review-death-type {
          display: flex;
          gap: 8px;
        }
        .pr-review-type-btn {
          flex: 1;
          padding: 10px;
          background: #0d1117;
          border: 1px solid #30363d;
          border-radius: 6px;
          color: #8b949e;
          font-size: 0.85rem;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.15s;
        }
        .pr-review-type-btn:hover {
          border-color: #6c63ff;
          color: #f0f6fc;
        }
        .pr-review-type-btn.active {
          background: #6c63ff;
          border-color: #6c63ff;
          color: #fff;
        }
        .pr-review-actions {
          display: flex;
          gap: 12px;
          padding: 16px 20px;
          border-top: 1px solid #30363d;
          justify-content: flex-end;
        }
      `}</style>
    </div>
  );
};

export default PRDashboard;
