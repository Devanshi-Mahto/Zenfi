import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, Download, Search, Trash2, Sparkles } from 'lucide-react';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import Badge from '../components/ui/Badge';
import Modal from '../components/ui/Modal';
import EmptyState from '../components/ui/EmptyState';
import { SkeletonList } from '../components/ui/Skeleton';
import CategoryPieChart from '../components/charts/CategoryPieChart';
import { expenseCategories } from '../data/dummyData';   // config-only
import { formatCurrency, formatDate, getCategoryEmoji, getCategoryColor } from '../utils/formatters';
import { getExpenses, addExpense, deleteExpense, categorize } from '../api/expenses';
import { useToast } from '../context/ToastContext';

const emptyForm = { description: '', amount: '', category: 'food', is_essential: false };

export default function Transactions() {
  const { success, error: toastError } = useToast();
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading]           = useState(true);
  const [saving, setSaving]             = useState(false);
  const [modalOpen, setModalOpen]       = useState(false);
  const [form, setForm]                 = useState(emptyForm);
  const [search, setSearch]             = useState('');
  const [catFilter, setCatFilter]       = useState('all');
  const [sortBy, setSortBy]             = useState('date');
  const [deleteId, setDeleteId]         = useState(null);
  const [aiSuggestion, setAiSuggestion] = useState(null);
  const [suggesting, setSuggesting]     = useState(false);

  const fetchTransactions = useCallback(async () => {
    setLoading(true);
    try {
      const res = await getExpenses();
      const data = res.data?.results || res.data || [];
      setTransactions(Array.isArray(data) ? data : []);
    } catch {
      toastError('Failed to load transactions.');
    } finally {
      setLoading(false);
    }
  }, [toastError]);

  useEffect(() => { fetchTransactions(); }, [fetchTransactions]);

  // Client-side filtering/sorting
  const filtered = transactions
    .filter(t => catFilter === 'all' || t.category === catFilter)
    .filter(t => !search || t.description?.toLowerCase().includes(search.toLowerCase()))
    .sort((a, b) =>
      sortBy === 'amount'
        ? Number(b.amount) - Number(a.amount)
        : new Date(b.date) - new Date(a.date)
    );

  const handleChange = (e) => {
    const val = e.target.type === 'checkbox' ? e.target.checked : e.target.value;
    setForm(p => ({ ...p, [e.target.name]: val }));
    // Clear AI suggestion when description changes
    if (e.target.name === 'description') setAiSuggestion(null);
  };

  // AI categorization on description blur
  const handleDescriptionBlur = async () => {
    if (!form.description || form.description.length < 3) return;
    setSuggesting(true);
    try {
      const res = await categorize({ description: form.description, amount: Number(form.amount) || 0 });
      const data = res.data;
      if (data.confidence >= 0.7 && data.category !== form.category) {
        setAiSuggestion(data);
      }
    } catch { /* silent */ } finally {
      setSuggesting(false);
    }
  };

  const applyAiSuggestion = () => {
    if (aiSuggestion) {
      setForm(p => ({ ...p, category: aiSuggestion.category }));
      setAiSuggestion(null);
    }
  };

  const handleAdd = async (e) => {
    e.preventDefault();
    setSaving(true);
    const payload = { ...form, amount: Number(form.amount) };
    try {
      const res = await addExpense(payload);
      setTransactions(prev => [res.data, ...prev]);
      setModalOpen(false);
      setForm(emptyForm);
      setAiSuggestion(null);
      success('Expense added! 💸');
    } catch (err) {
      toastError(err.response?.data?.detail || 'Could not add expense.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id) => {
    try {
      await deleteExpense(id);
      setTransactions(prev => prev.filter(t => t.id !== id));
      success('Expense deleted.');
    } catch {
      toastError('Could not delete expense.');
    } finally {
      setDeleteId(null);
    }
  };

  const totalSpent = filtered.reduce((s, t) => s + Number(t.amount), 0);

  const catData = Object.entries(
    transactions.reduce((acc, t) => {
      acc[t.category] = (acc[t.category] || 0) + Number(t.amount);
      return acc;
    }, {})
  ).map(([name, value]) => ({
    name: name.charAt(0).toUpperCase() + name.slice(1),
    value,
    color: getCategoryColor(name),
  }));

  const exportCSV = () => {
    const header = 'Date,Description,Category,Amount,Essential\n';
    const rows = filtered.map(t =>
      `${t.date},"${t.description}",${t.category},${t.amount},${t.is_essential}`
    ).join('\n');
    const blob = new Blob([header + rows], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = 'zenfi-transactions.csv'; a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}
        className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-xl font-bold text-[var(--text)]">Transactions</h2>
          <p className="text-sm text-[var(--text-muted)] mt-0.5">
            {filtered.length} transactions · {formatCurrency(totalSpent)} total
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" icon={<Download size={15} />} onClick={exportCSV} size="sm">Export</Button>
          <Button variant="primary" icon={<Plus size={15} />} onClick={() => setModalOpen(true)} size="sm">Add Expense</Button>
        </div>
      </motion.div>

      {/* Charts */}
      {catData.length > 0 && (
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.1 }}>
            <Card className="h-full">
              <h3 className="text-[var(--text)] font-semibold mb-4">Spending by Category</h3>
              <CategoryPieChart data={catData} />
            </Card>
          </motion.div>

          <motion.div className="xl:col-span-2" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.15 }}>
            <Card className="h-full">
              <h3 className="text-[var(--text)] font-semibold mb-4">Category Breakdown</h3>
              <div className="space-y-3">
                {catData.map((cat) => {
                  const pct = Math.round((cat.value / transactions.reduce((s, t) => s + Number(t.amount), 0)) * 100) || 0;
                  return (
                    <div key={cat.name} className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg flex items-center justify-center text-base"
                        style={{ backgroundColor: `${cat.color}20` }}>
                        {getCategoryEmoji(cat.name.toLowerCase())}
                      </div>
                      <div className="flex-1">
                        <div className="flex justify-between text-sm mb-1">
                          <span className="text-[var(--text)] font-medium">{cat.name}</span>
                          <span className="text-[var(--text-muted)]">{formatCurrency(cat.value)}</span>
                        </div>
                        <div className="h-1.5 rounded-full bg-[var(--border)] overflow-hidden">
                          <motion.div
                            initial={{ width: 0 }} animate={{ width: `${pct}%` }}
                            transition={{ duration: 0.6, delay: 0.2 }}
                            className="h-full rounded-full"
                            style={{ backgroundColor: cat.color }}
                          />
                        </div>
                      </div>
                      <span className="text-xs text-[var(--text-muted)] w-10 text-right">{pct}%</span>
                    </div>
                  );
                })}
              </div>
            </Card>
          </motion.div>
        </div>
      )}

      {/* Filters */}
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.2 }}>
        <Card>
          <div className="flex flex-wrap gap-3 items-center">
            <div className="relative flex-1 min-w-48">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" />
              <input
                value={search} onChange={e => setSearch(e.target.value)}
                placeholder="Search transactions..."
                className="pl-9 pr-4 py-2 text-sm w-full"
              />
            </div>
            <div className="flex gap-2 flex-wrap">
              {['all', 'food', 'shopping', 'travel', 'bills', 'entertainment', 'health', 'education', 'other'].map(cat => (
                <button
                  key={cat}
                  onClick={() => setCatFilter(cat)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                    catFilter === cat
                      ? 'bg-[#6C63FF] text-white'
                      : 'bg-[var(--border)] text-[var(--text-muted)] hover:text-[var(--text)]'
                  }`}
                >
                  {cat === 'all' ? 'All' : `${getCategoryEmoji(cat)} ${cat.charAt(0).toUpperCase() + cat.slice(1)}`}
                </button>
              ))}
            </div>
            <select value={sortBy} onChange={e => setSortBy(e.target.value)} className="py-2 px-3 text-sm w-auto">
              <option value="date">Sort: Date</option>
              <option value="amount">Sort: Amount</option>
            </select>
          </div>
        </Card>
      </motion.div>

      {/* Transaction list */}
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.25 }}>
        <Card className="p-0 overflow-hidden">
          {loading ? (
            <div className="p-5"><SkeletonList rows={6} /></div>
          ) : filtered.length === 0 ? (
            <EmptyState
              icon="💸"
              title={transactions.length === 0 ? 'No transactions yet' : 'No results found'}
              description={transactions.length === 0 ? 'Add your first expense to start tracking.' : 'Try adjusting your filters.'}
              action={transactions.length === 0 ? (
                <Button variant="primary" onClick={() => setModalOpen(true)} icon={<Plus size={16} />}>Add Expense</Button>
              ) : null}
            />
          ) : (
            <div>
              <div className="hidden md:grid grid-cols-[2fr_1fr_1fr_auto_auto] gap-4 px-5 py-3 border-b border-[var(--border)] text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wide">
                <span>Transaction</span>
                <span>Category</span>
                <span>Date</span>
                <span className="text-right">Amount</span>
                <span></span>
              </div>
              <AnimatePresence>
                {filtered.map((txn, i) => (
                  <motion.div
                    key={txn.id}
                    initial={{ opacity: 0, y: 5 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    transition={{ delay: i * 0.02 }}
                    className="grid grid-cols-1 md:grid-cols-[2fr_1fr_1fr_auto_auto] gap-2 md:gap-4 items-center px-5 py-4 border-b border-[var(--border)] last:border-0 hover:bg-[var(--border)]/20 transition-colors group"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-xl bg-[var(--border)] flex items-center justify-center text-lg flex-shrink-0">
                        {getCategoryEmoji(txn.category)}
                      </div>
                      <div>
                        <p className="text-sm font-medium text-[var(--text)]">{txn.description}</p>
                        {txn.ai_suggestion && (
                          <p className="text-xs text-[#6C63FF]">🤖 AI: {txn.ai_suggestion.suggested_category}</p>
                        )}
                        {txn.is_essential && <Badge variant="info" className="mt-0.5 md:hidden">Essential</Badge>}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant={txn.category === 'bills' ? 'danger' : txn.category === 'food' ? 'primary' : 'default'}>
                        {txn.category}
                      </Badge>
                      {txn.is_essential && <Badge variant="info" className="hidden md:inline-flex">Essential</Badge>}
                    </div>
                    <span className="text-sm text-[var(--text-muted)]">{formatDate(txn.date)}</span>
                    <span className="text-sm font-bold text-[#FF5C5C] md:text-right">
                      -{formatCurrency(txn.amount)}
                    </span>
                    <button
                      onClick={() => setDeleteId(txn.id)}
                      className="opacity-0 group-hover:opacity-100 p-1.5 rounded-lg text-[var(--text-dim)] hover:text-[#FF5C5C] hover:bg-[#FF5C5C]/10 transition-all"
                    >
                      <Trash2 size={14} />
                    </button>
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          )}
        </Card>
      </motion.div>

      {/* Add Expense Modal */}
      <Modal isOpen={modalOpen} onClose={() => { setModalOpen(false); setForm(emptyForm); setAiSuggestion(null); }} title="Add Expense">
        <form onSubmit={handleAdd} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-[var(--text-muted)] mb-1.5">Description</label>
            <input
              name="description"
              value={form.description}
              onChange={handleChange}
              onBlur={handleDescriptionBlur}
              placeholder="e.g. Swiggy Dinner"
              required
            />
            {/* AI suggestion banner */}
            {suggesting && (
              <p className="text-xs text-[#6C63FF] mt-1.5 flex items-center gap-1">
                <Sparkles size={11} className="animate-spin" /> Analyzing…
              </p>
            )}
            {aiSuggestion && (
              <div className="mt-2 p-2.5 rounded-lg bg-[#6C63FF]/10 border border-[#6C63FF]/20 flex items-center justify-between gap-2">
                <p className="text-xs text-[#6C63FF]">
                  🤖 AI suggests: <strong>{aiSuggestion.category}</strong> ({Math.round(aiSuggestion.confidence * 100)}% confident)
                </p>
                <button type="button" onClick={applyAiSuggestion}
                  className="text-xs text-[#6C63FF] hover:underline font-semibold shrink-0">Apply</button>
              </div>
            )}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-[var(--text-muted)] mb-1.5">Amount (₹)</label>
              <input name="amount" type="number" min="1" value={form.amount} onChange={handleChange} placeholder="500" required />
            </div>
            <div>
              <label className="block text-sm font-medium text-[var(--text-muted)] mb-1.5">Category</label>
              <select name="category" value={form.category} onChange={handleChange}>
                {expenseCategories.map(c => <option key={c.value} value={c.value}>{c.emoji} {c.label}</option>)}
              </select>
            </div>
          </div>
          <label className="flex items-center gap-2.5 cursor-pointer">
            <input type="checkbox" name="is_essential" checked={form.is_essential} onChange={handleChange}
              className="w-4 h-4 rounded accent-[#6C63FF]" />
            <span className="text-sm text-[var(--text-muted)]">Mark as essential expense</span>
          </label>
          <div className="flex gap-3 pt-2">
            <Button type="button" variant="secondary" onClick={() => { setModalOpen(false); setForm(emptyForm); setAiSuggestion(null); }} className="flex-1">Cancel</Button>
            <Button type="submit" variant="primary" loading={saving} className="flex-1">Add Expense</Button>
          </div>
        </form>
      </Modal>

      {/* Delete Confirm Modal */}
      <Modal isOpen={!!deleteId} onClose={() => setDeleteId(null)} title="Delete Expense" size="sm">
        <p className="text-sm text-[var(--text-muted)] mb-6">Delete this expense? This cannot be undone.</p>
        <div className="flex gap-3">
          <Button variant="secondary" onClick={() => setDeleteId(null)} className="flex-1">Cancel</Button>
          <Button variant="danger" onClick={() => handleDelete(deleteId)} className="flex-1">Delete</Button>
        </div>
      </Modal>
    </div>
  );
}
