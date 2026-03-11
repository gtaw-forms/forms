// src/formSchemas/decedentSchema.js

// Define common layout options for reuse
const compact50 = { layout: 'compact-50' };
const compact33 = { layout: 'compact-33' };
const full = { layout: 'full' };

// Reusable components for specific field types could be defined here
const textInput = (name, label, placeholder, layout = compact50) => ({
  name,
  label,
  type: 'text',
  placeholder,
  ...layout,
});

const textareaInput = (name, label, placeholder, rows = 4, layout = full, allowImagePaste = false, linkedImageField = '') => ({
  name,
  label,
  type: 'textarea',
  rows,
  placeholder,
  ...layout,
  ...(allowImagePaste && { allowImagePaste, linkedImageField }), // Conditionally add image paste properties
});

const imageInput = (name, label, maxImages = 3) => ({
  name,
  label,
  type: 'image',
  maxImages,
});

const sectionHeader = (label) => ({
  type: 'section',
  label,
});

const selectInput = (name, label, optionsKey, layout = compact50) => ({
  name,
  label,
  type: 'select',
  optionsKey,
  ...layout,
});

export const decedentItemSchema = [
  sectionHeader('Identification'),
  textInput('decedentName', 'Decedent Name', 'Full Name', compact50),
  textInput('decedentOOC', 'Decedent OOC', 'Out-of-Character Name', compact50),
  textareaInput('cexamine', 'Physical Description (/cexamine)', 'Enter the results of /cexamine here...', 3),
  {
    name: 'cdna',
    label: 'DNA Profile (/cdna)',
    type: 'text',
    placeholder: 'Enter DNA String (Double-click to copy in viewer)',
    ...full,
    allowCopy: true // Hint for the renderer
  },
  
  sectionHeader('Forensic Details'),
  // User requested BAC and Narcotics at the top
  textInput('bacLevel', 'Blood Alcohol Content (BAC)', 'e.g. 0.08%', compact50),
  textInput('narcotics', 'Narcotics / Tox Screen', 'e.g. Cocaine, THC, None', compact50),
  
  textInput('pronouncedTimeOfDeath', 'Probable Time of Death', 'e.g., 04/20/2024 14:30', compact50),
  textInput('probableCauseOfDeath', 'Probable Cause of Death', 'e.g., Gunshot Wound, Blunt Force Trauma', compact50),
  selectInput('mannerOfDeath', 'Manner of Death', 'mannerOfDeathOptions', compact50),
  selectInput('typeOfDeath', 'Type of Death', 'typeOfDeathOptions', compact50),

  sectionHeader('Autopsy & Striations'),
  textareaInput('cdamages', 'Autopsy Findings (/cdamages)', 'Transcription of /cdamages (e.g., Gunshot to Torso)...', 4),
  textareaInput('setinjuries', 'Injury Details (/setinjuries)', 'Detailed injury descriptions if applicable...', 3),
  
  {
    name: 'striationMarks',
    label: 'Striation Marks & Caliber',
    type: 'textarea',
    placeholder: 'Enter striation data (e.g. 9mm, 5.56mm)...',
    rows: 2,
    ...full,
  },

  sectionHeader('Evidence & Media'),
  imageInput('scenePhotos', 'Scene Photos & Evidence', 6),
  imageInput('additionalImages', 'Post URLs / Images', 6),
];
