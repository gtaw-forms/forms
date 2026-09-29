// Pure mapper: RTDB /agencies store -> react-select options. RTDB agency
// records carry fullName/logo/url but NO shortCode field, so `value` falls
// back to the record KEY (LSPD/LSSD/SADCR/DAO/...) to stay code-valued.
// Returns [] when the store is null/empty (matches the original guard).
export const mapAgencyOptions = (agencyDataStore) => {
    if (!agencyDataStore) return [];
    return Object.entries(agencyDataStore).map(([key, a]) => ({
        value: (a.shortCode || key).toLowerCase(),
        label: a.fullName,
    }));
};