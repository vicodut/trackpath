import type { StateMilestone } from '../../hooks/useStateMilestones';
import styles from './StateMilestoneCard.module.css';

interface StateMilestoneCardProps {
  milestone: StateMilestone;
}

export function StateMilestoneCard({ milestone }: StateMilestoneCardProps) {
  const [from, to] = milestone.name.split('/').map(s => s.trim());
  return (
    <div className={styles.card}>
      <span className={styles.flag}>🏁</span>
      <div className={styles.info}>
        <div className={styles.label}>STATE BORDER</div>
        <div className={styles.names}>
          <span>{from}</span>
          {to && <><span className={styles.arrow}>→</span><span>{to}</span></>}
        </div>
        <div className={styles.km}>{milestone.distanceKm.toFixed(0)} km</div>
      </div>
    </div>
  );
}
