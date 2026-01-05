// src/formDefinitions.js
// THIS IS A VERY LEGACY FILE THAT DEFINES ALL FORM METADATA AND GENERATORS
// IT SHOULD NOT BE CONFUSED WITH THE FORM HANDLER COMPONENT 
// IT SHOULD NOT BE REFERENCED OR USED DIRECTLY, SCHEDULED FOR DEPRECATION
import { lazy } from 'react';

// Import generators normally as they are not components
import {
    generateMassFatality
} from './phmc-bbcode-generators';


// Import your icons
import graveyard from './assets/graveyard.png';
import application from './assets/application.png'; // Assuming this is for SAAA or generic

// Dynamic component loaders - components are loaded only when needed
const componentLoaders = {
    // Legacy loaders removed
};


// Admin component can be loaded normally as it's a distinct route/view
import AdminAuthAndActions from './components/Admin/AdminAuthAndActions.jsx';


export const generateAdminView = (viewData) => {
    if (!viewData.isAdminAuthenticated) {
        return "Please log in using the form fields to view admin controls.";
    }

    const categoryName = viewData.adminSelectedCategoryName || 'Selected Category';
    // Simplified title, and we'll add a newline before the statuses if they exist.
    let adminContent = `[b]${categoryName} Recruitment Statuses:[/b]\n`;

    if (viewData.adminDisplayData && typeof viewData.adminDisplayData === 'object' && Object.keys(viewData.adminDisplayData).length > 0) {
        const statusEntries = Object.entries(viewData.adminDisplayData).map(([key, position]) => {
            const displayName = position.displayName || position.name || key;
            const status = position.status || 'N/A';
            const statusColor = status === "OPEN" ? "green" : "red";
            // Format each position and its status, using color for visual cue
            return `${displayName}: [color=${statusColor}]${status}[/color]`;
        });

        // Join the statuses with a separator for a more compact, single-line display if possible.
        // If you prefer a list for many items, we can revert to `[list]` and `[*] `.
        adminContent += statusEntries.join(' | ');

    } else if (viewData.adminDisplayData === null && viewData.adminSelectedCategoryName) {
        adminContent += `Data for ${categoryName} not found or failed to load.`;
    }
    else if (viewData.adminSelectedCategoryName) {
        // This case might occur briefly while data is loading after category selection
        adminContent += `Loading data for ${categoryName}...`;
    }
    else if (viewData.isAdminAuthenticated && !viewData.adminSelectedCategoryName) {
        adminContent += "Please select a recruitment category in the panel to view statuses.";
    }
    else {
        adminContent += "No recruitment data to display. Please select a category or check logs if issues persist.";
    }
    // No need for an extra newline if join is used, as it doesn't end with one.
    // If using a list, ensure [list]...[/list] structure.
    return adminContent;
};

export const formDefinitions = [
    { version: 11, name: "Mass Fatality Report", group: "PHMC", icon: graveyard, generator: generateMassFatality, componentLoader: null, titleKey: "massFatalityReport", sortOrder: 14, isHiddenInSelector: true, hasCustomTitle: true, userTypes: ['phmcStaff', 'coroner', 'other'], primaryFor: ['coroner'], requiredFaction: ['PHMC'], requiredRank: 1, isPHMC: true },
    {
        version: 999,
        name: "Admin Control Panel",
        group: "Admin",
        icon: application,
        componentLoader: null, // Admin component is imported normally
        generator: generateAdminView,
        titleKey: "adminControlPanel",
        sortOrder: 999,
        userTypes: ['other'], primaryFor: ['other']
    },
];

// Helper to get form definition by version
export const getFormDefinition = (version) => formDefinitions.find(form => form.version === version);

// Helper to filter forms by user type
export const getFormsByUserType = (userType) => {
    return formDefinitions.filter(form => 
        !form.userTypes || form.userTypes.includes(userType)
    );
};

// Helper to get primary forms for a user type
export const getPrimaryFormsForUserType = (userType) => {
    return formDefinitions.filter(form => 
        form.primaryFor && form.primaryFor.includes(userType)
    );
};

// Helper to get forms by group and user type
export const getFormsByGroupAndUserType = (group, userType) => {
    return formDefinitions.filter(form => 
        form.group === group && 
        (!form.userTypes || form.userTypes.includes(userType))
    );
};

// Helper to generate versionNames map for display (if still needed elsewhere, or can be derived from formDefinitions)
export const generateVersionNames = () => {
    const names = {};
    formDefinitions.forEach(form => {
        names[form.version] = form.name;
    });
    return names;
};
