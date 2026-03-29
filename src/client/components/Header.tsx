import { useSession, authClient } from '../lib/auth-client';

interface HeaderProps {
  sidebarVisible: boolean;
  onToggleSidebar: () => void;
  isAdmin: boolean;
  onAdmin: () => void;
  onStats: () => void;
}

export function Header({ sidebarVisible, onToggleSidebar, isAdmin, onAdmin, onStats }: HeaderProps) {
  const { data: session, isPending } = useSession();

  return (
    <header className="header">
      <h1><img src="/sasquatch-icon.gif" alt="" style={{ width: 28, height: 28, imageRendering: 'pixelated', verticalAlign: 'middle', marginRight: 8 }} />AT_TRACKER</h1>
      <div className="header-actions">
        <button onClick={onStats}>STATS</button>
        {isAdmin && (
          <button onClick={onAdmin}>ADMIN</button>
        )}
        <button onClick={onToggleSidebar}>
          {sidebarVisible ? 'HIDE_LIST' : 'SHOW_LIST'}
        </button>
        {isPending ? null : session?.user ? (
          <>
            <span className="auth-user">{session.user.name || session.user.email}</span>
            <button onClick={() => authClient.signOut()}>LOGOUT</button>
          </>
        ) : (
          <button onClick={() => authClient.signIn.social({ provider: "github", callbackURL: "/" })}>
            LOGIN_GITHUB
          </button>
        )}
      </div>
    </header>
  );
}
