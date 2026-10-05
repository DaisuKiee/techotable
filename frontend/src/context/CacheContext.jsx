import React, { createContext, useContext, useCallback } from 'react';

const CacheContext = createContext(null);

/**
 * Cache Context Provider
 * Manages cache invalidation across the application
 */
export const CacheProvider = ({ children }) => {
  
  // Invalidate specific cache
  const invalidateCache = useCallback((cacheKey) => {
    localStorage.removeItem(`cache_${cacheKey}`);
    localStorage.removeItem(`cache_timestamp_${cacheKey}`);
    
    // Dispatch event to notify other components
    window.dispatchEvent(new CustomEvent('cache-invalidated', { 
      detail: { cacheKey } 
    }));
  }, []);

  // Invalidate multiple caches
  const invalidateCaches = useCallback((cacheKeys) => {
    cacheKeys.forEach(key => {
      localStorage.removeItem(`cache_${key}`);
      localStorage.removeItem(`cache_timestamp_${key}`);
    });
    
    window.dispatchEvent(new CustomEvent('caches-invalidated', { 
      detail: { cacheKeys } 
    }));
  }, []);

  // Clear all caches
  const clearAllCaches = useCallback(() => {
    const keys = Object.keys(localStorage);
    keys.forEach(key => {
      if (key.startsWith('cache_') || key.startsWith('cache_timestamp_')) {
        localStorage.removeItem(key);
      }
    });
    
    window.dispatchEvent(new CustomEvent('all-caches-cleared'));
  }, []);

  // Get cache age
  const getCacheAge = useCallback((cacheKey) => {
    const timestamp = localStorage.getItem(`cache_timestamp_${cacheKey}`);
    if (!timestamp) return null;
    
    return Date.now() - parseInt(timestamp);
  }, []);

  // Check if cache exists and is valid
  const isCacheValid = useCallback((cacheKey, maxAge = 5 * 60 * 1000) => {
    const age = getCacheAge(cacheKey);
    return age !== null && age < maxAge;
  }, [getCacheAge]);

  const value = {
    invalidateCache,
    invalidateCaches,
    clearAllCaches,
    getCacheAge,
    isCacheValid
  };

  return (
    <CacheContext.Provider value={value}>
      {children}
    </CacheContext.Provider>
  );
};

export const useCache = () => {
  const context = useContext(CacheContext);
  if (!context) {
    throw new Error('useCache must be used within CacheProvider');
  }
  return context;
};
