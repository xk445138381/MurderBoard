import { NavLink, Outlet, useLocation } from 'react-router-dom';

const navItems = [
  { to: '/board', label: '案件板' },
];

export function AppLayout() {
  const location = useLocation();
  const isBoardRoute = location.pathname === '/' || location.pathname === '/board';

  return (
    <div className={isBoardRoute ? 'app-shell app-shell--board' : 'app-shell'}>
      <header className="app-header">
        <NavLink className="brand" to="/">
          MurderBoard
        </NavLink>
        <nav aria-label="主导航" className="app-nav">
          {navItems.map((item) => (
            <NavLink key={item.to} to={item.to}>
              {item.label}
            </NavLink>
          ))}
        </nav>
      </header>
      <main className={isBoardRoute ? 'app-main app-main--board' : 'app-main'}>
        <Outlet />
      </main>
    </div>
  );
}
