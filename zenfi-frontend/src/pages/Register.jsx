import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { TrendingUp, Eye, EyeOff, UserPlus, CheckCircle2 } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import Button from '../components/ui/Button';

const FEATURES = [
  ['🎯', 'Savings Goals',    'Track progress visually'],
  ['📊', 'Spending Analytics','See where money goes'],
  ['🤖', 'AI Insights',      'Powered by Gemini'],
  ['🔔', 'Smart Alerts',     'Budget reminders'],
];

// Client-side password strength indicator
const getStrength = (pw) => {
  if (!pw) return null;
  const score = [pw.length >= 8, /[A-Z]/.test(pw), /[0-9]/.test(pw), /[^a-zA-Z0-9]/.test(pw)]
    .filter(Boolean).length;
  return score <= 1 ? 'weak' : score === 2 ? 'fair' : score === 3 ? 'good' : 'strong';
};
const STRENGTH_COLOR = { weak: '#FF5C5C', fair: '#FFB547', good: '#6C63FF', strong: '#00D4AA' };
const STRENGTH_WIDTH = { weak: '25%', fair: '50%', good: '75%', strong: '100%' };

export default function Register() {
  const { signup, loading, error, clearError } = useAuth();
  const navigate = useNavigate();
  const [form, setForm]         = useState({ username: '', email: '', password: '', confirm: '' });
  const [showPass, setShowPass]  = useState(false);
  const [localError, setLocalError] = useState('');

  const handleChange = (e) => {
    clearError();
    setLocalError('');
    setForm(p => ({ ...p, [e.target.name]: e.target.value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    // Client-side validation
    if (form.username.trim().length < 3) {
      setLocalError('Username must be at least 3 characters.');
      return;
    }
    if (form.password.length < 6) {
      setLocalError('Password must be at least 6 characters.');
      return;
    }
    if (form.password !== form.confirm) {
      setLocalError('Passwords do not match.');
      return;
    }
    const ok = await signup(form.username.trim(), form.password, form.email.trim());
    if (ok) navigate('/', { replace: true });
  };

  const displayError = localError || error;
  const strength     = getStrength(form.password);

  return (
    <div className="min-h-screen bg-[#0A0B0F] flex items-center justify-center p-6">
      <div className="w-full max-w-md">
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
        >
          {/* Logo */}
          <div className="flex items-center gap-3 mb-8">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#6C63FF] to-[#00D4AA] flex items-center justify-center shadow-[0_0_20px_rgba(108,99,255,0.4)]">
              <TrendingUp size={20} className="text-white" />
            </div>
            <span className="text-[#F5F5F7] font-bold text-xl">ZenFi</span>
          </div>

          <h1 className="text-2xl font-bold text-[#F5F5F7] mb-1">Create your account</h1>
          <p className="text-[#8A8F9C] text-sm mb-8">Start tracking your finances with ZenFi</p>

          <form onSubmit={handleSubmit} className="space-y-4" noValidate>
            {/* Username */}
            <div>
              <label htmlFor="reg-username" className="block text-sm font-medium text-[#8A8F9C] mb-1.5">
                Username <span className="text-[#FF5C5C]">*</span>
              </label>
              <input
                id="reg-username"
                name="username"
                type="text"
                autoComplete="username"
                autoFocus
                value={form.username}
                onChange={handleChange}
                placeholder="Choose a username (min 3 chars)"
                required
                disabled={loading}
                minLength={3}
              />
            </div>

            {/* Email (optional) */}
            <div>
              <label htmlFor="reg-email" className="block text-sm font-medium text-[#8A8F9C] mb-1.5">
                Email <span className="text-[#4A4D5A] text-xs font-normal">(optional)</span>
              </label>
              <input
                id="reg-email"
                name="email"
                type="email"
                autoComplete="email"
                value={form.email}
                onChange={handleChange}
                placeholder="you@example.com"
                disabled={loading}
              />
            </div>

            {/* Password */}
            <div>
              <label htmlFor="reg-password" className="block text-sm font-medium text-[#8A8F9C] mb-1.5">
                Password <span className="text-[#FF5C5C]">*</span>
              </label>
              <div className="relative">
                <input
                  id="reg-password"
                  name="password"
                  type={showPass ? 'text' : 'password'}
                  autoComplete="new-password"
                  value={form.password}
                  onChange={handleChange}
                  placeholder="Minimum 6 characters"
                  required
                  disabled={loading}
                  className="pr-11"
                />
                <button
                  type="button"
                  onClick={() => setShowPass(p => !p)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[#8A8F9C] hover:text-[#F5F5F7] transition-colors"
                  tabIndex={-1}
                  aria-label={showPass ? 'Hide password' : 'Show password'}
                >
                  {showPass ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>

              {/* Password strength bar */}
              {strength && (
                <div className="mt-2 space-y-1">
                  <div className="h-1 rounded-full bg-[#1E2028] overflow-hidden">
                    <motion.div
                      animate={{ width: STRENGTH_WIDTH[strength] }}
                      transition={{ duration: 0.3 }}
                      className="h-full rounded-full transition-colors"
                      style={{ backgroundColor: STRENGTH_COLOR[strength] }}
                    />
                  </div>
                  <p className="text-xs" style={{ color: STRENGTH_COLOR[strength] }}>
                    Password strength: <span className="font-medium capitalize">{strength}</span>
                  </p>
                </div>
              )}
            </div>

            {/* Confirm Password */}
            <div>
              <label htmlFor="reg-confirm" className="block text-sm font-medium text-[#8A8F9C] mb-1.5">
                Confirm Password <span className="text-[#FF5C5C]">*</span>
              </label>
              <div className="relative">
                <input
                  id="reg-confirm"
                  name="confirm"
                  type="password"
                  autoComplete="new-password"
                  value={form.confirm}
                  onChange={handleChange}
                  placeholder="Re-enter your password"
                  required
                  disabled={loading}
                />
                {form.confirm && form.password === form.confirm && (
                  <CheckCircle2
                    size={16}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-[#00D4AA]"
                  />
                )}
              </div>
            </div>

            {/* Error message */}
            {displayError && (
              <motion.div
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex items-start gap-2.5 text-sm text-[#FF5C5C] bg-[#FF5C5C]/10 border border-[#FF5C5C]/20 rounded-xl px-4 py-3"
                role="alert"
              >
                <span className="mt-0.5 text-base">⚠️</span>
                <span>{displayError}</span>
              </motion.div>
            )}

            <Button
              type="submit"
              variant="primary"
              size="lg"
              loading={loading}
              disabled={!form.username || !form.password || !form.confirm || loading}
              className="w-full mt-2"
              icon={<UserPlus size={16} />}
            >
              {loading ? 'Creating account…' : 'Create Account'}
            </Button>
          </form>

          {/* Feature grid */}
          <div className="relative my-6">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-[#1E2028]" />
            </div>
            <div className="relative flex justify-center">
              <span className="px-3 bg-[#0A0B0F] text-xs text-[#8A8F9C]">What you get</span>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            {FEATURES.map(([emoji, title, desc]) => (
              <div key={title} className="bg-[#111318] border border-[#1E2028] rounded-xl p-3">
                <p className="text-lg mb-1">{emoji}</p>
                <p className="text-xs font-semibold text-[#F5F5F7]">{title}</p>
                <p className="text-xs text-[#8A8F9C]">{desc}</p>
              </div>
            ))}
          </div>

          <p className="text-center text-sm text-[#8A8F9C] mt-6">
            Already have an account?{' '}
            <Link to="/login" className="text-[#6C63FF] font-medium hover:underline">
              Sign in
            </Link>
          </p>
        </motion.div>
      </div>
    </div>
  );
}
