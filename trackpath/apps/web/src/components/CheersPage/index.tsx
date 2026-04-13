import { useMemo } from 'react';
import type { Cheer } from '../../api/cheers';
import styles from './CheersPage.module.css';

interface CheersPageProps {
  cheers: Cheer[];
  isAdmin: boolean;
  onDelete: (id: number) => void;
  onClose: () => void;
}

export function CheersPage({ cheers, isAdmin, onDelete, onClose }: CheersPageProps) {
  const grouped = useMemo(() => {
    const map = new Map<string, Cheer[]>();
    for (const c of cheers) {
      const day = c.createdAt.slice(0, 10);
      if (!map.has(day)) map.set(day, []);
      map.get(day)!.push(c);
    }
    return [...map.entries()].sort((a, b) => b[0].localeCompare(a[0]));
  }, [cheers]);

  const fmtDay = (iso: string) => {
    const d = new Date(iso + 'T00:00:00');
    return d.toLocaleDateString('default', { weekday: 'long', month: 'long', day: 'numeric' }).toUpperCase();
  };

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <h2>🥾 Cheers</h2>
        <button className="icon-btn" onClick={onClose}>✕</button>
      </div>
      <div className={styles.content}>
        {grouped.length === 0 && (
          <div className={styles.empty}>No cheers yet — be the first!</div>
        )}
        {grouped.map(([day, items]) => (
          <div key={day} className={styles.dayGroup}>
            <span className={styles.dayLabel}>{fmtDay(day)}</span>
            {items.map(c => (
              <div key={c.id} className={styles.cheerItem}>
                <div className={styles.cheerHeader}>
                  <span className={styles.cheerName}>{c.name}</span>
                  {isAdmin && !c.isPublic && <span className={styles.cheerPrivate}>🔒 private</span>}
                  <span className={styles.cheerTime}>
                    {new Date(c.createdAt).toLocaleTimeString('default', { hour: '2-digit', minute: '2-digit' })}
                  </span>
                  {isAdmin && (
                    <button className={styles.cheerDelete} onClick={() => onDelete(c.id)}>✕</button>
                  )}
                </div>
                <p className={styles.cheerMessage}>"{c.message}"</p>
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
