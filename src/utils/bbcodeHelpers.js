// src/utils/bbcodeHelpers.js
const getDepartmentFullName = (departmentShortCode, agencyDataStore) => {
    if (agencyDataStore && departmentShortCode && agencyDataStore[departmentShortCode]) {
        return agencyDataStore[departmentShortCode].fullName;
    }
    return departmentShortCode; // Fallback
};
export { getDepartmentFullName };
