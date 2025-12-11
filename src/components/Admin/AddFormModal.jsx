// src/components/admin/AddFormModal.jsx
import React, { useState, useEffect } from "react";
import { database } from "../../firebase";
import { ref, update } from "firebase/database";
import Select from 'react-select';
import useGtaWorldAuth from '../../hooks/useGtaWorldAuth';
import { logAdminActionToDiscord } from '../../utils/adminLogger';
import BulkAddFieldsModal from './BulkAddFieldsModal'; // Import the new modal
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { SortableFieldItem } from './SortableFieldItem';
const inputStyle = {
  width: "100%",
  padding: "0.75rem",
  marginBottom: "1rem",
  background: "#1e293b",
  border: "1px solid #334155",
  color: "#e2e8f0",
  borderRadius: 8,
  fontSize: "1rem"
};

const AddFormModal = ({ show, onClose, editingForm = null, user }) => {
  const { user: gtawUser } = useGtaWorldAuth(); // Get authenticated user for logging

  const [formId, setFormId] = useState("");
  const [formName, setFormName] = useState("");
  const [category, setCategory] = useState("");
  const [bbcodeTemplate, setBbcodeTemplate] = useState("");
  const [titleGeneratorCode, setTitleGeneratorCode] = useState(""); // New state
  const [fields, setFields] = useState([]);
  const [accessType, setAccessType] = useState("Public"); // New state for form access control (e.g., "Public", "PHMC", "Coroner", "Civilian")
  const [formDescription, setFormDescription] = useState("");
  const [isHidden, setIsHidden] = useState(false); // NEW STATE

  const createDefaultNewField = () => ({
    type: "input",
    label: "",
    name: "",
    placeholder: "",
    layout: "full",
    rows: 4,
    maxImages: 6,
    optionsKey: "",
    timerType: "",
    buttonLabel: "",
    buttonAction: "",
    displayCurrentTime: false,
    id: null, // New: Unique ID for field for editing purposes
    associatedInputField: null,
    options: [],
    inputType: "",
    showIf: null,
    infoType: 'Information', // Default for information_state
    content: '', // Default for information_state
    decedentItemSchemaJson: "", // New: Schema for decedent list items
    paymentTotal: 0,
  });

  const [newField, setNewField] = useState(createDefaultNewField());

  const [editingFieldIndex, setEditingFieldIndex] = useState(null); // New state to track which field is being edited

  const [showConditionalBuilder, setShowConditionalBuilder] = useState(false);
  const [conditionalField, setConditionalField] = useState("");
  const [conditionalValue, setConditionalValue] = useState("");
  const [tempConditions, setTempConditions] = useState([]);
  const [conditionMode, setConditionMode] = useState("and");
  const [exactValue, setExactValue] = useState("");

  // State for Bulk Conditional Editor
  const [showBulkEditor, setShowBulkEditor] = useState(false);
  const [bulkSelectedFields, setBulkSelectedFields] = useState([]);
  const [bulkShowIf, setBulkShowIf] = useState(null);
  const [bulkTempConditions, setBulkTempConditions] = useState([]);
  const [bulkConditionMode, setBulkConditionMode] = useState('and');
  const [bulkConditionalField, setBulkConditionalField] = useState('');
  const [bulkConditionalValue, setBulkConditionalValue] = useState('');
  const [bulkExactValue, setBulkExactValue] = useState('');

  // State for Bulk Add Modal
  const [showBulkAddModal, setShowBulkAddModal] = useState(false);

  useEffect(() => {
    if (editingForm) {
      setFormId(editingForm.id || "");
      setFormName(editingForm.name || "");
      setCategory(editingForm.category || "");
      setBbcodeTemplate(editingForm.template || "");
      setTitleGeneratorCode(editingForm.titleGeneratorCode || ""); // Load existing code
      // Ensure all loaded fields have an 'id' for consistent editing
      const safeFields = (editingForm.fields || []).map(f => ({
        ...f,
        id: f.id || `field-${Date.now()}-${Math.random().toString(36).substr(2, 9)}` // Assign a unique ID if missing
      }));
      setFields(safeFields);
      setAccessType(editingForm.accessType || "Public"); // Load accessType
      setFormDescription(editingForm.formDescription || ""); // Load form description
      setIsHidden(!!editingForm.isHidden); // Load isHidden
      setNewField(createDefaultNewField()); // Reset newField to default for adding new fields
      setEditingFieldIndex(null); // Ensure no field is selected for editing initially
    } else {
      resetForm();
    }
  }, [editingForm]);

  const resetForm = () => {
    setFormId("");
    setFormName("");
    setCategory("");
    setBbcodeTemplate("");
    setTitleGeneratorCode(""); // Reset new state
    setFields([]);
    setAccessType("Public"); // Reset accessType
    setFormDescription(""); // Reset form description
    setIsHidden(false); // Reset isHidden
    setNewField(createDefaultNewField());
    setEditingFieldIndex(null); // Ensure editing mode is off when resetting the form
  };

  const saveField = () => {
    // Assign a temporary ID if adding a new field without one
    const fieldToSave = { ...newField };
    if (editingFieldIndex === null && !fieldToSave.id) {
        fieldToSave.id = `field-${Date.now()}`;
    }

    if (fieldToSave.type === "hr") {
      setFields(prevFields => {
        if (editingFieldIndex !== null) {
          const updatedFields = [...prevFields];
          updatedFields[editingFieldIndex] = { type: "hr", id: fieldToSave.id };
          return updatedFields;
        }
        return [...prevFields, { type: "hr", id: fieldToSave.id }];
      });
    } else if (fieldToSave.type === "fake_line") {
      setFields(prevFields => {
        if (editingFieldIndex !== null) {
          const updatedFields = [...prevFields];
          updatedFields[editingFieldIndex] = { type: "fake_line", id: fieldToSave.id };
          return updatedFields;
        }
        return [...prevFields, { type: "fake_line", id: fieldToSave.id }];
      });
    } else if (fieldToSave.type === "small_header") {
      if (!fieldToSave.label) {
        alert("Header Text is required for Small Header!");
        return;
      }
      const finalName = fieldToSave.name || `header_${fields.length + 1}`;
      setFields(prevFields => {
        if (editingFieldIndex !== null) {
          const updatedFields = [...prevFields];
          updatedFields[editingFieldIndex] = { ...fieldToSave, name: finalName, id: fieldToSave.id };
          return updatedFields;
        }
        return [...prevFields, { ...fieldToSave, name: finalName, id: fieldToSave.id }];
      });
    } else if (fieldToSave.type === "timer") {
        if (!fieldToSave.label || !fieldToSave.name || !fieldToSave.timerType) {
            alert("Label, Name, and Timer Type are required for Timer!");
            return;
        }
        if (fieldToSave.buttonLabel && !fieldToSave.buttonAction) {
            alert("If Button Label is provided, Button Action is required for Timer!");
            return;
        }
        setFields(prevFields => {
            if (editingFieldIndex !== null) {
                const updatedFields = [...prevFields];
                updatedFields[editingFieldIndex] = { ...fieldToSave, id: fieldToSave.id };
                return updatedFields;
            }
            return [...prevFields, { ...fieldToSave, id: fieldToSave.id }];
        });
    } else if (fieldToSave.type === "checkbox") {
        if (!fieldToSave.label || !fieldToSave.name) {
            alert("Label and Name are required for Checkbox!");
            return;
        }
        if (fieldToSave.associatedInputField) {
            if (!fieldToSave.associatedInputField.name || !fieldToSave.associatedInputField.type) {
                alert("Associated Input Field Name and Type are required!");
                return;
            }
            if (fieldToSave.associatedInputField.type === "select" && !fieldToSave.associatedInputField.optionsKey) {
                alert("Associated Input Options Key is required for Select type!");
                return;
            }
        }
        
        setFields(prevFields => {
            if (editingFieldIndex !== null) {
                const updatedFields = [...prevFields];
                updatedFields[editingFieldIndex] = { ...fieldToSave, id: fieldToSave.id };
                return updatedFields;
            }
            return [...prevFields, { ...fieldToSave, id: fieldToSave.id }];
        });
    } else if (fieldToSave.type === "radio") {
        if (!fieldToSave.label || !fieldToSave.name || fieldToSave.options.length === 0) {
            alert("Label, Name, and Options are required for Radio Buttons!");
            return;
        }
        setFields(prevFields => {
            if (editingFieldIndex !== null) {
                const updatedFields = [...prevFields];
                updatedFields[editingFieldIndex] = { ...fieldToSave, id: fieldToSave.id };
                return updatedFields;
            }
            return [...prevFields, { ...fieldToSave, id: fieldToSave.id }];
        });
    } else if (fieldToSave.type === "input_button_combo") {
        if (!fieldToSave.label || !fieldToSave.name || !fieldToSave.inputType || !fieldToSave.buttonLabel || !fieldToSave.buttonAction) {
            alert("Label, Name, Input Type, Button Label, and Button Action are required for Input Button Combo!");
            return;
        }
        setFields(prevFields => {
            if (editingFieldIndex !== null) {
                const updatedFields = [...prevFields];
                updatedFields[editingFieldIndex] = { ...fieldToSave, id: fieldToSave.id };
                return updatedFields;
            }
            return [...prevFields, { ...fieldToSave, id: fieldToSave.id }];
        });
    } else if (fieldToSave.type === "attach_report_button") {
        if (!fieldToSave.label || !fieldToSave.employeeType || !fieldToSave.targetField) {
            alert("Label, Employee Type, and Target Field are required for Attach Report Button!");
            return;
        }
        setFields(prevFields => {
            if (editingFieldIndex !== null) {
                const updatedFields = [...prevFields];
                updatedFields[editingFieldIndex] = { ...fieldToSave, id: fieldToSave.id };
                return updatedFields;
            }
            return [...prevFields, { ...fieldToSave, id: fieldToSave.id }];
        });
    } else if (fieldToSave.type === "payment_button") {
        if (!fieldToSave.label || !fieldToSave.name) {
            alert("Label and Name are required for Payment Button!");
            return;
        }
        if (typeof fieldToSave.paymentTotal !== 'number' || isNaN(fieldToSave.paymentTotal) || fieldToSave.paymentTotal < 0) {
            alert("Payment Total must be a non-negative number!");
            return;
        }
        setFields(prevFields => {
            if (editingFieldIndex !== null) {
                const updatedFields = [...prevFields];
                updatedFields[editingFieldIndex] = { ...fieldToSave, id: fieldToSave.id };
                return updatedFields;
            }
            return [...prevFields, { ...fieldToSave, id: fieldToSave.id }];
        });
    } else if (fieldToSave.type === "decedent_list") {
        const finalName = "decedents"; // Fixed name for decedent list
        const defaultDecedentSchema = [
          {
            name: "decedentName",
            label: "Decedent Name",
            type: "text",
            placeholder: "Full Name",
            layout: "compact-50"
          },
          {
            name: "decedentOOC",
            label: "Decedent OOC",
            type: "text",
            placeholder: "Out-of-Character Name",
            layout: "compact-50"
          },
          {
            name: "synopsis",
            label: "Decedent Injuries / Things of Note", // Updated label for synopsis
            type: "textarea",
            rows: 4,
            placeholder: "Brief synopsis of the decedent, injuries, etc."
          },
          {
            name: "pronouncedTimeOfDeath",
            label: "Probable Time of Death",
            type: "text", // Could be 'timer' with type 'datetime-local' if precise
            placeholder: "e.g., 04/20/2024 14:30",
            layout: "compact-50"
          },
          {
            name: "probableCauseOfDeath",
            label: "Probable Cause of Death",
            type: "text",
            placeholder: "e.g., Gunshot Wound, Blunt Force Trauma",
            layout: "compact-50"
          },
          {
            name: "mannerOfDeath",
            label: "Manner of Death",
            type: "select",
            optionsKey: "mannerOfDeathOptions",
            layout: "compact-50"
          },
          {
            name: "typeOfDeath",
            label: "Type of Death",
            type: "select",
            optionsKey: "typeOfDeathOptions",
            layout: "compact-50"
          },
          {
            name: "scenePhotos",
            label: "Scene Photos",
            type: "image",
            maxImages: 3
          },
          {
            type: "textarea",
            label: "Scene Photos - Notes",
            name: "scenePhotos_narrative",
            placeholder: "Write notes or paste screenshots here (Ctrl+V)",
            rows: 6,
            allowImagePaste: true,
            linkedImageField: "scenePhotos", // Links to the 'scenePhotos' image field
            layout: "full"
          },
          {
            name: "additionalImages",
            label: "Additional Images",
            type: "image",
            maxImages: 3
          },
          {
            type: "textarea",
            label: "Additional Images - Notes",
            name: "additionalImages_narrative",
            placeholder: "Write notes or paste screenshots here (Ctrl+V)",
            rows: 6,
            allowImagePaste: true,
            linkedImageField: "additionalImages", // Links to the 'additionalImages' image field
            layout: "full"
          }
        ];
        const decedentItemSchemaJson = JSON.stringify(defaultDecedentSchema, null, 2);

        setFields(prevFields => {
            if (editingFieldIndex !== null) {
                const updatedFields = [...prevFields];
                updatedFields[editingFieldIndex] = { type: "decedent_list", name: finalName, id: fieldToSave.id, decedentItemSchemaJson: decedentItemSchemaJson };
                return updatedFields;
            }
            return [...prevFields, { type: "decedent_list", name: finalName, id: fieldToSave.id, decedentItemSchemaJson: decedentItemSchemaJson }];
        });
    } else if (fieldToSave.type === "dynamic_text_list") {
        if (!fieldToSave.label || !fieldToSave.name || !fieldToSave.buttonLabel) {
            alert("Label, Name and Button Label are required for Dynamic Text List!");
            return;
        }
        setFields(prevFields => {
            if (editingFieldIndex !== null) {
                const updatedFields = [...prevFields];
                updatedFields[editingFieldIndex] = { ...fieldToSave, id: fieldToSave.id };
                return updatedFields;
            }
            return [...prevFields, { ...fieldToSave, id: fieldToSave.id }];
        });
    } else if (fieldToSave.type === "autopsy_diagram_button") {
        if (!fieldToSave.label || !fieldToSave.name) {
            alert("Label and Name are required for Autopsy Diagram Button!");
            return;
        }
        setFields(prevFields => {
            if (editingFieldIndex !== null) {
                const updatedFields = [...prevFields];
                updatedFields[editingFieldIndex] = { ...fieldToSave, id: fieldToSave.id };
                return updatedFields;
            }
            return [...prevFields, { ...fieldToSave, id: fieldToSave.id }];
        });
    } else if (fieldToSave.type === "information_state") {
        if (!fieldToSave.content) {
            alert("Content is required for Information State!");
            return;
        }
        const finalName = fieldToSave.name || `info_${fields.length + 1}`;
        setFields(prevFields => {
            if (editingFieldIndex !== null) {
                const updatedFields = [...prevFields];
                updatedFields[editingFieldIndex] = { ...fieldToSave, name: finalName, id: fieldToSave.id };
                return updatedFields;
            }
            return [...prevFields, { ...fieldToSave, name: finalName, id: fieldToSave.id }];
        });
    } else if (fieldToSave.type === "image") {
  if (!fieldToSave.label || !fieldToSave.name) {
    alert("Label and Name are required for Image field!");
    return;
  }

  const imageField = {
    ...fieldToSave,
    type: "image",
    maxImages: fieldToSave.maxImages || 6,
    id: fieldToSave.id || `img-${Date.now()}`
  };

  const narrativeField = {
    type: "textarea",
    label: `${fieldToSave.label} - Notes`,
    name: `${fieldToSave.name}_narrative`,
    placeholder: "Write notes or paste screenshots here (Ctrl+V)",
    rows: 6,
    allowImagePaste: true,
    linkedImageField: fieldToSave.name,
    layout: "full",
    id: `nar-${Date.now()}`
  };

  setFields(prevFields => {
    if (editingFieldIndex !== null) {
      const updated = [...prevFields];
      updated[editingFieldIndex] = imageField;

      const narrativeIndex = updated.findIndex(
        f => f.linkedImageField === fieldToSave.name && f.type === "textarea"
      );
      if (narrativeIndex !== -1) {
        updated[narrativeIndex] = {
          ...updated[narrativeIndex],
          label: narrativeField.label,
          placeholder: narrativeField.placeholder
        };
      }
      return updated;
    }

    return [...prevFields, imageField, narrativeField];
  });

  setNewField(createDefaultNewField());
  setEditingFieldIndex(null);
  return;
    } else if (fieldToSave.type === "multi_select") { // NEW MULTI_SELECT BLOCK
      if (!fieldToSave.label || !fieldToSave.name || !fieldToSave.optionsKey) {
        alert("Label, Name, and Options Key are required for Dropdown (Multiple Selection)!");
        return;
      }
      setFields(prevFields => {
        if (editingFieldIndex !== null) {
          const updatedFields = [...prevFields];
          updatedFields[editingFieldIndex] = { ...fieldToSave, id: fieldToSave.id };
          return updatedFields;
        }
        return [...prevFields, { ...fieldToSave, id: fieldToSave.id }];
      });
    } else if (fieldToSave.type === "character_selector") {
        if (!fieldToSave.label || !fieldToSave.name) {
            alert("Label and Name are required for Character Selector!");
            return;
        }
        setFields(prevFields => {
            if (editingFieldIndex !== null) {
                const updatedFields = [...prevFields];
                updatedFields[editingFieldIndex] = { ...fieldToSave, id: fieldToSave.id };
                return updatedFields;
            }
            return [...prevFields, { ...fieldToSave, id: fieldToSave.id }];
        });
    } else if (fieldToSave.type === "multi_employee_select") {
      if (!fieldToSave.label || !fieldToSave.name) {
        alert("Label and Name are required for Dropdown - Multiple Employees!");
        return;
      }
      // For multi_employee_select, options are implicitly 'phmcEmployees' and doesn't need to be configurable, and isMulti is true.
      setFields(prevFields => {
        if (editingFieldIndex !== null) {
          const updatedFields = [...prevFields];
          updatedFields[editingFieldIndex] = { ...fieldToSave, isMulti: true, id: fieldToSave.id };
          return updatedFields;
        }
        return [...prevFields, { ...fieldToSave, isMulti: true, id: fieldToSave.id }];
      });
    } else if (fieldToSave.type === "employee_select") { // NEW EMPLOYEE_SELECT BLOCK
      if (!fieldToSave.label || !fieldToSave.name) {
        alert("Label and Name are required for Dropdown - Employee Selector!");
        return;
      }
      // For employee_select, options are implicitly 'phmcEmployees' and doesn't need to be configurable
      setFields(prevFields => {
        if (editingFieldIndex !== null) {
          const updatedFields = [...prevFields];
          updatedFields[editingFieldIndex] = { ...fieldToSave, id: fieldToSave.id };
          return updatedFields;
        }
        return [...prevFields, { ...fieldToSave, id: fieldToSave.id }];
      });
    } else {
      if (!fieldToSave.label || !fieldToSave.name) {
        alert("Label and Name are required!");
        return;
      }
      setFields(prevFields => {
        if (editingFieldIndex !== null) {
          const updatedFields = [...prevFields];
          updatedFields[editingFieldIndex] = { ...fieldToSave, id: fieldToSave.id };
          return updatedFields;
        }
        return [...prevFields, { ...fieldToSave, id: fieldToSave.id }];
      });
    }

    setNewField(createDefaultNewField()); // Reset to default after saving
    setEditingFieldIndex(null); // Exit editing mode
    setShowConditionalBuilder(false);
  };

  const removeField = (id) => setFields(fields.filter(f => f.id !== id));

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleDragEnd = (event) => {
    const {active, over} = event;
    
    if (active.id !== over.id) {
      setFields((items) => {
        const oldIndex = items.findIndex((item) => item.id === active.id);
        const newIndex = items.findIndex((item) => item.id === over.id);
        
        return arrayMove(items, oldIndex, newIndex);
      });
    }
  };

  const startEditField = (fieldToEdit, index) => {
    // Make a deep copy to avoid direct mutation of the original field in the `fields` array
    setNewField(JSON.parse(JSON.stringify(fieldToEdit)));
    setEditingFieldIndex(index);
    setShowConditionalBuilder(false); // Hide conditional builder when editing field
    setTempConditions([]); // Clear temporary conditions
  };

const addCondition = () => {
  if (!conditionalField) return;
  let value = conditionalValue === "filled" ? true : conditionalValue === "empty" ? false : exactValue;
  if (conditionalValue === "exact" && !exactValue) return alert("Enter exact value");

  setTempConditions([...tempConditions, { field: conditionalField, value }]);
  setConditionalField("");
  setConditionalValue("");
  setExactValue("");
};

const removeTempCondition = (i) => setTempConditions(tempConditions.filter((_, idx) => idx !== i));

const applyAdvancedCondition = () => {
  if (tempConditions.length === 0) return;

  const showIf = tempConditions.length === 1
    ? { field: tempConditions[0].field, value: tempConditions[0].value }
    : { mode: conditionMode, conditions: tempConditions };

  setNewField({ ...newField, showIf });
  setTempConditions([]);
  setConditionMode("and");
  setShowConditionalBuilder(false);
};

const addBulkCondition = () => {
    if (!bulkConditionalField) return;
    let value = bulkConditionalValue === "filled" ? true : bulkConditionalValue === "empty" ? false : bulkExactValue;
    if (bulkConditionalValue === "exact" && !bulkExactValue) return alert("Enter exact value for bulk condition");

    setBulkTempConditions([...bulkTempConditions, { field: bulkConditionalField, value }]);
    setBulkConditionalField("");
    setBulkConditionalValue("");
    setBulkExactValue("");
};

const removeBulkTempCondition = (i) => setBulkTempConditions(bulkTempConditions.filter((_, idx) => idx !== i));

const applyBulkConditionalLogic = () => {
    if (bulkSelectedFields.length === 0) {
        alert("Please select at least one field to apply the logic to.");
        return;
    }
    if (bulkTempConditions.length === 0) {
        alert("Please add at least one conditional rule.");
        return;
    }

    const showIfToApply = bulkTempConditions.length === 1
        ? { field: bulkTempConditions[0].field, value: bulkTempConditions[0].value }
        : { mode: bulkConditionMode, conditions: bulkTempConditions };
        
    setFields(currentFields => 
        currentFields.map(field => 
            bulkSelectedFields.some(selected => selected.value === field.id)
                ? { ...field, showIf: showIfToApply }
                : field
        )
    );

    // Reset bulk editor state
    setShowBulkEditor(false);
    setBulkSelectedFields([]);
    setBulkTempConditions([]);
    setBulkConditionMode('and');
    alert(`Conditional logic applied to ${bulkSelectedFields.length} fields.`);
};

const handleBulkAddFields = (fieldsToAdd) => {
    const validatedFields = fieldsToAdd.map(field => ({
        ...field,
        id: `field-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
    }));
    setFields(currentFields => [...currentFields, ...validatedFields]);
    setShowBulkAddModal(false); // Hide modal after adding
};

      const saveForm = () => {
      if (!formId || !formName) {
        alert("Form ID and Name required!");
        return;
      }
  
      const formData = {
        id: formId,
        name: formName,
        category,
        formDescription,
        template: bbcodeTemplate,
        titleGeneratorCode, // Save the titleGeneratorCode
        fields,
        accessType, // Store accessType
        isHidden, // Store isHidden
        lastUpdated: Date.now() // NEW: Add lastUpdated timestamp
      };
  
      update(ref(database, `forms/${formId}`), formData)
        .then(() => {
          alert("Form saved!");
          const actionType = editingForm ? 'modify' : 'add';
          
          // Use the passed 'user' prop (unified user) first, then fallback to gtawUser from the hook
          const userForLogging = user || gtawUser;

          const userDetails = {
              username: userForLogging?.displayName || userForLogging?.username || 'Unknown',
              id: userForLogging?.uid || userForLogging?.id || 'N/A'
          };
          logAdminActionToDiscord(actionType, formData, userDetails);
          onClose();
        })
        .catch(err => alert("Error: " + err.message));
    };
  if (!show) return null;

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.9)", zIndex: 9999, overflow: "auto" }}>
      <div style={{ maxWidth: 1100, margin: "2rem auto", background: "#0f172a", borderRadius: 16, overflow: "hidden" }} onClick={e => e.stopPropagation()}>
        <div style={{ background: "#1e293b", padding: "1.5rem", textAlign: "center" }}>
          <h2 style={{ margin: 0, color: "#e2e8f0" }}>{editingForm ? "Edit" : "Create"} Form</h2>
        </div>

        <div style={{ padding: "2rem" }}>
          <input placeholder="Form ID (e.g. medical_release)" value={formId} onChange={e => setFormId(e.target.value.replace(/\s/g, "_").toLowerCase())} style={inputStyle} disabled={!!editingForm} />
          <input placeholder="Form Name" value={formName} onChange={e => setFormName(e.target.value)} style={inputStyle} />
          <input placeholder="Category" value={category} onChange={e => setCategory(e.target.value)} style={inputStyle} />
          <textarea placeholder="Form Description" rows={3} value={formDescription} onChange={e => setFormDescription(e.target.value)} style={{ ...inputStyle, height: "auto" }} />

          <label style={{ display: "flex", alignItems: "center", color: "#e2e8f0", margin: "1rem 0" }}>
            <strong style={{ marginRight: "1rem" }}>Access Type:</strong>
            <select value={accessType} onChange={e => setAccessType(e.target.value)} style={{ ...inputStyle, margin: 0, width: 'auto', flexGrow: 1 }}>
              <option value="Public">Public (No Restriction)</option>
              <option value="PHMC">PHMC Staff Only</option>
              <option value="Coroner">Coroner / DMEC Only</option>
              <option value="Mental Health">Mental Health Only</option> // NEW: Mental Health Access
              <option value="Civilian">Civilian / Patient Files</option>
            </select>
          </label>

          {/* NEW: isHidden Checkbox */}
          <label style={{ display: "flex", alignItems: "center", color: "#e2e8f0", marginBottom: "1rem" }}>
            <input
              type="checkbox"
              checked={isHidden}
              onChange={e => setIsHidden(e.target.checked)}
              style={{ marginRight: "0.8rem", width: 'auto' }}
            />
            <strong style={{ flexGrow: 1 }}>Hide Form (Localhost Devs Only)</strong>
          </label>
          <h4 style={{ color: "#60a5fa", marginTop: "2rem" }}>Title Generator Function</h4>
          <div style={{ color: "#94a3b8", fontSize: "0.9rem", marginBottom: "1rem" }}>
            Create a template for the report title. <br />
            Use <code>[FORM_NAME]</code> for the form's name. <br />
            Use <code>{"{{fieldName}}"}</code> for form values (e.g., <code>{"{{PatientName}}"}</code>).
          </div>
          <textarea
            rows={6}
            value={titleGeneratorCode}
            onChange={e => setTitleGeneratorCode(e.target.value)}
            style={{ ...inputStyle, fontFamily: "monospace", maxHeight: "200px", overflowY: "auto" }}
            placeholder={`[FORM_NAME] - {{PatientName}}\n\nExample for decedents:\n(formName, formData) => {\n  let title = formName;\n  if (formData.decedents && Array.isArray(formData.decedents)) {\n    const decedentNames = formData.decedents\n      .map(dec => dec.decedentName)\n      .filter(name => name && name.trim() !== '')\n      .join(', ');\n    if (decedentNames) {\n      title += \` - \${decedentNames}\`;\n    }\n  }\n  return title;\n}`}
          />

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h4 style={{ color: "#60a5fa", marginTop: "2rem" }}>BBCode Template</h4>
<button
  onClick={() => {
    if (!bbcodeTemplate.trim()) {
      alert("Please paste a BBCode template first!");
      return;
    }

    let newTemplate = bbcodeTemplate;

    // ──────────────────────────────────────────────────────────────
    // 0. PRE-CLEANUP: Remove malformed [/cb] closing tags
    // ──────────────────────────────────────────────────────────────
    newTemplate = newTemplate.replace(/\[\/cb[^\]]*\]/g, '');

    // ──────────────────────────────────────────────────────────────
    // 1. Convert old ternary checkbox patterns → {{cb:variable}}
    // ──────────────────────────────────────────────────────────────
    newTemplate = newTemplate.replace(
      /\[cb\{\{\s*formData\.([a-zA-Z0-9_]+)\s*\?\.\s*includes\s*\(['"]([^'"]+)['"]\)\s*\?\s*['"]c['"]\s*:\s*['"]['"]\s*\}\}\]/g,
      (m, field) => `{{cb:${field}}}`
    );
    newTemplate = newTemplate.replace(
      /\[cb\$\{\s*formData\.([a-zA-Z0-9_]+)\s*===\s*['"]([^'"]+)['"]\s*\?\s*['"]c['"]\s*:\s*['"]['"]\s*\}\]/g,
      (m, field) => `{{cb:${field}}}`
    );

    // NEW: Handle [cb{{...}}] format
    newTemplate = newTemplate.replace(
      /\[cb\{\{([a-zA-Z0-9_]+)\s*===\s*['"]([^'"]+)['"]\s*\?\s*['"]c['"]\s*:\s*['"]['"]\}\}\]/g,
      `[cb:$1]`
    );

    // NEW: Convert single-select object-based ternaries to .includes() check
    newTemplate = newTemplate.replace(
      /\{\{formData\.([a-zA-Z0-9_]+)\s*===\s*['"]([^'"]+)['"]\s*\?\s*'X'\s*:\s*''\}\}/g,
      "{{formData.$1?.includes('$2') ? 'X' : ''}}"
    );

    // ──────────────────────────────────────────────────────────────
    // 2. Convert {{cb:variable}} → [cb:variable]
    // ──────────────────────────────────────────────────────────────
    newTemplate = newTemplate.replace(/\{\{cb:([a-zA-Z0-9_]+)\}\}/g, `[cb:$1]`);

    // ──────────────────────────────────────────────────────────────
    // 3. Convert old conditional ternary → [conditional]
    // ──────────────────────────────────────────────────────────────
    newTemplate = newTemplate.replace(
      /\$\{\s*formData\.([a-zA-Z0-9_]+)\s*===\s*['"]([^'"]+)['"]\s*\?\s*['"](c?)['"]\s*:\s*['"]['"]\s*\}/g,
      (m, field, value, c) => c ? `[conditional field="${field}" value="${value}"]c[/conditional]` : ''
    );

    // ──────────────────────────────────────────────────────────────
    // 4. Convert ${var} and {{var}} → {{var}}
    // ──────────────────────────────────────────────────────────────
    newTemplate = newTemplate.replace(/\$\{([^}]+)\}/g, (m, p1) => `{{${p1.trim()}}}`);
    newTemplate = newTemplate.replace(/\{\{([^}]+)\}\}/g, (m, p1) => `{{${p1.trim()}}}`);

    // ──────────────────────────────────────────────────────────────
    // 5. FIX [cb:field]Text ON SAME LINE → ONE PER LINE (THE HOLY GRAIL)
    // ──────────────────────────────────────────────────────────────
    newTemplate = newTemplate.replace(/\[cb:([^\]]+)\](.*?)(?=\[cb:|\r?\n|$)/gi, (match, field, text) => {
      const trimmed = text.trim();
      return trimmed ? `[cb:${field.trim()}]${trimmed}\n` : match;
    });

    // Split lines with multiple [cb:...] into separate lines
    const lines = newTemplate.split('\n');
    const fixedLines = [];

    for (let line of lines) {
      const matches = [...line.matchAll(/\[cb:([^\]]+)\]/g)];
      if (matches.length <= 1) {
        fixedLines.push(line);
        continue;
      }

      let remaining = line;
      for (const match of matches) {
        const full = match[0];
        const field = match[1];
        const index = remaining.indexOf(full);
        const before = remaining.slice(0, index);
        const afterMatch = remaining.slice(index + full.length);
        const optionText = afterMatch.match(/^([^\[\]]+)/)?.[0]?.trim() || "";

        if (before.trim()) fixedLines.push(before.trim());
        fixedLines.push(`[cb:${field}]${optionText}`);
        remaining = afterMatch.slice(optionText.length);
      }
      if (remaining.trim()) fixedLines.push(remaining.trim());
    }

    newTemplate = fixedLines.filter(Boolean).join("\n");


    // ──────────────────────────────────────────────────────────────
    // 7. Final cleanup
    // ──────────────────────────────────────────────────────────────
    newTemplate = newTemplate
      .replace(/\n{3,}/g, "\n\n")
      .replace(/^\s+|\s+$/gm, "")
      .replace(/\[cb:([^\]]+)\]\s+/g, "[cb:$1]");

    setBbcodeTemplate(newTemplate);
    alert("Legacy BBCode PARSED & PERFECTED!\n\nAll [cb:field] are on new lines\nOld patterns converted\nLabels bolded\nReady for 2025");
  }}
  style={{
    background: "linear-gradient(135deg, #8b5cf6, #6366f1)",
    color: "white",
    border: "none",
    padding: "1rem 2rem",
    borderRadius: 12,
    fontWeight: "bold",
    fontSize: "1.1rem",
    cursor: "pointer",
    boxShadow: "0 4px 20px rgba(139, 92, 246, 0.5)"
  }}
>
  Parse & Fix Legacy BBCode (ULTIMATE)
</button>
          </div>
          <div style={{ color: "#94a3b8", fontSize: "0.9rem", marginBottom: "1rem", padding: "1rem", background: "#162032", borderRadius: 8 }}>
            <h5 style={{ color: "#a78bfa", marginTop: 0 }}>BBCode Syntax Guide</h5>
            <ul style={{ paddingLeft: "20px", margin: 0 }}>
              <li style={{ marginBottom: '0.5rem' }}><strong>Field Values:</strong> <code>{"{{ fieldName }}"}</code><br />Replaces with the value of the specified field.</li>
              <li style={{ marginBottom: '0.5rem' }}><strong>JavaScript Expressions:</strong> <code>{"{{ ctx.field1 + ctx.field2 }}"}</code><br />Allows for simple JS logic. Use `ctx` to access form values.</li>
              <li style={{ marginBottom: '0.5rem' }}><strong>Checkboxes (for options):</strong> <code>[cb:fieldName]Option Text</code><br />Renders a checkbox for "Option Text". It will be checked if the value of `fieldName` matches "Option Text".</li>
              <li style={{ marginBottom: '0.5rem' }}><strong>Checkboxes (for presence):</strong> <code>[cb:fieldName]</code><br />Renders a single checkbox that is checked if `fieldName` has any value.</li>
              <li style={{ marginBottom: '0.5rem' }}><strong>Conditional (value exists):</strong> <code>[conditional field="fieldName"]...[/conditional]</code><br />Shows the enclosed content only if `fieldName` has a value.</li>
              <li style={{ marginBottom: '0.5rem' }}><strong>Conditional (value matches):</strong> <code>[conditional field="fieldName" value="expectedValue"]...[/conditional]</code><br />Shows the enclosed content only if the value of `fieldName` is exactly "expectedValue".</li>
            </ul>
          </div>

          <textarea
            rows={12}
            value={bbcodeTemplate}
            onChange={e => {
              setBbcodeTemplate(e.target.value);
              console.log('AddFormModal: bbcodeTemplate updated by textarea:', e.target.value);
            }}
            style={{ ...inputStyle, fontFamily: "monospace", maxHeight: "200px", overflowY: "auto" }}
          />

          {/* New: Title Generator Code Input */}

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: "2rem" }}>
            <h4 style={{ color: "#60a5fa", margin: 0 }}>Add Field</h4>
            <button 
              onClick={() => setShowBulkAddModal(true)} 
              style={{ background: "#4f46e5", color: "white", border: "none", padding: "0.5rem 1rem", borderRadius: 8, cursor: 'pointer', fontSize: '0.9rem' }}
            >
              Add Multiple Fields at Once
            </button>
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem", alignItems: "center" }}>
            <select value={newField.type} onChange={e => setNewField({ ...createDefaultNewField(), type: e.target.value })} style={{...inputStyle, flex: '1 1 auto', minWidth: '150px'}}>
              <option value="input">Text Input</option>
              <option value="textarea">Textarea</option>
              <option value="select">Dropdown</option>
              <option value="character_selector">Dropdown - Character Select</option>
              <option value="employee_select">Dropdown - Employee Selector</option>
              <option value="multi_employee_select">Dropdown - Multiple Employees</option>
              <option value="multi_select">Dropdown (Multiple Selection)</option> // NEW OPTION
              <option value="checkbox">Checkbox</option>
              <option value="radio">Radio Button</option>
              <option value="image">Image Upload</option>
              <option value="payment_button">Payment Button</option>
              <option value="hr">Horizontal Rule</option>
              <option value="fake_line">Fake Line</option>
              <option value="small_header">Small Header</option>
                            <option value="timer">Timer Field</option>
                            <option value="input_button_combo">Input Button Combo</option>
                            <option value="attach_report_button">Attach Report Button</option>
                            <option value="decedent_list">Decedent List</option>
                            <option value="dynamic_text_list">Dynamic Text List</option>
                            <option value="autopsy_diagram_button">Autopsy Diagram Button</option>
                            <option value="information_state">Information State</option>
                          </select>
              
                                                    {newField.type === "information_state" && (
                                                      <>
                                                          <select
                                                              value={newField.infoType}
                                                              onChange={e => setNewField({ ...newField, infoType: e.target.value })}
                                                              style={{...inputStyle, flex: '1 1 auto', minWidth: '150px'}}
                                                          >
                                                              <option value="Information">Information</option>
                                                              <option value="Warning">Warning</option>
                                                              <option value="Danger">Danger</option>
                                                          </select>
                                                          <textarea
                                                              placeholder="Content for the information state"
                                                              value={newField.content}
                                                              onChange={e => setNewField({ ...newField, content: e.target.value })}
                                                              style={{...inputStyle, flex: '1 1 100%', minWidth: '150px'}}
                                                              rows={3}
                                                          />
                                                      </>
                                                    )}
              
                                                    {newField.type !== "hr" && newField.type !== "decedent_list" && newField.type !== "information_state" && (
                                                      <input
                                                        placeholder={newField.type === "small_header" ? "Header Text" : "Label"}
                                                        value={newField.label}
                                                        onChange={e => setNewField({ ...newField, label: e.target.value })}
                                                        style={{...inputStyle, flex: '1 1 auto', minWidth: '150px'}}
                                                      />
                                                    )}                          
                          {newField.type !== "hr" && newField.type !== "small_header" && newField.type !== "attach_report_button" && newField.type !== "decedent_list" && newField.type !== "information_state" && (
                            <input 
                              placeholder="Name {{}}" 
                              value={newField.name} 
                              onChange={e => setNewField({ ...newField, name: e.target.value })} 
                              style={{...inputStyle, flex: '1 1 auto', minWidth: '150px'}} 
                            />
                          )}
                          {newField.type === "dynamic_text_list" && (
                            <input
                              placeholder="Button Label"
                              value={newField.buttonLabel}
                              onChange={e => setNewField({ ...newField, buttonLabel: e.target.value })}
                              style={{...inputStyle, flex: '1 1 auto', minWidth: '150px'}}
                            />
                          )}
              
                          {newField.type === "attach_report_button" && (
                            <>
                              <select
                                value={newField.employeeType}
                                onChange={e => setNewField({ ...newField, employeeType: e.target.value })}
                                style={{...inputStyle, flex: '1 1 auto', minWidth: '150px'}}
                              >
                                <option value="">— Select Employee Type —</option>
                                <option value="PHMC">PHMC</option>
                                <option value="Coroner">Coroner</option>
                              </select>
                              <input
                                placeholder="Target Field Name"
                                value={newField.targetField}
                                onChange={e => setNewField({ ...newField, targetField: e.target.value })}
                                style={{...inputStyle, flex: '1 1 auto', minWidth: '150px'}}
                              />
                            </>
                          )}
                          {newField.type === "decedent_list" && (
                            <div style={{ flexBasis: '100%', padding: '1rem', background: '#162032', borderRadius: 8 }}>
                                <div style={{ color: "#94a3b8", fontSize: "0.9rem", marginTop: '0.5rem' }}>
                                    The decedent list will automatically include fields for Name, OOC, Synopsis, Time/Cause/Manner/Type of Death, Scene Photos and their Notes, and Additional Images and their Notes.
                                </div>
                            </div>
                          )}
              
                          {newField.type !== "hr" && newField.type !== "checkbox" && newField.type !== "image" && newField.type !== "small_header" && newField.type !== "timer" && newField.type !== "radio" && newField.type !== "input_button_combo" && newField.type !== "attach_report_button" && newField.type !== "decedent_list" && newField.type !== "information_state" && (
                            <input 
                              placeholder="Placeholder" 
                              value={newField.placeholder} 
                              onChange={e => setNewField({ ...newField, placeholder: e.target.value })} 
                              style={{...inputStyle, flex: '1 1 auto', minWidth: '150px'}} 
                            />
                          )}
              
                          {newField.type !== "hr" && newField.type !== "checkbox" && newField.type !== "image" && newField.type !== "small_header" && newField.type !== "radio" && newField.type !== "input_button_combo" && newField.type !== "attach_report_button" && newField.type !== "information_state" && (
                            <select value={newField.layout || "full"} onChange={e => setNewField({ ...newField, layout: e.target.value })} style={{...inputStyle, flex: '1 1 auto', minWidth: '150px'}}>
                              <option value="full">Full Width</option>
                              <option value="compact-50">Compact (50%)</option>
                              <option value="compact-33">Compact (33%)</option>
                              <option value="compact">Compact (20%)</option>
                            </select>
                          )}
              
                          {newField.type === "textarea" && (
                            <input 
                              type="number" 
                              placeholder="Rows" 
                              value={newField.rows} 
                              onChange={e => setNewField({ ...newField, rows: +e.target.value || 4 })} 
                              style={{...inputStyle, flex: '1 1 auto', minWidth: '150px'}} 
                            />
                          )}
                                      {newField.type === "image" && (
                                        <input
                                          type="number"
                                          placeholder="Max Images"
                                          value={newField.maxImages}
                                          onChange={e => setNewField({ ...newField, maxImages: +e.target.value || 6 })}
                                          style={{...inputStyle, flex: '1 1 auto', minWidth: '150px'}}
                                        />
                                      )}
                                      
                                      {(newField.type === "select" || newField.type === "multi_select") && (
                                        <input
                                          placeholder="Options Key (e.g. dnrTypes)"
                                          value={newField.optionsKey}
                                          onChange={e => setNewField({ ...newField, optionsKey: e.target.value })}
                                          style={{...inputStyle, flex: '1 1 auto', minWidth: '150px'}}
                                        />
                                      )}                        
                                                  {/* New Timer fields */}
                                                  {newField.type === "timer" && (
                                                    <>
                                                      <select value={newField.timerType} onChange={e => setNewField({ ...newField, timerType: e.target.value })} style={{...inputStyle, flex: '1 1 auto', minWidth: '150px'}}>
                                                          <option value="">— Select Timer Type —</option>
                                                          <option value="datetime-local">Date & Time</option>
                                                          <option value="date">Date Only</option>
                                                          <option value="time">Time Only</option>
                                                      </select>
                                                      <input 
                                                        placeholder="Button Label (optional)" 
                                                        value={newField.buttonLabel} 
                                                        onChange={e => setNewField({ ...newField, buttonLabel: e.target.value })} 
                                                        style={{...inputStyle, flex: '1 1 auto', minWidth: '150px'}} 
                                                      />
                                                      {newField.buttonLabel && ( // Only show action if label is present
                                                        <select value={newField.buttonAction || ""} onChange={e => setNewField({ ...newField, buttonAction: e.target.value })} style={{...inputStyle, flex: '1 1 auto', minWidth: '150px'}}>
                                                            <option value="">— Select Button Action —</option>
                                                            <option value="set_current_time">Set Current Time</option>
                                                        </select>
                                                      )}
                                                      <label style={{ display: "flex", alignItems: "center", color: "#e2e8f0", marginTop: "0.5rem", flex: '1 1 auto', minWidth: '150px' }}>
                                                        <input
                                                          type="checkbox"
                                                          checked={newField.displayCurrentTime}
                                                          onChange={e => setNewField({ ...newField, displayCurrentTime: e.target.checked })}
                                                          style={{ marginRight: "0.8rem" }}
                                                        />
                                                        Show Current Server Time
                                                      </label>
                                                    </>
                                                  )}
                                      
                                                  {/* New Radio fields */}
                                                  {newField.type === "radio" && (
                                                    <textarea
                                                      placeholder="Options (comma-separated, e.g., Option A, Option B)"
                                                      value={newField.options.join(', ')}
                                                      onChange={e => setNewField({ ...newField, options: e.target.value.split(',').map(s => s.trim()).filter(s => s) })}
                                                      style={{...inputStyle, flex: '1 1 auto', minWidth: '150px'}} 
                                                    />
                                                  )}
              
                                                  {/* New Input Button Combo fields */}
                                                  {newField.type === "input_button_combo" && (
                                                    <>
                                                      <select value={newField.inputType} onChange={e => setNewField({ ...newField, inputType: e.target.value })} style={{...inputStyle, flex: '1 1 auto', minWidth: '150px'}}>
                                                          <option value="">— Select Input Type —</option>
                                                          <option value="text">Text</option>
                                                          <option value="datetime-local">Date & Time</option>
                                                          <option value="time">Time Only</option>
                                                      </select>
                                                      <input 
                                                        placeholder="Button Label" 
                                                        value={newField.buttonLabel} 
                                                        onChange={e => setNewField({ ...newField, buttonLabel: e.target.value })} 
                                                        style={{...inputStyle, flex: '1 1 auto', minWidth: '150px'}} 
                                                      />
                                                      <select value={newField.buttonAction || ""} onChange={e => setNewField({ ...newField, buttonAction: e.target.value })} style={{...inputStyle, flex: '1 1 auto', minWidth: '150px'}}>
                                                          <option value="">— Select Button Action —</option>
                                                          <option value="set_current_time">Set Current Time</option>
                                                      </select>
                                                    </>
                                                  )}
              
                                                  {/* New Payment Button fields */}
                                                  {newField.type === "payment_button" && (
                                                    <div style={{ flexBasis: '100%', padding: '1rem', background: '#162032', borderRadius: 8 }}>
                                                      <input
                                                        type="number"
                                                        placeholder="Payment Total (in cents, e.g., 2000 for $20.00)"
                                                        value={newField.paymentTotal || ''}
                                                        onChange={e => setNewField({ ...newField, paymentTotal: +e.target.value })}
                                                        style={{...inputStyle, width: '100%'}}
                                                      />
                                                      <div style={{ color: "#94a3b8", fontSize: "0.9rem", marginTop: '0.5rem' }}>
                                                          Enter the total payment amount in cents. Example: <code>2000</code> for $20.00.
                                                      </div>
                                                    </div>
                                                  )}
                                      
                                                  {/* Associated Input Field for Checkbox */}
                                                  {newField.type === "checkbox" && (
                                                    <div style={{...inputStyle, flex: '1 1 auto', minWidth: '150px', border: "1px dashed #334155", padding: "1rem", margin: "0.5rem 0" }}>
                                                      <label style={{ display: "flex", alignItems: "center", color: "#e2e8f0", marginBottom: "0.5rem" }}>
                                                        <input
                                                          type="checkbox"
                                                          checked={!!newField.associatedInputField}
                                                          onChange={e => setNewField({ ...newField, associatedInputField: e.target.checked ? { type: "input", name: "", placeholder: "", optionsKey: "" } : null })}
                                                          style={{ marginRight: "0.8rem" }}
                                                        />
                                                        Has Associated Input Field
                                                      </label>
                                                      {newField.associatedInputField && (
                                                        <>
                                                          <select
                                                            value={newField.associatedInputField.type}
                                                            onChange={e => setNewField({ ...newField, associatedInputField: { ...newField.associatedInputField, type: e.target.value } })}
                                                            style={inputStyle}
                                                          >
                                                            <option value="input">Text Input</option>
                                                            <option value="textarea">Textarea</option>
                                                            <option value="select">Dropdown</option>
                                                          </select>
                                                          <input
                                                            placeholder="Associated Input Name {{}}"
                                                            value={newField.associatedInputField.name}
                                                            onChange={e => setNewField({ ...newField, associatedInputField: { ...newField.associatedInputField, name: e.target.value } })}
                                                            style={inputStyle}
                                                          />
                                                          {newField.associatedInputField.type !== "textarea" && newField.associatedInputField.type !== "select" && (
                                                            <input
                                                              placeholder="Associated Input Placeholder"
                                                              value={newField.associatedInputField.placeholder}
                                                              onChange={e => setNewField({ ...newField, associatedInputField: { ...newField.associatedInputField, placeholder: e.target.value } })}
                                                              style={inputStyle}
                                                            />
                                                          )}
                                                          {newField.associatedInputField.type === "select" && (
                                                            <input
                                                              placeholder="Associated Options Key (e.g. dnrTypes)"
                                                              value={newField.associatedInputField.optionsKey}
                                                              onChange={e => setNewField({ ...newField, associatedInputField: { ...newField.associatedInputField, optionsKey: e.target.value } })}
                                                              style={inputStyle}
                                                            />
                                                          )}
                                                        </>
                                                      )}
                                                    </div>
                                                  )}            
                                                  {(newField.type === "textarea" || newField.type === "input" || newField.type === "timer") && (
                <div style={{ margin: "1rem 0", padding: "1rem", background: "#162032", borderRadius: 8, border: "1px dashed #334155" }}>
                  <label style={{ display: "flex", alignItems: "center", color: "#e2e8f0", marginBottom: "0.8rem" }}>
                    <input
                      type="checkbox"
                      checked={!!newField.allowImagePaste}
                      onChange={e => setNewField({ ...newField, allowImagePaste: e.target.checked })}
                      style={{ marginRight: "0.8rem" }}
                    />
                    <strong>Enable Clipboard Image Paste (Ctrl+V)</strong>
                  </label>
                  {newField.allowImagePaste && (
                    <>
                      <p style={{ margin: "0.5rem 0", fontSize: "0.9rem", color: "#94a3b8" }}>
                        Users will be able to paste screenshots directly into this field.
                      </p>
                      <label style={{ display: "block", marginTop: "0.8rem", color: "#cbd5e1" }}>
                        <strong>Target Image Field:</strong>
                        <select
                          value={newField.linkedImageField || ""}
                          onChange={e => setNewField({ ...newField, linkedImageField: e.target.value || undefined })}
                          style={{ ...inputStyle, marginTop: "0.4rem" }}
                        >
                          <option value="">→ Auto (uses field name + "_images")</option>
                          {fields
                            .filter(f => f.type === "image")
                            .map(f => (
                              <option key={f.name} value={f.name}>
                                {f.label || f.name} ({f.name})
                              </option>
                            ))}
                        </select>
                      </label>
                      <small style={{ color: "#64748b", display: "block", marginTop: "0.4rem" }}>
                        Pasted images will be uploaded and added to this image gallery field.
                      </small>
                    </>
                  )}
                </div>
              )}
                                      <button onClick={saveField} style={{ background: "#10b981", color: "white", border: "none", padding: "0.8rem", borderRadius: 8, flex: '0 0 auto' }}>{editingFieldIndex !== null ? 'Update Field' : 'Add Field'}</button>
                                      {editingFieldIndex !== null && (
                                        <button onClick={() => { setNewField(createDefaultNewField()); setEditingFieldIndex(null); setShowConditionalBuilder(false); }} style={{ background: "#f59e0b", color: "white", border: "none", padding: "0.8rem", borderRadius: 8, flex: '0 0 auto' }}>Cancel Edit</button>
                                      )}
                                    </div>
              
                        {/* Conditional Builder */}
              {/* ADVANCED CONDITIONAL BUILDER */}
              <div style={{ margin: "1.5rem 0", padding: "1.5rem", background: "#1e293b", borderRadius: 12, border: "1px dashed #334155" }}>
                <button 
                  onClick={() => setShowConditionalBuilder(!showConditionalBuilder)}
                  style={{ background: "#8b5cf6", color: "white", border: "none", padding: "0.8rem 1.5rem", borderRadius: 8, fontWeight: "600" }}
                >
                  {showConditionalBuilder ? "Hide" : "Add Conditional Logic"} (AND/OR, Exact Values)
                </button>
              
                {showConditionalBuilder && (
                  <div style={{ marginTop: "1rem" }}>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr auto", gap: "0.8rem", marginBottom: "1rem" }}>
                      <select value={conditionalField} onChange={e => setConditionalField(e.target.value)} style={inputStyle}>
                        <option value="">— Select Trigger Field —</option>
                        {fields.map(f => (
                          <option key={f.name} value={f.name}>{f.label || f.name}</option>
                        ))}
                      </select>
              
                      <select value={conditionalValue} onChange={e => setConditionalValue(e.target.value)} style={inputStyle}>
                        <option value="">— Condition —</option>
                        <option value="filled">Has ANY value</option>
                        <option value="empty">Is empty</option>
                        <option value="exact">Exact value →</option>
                      </select>
              
                      <button onClick={addCondition} style={{ background: "#10b981", color: "white", border: "none", borderRadius: 8 }}>
                        Add Rule
                      </button>
                    </div>
              
                    {conditionalValue === "exact" && (
                      <input
                        placeholder="Enter exact value (e.g. GeneralInformation)"
                        value={exactValue}
                        onChange={e => setExactValue(e.target.value)}
                        style={{ ...inputStyle, marginBottom: "1rem" }}
                      />
                    )}
              
                    {tempConditions.length > 0 && (
                      <>
                        <div style={{ margin: "1rem 0", fontWeight: "600", color: "#94a3b8" }}>
                          Show this field when:
                          <select value={conditionMode} onChange={e => setConditionMode(e.target.value)} style={{ marginLeft: "1rem", padding: "0.4rem", background: "#334155", border: "none", borderRadius: 6, color: "#e2e8f0" }}
                                                                    className="form-select-inline" // Add inline class
                          >
                            <option value="and">ALL</option>
                            <option value="or">ANY</option>
                          </select>
                          of these are true:
                        </div>
              
                        {tempConditions.map((c, i) => (
                          <div key={i} style={{ padding: "0.8rem", background: "#334155", borderRadius: 8, marginBottom: "0.5rem", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                            <span>
                              <strong>{fields.find(f => f.name === c.field)?.label || c.field}</strong>
                              {c.value === true ? " is filled" : c.value === false ? " is empty" : ` = "${c.value}"`}
                            </span>
                            <button onClick={() => removeTempCondition(i)} style={{ background: "#ef4444", color: "white", border: "none", padding: "0.4rem 0.8rem", borderRadius: 6 }}>Remove</button>
                          </div>
                        ))}
              
                        <button onClick={applyAdvancedCondition} style={{ background: "#8b5cf6", color: "white", padding: "0.8rem", border: "none", borderRadius: 8, width: "100%", marginTop: "1rem" }}>
                          Apply Conditions ({tempConditions.length})
                        </button>
                      </>
                    )}
                  </div>
                )}
              </div>
            {/* NEW: Bulk Conditional Logic Builder */}
            <div style={{ margin: "1.5rem 0", padding: "1.5rem", background: "#1e293b", borderRadius: 12, border: "1px dashed #334155" }}>
                <button
                    onClick={() => setShowBulkEditor(!showBulkEditor)}
                    style={{ background: "#8b5cf6", color: "white", border: "none", padding: "0.8rem 1.5rem", borderRadius: 8, fontWeight: "600" }}
                >
                    {showBulkEditor ? "Hide" : "Bulk Edit Conditional Logic"}
                </button>

                {showBulkEditor && (
                    <div style={{ marginTop: "1rem" }}>
                        <h5 style={{ color: "#a78bfa", marginBottom: "1rem" }}>Apply to Fields:</h5>
                        <Select
                            isMulti
                            options={fields.map(f => ({ value: f.id, label: f.label || f.name }))}
                            value={bulkSelectedFields}
                            onChange={setBulkSelectedFields}
                            styles={{
                                control: (base) => ({ ...base, backgroundColor: '#334155', borderColor: '#475569', color: '#e2e8f0' }),
                                multiValue: (base) => ({ ...base, backgroundColor: '#60a5fa' }),
                                multiValueLabel: (base) => ({ ...base, color: 'white' }),
                                option: (base, { isFocused, isSelected }) => ({ ...base, backgroundColor: isSelected ? '#60a5fa' : isFocused ? '#475569' : '#334155', color: '#e2e8f0' }),
                                menu: (base) => ({ ...base, backgroundColor: '#334155' }),
                                menuPortal: base => ({ ...base, zIndex: 99999 }),
                                input: (base) => ({ ...base, color: '#e2e8f0' }),
                                placeholder: (base) => ({ ...base, color: '#94a3b8' }),
                            }}
                            classNamePrefix="react-select"
                            placeholder="Select fields..."
                            menuPortalTarget={document.body}
                        />

                        <h5 style={{ color: "#a78bfa", margin: "1.5rem 0 1rem" }}>Conditional Rule:</h5>
                        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr auto", gap: "0.8rem", marginBottom: "1rem" }}>
                            <select value={bulkConditionalField} onChange={e => setBulkConditionalField(e.target.value)} style={inputStyle}>
                                <option value="">— Select Trigger Field —</option>
                                {fields.map(f => (
                                    <option key={f.name} value={f.name}>{f.label || f.name}</option>
                                ))}
                            </select>

                            <select value={bulkConditionalValue} onChange={e => setBulkConditionalValue(e.target.value)} style={inputStyle}>
                                <option value="">— Condition —</option>
                                <option value="filled">Has ANY value</option>
                                <option value="empty">Is empty</option>
                                <option value="exact">Exact value →</option>
                            </select>

                            <button onClick={addBulkCondition} style={{ background: "#10b981", color: "white", border: "none", borderRadius: 8 }}>
                                Add Rule
                            </button>
                        </div>

                        {bulkConditionalValue === "exact" && (
                            <input
                                placeholder="Enter exact value (e.g. GeneralInformation)"
                                value={bulkExactValue}
                                onChange={e => setBulkExactValue(e.target.value)}
                                style={{ ...inputStyle, marginBottom: "1rem" }}
                            />
                        )}

                        {bulkTempConditions.length > 0 && (
                            <>
                                <div style={{ margin: "1rem 0", fontWeight: "600", color: "#94a3b8" }}>
                                    Show selected fields when:
                                    <select value={bulkConditionMode} onChange={e => setBulkConditionMode(e.target.value)} style={{ marginLeft: "1rem", padding: "0.4rem", background: "#334155", border: "none", borderRadius: 6, color: "#e2e8f0" }}
                                                                    className="form-select-inline" // Add inline class
                                    >
                                        <option value="and">ALL</option>
                                        <option value="or">ANY</option>
                                    </select>
                                    of these are true:
                                </div>

                                {bulkTempConditions.map((c, i) => (
                                    <div key={i} style={{ padding: "0.8rem", background: "#334155", borderRadius: 8, marginBottom: "0.5rem", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                                        <span>
                                            <strong>{fields.find(f => f.name === c.field)?.label || c.field}</strong>
                                            {c.value === true ? " is filled" : c.value === false ? " is empty" : ` = "${c.value}"`}
                                        </span>
                                        <button onClick={() => removeBulkTempCondition(i)} style={{ background: "#ef4444", color: "white", border: "none", padding: "0.4rem 0.8rem", borderRadius: 6 }}>Remove</button>
                                    </div>
                                ))}

                                <button onClick={applyBulkConditionalLogic} style={{ background: "#8b5cf6", color: "white", padding: "0.8rem", border: "none", borderRadius: 8, width: "100%", marginTop: "1rem" }}>
                                    Apply Conditions to {bulkSelectedFields.length} Selected Fields
                                </button>
                            </>
                        )}
                    </div>
                )}
            </div>
                        {newField.showIf && (
                          <div style={{ padding: "0.8rem", background: "#1e293b", borderRadius: 8, color: "#a78bfa", fontSize: "0.9rem" }}>
                            Show this field if {' '}
                            {newField.showIf.mode ? ( // Check if it's a complex condition
                                <>
                                    <strong>{newField.showIf.mode.toUpperCase()}</strong> of: {' '}
                                    {newField.showIf.conditions.map((condition, idx) => (
                                        <span key={idx}>
                                            {idx > 0 && ", "}
                                            <strong>{fields.find(field => field.name === condition.field)?.label || condition.field}</strong>
                                            {' '}is{' '}
                                            {condition.value === true ? "filled" : condition.value === false ? "empty" : `"${condition.value}"`}
                                        </span>
                                    ))}
                                </>
                            ) : ( // Simple condition
                                <>
                                    <strong>{fields.find(field => field.name === newField.showIf.field)?.label || newField.showIf.field}</strong>
                                    {' '}is{' '}
                                    {newField.showIf.value === true ? "filled" : newField.showIf.value === false ? "empty" : `"${newField.showIf.value}"`}
                                </>
                            )}
                            <button onClick={() => setNewField({ ...newField, showIf: null })} style={{ marginLeft: "1rem", color: "#ef4444" }}>Remove</button>
                          </div>
                        )}
              
                        <h4 style={{ color: "#60a5fa", marginTop: "2rem" }}>Fields ({fields.length})</h4>
                        <div style={{ maxHeight: '400px', overflowY: 'auto', padding: '0.5rem', border: '1px solid #334155', borderRadius: '8px', background: '#0f172a' }}>
                          <DndContext
                            sensors={sensors}
                            collisionDetection={closestCenter}
                            onDragEnd={handleDragEnd}
                          >
                            <SortableContext
                              items={fields.map(f => f.id)}
                              strategy={verticalListSortingStrategy}
                            >
                              {fields.map((f, i) => (
                                <SortableFieldItem key={f.id} id={f.id}>
                                  <div style={{ background: "#1e293b", padding: "1rem", borderRadius: 10, marginBottom: "0.8rem", border: "1px solid #334155", width: '100%' }}>
                                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                                      <div>
                                        { f.type === "image" ? (
                                          <span style={{ color: "#a78bfa" }}>
                                            Image Gallery: <strong>{f.label}</strong> → <code>{"{{" + f.name + "}}"}</code>
                                            <span style={{ color: "#34d399", marginLeft: "0.5rem" }}>
                                              (Auto-paired with narrative field below)
                                            </span>
                                          </span>
                                        ) : f.allowImagePaste ? (
                                          <span style={{ color: "#34d399" }}>
                                            Text + Paste: <strong>{f.label}</strong> → <code>{"{{" + f.name + "}}"}</code>
                                            <span style={{ color: "#fbbf24", fontSize: "0.85rem" }}>
                                              → pastes into <strong>{f.linkedImageField}</strong>
                                            </span>
                                          </span>
                                        ) : f.type === "hr" ? (
                                          <span style={{ color: "#a78bfa" }}>Horizontal Rule</span>
                                        ) : f.type === "fake_line" ? (
                                          <span style={{ color: "#a78bfa" }}>Fake Line (Thinner Horizontal Rule)</span>
                                        ) : f.type === "small_header" ? (
                                          <span style={{ color: "#a78bfa" }}>Small Header: <strong>{f.label}</strong></span>
                                        ) : f.type === "timer" ? (
                                          <span style={{ color: "#a78bfa" }}>Timer: <strong>{f.label}</strong> → <code>{"{{" + f.name + "}}"}</code> ({f.timerType})
                                            {f.buttonLabel && ` [Button: ${f.buttonLabel} (${f.buttonAction})]`}
                                          </span>
                                        ) : f.type === "checkbox" ? (
                                          <span style={{ color: "#a78bfa" }}>Checkbox: <strong>{f.label}</strong> → <code>{"{{" + f.name + "}}"}</code>
                                            {f.associatedInputField && ` [Associated Input: ${f.associatedInputField.type} -> ${f.associatedInputField.name}]`}
                                          </span>
                                        ) : f.type === "radio" ? (
                                          <span style={{ color: "#a78bfa" }}>Radio: <strong>{f.label}</strong> → <code>{"{{" + f.name + "}}"}</code> (Options: {f.options.join(', ')})</span>
                                        ) : f.type === "input_button_combo" ? (
                                          <span style={{ color: "#a78bfa" }}>Input Button Combo: <strong>{f.label}</strong> → <code>{"{{" + f.name + "}}"}</code> (Type: {f.inputType}, Button: {f.buttonLabel} ({f.buttonAction}))</span>
                                        ) : f.type === "payment_button" ? (
                                          <span style={{ color: "#a78bfa" }}>Payment Button: <strong>{f.label}</strong> → <code>{"{{" + f.name + "}}"}</code> (stores timestamp)</span>
                                        ) : f.type === "attach_report_button" ? (
                                          <span style={{ color: "#a78bfa" }}>Attach Report Button: <strong>{f.label}</strong> → (Filters: {f.filterVersions}, Type: {f.employeeType}, Target: {f.targetField})</span>
                                        ) : f.type === "decedent_list" ? (
                                            <span style={{ color: "#a78bfa" }}>Decedent List: <strong>{f.name}</strong></span>
                                        ) : f.type === "dynamic_text_list" ? (
                                          <span style={{ color: "#a78bfa" }}>Dynamic List: <strong>{f.label}</strong> → <code>{"{{" + f.name + "}}"}</code> (Button: {f.buttonLabel})</span>
                                        ) : f.type === "autopsy_diagram_button" ? (
                                          <span style={{ color: "#a78bfa" }}>Autopsy Diagram Button: <strong>{f.label}</strong> → stores URL in <code>{"{{" + f.name + "}}"}</code></span>
                                        ) : f.type === "information_state" ? (
                                          <span style={{ color: "#a78bfa" }}>Info State: <strong>{f.infoType}</strong> → <code>{f.content.substring(0, 50)}...</code></span>
                                        ) : f.type === "character_selector" ? (
                                          <span style={{ color: "#a78bfa" }}>Dropdown - Character Select: <strong>{f.label}</strong> → <code>{"{{" + f.name + "}}"}</code></span>
                                        ) : f.type === "multi_employee_select" ? (
                                          <span style={{ color: "#a78bfa" }}>Dropdown - Multiple Employees: <strong>{f.label}</strong> → <code>{"{{" + f.name + "}}"}</code></span>
                                        ) : f.type === "employee_select" ? ( // NEW EMPLOYEE SELECT DISPLAY
                                          <span style={{ color: "#a78bfa" }}>Dropdown - Employee Selector: <strong>{f.label}</strong> → <code>{"{{" + f.name + "}}"}</code></span>
                                        ) : (
                                          <>
                                            <strong>{f.label}</strong> → <code>{"{{" + f.name + "}}"}</code>
                                          </>
                                        )}
                                        {f.layout === "full" && <span style={{ marginLeft: "1rem", color: "#a78bfa" }}>Full Width</span>}
                                        {f.layout === "compact-50" && <span style={{ marginLeft: "1rem", color: "#a78bfa" }}>Compact (50%)</span>}
                                        {f.layout === "compact-33" && <span style={{ marginLeft: "1rem", color: "#a78bfa" }}>Compact (33%)</span>} 
                                        {f.layout === "compact" && <span style={{ marginLeft: "1rem", color: "#a78bfa" }}>Compact (20%)</span>}
                                        {f.type === "select" && <span style={{ marginLeft: "1rem", color: "#f59e0b" }}>Options: {f.optionsKey}</span>}
                                        {f.showIf && (
                                          <span style={{ marginLeft: "1rem", color: "#8b5cf6" }}>
                                              Show if {' '}
                                              {f.showIf.mode ? ( // Check if it's a complex condition
                                                  <>
                                                      <strong>{f.showIf.mode.toUpperCase()}</strong> of: {' '}
                                                      {f.showIf.conditions.map((condition, idx) => (
                                                          <span key={idx}>
                                                              {idx > 0 && ", "}
                                                              <strong>{fields.find(field => field.name === condition.field)?.label || condition.field}</strong>
                                                              {' '}is{' '}
                                                              {condition.value === true ? "filled" : condition.value === false ? "empty" : `"${condition.value}"`}
                                                          </span>
                                                      ))}
                                                  </>
                                              ) : ( // Simple condition
                                                  <>
                                                      <strong>{fields.find(field => field.name === f.showIf.field)?.label || f.showIf.field}</strong>
                                                      {' '}is{' '}
                                                      {f.showIf.value === true ? "filled" : f.showIf.value === false ? "empty" : `"${f.showIf.value}"`}
                                                  </>
                                              )}
                                          </span>
                                        )}
                                      </div>
                                      <div style={{ display: "flex", gap: "0.5rem" }}>
                                        <button onClick={() => startEditField(f, i)} style={{ background: "#6366f1", color: "white", border: "none", padding: "0 1rem", borderRadius: 8 }}>Edit</button>
                                        <button onClick={() => removeField(f.id)} style={{ background: "#ef4444", color: "white", border: "none", padding: "0 1rem", borderRadius: 8 }}>Remove</button>
                                      </div>
                                    </div>
                                  </div>
                                </SortableFieldItem>
                              ))}
                            </SortableContext>
                          </DndContext>
                        </div>
              
                        <div style={{ marginTop: "2rem", textAlign: "center" }}>
                          <button onClick={saveForm} style={{ padding: "1rem 3rem", background: "#6366f1", color: "white", border: "none", borderRadius: 12, margin: "0 1rem" }}>Save Form</button>
                          <button onClick={onClose} style={{ padding: "1rem 3rem", background: "#475569", color: "white", border: "none", borderRadius: 12 }}>Cancel</button>
                        </div>
                      </div>
                    </div>
                    {console.log('AddFormModal: Passing bbcodeTemplate to BulkAddFieldsModal:', bbcodeTemplate)}
                    <BulkAddFieldsModal 
                      show={showBulkAddModal}
                      onClose={() => setShowBulkAddModal(false)}
                      onBulkAdd={handleBulkAddFields}
                      existingFields={fields}
                      bbcodeTemplate={bbcodeTemplate}
                    />
                  </div>
                );
              };
              
              export default AddFormModal;
              