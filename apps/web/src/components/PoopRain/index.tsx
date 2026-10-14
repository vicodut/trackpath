import { useMemo } from 'react';
import styles from './PoopRain.module.css';

const POOP_COUNT = 28;

export function PoopRain() {
  const poops = useMemo(() =>
    Array.from({ length: POOP_COUNT }, (_, i) => ({
      id: i,
      left: Math.random() * 100,
      size: 24 + Math.random() * 24,
      delay: Math.random() * 0.6,
      duration: 1.2 + Math.random() * 0.8,
    })),
  []);

  return (
    <div className={styles.rain}>
      {poops.map(p => (
        <span
          key={p.id}
          className={styles.poop}
          style={{
            left: `${p.left}%`,
            fontSize: p.size,
            animationDelay: `${p.delay}s`,
            animationDuration: `${p.duration}s`,
          }}
        >
          💩
        </span>
      ))}
    </div>
  );
}
