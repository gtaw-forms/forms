import React, { createContext, useState, useContext } from 'react';

const SettingsContext = createContext();

export const useSettings = () => useContext(SettingsContext);

export const SettingsProvider = ({ children }) => {
    const [seasonalEffectsEnabled, setSeasonalEffectsEnabled] = useState(() => {
        // Default to true if the setting isn't found in localStorage
        return localStorage.getItem('seasonalEffectsEnabled') !== 'false';
    });

    const toggleSeasonalEffects = () => {
        const newValue = !seasonalEffectsEnabled;
        setSeasonalEffectsEnabled(newValue);
        localStorage.setItem('seasonalEffectsEnabled', String(newValue));
    };

    const value = {
        seasonalEffectsEnabled,
        toggleSeasonalEffects,
    };

    return (
        <SettingsContext.Provider value={value}>
            {children}
        </SettingsContext.Provider>
    );
};
