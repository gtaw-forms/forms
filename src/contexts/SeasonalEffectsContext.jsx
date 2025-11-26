import React, { createContext, useContext, useState, useEffect } from 'react';

const SeasonalEffectsContext = createContext();

export const SeasonalEffectsProvider = ({ children }) => {
  const [seasonalEffectsEnabled, setSeasonalEffectsEnabled] = useState(() => {
    try {
      const storedValue = localStorage.getItem('seasonalEffectsEnabled');
      return storedValue ? JSON.parse(storedValue) : true;
    } catch (e) {
      console.error("Failed to parse seasonalEffectsEnabled from localStorage", e);
      return true;
    }
  });

  useEffect(() => {
    localStorage.setItem('seasonalEffectsEnabled', JSON.stringify(seasonalEffectsEnabled));
  }, [seasonalEffectsEnabled]);

  return (
    <SeasonalEffectsContext.Provider value={{ seasonalEffectsEnabled, setSeasonalEffectsEnabled }}>
      {children}
    </SeasonalEffectsContext.Provider>
  );
};

export const useSeasonalEffects = () => {
  const context = useContext(SeasonalEffectsContext);
  if (context === undefined) {
    throw new Error('useSeasonalEffects must be used within a SeasonalEffectsProvider');
  }
  return context;
};
