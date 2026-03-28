interface HeaderProps {
  onSync: () => void;
  syncing: boolean;
  sidebarVisible: boolean;
  onToggleSidebar: () => void;
}

export function Header({ onSync, syncing, sidebarVisible, onToggleSidebar }: HeaderProps) {
  return (
    <header className="header">
      <h1><span>&#9650;</span> AT Tracker</h1>
      <div className="header-actions">
        <button className="primary" onClick={onSync} disabled={syncing}>
          Sync inReach
        </button>
        <button onClick={onToggleSidebar}>
          {sidebarVisible ? 'Hide List' : 'Show List'}
        </button>
      </div>
    </header>
  );
}
