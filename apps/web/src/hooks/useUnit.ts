import { useState, useEffect, useCallback } from 'react';

export type Unit = 'km' | 'mi';

const UNIT_EVENT = 'trackpath:unit-change';

function stored(): Unit {
  return (localStorage.getItem('unit') as Unit) || 'km';
}

export function useUnit() {
  const [unit, setUnit] = useState<Unit>(stored);

  useEffect(() => {
    const handler = () => { setUnit(stored()); };
    window.addEventListener(UNIT_EVENT, handler);
    return () => { window.removeEventListener(UNIT_EVENT, handler); };
  }, []);

  const toggleUnit = useCallback(() => {
    localStorage.setItem('unit', stored() === 'km' ? 'mi' : 'km');
    window.dispatchEvent(new Event(UNIT_EVENT));
  }, []);

  const fmtDist = useCallback((km: number, decimals = 1): string => {
    if (unit === 'mi') return `${(km * 0.621371).toFixed(decimals)} mi`;
    return `${km.toFixed(decimals)} km`;
  }, [unit]);

  return { unit, toggleUnit, fmtDist };
}
