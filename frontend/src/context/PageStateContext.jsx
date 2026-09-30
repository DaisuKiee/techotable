import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';

const PageStateContext = createContext();

export const usePageState = () => {
  const context = useContext(PageStateContext);
  if (!context) {
    throw new Error('usePageState must be used within PageStateProvider');
  }
  return context;
};

export const PageStateProvider = ({ children }) => {
  // Store state for different pages
  const [pageStates, setPageStates] = useState(() => {
    // Try to load from sessionStorage on mount
    const saved = sessionStorage.getItem('pageStates');
    return saved ? JSON.parse(saved) : {};
  });

  // Save to sessionStorage whenever state changes
  useEffect(() => {
    sessionStorage.setItem('pageStates', JSON.stringify(pageStates));
  }, [pageStates]);

  // Save state for a specific page
  const savePageState = useCallback((pageName, state) => {
    setPageStates(prev => {
      // Only update if the state actually changed
      const currentState = prev[pageName];
      if (JSON.stringify(currentState) === JSON.stringify(state)) {
        return prev;
      }
      return {
        ...prev,
        [pageName]: state
      };
    });
  }, []);

  // Get state for a specific page
  const getPageState = useCallback((pageName, defaultState = {}) => {
    return pageStates[pageName] || defaultState;
  }, [pageStates]);

  // Clear state for a specific page
  const clearPageState = useCallback((pageName) => {
    setPageStates(prev => {
      const newStates = { ...prev };
      delete newStates[pageName];
      return newStates;
    });
  }, []);

  // Clear all page states
  const clearAllStates = useCallback(() => {
    setPageStates({});
    sessionStorage.removeItem('pageStates');
  }, []);

  return (
    <PageStateContext.Provider
      value={{
        savePageState,
        getPageState,
        clearPageState,
        clearAllStates
      }}
    >
      {children}
    </PageStateContext.Provider>
  );
};
