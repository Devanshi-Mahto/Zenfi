import { Bell, Search, Sun, Moon, Menu } from 'lucide-react';
import { useState } from 'react';
import { useLocation, Link } from 'react-router-dom';
import { useTheme } from '../../context/ThemeContext';
import { useSidebar } from '../../context/SidebarContext';

const pageTitles = {
  '/':              'Dashboard',
  '/goals':         'Savings Goals',
  '/transactions':  'Transactions',
  '/ai-assistant':  'AI Assistant',
  '/notifications': 'Notifications',
};

export default function Navbar() {
  const location = useLocation();
  const { isDark, toggleTheme } = useTheme();
  const { toggle: toggleSidebar } = useSidebar();
  const title = pageTitles[location.pathname] || 'ZenFi';

  return (
    <header className="h-16 border-b border-[var(--border)] flex items-center justify-between px-4 lg:px-6 bg-[var(--bg-base)]/80 backdrop-blur-md sticky top-0 z-20 transition-colors duration-300">
      <div className="flex items-center gap-3">
        {/* Hamburger – mobile only */}
        <button
          id="sidebar-toggle"
          onClick={toggleSidebar}
          className="lg:hidden p-2 rounded-xl bg-[var(--bg-surface)] border border-[var(--border)] text-[var(--text-muted)] hover:text-[var(--text)] transition-colors"
          aria-label="Open sidebar"
        >
          <Menu size={18} />
        </button>

        <div>
          <h2 className="text-base lg:text-lg font-bold text-[var(--text)]">{title}</h2>
          <p className="text-xs text-[var(--text-muted)] hidden sm:block">
            {new Date().toLocaleDateString('en-IN', {
              weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
            })}
          </p>
        </div>
      </div>

      <div className="flex items-center gap-2 lg:gap-3">
        {/* Search – hidden on mobile */}
        <div className="relative hidden md:flex items-center">
          <Search size={15} className="absolute left-3 text-[var(--text-muted)]" />
          <input
            type="text"
            placeholder="Search transactions..."
            className="bg-[var(--bg-surface)] border border-[var(--border)] rounded-xl pl-9 pr-4 py-2 text-sm text-[var(--text)] placeholder:text-[var(--text-dim)] focus:outline-none focus:border-[#6C63FF]/50 w-48 lg:w-52 transition-colors"
          />
        </div>

        {/* Theme toggle */}
        <button
          id="theme-toggle"
          onClick={toggleTheme}
          aria-label="Toggle theme"
          className="p-2.5 rounded-xl bg-[var(--bg-surface)] border border-[var(--border)] text-[var(--text-muted)] hover:text-[var(--text)] hover:border-[#6C63FF]/30 transition-all"
        >
          {isDark ? <Sun size={17} /> : <Moon size={17} />}
        </button>

        {/* Notifications bell */}
        <Link
          to="/notifications"
          id="nav-notifications"
          className="relative p-2.5 rounded-xl bg-[var(--bg-surface)] border border-[var(--border)] text-[var(--text-muted)] hover:text-[var(--text)] hover:border-[#6C63FF]/30 transition-all"
        >
          <Bell size={18} />
          <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-[#6C63FF]" />
        </Link>
      </div>
    </header>
  );
}
