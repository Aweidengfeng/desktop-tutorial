import { useState, useEffect, useCallback, useRef } from 'react';
import axios from 'axios';

export function useAdminData<T>(
  fetchFn: () => Promise<T>,
  deps: ReadonlyArray<unknown> = [],
  autoRefreshMs = 0
) {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const isMounted = useRef(true);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const fetch = useCallback(async () => {
    setLoading(true);
    try {
      const result = await fetchFn();
      if (isMounted.current) {
        setData(result);
        setError(null);
      }
    } catch (e: unknown) {
      let message = '请求失败';
      if (axios.isAxiosError<{ error?: string }>(e)) {
        message = e.response?.data?.error || e.message || '请求失败';
      } else if (e instanceof Error) {
        message = e.message;
      }
      if (isMounted.current) setError(message);
    } finally {
      if (isMounted.current) setLoading(false);
    }
  }, deps);

  useEffect(() => {
    isMounted.current = true;
    fetch();
    if (autoRefreshMs > 0) {
      const timer = setInterval(fetch, autoRefreshMs);
      return () => {
        isMounted.current = false;
        clearInterval(timer);
      };
    }
    return () => { isMounted.current = false; };
  }, [fetch, autoRefreshMs]);

  return { data, loading, error, refresh: fetch };
}
