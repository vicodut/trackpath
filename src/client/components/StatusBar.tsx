interface StatusBarProps {
  message: string;
  type: '' | 'syncing' | 'success';
}

export function StatusBar({ message, type }: StatusBarProps) {
  return (
    <div className={`status-bar ${type}`}>
      {type === 'syncing' && <span className="spinner" />}
      {message}
    </div>
  );
}
