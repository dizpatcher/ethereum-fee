import { useState, useEffect, useRef } from 'react';
import type { GasData } from '../types';
import { fetchGasData } from '../api/gasApi';

export function useGasData(intervalMs = 15_000) {
  const [data, setData] = useState<GasData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const activeRef = useRef(true);

  useEffect(() => {
    activeRef.current = true;

    const load = async () => {
      try {
        const d = await fetchGasData();
        if (activeRef.current) {
          setData(d);
          setError(null);
        }
      } catch (e) {
        if (activeRef.current)
          setError(e instanceof Error ? e.message : 'Ошибка загрузки данных');
      } finally {
        if (activeRef.current) setLoading(false);
      }
    };

    load();
    const id = setInterval(load, intervalMs);
    return () => {
      activeRef.current = false;
      clearInterval(id);
    };
  }, [intervalMs]);

  return { data, loading, error };
}
