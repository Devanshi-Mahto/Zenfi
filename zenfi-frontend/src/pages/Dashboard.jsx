import { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { TrendingUp, TrendingDown, Target, Wallet, ArrowUpRight, Sparkles, RefreshCw, Pencil } from 'lucide-react';
import { Link } from 'react-router-dom';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import Modal from '../components/ui/Modal';
import ProgressBar from '../components/ui/ProgressBar';
import Badge from '../components/ui/Badge';
import { SkeletonStatGrid, SkeletonList, SkeletonInsightCard } from '../components/ui/Skeleton';
import SpendingAreaChart from '../components/charts/SpendingAreaChart';
import { formatCurrency, formatRelativeDate, calcProgress, getCategoryEmoji } from '../utils/formatters';
import { getDashboard } from '../api/dashboard';
import { getInsights, refreshInsights, markInsightRead } from '../api/ai';
import { updateBudget } from '../api/budget';
import { useToast } from '../context/ToastContext';

const fadeUp = (delay = 0) => ({
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.4, delay },
});

// Map backend insight types to UI colors
const INSIGHT_STYLE = {
  overspending: { bg: 'bg-[#FFB547]/8 border-[#FFB547]/20', title: 'text-[#FFB547]' },
  savings_tip:  { bg: 'bg-[#00D4AA]/8 border-[#00D4AA]/20', title: 'text-[#00D4AA]' },
  goal_warning: { bg: 'bg-[#FF5C5C]/8 border-[#FF5C5C]/20', title: 'text-[#FF5C5C]' },
  pattern:      { bg: 'bg-[#6C63FF]/8 border-[#6C63FF]/20', title: 'text-[#6C63FF]' },
  general:      { bg: 'bg-[#6C63FF]/8 border-[#6C63FF]/20', title: 'text-[#6C63FF]' },
};

export default function Dashboard() {
  const { error: toastError, success } = useToast();
  const [dashboard, setDashboard] = useState(null);
  const [insights, setInsights]   = useState([]);
  const [loading, setLoading]     = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [budgetModalOpen, setBudgetModalOpen] = useState(false);
  const [budgetInput, setBudgetInput] = useState('');
  const [budgetSaving, setBudgetSaving] = useState(false);

  // Build 6-month chart data from category_breakdown (simple mock from real total)
  const chartData = dashboard ? [
    { month: 'Dec', spending: 0,     savings: 0 },
    { month: 'Jan', spending: 0,     savings: 0 },
    { month: 'Feb', spending: 0,     savings: 0 },
    { month: 'Mar', spending: 0,     savings: 0 },
    { month: 'Apr', spending: 0,     savings: 0 },
    { month: 'May', spending: Math.round(dashboard.stats.monthly_spent), savings: Math.max(Math.round(dashboard.stats.monthly_budget - dashboard.stats.monthly_spent), 0) },
  ] : [];

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const [dashRes, insightRes] = await Promise.allSettled([
        getDashboard(),
        getInsights(),
      ]);
      if (dashRes.status === 'fulfilled') {
        setDashboard(dashRes.value.data);
      }
      if (insightRes.status === 'fulfilled') {
        setInsights(insightRes.value.data?.results || []);
      }
    } catch (e) {
      toastError('Failed to load dashboard data.');
    } finally {
      setLoading(false);
    }
  }, [toastError]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const handleRefreshInsights = async () => {
    setRefreshing(true);
    try {
      await refreshInsights();
      const res = await getInsights();
      setInsights(res.data?.results || []);
      success('AI insights refreshed!');
    } catch {
      toastError('Could not refresh insights.');
    } finally {
      setRefreshing(false);
    }
  };

  const handleMarkRead = async (id) => {
    try {
      await markInsightRead(id);
      setInsights(prev => prev.map(i => i.id === id ? { ...i, is_read: true } : i));
    } catch { /* silent */ }
  };

  const openBudgetModal = () => {
    if (dashboard?.stats?.monthly_budget) {
      setBudgetInput(String(dashboard.stats.monthly_budget));
    }
    setBudgetModalOpen(true);
  };

  const handleSaveBudget = async (e) => {
    e.preventDefault();
    const amount = Number(budgetInput);
    if (!amount || amount <= 0) {
      toastError('Please enter a valid budget amount.');
      return;
    }
    setBudgetSaving(true);
    try {
      await updateBudget(amount);
      setBudgetModalOpen(false);
      success('Monthly budget updated!');
      await fetchAll();
    } catch (err) {
      const detail = err.response?.data?.detail;
      const msg = typeof detail === 'object'
        ? Object.values(detail).flat()[0]
        : detail || 'Could not save budget.';
      toastError(msg);
    } finally {
      setBudgetSaving(false);
    }
  };

  const stats = dashboard ? [
    {
      label: 'Spent This Month',
      value: formatCurrency(dashboard.stats.monthly_spent),
      change: `${dashboard.stats.budget_used_pct}% of budget used`,
      trend: dashboard.stats.budget_used_pct > 80 ? 'up' : 'neutral',
      icon: Wallet, color: '#FF5C5C', bg: 'from-[#FF5C5C]/10 to-transparent',
    },
    {
      label: 'Budget Remaining',
      value: formatCurrency(dashboard.stats.budget_remaining),
      change: `of ${formatCurrency(dashboard.stats.monthly_budget)} budget`,
      trend: 'down',
      icon: TrendingDown, color: '#FFB547', bg: 'from-[#FFB547]/10 to-transparent',
      editable: true,
    },
    {
      label: 'Total Saved',
      value: formatCurrency(dashboard.stats.total_saved, true),
      change: 'Across all goals',
      trend: 'down',
      icon: TrendingUp, color: '#00D4AA', bg: 'from-[#00D4AA]/10 to-transparent',
    },
    {
      label: 'Active Goals',
      value: dashboard.stats.active_goals,
      change: 'In progress',
      trend: 'neutral',
      icon: Target, color: '#6C63FF', bg: 'from-[#6C63FF]/10 to-transparent',
    },
  ] : [];

  return (
    <div className="space-y-6">
      {/* Stats */}
      {loading ? <SkeletonStatGrid /> : (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
          {stats.map((stat, i) => (
            <motion.div key={stat.label} {...fadeUp(i * 0.05)}>
              <Card className={`bg-gradient-to-br ${stat.bg} border border-[var(--border)] hover:border-[${stat.color}]/30 transition-colors`}>
                <div className="flex items-start justify-between mb-4">
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center"
                    style={{ backgroundColor: `${stat.color}20` }}>
                    <stat.icon size={18} style={{ color: stat.color }} />
                  </div>
                  {stat.editable ? (
                    <button
                      onClick={openBudgetModal}
                      className="p-1 rounded-lg text-[var(--text-dim)] hover:text-[#FFB547] hover:bg-[#FFB547]/10 transition-colors"
                      title="Edit monthly budget"
                    >
                      <Pencil size={14} />
                    </button>
                  ) : (
                    <ArrowUpRight size={14} className="text-[var(--text-dim)] mt-1" />
                  )}
                </div>
                <p className="text-2xl font-bold text-[var(--text)] mb-1">{stat.value}</p>
                <p className="text-xs text-[var(--text-muted)]">{stat.label}</p>
                <p className={`text-xs mt-2 font-medium ${
                  stat.trend === 'up' ? 'text-[#FF5C5C]' :
                  stat.trend === 'down' ? 'text-[#00D4AA]' : 'text-[var(--text-muted)]'
                }`}>{stat.change}</p>
              </Card>
            </motion.div>
          ))}
        </div>
      )}

      {/* Charts row */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        <motion.div className="xl:col-span-2" {...fadeUp(0.2)}>
          <Card>
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-[var(--text)] font-semibold">Spending Overview</h3>
                <p className="text-xs text-[var(--text-muted)] mt-0.5">Current month vs budget</p>
              </div>
              <Badge variant="primary">Monthly</Badge>
            </div>
            <SpendingAreaChart data={chartData} />
          </Card>
        </motion.div>

        {/* AI Insights */}
        <motion.div {...fadeUp(0.25)}>
          <Card className="h-full">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Sparkles size={15} className="text-[#6C63FF]" />
                <h3 className="text-[var(--text)] font-semibold">AI Insights</h3>
              </div>
              <button
                onClick={handleRefreshInsights}
                disabled={refreshing}
                className="p-1.5 rounded-lg text-[var(--text-muted)] hover:text-[#6C63FF] hover:bg-[#6C63FF]/10 transition-colors disabled:opacity-50"
                title="Refresh insights"
              >
                <RefreshCw size={13} className={refreshing ? 'animate-spin' : ''} />
              </button>
            </div>
            {loading ? (
              <div className="space-y-3">
                {[1,2,3].map(i => <SkeletonInsightCard key={i} />)}
              </div>
            ) : insights.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-sm text-[var(--text-muted)]">No insights yet.</p>
                <button onClick={handleRefreshInsights} className="text-xs text-[#6C63FF] mt-2 hover:underline">
                  Generate insights
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                {insights.slice(0, 4).map((insight, i) => {
                  const style = INSIGHT_STYLE[insight.type] || INSIGHT_STYLE.general;
                  return (
                    <motion.div
                      key={insight.id}
                      initial={{ opacity: 0, x: 10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 0.3 + i * 0.1 }}
                      onClick={() => !insight.is_read && handleMarkRead(insight.id)}
                      className={`p-3 rounded-xl border text-sm cursor-pointer transition-opacity ${style.bg} ${insight.is_read ? 'opacity-60' : ''}`}
                    >
                      <p className={`font-semibold mb-1 ${style.title}`}>{insight.title}</p>
                      <p className="text-[var(--text-muted)] text-xs leading-relaxed">{insight.message}</p>
                    </motion.div>
                  );
                })}
              </div>
            )}
          </Card>
        </motion.div>
      </div>

      {/* Bottom row: Goals + Transactions */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        {/* Top Goals */}
        <motion.div {...fadeUp(0.3)}>
          <Card>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-[var(--text)] font-semibold">Savings Goals</h3>
              <Link to="/goals" className="text-xs text-[#6C63FF] hover:underline">View all</Link>
            </div>
            {loading ? <SkeletonList rows={3} /> : !dashboard?.active_goals?.length ? (
              <p className="text-sm text-center text-[var(--text-muted)] py-6">No goals yet. <Link to="/goals" className="text-[#6C63FF] hover:underline">Create one →</Link></p>
            ) : (
              <div className="space-y-4">
                {dashboard.active_goals.map((goal) => {
                  const pct = calcProgress(goal.saved_amount, goal.target_amount);
                  return (
                    <div key={goal.id} className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium text-[var(--text)]">{goal.title}</span>
                        <span className="text-xs text-[var(--text-muted)]">{pct}%</span>
                      </div>
                      <ProgressBar value={pct} max={100} color="auto" height={6} />
                      <div className="flex justify-between text-xs text-[var(--text-muted)]">
                        <span>₹{Number(goal.saved_amount).toLocaleString('en-IN')} saved</span>
                        <span>of ₹{Number(goal.target_amount).toLocaleString('en-IN')}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </Card>
        </motion.div>

        {/* Recent Transactions */}
        <motion.div {...fadeUp(0.35)}>
          <Card>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-[var(--text)] font-semibold">Recent Transactions</h3>
              <Link to="/transactions" className="text-xs text-[#6C63FF] hover:underline">View all</Link>
            </div>
            {loading ? <SkeletonList rows={5} /> : !dashboard?.recent_transactions?.length ? (
              <p className="text-sm text-center text-[var(--text-muted)] py-6">No transactions yet. <Link to="/transactions" className="text-[#6C63FF] hover:underline">Add one →</Link></p>
            ) : (
              <div className="space-y-3">
                {dashboard.recent_transactions.map((txn) => (
                  <div key={txn.id} className="flex items-center justify-between py-2 border-b border-[var(--border)] last:border-0">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-xl bg-[var(--border)] flex items-center justify-center text-lg">
                        {getCategoryEmoji(txn.category)}
                      </div>
                      <div>
                        <p className="text-sm font-medium text-[var(--text)]">{txn.description}</p>
                        <p className="text-xs text-[var(--text-muted)]">{formatRelativeDate(txn.date)}</p>
                      </div>
                    </div>
                    <p className="text-sm font-semibold text-[#FF5C5C]">-₹{Number(txn.amount).toLocaleString('en-IN')}</p>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </motion.div>
      </div>

      <Modal
        isOpen={budgetModalOpen}
        onClose={() => setBudgetModalOpen(false)}
        title="Edit Monthly Budget"
        size="sm"
      >
        <form onSubmit={handleSaveBudget} className="space-y-4">
          <div>
            <label htmlFor="dash_budget" className="block text-xs font-medium text-[var(--text-muted)] mb-2">
              Budget amount (₹)
            </label>
            <input
              id="dash_budget"
              type="number"
              min="1"
              step="100"
              value={budgetInput}
              onChange={(e) => setBudgetInput(e.target.value)}
              className="w-full px-4 py-3 rounded-xl bg-[var(--border)] border border-[var(--border)] text-[var(--text)] text-sm focus:outline-none focus:border-[#6C63FF]/50"
              placeholder="e.g. 30000"
              autoFocus
            />
          </div>
          <div className="flex gap-3 justify-end">
            <Button variant="ghost" type="button" onClick={() => setBudgetModalOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" loading={budgetSaving}>
              Save
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
