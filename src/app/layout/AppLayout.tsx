import { NavLink, Outlet } from 'react-router-dom';

const navItems = [
  { to: '/cases', label: 'Cases' },
  { to: '/entities', label: 'Entities' },
  { to: '/timeline', label: 'Timeline' },
  { to: '/evidence', label: 'Evidence' },
  { to: '/notes', label: 'Notes' },
  { to: '/trash', label: 'Trash' },
  { to: '/archive', label: 'Archive' },
];

export function AppLayout() {
  return (
    <div className="app-shell">
      <header className="app-header">
        <NavLink className="brand" to="/">
          MurderBoard
        </NavLink>
        <nav aria-label="Primary navigation" className="app-nav">
          {navItems.map((item) => (
            <NavLink key={item.to} to={item.to}>
              {item.label}
            </NavLink>
          ))}
        </nav>
      </header>
      <main className="app-main">
        <Outlet />
      </main>
    </div>
  );
}
