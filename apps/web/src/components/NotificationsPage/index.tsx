import { useEffect, useMemo, useState } from 'react';
import { fetchNotifications } from '../../api/notifications';
import type { NotificationSummary } from '../../types';
import styles from './NotificationsPage.module.css';

interface NotificationsPageProps {
  onClose: () => void;
}

export function NotificationsPage({ onClose }: NotificationsPageProps) {
  const [items, setItems] = useState<NotificationSummary[] | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    fetchNotifications().then(setItems).catch(() => { setFailed(true); });
  }, []);

  const sorted = useMemo(
    () => [...(items ?? [])].sort((a, b) => b.date.localeCompare(a.date)),
    [items],
  );

  const fmtDay = (iso: string) =>
    new Date(iso.slice(0, 10) + 'T00:00:00')
      .toLocaleDateString('default', { weekday: 'long', month: 'long', day: 'numeric' })
      .toUpperCase();

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <h2>🔔 Daily Updates</h2>
        <button className="icon-btn" onClick={onClose}>✕</button>
      </div>
      <div className={styles.content}>
        {failed && <div className={styles.empty}>Could not load updates.</div>}
        {items && sorted.length === 0 && <div className={styles.empty}>No daily updates yet.</div>}
        {sorted.map(n => (
          <div key={n.date} className={styles.item}>
            <span className={styles.day}>{fmtDay(n.date)}</span>
            <p className={styles.text}>{n.text}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
