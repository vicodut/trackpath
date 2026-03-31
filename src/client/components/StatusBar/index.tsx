import styles from './StatusBar.module.css';

interface StatusBarProps {
  message: string;
  type: '' | 'syncing' | 'success';
}

export function StatusBar({ message, type }: StatusBarProps) {
  return (
    <div className={`${styles.statusBar} ${type ? styles[type] : ''}`}>
      {type === 'syncing' && <span className="spinner" />}
      {message}
    </div>
  );
}
