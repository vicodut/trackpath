import { useMemo, useState } from 'react';
import type { Cheer } from '../../api/cheers';
import styles from './CheersPage.module.css';

const CHEER_NAME_KEY = 'trackpath:cheer-name';

interface CheersPageProps {
  cheers: Cheer[];
  isAdmin: boolean;
  onDelete: (id: number) => void;
  onSubmit?: (name: string, message: string, isPublic: boolean) => Promise<boolean>;
  onClose: () => void;
}

export function CheersPage({ cheers, isAdmin, onDelete, onSubmit, onClose }: CheersPageProps) {
  const [name, setName] = useState(() => localStorage.getItem(CHEER_NAME_KEY) ?? '');
  const [message, setMessage] = useState('');
  const [isPublic, setIsPublic] = useState(false);
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);

  const handleNameChange = (val: string) => {
    setName(val);
    try { localStorage.setItem(CHEER_NAME_KEY, val); } catch { /* ignore */ }
  };

  const handleSubmit = async () => {
    if (!name.trim() || !message.trim()) return;
    setSending(true);
    const ok = await onSubmit?.(name.trim(), message.trim(), isPublic);
    setSending(false);
    if (ok) { setMessage(''); setSent(true); setTimeout(() => { setSent(false); }, 3000); }
  };

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
        <div className={styles.form}>
          <input
            className={styles.formInput}
            placeholder="Your name"
            value={name}
            onChange={e => { handleNameChange(e.target.value); }}
            maxLength={50}
          />
          <textarea
            className={styles.formTextarea}
            placeholder="Send Vico some motivation! 💪"
            value={message}
            onChange={e => { setMessage(e.target.value); }}
            rows={3}
            maxLength={280}
          />
          <div className={styles.formFooter}>
            <label className={styles.formPublic}>
              <input
                type="checkbox"
                checked={isPublic}
                onChange={e => { setIsPublic(e.target.checked); }}
              />
              Make it public
            </label>
            <button
              className={styles.formSubmit}
              onClick={handleSubmit}
              disabled={!name.trim() || !message.trim() || sending}
            >
              {sent ? '🎉 Sent!' : sending ? 'Sending…' : 'Send Cheers →'}
            </button>
          </div>
        </div>

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
                    <button className={styles.cheerDelete} onClick={() => { onDelete(c.id); }}>✕</button>
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
