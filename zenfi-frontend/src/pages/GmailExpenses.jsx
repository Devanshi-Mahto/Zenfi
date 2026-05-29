import { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { Mail, Check, X, RefreshCw, Inbox } from 'lucide-react';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import Badge from '../components/ui/Badge';
import { formatCurrency, formatRelativeDate } from '../utils/formatters';
import {
  getParsedExpenses,
  approveParsedExpense,
  rejectParsedExpense,
  triggerGmailSync,
} from '../api/gmail';
import { useToast } from '../context/ToastContext';

const CATEGORY_EMOJI = {
  food: '🍽️', shopping: '🛍️', travel: '🚌', bills: '📄',
  entertainment: '🎬', health: '🏥', education: '📚', other: '📦',
};

export default function GmailExpenses() {
  const { success, error: toastError } = useToast();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [actingId, setActingId] = useState(null);

  const fetchItems = useCallback(async () => {
    setLoading(true);
    try {
      const res = await getParsedExpenses('pending');
      setItems(res.data?.results || []);
    } catch (err) {
      const status = err.response?.status;
      if (status === 404) {
        toastError('Gmail parsed endpoint not found (404). Restart the backend to load the latest Gmail integration routes.');
      } else {
        toastError('Failed to load parsed expenses.');
      }
    } finally {
      setLoading(false);
    }
  }, [toastError]);

  useEffect(() => { fetchItems(); }, [fetchItems]);

  const handleSync = async () => {
    setSyncing(true);
    try {
      const res = await triggerGmailSync(false);
      const data = res.data;
      if (data.status === 'error') {
        toastError(data.message || 'Sync failed');
      } else {
        success(
          `Scanned ${data.emails_scanned ?? 0} emails — ${data.expenses_parsed ?? 0} new items`
        );
      }
      await fetchItems();
    } catch (err) {
      const d = err.response?.data;
      toastError(d?.message || d?.detail || 'Sync failed');
    } finally {
      setSyncing(false);
    }
  };

  const handleApprove = async (item) => {
    setActingId(item.id);
    try {
      await approveParsedExpense(item.id, {
        category: item.category,
        amount: item.amount,
        description: item.description,
      });
      success('Expense imported!');
      setItems((prev) => prev.filter((i) => i.id !== item.id));
    } catch {
      toastError('Could not approve expense.');
    } finally {
      setActingId(null);
    }
  };

  const handleReject = async (id) => {
    setActingId(id);
    try {
      await rejectParsedExpense(id);
      setItems((prev) => prev.filter((i) => i.id !== id));
      success('Skipped');
    } catch {
      toastError('Could not reject.');
    } finally {
      setActingId(null);
    }
  };

  return (
    <div className="space-y-6 max-w-3xl">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-[var(--text)] flex items-center gap-2">
            <Inbox size={22} className="text-[#6C63FF]" />
            Gmail Expenses
          </h2>
          <p className="text-sm text-[var(--text-muted)] mt-1">
            Review transactions detected from your inbox before they are added.
          </p>
        </div>
        <Button
          variant="secondary"
          onClick={handleSync}
          loading={syncing}
          icon={<RefreshCw size={16} />}
        >
          Sync Gmail
        </Button>
      </div>

      {loading ? (
        <Card><p className="text-sm text-[var(--text-muted)] text-center py-8">Loading…</p></Card>
      ) : items.length === 0 ? (
        <Card>
          <div className="text-center py-10">
            <Mail size={32} className="mx-auto text-[var(--text-muted)] mb-3" />
            <p className="text-sm text-[var(--text-muted)]">No pending expenses from Gmail.</p>
            <Button className="mt-4" onClick={handleSync} loading={syncing}>Run sync</Button>
          </div>
        </Card>
      ) : (
        <div className="space-y-3">
          {items.map((item, i) => (
            <motion.div key={item.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}>
              <Card className="border border-[var(--border)]">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex gap-3 min-w-0">
                    <span className="text-2xl">{CATEGORY_EMOJI[item.category] || '📦'}</span>
                    <div className="min-w-0">
                      <p className="font-semibold text-[var(--text)] truncate">{item.merchant || 'Unknown'}</p>
                      <p className="text-xs text-[var(--text-muted)] truncate">{item.subject}</p>
                      <div className="flex flex-wrap gap-2 mt-2">
                        <Badge variant="primary">{Math.round(item.confidence * 100)}% match</Badge>
                        <Badge>{item.parse_method}</Badge>
                        {item.order_id && <Badge>#{item.order_id.slice(0, 12)}</Badge>}
                      </div>
                    </div>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="text-lg font-bold text-[#FF5C5C]">
                      {item.amount ? formatCurrency(item.amount) : '—'}
                    </p>
                    {item.transaction_date && (
                      <p className="text-xs text-[var(--text-muted)]">
                        {formatRelativeDate(item.transaction_date)}
                      </p>
                    )}
                  </div>
                </div>
                <div className="flex gap-2 mt-4 justify-end">
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => handleReject(item.id)}
                    disabled={actingId === item.id}
                    icon={<X size={14} />}
                  >
                    Reject
                  </Button>
                  <Button
                    size="sm"
                    variant="teal"
                    onClick={() => handleApprove(item)}
                    disabled={actingId === item.id || !item.amount}
                    icon={<Check size={14} />}
                  >
                    Approve
                  </Button>
                </div>
              </Card>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}
