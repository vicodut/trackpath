import { useState, useEffect, useRef } from 'react';
import { useSession, authClient } from '../../lib/auth-client';
import { useIsMobile } from '../../hooks/useIsMobile';
import { useUnit } from '../../hooks/useUnit';
import styles from './Header.module.css';

interface HeaderProps {
  sidebarVisible: boolean;
  onToggleSidebar: () => void;
  isAdmin: boolean;
  onAdmin: () => void;
  onStats: () => void;
  onTrailLog: () => void;
  onBlog: () => void;
  onGear: () => void;
  onPolls: () => void;
  onResources: () => void;
  onCheers: () => void;
}

export function Header({ sidebarVisible, onToggleSidebar, isAdmin, onAdmin, onStats, onTrailLog, onBlog, onGear, onPolls, onResources, onCheers }: HeaderProps) {
  const { data: session, isPending } = useSession();
  const [menuOpen, setMenuOpen] = useState(false);
  const isMobile = useIsMobile();
  const menuRef = useRef<HTMLDivElement>(null);
  const { unit, toggleUnit } = useUnit();

  useEffect(() => {
    if (!menuOpen) return;
    let cleanup: (() => void) | undefined;
    const timer = setTimeout(() => {
      const handleClose = (e: Event) => {
        if (menuRef.current && e.target instanceof Node && !menuRef.current.contains(e.target)) {
          setMenuOpen(false);
        }
      };
      document.addEventListener('pointerdown', handleClose);
      cleanup = () => document.removeEventListener('pointerdown', handleClose);
    }, 50);
    return () => { clearTimeout(timer); cleanup?.(); };
  }, [menuOpen]);

  const closeAndDo = (fn: () => void) => {
    setMenuOpen(false);
    fn();
  };

  const actions = (
    <>
      <button className={styles.unitToggle} onClick={() => toggleUnit()}>{unit.toUpperCase()}</button>
      <button onClick={() => closeAndDo(onStats)}>STATS</button>
      <button onClick={() => closeAndDo(onGear)}>GEAR</button>
      <button onClick={() => closeAndDo(onPolls)}>POLLS</button>
      <button onClick={() => closeAndDo(onCheers)}>CHEERS</button>
      <button onClick={() => closeAndDo(onBlog)}>JOURNAL</button>
      <button onClick={() => closeAndDo(onResources)}>RESOURCES</button>
      {isAdmin && <button onClick={() => closeAndDo(onAdmin)}>ADMIN</button>}
      {isMobile ? (
        <button onClick={() => closeAndDo(onTrailLog)}>TRAIL_LOG</button>
      ) : (
        <button onClick={() => closeAndDo(onToggleSidebar)}>
          {sidebarVisible ? 'HIDE_LIST' : 'SHOW_LIST'}
        </button>
      )}
      {isPending ? null : session?.user ? (
        <>
          <span className={styles.authUser}>{session.user.name || session.user.email}</span>
          <button onClick={() => closeAndDo(() => void authClient.signOut())}>LOGOUT</button>
        </>
      ) : (
        <button onClick={() => closeAndDo(() => void authClient.signIn.social({ provider: "github", callbackURL: "/" }))}>
          LOGIN_GITHUB
        </button>
      )}
    </>
  );

  return (
    <header className={styles.header}>
      <h1>
        <img src="/sasquatch-icon.gif" alt="" style={{ width: 28, height: 28, imageRendering: 'pixelated', verticalAlign: 'middle', marginRight: 8 }} />
        AT_TRACKER
      </h1>
      {isMobile ? (
        <div className={styles.menu} ref={menuRef}>
          <button className={styles.hamburgerBtn} onClick={() => setMenuOpen(!menuOpen)} aria-label="Menu">
            <span className={`${styles.hamburgerIcon} ${menuOpen ? styles.hamburgerIconOpen : ''}`}>
              <span /><span /><span />
            </span>
          </button>
          {menuOpen && (
            <div className={styles.dropdown}>
              {actions}
            </div>
          )}
        </div>
      ) : (
        <div className={styles.actions}>
          {actions}
        </div>
      )}
    </header>
  );
}
