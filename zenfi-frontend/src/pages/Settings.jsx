import { useState, useEffect } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Wallet, Save, Mail, Unplug, RefreshCw } from 'lucide-react';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import { SkeletonStatGrid } from '../components/ui/Skeleton';
import { formatCurrency, formatRelativeDate } from '../utils/formatters';
import { getBudget, updateBudget, DEFAULT_BUDGET } from '../api/budget';
import {
  getGmailStatus,
  getGmailConnectUrl,
  disconnectGmail,
  reconnectGmail,
  updateGmailSettings,
  triggerGmailSync,
} from '../api/gmail';
import { useToast } from '../context/ToastContext';

export default function Settings() {
  const { success, error: toastError } = useToast();
  const [budget, setBudget]       = useState('');
  const [loading, setLoading]     = useState(true);
  const [saving, setSaving]       = useState(false);
  const [loadError, setLoadError] = useState(false);
  const [gmail, setGmail] = useState({
    connected: false,
    email: '',
    last_sync_at: null,
    sync_enabled: true,
    gmail_auto_sync: true,
    api_configured: false,
  });
  const [gmailLoading, setGmailLoading] = useState(true);
  const [gmailSyncing, setGmailSyncing] = useState(false);
  const [searchParams, setSearchParams] = useSearchParams();

  useEffect(() => {
    const g = searchParams.get('gmail');
    if (g === 'connected') success('Gmail connected successfully!');
    if (g === 'error') toastError('Gmail connection failed. Check API credentials.');
    if (g) setSearchParams({}, { replace: true });
  }, [searchParams, setSearchParams, success, toastError]);

  useEffect(() => {
    getGmailStatus()
      .then((res) => setGmail(res.data))
      .catch(() => {})
      .finally(() => setGmailLoading(false));
  }, []);

  const handleConnectGmail = async () => {
    try {
      const res = await getGmailConnectUrl();
      window.location.href = res.data.auth_url;
    } catch (err) {
      toastError(err.response?.data?.detail || 'Gmail OAuth not configured on server.');
    }
  };

  const handleDisconnectGmail = async () => {
    try {
      await disconnectGmail();
      setGmail({ connected: false, email: '', last_sync_at: null });
      success('Gmail disconnected');
    } catch {
      toastError('Could not disconnect Gmail');
    }
  };

  const handleGmailSync = async () => {
    const latest = await getGmailStatus().catch(() => null);
    if (!latest?.data?.api_configured) {
      toastError('Gmail API not configured on server. Add GMAIL_CLIENT_ID/SECRET to zenfi/.env and restart Django.');
      return;
    }
    setGmail(latest.data);
    if (!latest.data.connected) {
      toastError('Connect Gmail first before syncing.');
      return;
    }
    if (!latest.data.sync_enabled) {
      toastError('Enable Gmail sync to run inbox scanning/import.');
      return;
    }
    setGmailSyncing(true);
    try {
      const syncRes = await triggerGmailSync(false);
      const data = syncRes.data;
      const res = await getGmailStatus();
      setGmail(res.data);
      if (data.status === 'error') {
        toastError(data.message || 'Sync failed');
      } else {
        const msg = `Synced: ${data.emails_scanned ?? 0} emails, ${data.expenses_parsed ?? 0} parsed`;
        success(msg);
      }
    } catch (err) {
      const d = err.response?.data;
      toastError(d?.message || d?.detail || err.message || 'Sync failed');
    } finally {
      setGmailSyncing(false);
    }
  };

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await getBudget();
        if (!cancelled) {
          setBudget(String(res.data.monthly_budget ?? DEFAULT_BUDGET));
          setLoadError(false);
        }
      } catch {
        if (!cancelled) {
          setBudget(String(DEFAULT_BUDGET));
          setLoadError(true);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const handleChangeGmail = async () => {
    if (!gmail.api_configured) {
      toastError('Gmail API not configured on server.');
      return;
    }
    try {
      const res = await reconnectGmail();
      window.location.href = res.data.auth_url;
    } catch (err) {
      toastError(err.response?.data?.message || err.response?.data?.detail || 'Could not reconnect Gmail.');
    }
  };

  const handleUpdateGmailSettings = async (patch) => {
    try {
      const res = await updateGmailSettings(patch);
      setGmail((prev) => ({ ...prev, ...res.data }));
      success('Gmail settings updated');
    } catch (err) {
      toastError(err.response?.data?.error || 'Could not update Gmail settings');
    }
  };

  const handleSave = async (e) => {
    e.preventDefault();
    const amount = Number(budget);
    if (!amount || amount <= 0) {
      toastError('Please enter a valid budget amount.');
      return;
    }
    setSaving(true);
    try {
      const res = await updateBudget(amount);
      setBudget(String(res.data.monthly_budget));
      success('Monthly budget updated!');
    } catch (err) {
      const detail = err.response?.data?.detail;
      const msg = typeof detail === 'object'
        ? Object.values(detail).flat()[0]
        : detail || 'Could not save budget.';
      toastError(msg);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6 max-w-xl">
      <div>
        <h2 className="text-xl font-bold text-[var(--text)]">Settings</h2>
        <p className="text-sm text-[var(--text-muted)] mt-1">
          Budget, Gmail auto-tracking, and account preferences.
        </p>
      </div>

      <Card>
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-xl bg-[#6C63FF]/15 flex items-center justify-center">
            <Mail size={18} className="text-[#6C63FF]" />
          </div>
          <div className="flex-1">
            <h3 className="text-[var(--text)] font-semibold">Gmail Auto Tracking</h3>
            <p className="text-xs text-[var(--text-muted)]">
              Import orders & payments from inbox (read-only)
            </p>
          </div>
        </div>
        {gmailLoading ? (
          <p className="text-xs text-[var(--text-muted)]">Checking connection…</p>
        ) : !gmail.api_configured ? (
          <p className="text-sm text-[#FFB547]">
            Server missing Gmail OAuth keys. Add GMAIL_CLIENT_ID and GMAIL_CLIENT_SECRET to zenfi/.env and restart the backend.
          </p>
        ) : gmail.connected ? (
          <div className="space-y-3">
            <p className="text-sm text-[#00D4AA]">Connected as {gmail.email}</p>
            {gmail.last_sync_at && (
              <p className="text-xs text-[var(--text-muted)]">
                Last sync: {formatRelativeDate(gmail.last_sync_at)}
              </p>
            )}
            <div className="space-y-2">
              <label className="flex items-center justify-between gap-3 text-xs text-[var(--text-muted)] cursor-pointer">
                <span>Enable Gmail sync</span>
                <input
                  type="checkbox"
                  checked={Boolean(gmail.sync_enabled)}
                  onChange={(e) => handleUpdateGmailSettings({ sync_enabled: e.target.checked })}
                />
              </label>
              <label className="flex items-center justify-between gap-3 text-xs text-[var(--text-muted)] cursor-pointer">
                <span>Auto-import into Transactions</span>
                <input
                  type="checkbox"
                  checked={Boolean(gmail.gmail_auto_sync)}
                  onChange={(e) => handleUpdateGmailSettings({ gmail_auto_sync: e.target.checked })}
                />
              </label>
            </div>

            <div className="flex flex-wrap gap-2">
              <Button size="sm" variant="secondary" onClick={handleGmailSync} loading={gmailSyncing} icon={<RefreshCw size={14} />}>
                Sync now
              </Button>
              <Link to="/gmail-expenses">
                <Button size="sm" variant="primary">Review pending</Button>
              </Link>
              <Button size="sm" variant="ghost" onClick={handleChangeGmail} title="Reconnect with a different Gmail account">
                Change Gmail
              </Button>
              <Button size="sm" variant="ghost" onClick={handleDisconnectGmail} icon={<Unplug size={14} />}>
                Disconnect
              </Button>
            </div>
          </div>
        ) : (
          <div className="flex gap-2 flex-wrap">
            <Button onClick={handleConnectGmail} icon={<Mail size={16} />}>
              Connect Gmail
            </Button>
            <Button variant="ghost" onClick={handleChangeGmail}>
              Change Gmail
            </Button>
          </div>
        )}
      </Card>

      {loading ? (
        <SkeletonStatGrid />
      ) : (
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
          {loadError && (
            <p className="text-sm text-[#FFB547] mb-4">
              Could not reach the server — showing default budget. Restart the backend and refresh, or save to set your budget.
            </p>
          )}
          <Card>
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 rounded-xl bg-[#FFB547]/15 flex items-center justify-center">
                <Wallet size={18} className="text-[#FFB547]" />
              </div>
              <div>
                <h3 className="text-[var(--text)] font-semibold">Monthly Budget</h3>
                <p className="text-xs text-[var(--text-muted)]">
                  Used for dashboard stats and budget alerts
                </p>
              </div>
            </div>

            <form onSubmit={handleSave} className="space-y-4">
              <div>
                <label htmlFor="monthly_budget" className="block text-xs font-medium text-[var(--text-muted)] mb-2">
                  Budget amount (₹)
                </label>
                <input
                  id="monthly_budget"
                  type="number"
                  min="1"
                  step="100"
                  value={budget}
                  onChange={(e) => setBudget(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl bg-[var(--border)] border border-[var(--border)] text-[var(--text)] text-sm focus:outline-none focus:border-[#6C63FF]/50 transition-colors"
                  placeholder="e.g. 30000"
                />
                {budget && Number(budget) > 0 && (
                  <p className="text-xs text-[var(--text-muted)] mt-2">
                    Preview: {formatCurrency(Number(budget))} per month
                  </p>
                )}
              </div>

              <Button type="submit" loading={saving} icon={<Save size={16} />}>
                Save budget
              </Button>
            </form>
          </Card>
        </motion.div>
      )}
    </div>
  );
}
