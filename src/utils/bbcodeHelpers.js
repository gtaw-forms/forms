// src/utils/bbcodeHelpers.js
const getDepartmentFullName = (departmentShortCode, agencyDataStore) => {
    if (agencyDataStore && departmentShortCode && agencyDataStore[departmentShortCode]) {
        return agencyDataStore[departmentShortCode].fullName;
    }
    return departmentShortCode; // Fallback
};

// Helper to transform the report title on attachment
const transformReportTitle = (originalKey) => {
    if (typeof originalKey !== 'string') {
        return 'Attached Report';
    }

    let finalKey = originalKey;

    // 1. Handle Death Report prefix and date stripping
    if (finalKey.startsWith('[DEATH-REPORT]')) {
        finalKey = finalKey.replace('[DEATH-REPORT]', 'Coroner Report -').trim();
        // Remove date like MM/DD/YYYY from the end
        finalKey = finalKey.replace(/\s+\d{2}\/\d{2}\/\d{4}$/, '').trim();
    } 
    // 2. Handle Mass Fatality Report titles (prefix and x{times})
    else if (finalKey.startsWith('[Mass Fatality Report]') || finalKey.startsWith('[Multi Fatality Report]')) {
        // Remove the leading "[Mass Fatality Report]" or "[Multi Fatality Report]"
        finalKey = finalKey.replace(/\[(Mass|Multi) Fatality Report\]\s*/i, '').trim();
        // Remove the date from the end (e.g., "- 03/01/2026")
        finalKey = finalKey.replace(/\s*-\s*\d{2}\/\d{2}\/\d{4}$/, '').trim();
        // Remove any pipe separators from concatenated names
        finalKey = finalKey.replace(/\s*\|\s*/g, ', ').trim(); // Replace '|' with ', ' for better display

        // Prepend the standardized report type
        finalKey = `Mass Fatality Report - ${finalKey}`;
        // Ensure "x{times}" is correctly formatted without parentheses if it was " (x{times})"
        finalKey = finalKey.replace(/\s*\(x(\d+)\)/g, ' x$1');
    }
    
    // Replace text within double parentheses ((...)) with "OOC - <content>"
    finalKey = finalKey.replace(/\(\((.*?)\)\)/g, 'OOC - $1').trim();

    // Finally, remove any remaining square brackets to prevent breaking spoilers
    finalKey = finalKey.replace(/\[|\]/g, '').trim();

    return finalKey;
};


export { getDepartmentFullName, transformReportTitle };
