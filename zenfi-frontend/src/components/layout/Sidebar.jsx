import { NavLink, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  LayoutDashboard, Target, ArrowLeftRight, Bot,
  LogOut, Sparkles, TrendingUp, Bell, Settings, Mail, X,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useSidebar } from '../../context/SidebarContext';

const navItems = [
  { path: '/',              icon: LayoutDashboard, label: 'Dashboard' },
  { path: '/goals',         icon: Target,          label: 'Goals' },
  { path: '/transactions',  icon: ArrowLeftRight,  label: 'Transactions' },
  { path: '/ai-assistant',  icon: Bot,             label: 'AI Assistant' },
  { path: '/notifications', icon: Bell,            label: 'Notifications' },
  { path: '/gmail-expenses', icon: Mail,            label: 'Gmail' },
  { path: '/settings',      icon: Settings,        label: 'Settings' },
];

function SidebarContent({ onClose }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <div className="flex flex-col h-full bg-[var(--bg-sidebar)] border-r border-[var(--border)]">
      {/* Logo */}
      <div className="px-6 py-6 border-b border-[var(--border)] flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-[#6C63FF] to-[#00D4AA] flex items-center justify-center shadow-[0_0_20px_rgba(108,99,255,0.4)]">
            <TrendingUp size={18} className="text-white" />
          </div>
          <div>
            <h1 className="text-[var(--text)] font-bold text-lg leading-tight">ZenFi</h1>
            <p className="text-[var(--text-muted)] text-xs">Finance Tracker</p>
          </div>
        </div>
        {/* Mobile close button */}
        {onClose && (
          <button
            onClick={onClose}
            className="lg:hidden p-1.5 rounded-lg text-[var(--text-muted)] hover:text-[var(--text)] hover:bg-[var(--border)] transition-colors"
          >
            <X size={18} />
          </button>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-6 space-y-1 overflow-y-auto">
        {navItems.map(({ path, icon: Icon, label }) => (
          <NavLink
            key={path}
            to={path}
            end={path === '/'}
            onClick={onClose}
            className={({ isActive }) =>
              `flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all duration-200 group ${
                isActive
                  ? 'bg-[#6C63FF]/15 text-[#6C63FF] border border-[#6C63FF]/20'
                  : 'text-[var(--text-muted)] hover:text-[var(--text)] hover:bg-[var(--border)]'
              }`
            }
          >
            {({ isActive }) => (
              <>
                <Icon
                  size={18}
                  className={isActive ? 'text-[#6C63FF]' : 'text-[var(--text-muted)] group-hover:text-[var(--text)]'}
                />
                <span>{label}</span>
                {isActive && (
                  <motion.div
                    layoutId="activeIndicator"
                    className="ml-auto w-1.5 h-1.5 rounded-full bg-[#6C63FF]"
                  />
                )}
              </>
            )}
          </NavLink>
        ))}
      </nav>

      {/* AI Badge */}
      <div className="mx-3 mb-4 p-4 bg-gradient-to-br from-[#6C63FF]/10 to-[#00D4AA]/10 border border-[#6C63FF]/20 rounded-xl">
        <div className="flex items-center gap-2 mb-2">
          <Sparkles size={14} className="text-[#6C63FF]" />
          <span className="text-xs font-semibold text-[#6C63FF]">AI-Powered</span>
        </div>
        <p className="text-xs text-[var(--text-muted)]">Get personalized financial insights powered by Gemini AI.</p>
      </div>

      {/* User + Logout */}
      <div className="px-3 pb-6 pt-3 border-t border-[var(--border)]">
        <div className="flex items-center gap-3 px-3 py-2 mb-2">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[#6C63FF] to-[#00D4AA] flex items-center justify-center text-white text-sm font-bold flex-shrink-0">
            {user?.username?.[0]?.toUpperCase() || 'U'}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-[var(--text)] truncate">{user?.username || 'User'}</p>
            <p className="text-xs text-[var(--text-muted)]">Free Plan</p>
          </div>
        </div>
        <button
          onClick={handleLogout}
          className="w-full flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm text-[var(--text-muted)] hover:text-[#FF5C5C] hover:bg-[#FF5C5C]/10 transition-all duration-200"
        >
          <LogOut size={16} />
          <span>Sign out</span>
        </button>
      </div>
    </div>
  );
}

export default function Sidebar() {
  const { isOpen, close } = useSidebar();

  return (
    <>
      {/* ── Desktop: fixed sidebar ─────────────────────────────── */}
      <motion.aside
        initial={{ x: -20, opacity: 0 }}
        animate={{ x: 0, opacity: 1 }}
        className="hidden lg:flex flex-col w-64 min-h-screen fixed left-0 top-0 z-30"
      >
        <SidebarContent />
      </motion.aside>

      {/* ── Mobile: slide-in overlay ───────────────────────────── */}
      <AnimatePresence>
        {isOpen && (
          <>
            {/* Backdrop */}
            <motion.div
              key="backdrop"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={close}
              className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm lg:hidden"
            />
            {/* Drawer */}
            <motion.aside
              key="drawer"
              initial={{ x: -280 }}
              animate={{ x: 0 }}
              exit={{ x: -280 }}
              transition={{ type: 'spring', damping: 28, stiffness: 300 }}
              className="fixed left-0 top-0 bottom-0 z-50 w-64 lg:hidden flex flex-col"
            >
              <SidebarContent onClose={close} />
            </motion.aside>
          </>
        )}
      </AnimatePresence>
    </>
  );
}
