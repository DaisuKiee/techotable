import { useState, useEffect, useCallback, useRef } from 'react';

/**
 * Smart data caching hook with automatic invalidation
 * 
 * Features:
 * - Instant load from cache on page revisit
 * - Background refresh to check for new data
 * - Timestamp-based cache invalidation
 * - Configurable cache duration
 * 
 * @param {Function} fetchFunction - API call function
 * @param {string} cacheKey - Unique cache identifier
 * @param {Object} options - Configuration options
 * @returns {Object} { data, loading, error, refetch, isFromCache }
 */
const useCachedData = (fetchFunction, cacheKey, options = {}) => {
  const {
    cacheDuration = 5 * 60 * 1000, // Default: 5 minutes
    enabled = true,
    dependencies = [],
    onSuccess = null,
    onError = null
  } = options;

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [isFromCache, setIsFromCache] = useState(false);
  
  const isMountedRef = useRef(true);
  const fetchInProgressRef = useRef(false);

  // Get cache storage key
  const getCacheKey = useCallback(() => {
    return `cache_${cacheKey}`;
  }, [cacheKey]);

  const getTimestampKey = useCallback(() => {
    return `cache_timestamp_${cacheKey}`;
  }, [cacheKey]);

  // Load from cache
  const loadFromCache = useCallback(() => {
    try {
      const cached = localStorage.getItem(getCacheKey());
      const timestamp = localStorage.getItem(getTimestampKey());

      if (cached && timestamp) {
        const age = Date.now() - parseInt(timestamp);
        
        // Cache is still valid
        if (age < cacheDuration) {
          const parsedData = JSON.parse(cached);
          setData(parsedData);
          setIsFromCache(true);
          return parsedData;
        } else {
          // Cache expired, clear it
          localStorage.removeItem(getCacheKey());
          localStorage.removeItem(getTimestampKey());
        }
      }
    } catch (err) {
      console.warn('Cache load error:', err);
    }
    return null;
  }, [getCacheKey, getTimestampKey, cacheDuration]);

  // Save to cache
  const saveToCache = useCallback((newData) => {
    try {
      localStorage.setItem(getCacheKey(), JSON.stringify(newData));
      localStorage.setItem(getTimestampKey(), Date.now().toString());
    } catch (err) {
      console.warn('Cache save error:', err);
    }
  }, [getCacheKey, getTimestampKey]);

  // Fetch fresh data
  const fetchData = useCallback(async (showLoadingSpinner = true) => {
    if (fetchInProgressRef.current) return;
    
    fetchInProgressRef.current = true;
    
    if (showLoadingSpinner) {
      setLoading(true);
    }
    setError(null);

    try {
      const response = await fetchFunction();
      const newData = response.data?.data || response.data || response;

      if (isMountedRef.current) {
        setData(newData);
        setIsFromCache(false);
        saveToCache(newData);
        
        if (onSuccess) {
          onSuccess(newData);
        }
      }
    } catch (err) {
      if (isMountedRef.current) {
        setError(err);
        if (onError) {
          onError(err);
        }
      }
      console.error('Fetch error:', err);
    } finally {
      if (isMountedRef.current) {
        setLoading(false);
      }
      fetchInProgressRef.current = false;
    }
  }, [fetchFunction, saveToCache, onSuccess, onError]);

  // Smart load: cache first, then background refresh
  const smartLoad = useCallback(async () => {
    if (!enabled) return;

    // Try to load from cache first
    const cachedData = loadFromCache();

    if (cachedData) {
      // Show cached data immediately (no loading spinner)
      setLoading(false);
      
      // Then fetch fresh data in background (silent refresh)
      setTimeout(() => {
        fetchData(false); // false = no loading spinner
      }, 100);
    } else {
      // No cache, show loading spinner and fetch
      fetchData(true);
    }
  }, [enabled, loadFromCache, fetchData]);

  // Manual refetch (always shows loading)
  const refetch = useCallback(() => {
    fetchData(true);
  }, [fetchData]);

  // Clear cache
  const clearCache = useCallback(() => {
    localStorage.removeItem(getCacheKey());
    localStorage.removeItem(getTimestampKey());
    setIsFromCache(false);
  }, [getCacheKey, getTimestampKey]);

  // Initial load
  useEffect(() => {
    smartLoad();

    return () => {
      isMountedRef.current = false;
    };
  }, [cacheKey, ...dependencies]); // eslint-disable-line react-hooks/exhaustive-deps

  return {
    data,
    loading,
    error,
    refetch,
    clearCache,
    isFromCache
  };
};

export default useCachedData;
