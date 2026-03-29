import { useSession, authClient } from '../lib/auth-client';

interface HeaderProps {
  sidebarVisible: boolean;
  onToggleSidebar: () => void;
  isAdmin: boolean;
  onAdmin: () => void;
}

export function Header({ sidebarVisible, onToggleSidebar, isAdmin, onAdmin }: HeaderProps) {
  const { data: session, isPending } = useSession();

  return (
    <header className="header">
      <h1><span>&#9650;</span> AT Tracker</h1>
      <div className="header-actions">
        {isAdmin && (
          <button onClick={onAdmin}>Admin</button>
        )}
        <button onClick={onToggleSidebar}>
          {sidebarVisible ? 'Hide List' : 'Show List'}
        </button>
        {isPending ? null : session?.user ? (
          <>
            <span className="auth-user">{session.user.name || session.user.email}</span>
            <button onClick={() => authClient.signOut()}>Log out</button>
          </>
        ) : (
          <button onClick={() => authClient.signIn.social({ provider: "github", callbackURL: "/" })}>
            Login with GitHub
          </button>
        )}
      </div>
    </header>
  );
}
