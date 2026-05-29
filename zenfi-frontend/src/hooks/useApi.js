/**
 * Generic data fetching hook.
 * Usage: const { data, loading, error, refetch } = useApi(fetchFn, deps)
 */
import { useState, useEffect, useCallback, useRef } from 'react';

export function useApi(fetcher, deps = [], options = {}) {
  const { immediate = true, initialData = null } = options;
  const [data, setData]       = useState(initialData);
  const [loading, setLoading] = useState(immediate);
  const [error, setError]     = useState(null);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; };
  }, []);

  const execute = useCallback(async (...args) => {
    if (mounted.current) { setLoading(true); setError(null); }
    try {
      const result = await fetcher(...args);
      // Support both raw data and axios {data} wrappers
      const payload = result?.data !== undefined ? result.data : result;
      if (mounted.current) setData(payload);
      return payload;
    } catch (err) {
      const msg = err.response?.data?.detail
        || err.response?.data?.error
        || err.message
        || 'An error occurred';
      if (mounted.current) setError(msg);
      throw err;
    } finally {
      if (mounted.current) setLoading(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  useEffect(() => {
    if (immediate) execute();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return { data, loading, error, refetch: execute, setData };
}
