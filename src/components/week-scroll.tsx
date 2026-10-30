'use client';
import { useEffect } from 'react';

export function WeekScrollInit() {
  useEffect(() => {
    const today = document.querySelector('.week .day.today') as HTMLElement | null;
    if (today) {
      today.scrollIntoView({ block: 'nearest', inline: 'center', behavior: 'instant' });
    }
  }, []);
  return null;
}
