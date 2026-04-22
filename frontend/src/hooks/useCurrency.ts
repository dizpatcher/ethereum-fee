import { useState, useCallback } from 'react';
import type { Currency } from '../types';

export function useCurrency() {
  const [currency, setCurrency] = useState<Currency>('RUB');
  const toggle = useCallback(
    () => setCurrency((c) => (c === 'RUB' ? 'USD' : 'RUB')),
    [],
  );
  return { currency, toggle };
}
