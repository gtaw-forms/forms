// src/formSchemas/decedentSchema.js

// Define common layout options for reuse
const compact50 = { layout: 'compact-50' };
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

export const decedentItemSchema = [
  sectionHeader('Identification'),
  textInput('decedentName', 'Decedent Name', 'Full Name', compact50),
  textInput('decedentOOC', 'Decedent OOC', 'Out-of-Character Name', compact50),
  
  sectionHeader('Medical Findings'),
  textareaInput('synopsis', 'Injuries / Things of Note', 'Brief synopsis of the decedent, injuries, etc.', 3),
  textInput('pronouncedTimeOfDeath', 'Probable Time of Death', 'e.g., 04/20/2024 14:30', compact50),
  textInput('probableCauseOfDeath', 'Probable Cause of Death', 'e.g., Gunshot Wound, Blunt Force Trauma', compact50),
  {
    name: 'mannerOfDeath',
    label: 'Manner of Death',
    type: 'select',
    optionsKey: 'mannerOfDeathOptions',
    ...compact50,
  },
  {
    name: 'typeOfDeath',
    label: 'Type of Death',
    type: 'select',
    optionsKey: 'typeOfDeathOptions',
    ...compact50,
  },
  
  sectionHeader('Scene Evidence'),
  imageInput('scenePhotos', 'Scene Photos & Evidence', 6),
  textareaInput('scenePhotos_narrative', 'Scene Notes / Narrative', 'This supports raw text in the event you forget images', 3),
  
  sectionHeader('Morgue, Damages and CDNA'),
  imageInput('additionalImages', 'Post URLs / Images', 6),
  textareaInput('additionalImages_narrative', 'Morgue / Damages / CDNA Notes', 'This supports raw text in the event you forget images.', 3),
];
