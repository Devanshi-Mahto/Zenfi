import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Bell, CheckCheck, Trash2, TrendingUp, AlertTriangle, Info, Target, Zap, RefreshCw } from 'lucide-react';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import Badge from '../components/ui/Badge';
import EmptyState from '../components/ui/EmptyState';
import {
  getNotifications,
  markNotificationRead,
  markAllNotificationsRead,
  deleteNotification,
} from '../api/notifications';
import { useToast } from '../context/ToastContext';

const ICON_MAP = {
  budget: AlertTriangle,
  overspending: AlertTriangle,
  goal: Target,
  ai: Zap,
  gmail: Info,
  extension: Zap,
  reminder: Bell,
  unusual: TrendingUp,
  info: Info,
};

function timeAgo(iso) {
  const diff = Math.floor((Date.now() - new Date(iso)) / 1000);
  if (diff < 60)   return 'Just now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

const TYPE_STYLES = {
  budget: { bg: 'bg-[#FFB547]/8 border-[#FFB547]/20', icon: 'text-[#FFB547]', badge: 'warning' },
  overspending: { bg: 'bg-[#FF5C5C]/8 border-[#FF5C5C]/20', icon: 'text-[#FF5C5C]', badge: 'danger' },
  goal: { bg: 'bg-[#6C63FF]/8 border-[#6C63FF]/20', icon: 'text-[#6C63FF]', badge: 'primary' },
  ai: { bg: 'bg-[#5CE1E6]/8 border-[#5CE1E6]/20', icon: 'text-[#5CE1E6]', badge: 'info' },
  gmail: { bg: 'bg-[#00D4AA]/8 border-[#00D4AA]/20', icon: 'text-[#00D4AA]', badge: 'success' },
  extension: { bg: 'bg-[#FFB547]/8 border-[#FFB547]/20', icon: 'text-[#FFB547]', badge: 'warning' },
  reminder: { bg: 'bg-[var(--bg-elevated)] border-[var(--border)]', icon: 'text-[var(--text-muted)]', badge: 'default' },
  unusual: { bg: 'bg-[#6C63FF]/8 border-[#6C63FF]/20', icon: 'text-[#6C63FF]', badge: 'primary' },
  info: { bg: 'bg-[var(--bg-elevated)] border-[var(--border)]', icon: 'text-[var(--text-muted)]', badge: 'default' },
};

export default function Notifications() {
  const { error: toastError, success } = useToast();
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState('all'); // all | unread
  const [typeFilter, setTypeFilter] = useState(''); // optional type

  const fetchNotifications = useCallback(async () => {
    setLoading(true);
    try {
      const status = filter === 'unread' ? 'unread' : 'all';
      const res = await getNotifications({ status, type: typeFilter || undefined, limit: 100 });
      setNotifications(res.data?.results || []);
    } catch {
      toastError('Failed to load notifications.');
    } finally {
      setLoading(false);
    }
  }, [filter, typeFilter, toastError]);

  useEffect(() => { fetchNotifications(); }, [fetchNotifications]);

  const unreadCount = notifications.filter((n) => !n.is_read).length;

  const markAllRead = async () => {
    try {
      await markAllNotificationsRead();
      setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
      success('Marked all as read');
    } catch {
      toastError('Could not mark all read.');
    }
  };

  const markRead = async (id) => {
    setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, is_read: true } : n)));
    try { await markNotificationRead(id); } catch { /* silent */ }
  };

  const deleteOne = async (id) => {
    setNotifications((prev) => prev.filter((n) => n.id !== id));
    try { await deleteNotification(id); } catch { /* silent */ }
  };

  const refresh = async () => {
    setRefreshing(true);
    try {
      await fetchNotifications();
    } finally {
      setRefreshing(false);
    }
  };

  const visible = notifications;

  return (
    <div className="space-y-6 max-w-2xl mx-auto">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex items-center justify-between flex-wrap gap-3"
      >
        <div>
          <h2 className="text-xl font-bold text-[var(--text)]">Notifications</h2>
          <p className="text-sm text-[var(--text-muted)] mt-0.5">
            {unreadCount > 0 ? `${unreadCount} unread` : 'All caught up!'}
          </p>
        </div>
        <div className="flex gap-2">
          {unreadCount > 0 && (
            <Button variant="secondary" size="sm" icon={<CheckCheck size={14} />} onClick={markAllRead}>
              Mark all read
            </Button>
          )}
          <Button variant="secondary" size="sm" icon={<RefreshCw size={14} />} onClick={refresh} disabled={refreshing}>
            Refresh
          </Button>
        </div>
      </motion.div>

      {/* Filter tabs */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.05 }}
        className="flex gap-2"
      >
        {['all', 'unread'].map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-4 py-2 rounded-xl text-sm font-medium transition-all ${
              filter === f
                ? 'bg-[#6C63FF] text-white shadow-[0_4px_16px_rgba(108,99,255,0.3)]'
                : 'bg-[var(--bg-surface)] border border-[var(--border)] text-[var(--text-muted)] hover:text-[var(--text)]'
            }`}
          >
            {f === 'all' ? 'All' : `Unread ${unreadCount > 0 ? `(${unreadCount})` : ''}`}
          </button>
        ))}
      </motion.div>

      {/* Type filter */}
      <div className="flex gap-2 flex-wrap">
        {['', 'budget', 'overspending', 'goal', 'gmail', 'extension', 'ai', 'unusual', 'reminder', 'info'].map((t) => (
          <button
            key={t || 'any'}
            onClick={() => setTypeFilter(t)}
            className={`px-3 py-1.5 rounded-xl text-xs font-medium transition-all ${
              typeFilter === t
                ? 'bg-[#1E2028] text-[#F5F5F7] border border-[#6C63FF]/30'
                : 'bg-[var(--bg-surface)] border border-[var(--border)] text-[var(--text-muted)] hover:text-[var(--text)]'
            }`}
          >
            {t ? t : 'All types'}
          </button>
        ))}
      </div>

      {/* Notification list */}
      {loading ? (
        <Card><p className="text-sm text-[var(--text-muted)] text-center py-10">Loading…</p></Card>
      ) : visible.length === 0 ? (
        <EmptyState
          icon="🔔"
          title={filter === 'unread' ? 'No unread notifications' : 'No notifications'}
          description="You're all caught up! New alerts about your budget, goals, and AI insights will appear here."
        />
      ) : (
        <div className="space-y-3">
          <AnimatePresence>
            {visible.map((n, i) => {
              const style = TYPE_STYLES[n.type] || TYPE_STYLES.info;
              const IconComp = ICON_MAP[n.type] || Bell;
              return (
                <motion.div
                  key={n.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, x: 40, scale: 0.95 }}
                  transition={{ delay: i * 0.04 }}
                  onClick={() => markRead(n.id)}
                  className={`relative flex gap-4 p-4 rounded-2xl border cursor-pointer
                    transition-all duration-200 hover:scale-[1.01] group
                    ${style.bg}
                    ${!n.is_read ? 'ring-1 ring-[#6C63FF]/20' : ''}
                  `}
                >
                  {/* Unread dot */}
                  {!n.is_read && (
                    <span className="absolute top-4 right-4 w-2 h-2 rounded-full bg-[#6C63FF]" />
                  )}

                  {/* Icon */}
                  <div className={`w-10 h-10 rounded-xl bg-[var(--bg-surface)] flex items-center justify-center flex-shrink-0 ${style.icon}`}>
                    <IconComp size={18} />
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start gap-2 flex-wrap">
                      <p className={`text-sm font-semibold ${n.is_read ? 'text-[var(--text-muted)]' : 'text-[var(--text)]'}`}>
                        {n.title}
                      </p>
                      <Badge variant={style.badge} className="text-[10px]">{n.type}</Badge>
                      <Badge variant={n.priority === 'critical' ? 'danger' : n.priority === 'high' ? 'warning' : 'default'} className="text-[10px]">
                        {n.priority}
                      </Badge>
                    </div>
                    <p className="text-xs text-[var(--text-muted)] mt-1 leading-relaxed">{n.message}</p>
                    <p className="text-[11px] text-[var(--text-dim)] mt-2">{timeAgo(n.created_at)}</p>
                  </div>

                  {/* Delete */}
                  <button
                    onClick={(e) => { e.stopPropagation(); deleteOne(n.id); }}
                    className="opacity-0 group-hover:opacity-100 p-1.5 rounded-lg text-[var(--text-muted)] hover:text-[#FF5C5C] hover:bg-[#FF5C5C]/10 transition-all self-start flex-shrink-0"
                  >
                    <Trash2 size={14} />
                  </button>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
}
