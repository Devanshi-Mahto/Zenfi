import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, Pencil, Trash2, Calendar, Brain } from 'lucide-react';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import Badge from '../components/ui/Badge';
import Modal from '../components/ui/Modal';
import ProgressBar from '../components/ui/ProgressBar';
import EmptyState from '../components/ui/EmptyState';
import { SkeletonGoalCard } from '../components/ui/Skeleton';
import { goalCategories } from '../data/dummyData';  // config-only, no mock data
import { calcProgress, daysUntil, formatCurrency } from '../utils/formatters';
import { getGoals, createGoal, updateGoal, deleteGoal, predictGoal } from '../api/goals';
import { useToast } from '../context/ToastContext';

const emptyForm = { title: '', target_amount: '', saved_amount: '0', deadline: '', category: 'savings' };

export default function Goals() {
  const { success, error: toastError } = useToast();
  const [goals, setGoals]       = useState([]);
  const [loading, setLoading]   = useState(true);
  const [saving, setSaving]     = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [editGoal, setEditGoal]   = useState(null);
  const [form, setForm]           = useState(emptyForm);
  const [deleteId, setDeleteId]   = useState(null);
  const [predictions, setPredictions] = useState({});   // { [goalId]: prediction }
  const [predLoading, setPredLoading] = useState({});

  const fetchGoals = useCallback(async () => {
    setLoading(true);
    try {
      const res = await getGoals();
      setGoals(res.data?.results || res.data || []);
    } catch {
      toastError('Failed to load goals.');
    } finally {
      setLoading(false);
    }
  }, [toastError]);

  useEffect(() => { fetchGoals(); }, [fetchGoals]);

  const openCreate = () => { setEditGoal(null); setForm(emptyForm); setModalOpen(true); };
  const openEdit   = (g)  => {
    setEditGoal(g);
    setForm({
      title:         g.title,
      target_amount: g.target_amount,
      saved_amount:  g.saved_amount,
      deadline:      g.deadline,
      category:      g.category || 'savings',
    });
    setModalOpen(true);
  };
  const closeModal = () => { setModalOpen(false); setEditGoal(null); setForm(emptyForm); };
  const handleChange = (e) => setForm(p => ({ ...p, [e.target.name]: e.target.value }));

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    const payload = {
      ...form,
      target_amount: Number(form.target_amount),
      saved_amount:  Number(form.saved_amount),
    };
    try {
      if (editGoal) {
        const res = await updateGoal(editGoal.id, payload);
        setGoals(prev => prev.map(g => g.id === editGoal.id ? res.data : g));
        success('Goal updated successfully!');
      } else {
        const res = await createGoal(payload);
        setGoals(prev => [res.data, ...prev]);
        success('Goal created! 🎯');
      }
      closeModal();
    } catch (err) {
      const msg = err.response?.data?.detail || 'Could not save goal.';
      toastError(msg);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id) => {
    try {
      await deleteGoal(id);
      setGoals(prev => prev.filter(g => g.id !== id));
      success('Goal deleted.');
    } catch {
      toastError('Could not delete goal.');
    } finally {
      setDeleteId(null);
    }
  };

  const handlePredict = async (goalId) => {
    setPredLoading(p => ({ ...p, [goalId]: true }));
    try {
      const res = await predictGoal(goalId);
      setPredictions(p => ({ ...p, [goalId]: res.data }));
      success('Prediction updated ✨');
    } catch {
      toastError('Could not fetch AI prediction.');
    } finally {
      setPredLoading(p => ({ ...p, [goalId]: false }));
    }
  };

  const getCategoryInfo = (cat) =>
    goalCategories.find(c => c.value === cat) || goalCategories[goalCategories.length - 1];

  const totalTarget = goals.reduce((s, g) => s + Number(g.target_amount), 0);
  const totalSaved  = goals.reduce((s, g) => s + Number(g.saved_amount), 0);
  const overallPct  = calcProgress(totalSaved, totalTarget);

  return (
    <div className="space-y-6">
      {/* Header */}
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}
        className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-[var(--text)]">Savings Goals</h2>
          <p className="text-sm text-[var(--text-muted)] mt-0.5">{goals.length} goals · {overallPct}% overall progress</p>
        </div>
        <Button variant="primary" icon={<Plus size={16} />} onClick={openCreate}>New Goal</Button>
      </motion.div>

      {/* Overall progress card */}
      {!loading && goals.length > 0 && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.1 }}>
          <Card className="bg-gradient-to-br from-[#6C63FF]/10 to-[#00D4AA]/5 border-[#6C63FF]/20">
            <div className="flex flex-col sm:flex-row sm:items-center gap-4">
              <div className="flex-1">
                <p className="text-sm text-[var(--text-muted)] mb-1">Overall Savings Progress</p>
                <div className="flex items-end gap-3 mb-3">
                  <p className="text-2xl font-bold text-[var(--text)]">{formatCurrency(totalSaved, true)}</p>
                  <p className="text-sm text-[var(--text-muted)] mb-0.5">of {formatCurrency(totalTarget, true)}</p>
                </div>
                <ProgressBar value={overallPct} max={100} color="#6C63FF" height={10} />
              </div>
              <div className="grid grid-cols-3 gap-4 sm:border-l border-[var(--border)] sm:pl-6">
                {[
                  ['🎯', goals.length, 'Goals'],
                  ['✅', goals.filter(g => calcProgress(g.saved_amount, g.target_amount) >= 100).length, 'Done'],
                  ['⏳', goals.filter(g => daysUntil(g.deadline) <= 30 && daysUntil(g.deadline) >= 0).length, 'Due Soon'],
                ].map(([emoji, val, label]) => (
                  <div key={label} className="text-center">
                    <p className="text-lg">{emoji}</p>
                    <p className="text-xl font-bold text-[var(--text)]">{val}</p>
                    <p className="text-xs text-[var(--text-muted)]">{label}</p>
                  </div>
                ))}
              </div>
            </div>
          </Card>
        </motion.div>
      )}

      {/* Goals grid */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {[1,2,3].map(i => <SkeletonGoalCard key={i} />)}
        </div>
      ) : goals.length === 0 ? (
        <EmptyState
          icon="🎯"
          title="No goals yet"
          description="Set your first savings goal and start your journey to financial freedom."
          action={<Button variant="primary" onClick={openCreate} icon={<Plus size={16} />}>Create Goal</Button>}
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          <AnimatePresence>
            {goals.map((goal, i) => {
              const pct     = calcProgress(goal.saved_amount, goal.target_amount);
              const days    = daysUntil(goal.deadline);
              const catInfo = getCategoryInfo(goal.category);
              const isComplete = pct >= 100;
              const pred    = predictions[goal.id];

              return (
                <motion.div
                  key={goal.id}
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.9 }}
                  transition={{ delay: i * 0.05 }}
                >
                  <Card hover className="group relative">
                    {isComplete && (
                      <div className="absolute top-3 right-3">
                        <Badge variant="success">✅ Complete</Badge>
                      </div>
                    )}
                    <div className="flex items-start gap-3 mb-4">
                      <div className="w-11 h-11 rounded-xl bg-[var(--border)] flex items-center justify-center text-2xl flex-shrink-0">
                        {catInfo.emoji}
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className="font-semibold text-[var(--text)] truncate">{goal.title}</h3>
                        <Badge variant="primary" className="mt-1">{catInfo.label}</Badge>
                      </div>
                    </div>

                    <div className="mb-3">
                      <div className="flex justify-between text-xs text-[var(--text-muted)] mb-2">
                        <span>{formatCurrency(goal.saved_amount)} saved</span>
                        <span className="font-semibold text-[var(--text)]">{pct}%</span>
                      </div>
                      <ProgressBar value={pct} max={100} color="auto" height={8} />
                      <p className="text-xs text-[var(--text-muted)] mt-1 text-right">Goal: {formatCurrency(goal.target_amount)}</p>
                    </div>

                    {/* AI Prediction badge */}
                    {pred && (
                      <div className={`mb-3 p-2.5 rounded-lg text-xs ${pred.on_track ? 'bg-[#00D4AA]/10 text-[#00D4AA] border border-[#00D4AA]/20' : 'bg-[#FF5C5C]/10 text-[#FF5C5C] border border-[#FF5C5C]/20'}`}>
                        <p className="font-semibold mb-0.5">{pred.on_track ? '✅ On Track' : '⚠️ Behind Schedule'}</p>
                        <p className="opacity-80">{pred.advice}</p>
                        {pred.monthly_required > 0 && (
                          <p className="mt-1 opacity-70">Need ₹{Number(pred.monthly_required).toLocaleString('en-IN')}/mo</p>
                        )}
                      </div>
                    )}

                    <div className="flex items-center justify-between pt-3 border-t border-[var(--border)]">
                      <div className="flex items-center gap-1.5 text-xs text-[var(--text-muted)]">
                        <Calendar size={12} />
                        <span>{days > 0 ? `${days} days left` : 'Past deadline'}</span>
                      </div>
                      <div className="flex gap-1">
                        <button
                          onClick={() => handlePredict(goal.id)}
                          disabled={predLoading[goal.id]}
                          className="p-1.5 rounded-lg text-[var(--text-muted)] hover:text-[#00D4AA] hover:bg-[#00D4AA]/10 transition-colors"
                          title="AI Predict"
                        >
                          <Brain size={14} className={predLoading[goal.id] ? 'animate-spin' : ''} />
                        </button>
                        <button onClick={() => openEdit(goal)} className="p-1.5 rounded-lg text-[var(--text-muted)] hover:text-[#6C63FF] hover:bg-[#6C63FF]/10 transition-colors">
                          <Pencil size={14} />
                        </button>
                        <button onClick={() => setDeleteId(goal.id)} className="p-1.5 rounded-lg text-[var(--text-muted)] hover:text-[#FF5C5C] hover:bg-[#FF5C5C]/10 transition-colors">
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>
                  </Card>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>
      )}

      {/* Create/Edit Modal */}
      <Modal isOpen={modalOpen} onClose={closeModal} title={editGoal ? 'Edit Goal' : 'New Savings Goal'}>
        <form onSubmit={handleSave} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-[var(--text-muted)] mb-1.5">Goal Title</label>
            <input name="title" value={form.title} onChange={handleChange} placeholder="e.g. Emergency Fund" required />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-[var(--text-muted)] mb-1.5">Target Amount (₹)</label>
              <input name="target_amount" type="number" min="1" value={form.target_amount} onChange={handleChange} placeholder="100000" required />
            </div>
            <div>
              <label className="block text-sm font-medium text-[var(--text-muted)] mb-1.5">Saved So Far (₹)</label>
              <input name="saved_amount" type="number" min="0" value={form.saved_amount} onChange={handleChange} placeholder="0" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-[var(--text-muted)] mb-1.5">Deadline</label>
              <input name="deadline" type="date" value={form.deadline} onChange={handleChange} required />
            </div>
            <div>
              <label className="block text-sm font-medium text-[var(--text-muted)] mb-1.5">Category</label>
              <select name="category" value={form.category} onChange={handleChange}>
                {goalCategories.map(c => <option key={c.value} value={c.value}>{c.emoji} {c.label}</option>)}
              </select>
            </div>
          </div>
          <div className="flex gap-3 pt-2">
            <Button type="button" variant="secondary" onClick={closeModal} className="flex-1">Cancel</Button>
            <Button type="submit" variant="primary" loading={saving} className="flex-1">
              {editGoal ? 'Save Changes' : 'Create Goal'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Delete Confirm Modal */}
      <Modal isOpen={!!deleteId} onClose={() => setDeleteId(null)} title="Delete Goal" size="sm">
        <p className="text-sm text-[var(--text-muted)] mb-6">Are you sure? This action cannot be undone.</p>
        <div className="flex gap-3">
          <Button variant="secondary" onClick={() => setDeleteId(null)} className="flex-1">Cancel</Button>
          <Button variant="danger" onClick={() => handleDelete(deleteId)} className="flex-1">Delete</Button>
        </div>
      </Modal>
    </div>
  );
}
