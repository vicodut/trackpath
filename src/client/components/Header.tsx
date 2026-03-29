import { useState, useEffect, useRef } from 'react';
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
  const [menuOpen, setMenuOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth <= 768);
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);

  useEffect(() => {
    if (!menuOpen) return;
    // Delay to avoid closing on the same tap that opened it
    const timer = setTimeout(() => {
      const handleClose = (e: Event) => {
        if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
          setMenuOpen(false);
        }
      };
      document.addEventListener('pointerdown', handleClose);
      cleanup = () => document.removeEventListener('pointerdown', handleClose);
    }, 50);
    let cleanup: (() => void) | undefined;
    return () => { clearTimeout(timer); cleanup?.(); };
  }, [menuOpen]);

  const closeAndDo = (fn: () => void) => {
    setMenuOpen(false);
    fn();
  };

  const actions = (
    <>
      <button onClick={() => closeAndDo(onStats)}>STATS</button>
      {isAdmin && <button onClick={() => closeAndDo(onAdmin)}>ADMIN</button>}
      <button onClick={() => closeAndDo(onToggleSidebar)}>
        {sidebarVisible ? 'HIDE_LIST' : 'SHOW_LIST'}
      </button>
      {isPending ? null : session?.user ? (
        <>
          <span className="auth-user">{session.user.name || session.user.email}</span>
          <button onClick={() => closeAndDo(() => authClient.signOut())}>LOGOUT</button>
        </>
      ) : (
        <button onClick={() => closeAndDo(() => authClient.signIn.social({ provider: "github", callbackURL: "/" }))}>
          LOGIN_GITHUB
        </button>
      )}
    </>
  );

  return (
    <header className="header">
      <h1>
        <img src="/sasquatch-icon.gif" alt="" style={{ width: 28, height: 28, imageRendering: 'pixelated', verticalAlign: 'middle', marginRight: 8 }} />
        AT_TRACKER
      </h1>
      {isMobile ? (
        <div className="header-menu" ref={menuRef}>
          <button className="hamburger-btn" onClick={() => setMenuOpen(!menuOpen)} aria-label="Menu">
            <span className={`hamburger-icon ${menuOpen ? 'open' : ''}`}>
              <span /><span /><span />
            </span>
          </button>
          {menuOpen && (
            <div className="header-dropdown">
              {actions}
            </div>
          )}
        </div>
      ) : (
        <div className="header-actions">
          {actions}
        </div>
      )}
    </header>
  );
}
