import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { TrendingUp, Eye, EyeOff, LogIn, Sparkles, ShieldCheck } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import Button from '../components/ui/Button';

export default function Login() {
  const { login, loading, error, clearError } = useAuth();
  const navigate = useNavigate();
  const [form, setForm]       = useState({ username: '', password: '' });
  const [showPass, setShowPass] = useState(false);

  const handleChange = (e) => {
    clearError();
    setForm(p => ({ ...p, [e.target.name]: e.target.value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const ok = await login(form.username, form.password);
    if (ok) navigate('/', { replace: true });
  };

  return (
    <div className="min-h-screen bg-[#0A0B0F] flex">
      {/* ── Left panel ── */}
      <div className="hidden lg:flex flex-col justify-between w-1/2 p-12 bg-gradient-to-br from-[#111318] to-[#0D0E13] border-r border-[#1E2028] relative overflow-hidden">
        {/* BG blobs */}
        <div className="absolute top-[-100px] left-[-100px] w-96 h-96 rounded-full bg-[#6C63FF]/10 blur-3xl pointer-events-none" />
        <div className="absolute bottom-[-80px] right-[-80px] w-72 h-72 rounded-full bg-[#00D4AA]/10 blur-3xl pointer-events-none" />

        {/* Logo */}
        <div className="flex items-center gap-3 relative z-10">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#6C63FF] to-[#00D4AA] flex items-center justify-center shadow-[0_0_30px_rgba(108,99,255,0.4)]">
            <TrendingUp size={20} className="text-white" />
          </div>
          <span className="text-[#F5F5F7] font-bold text-xl">ZenFi</span>
        </div>

        {/* Hero copy */}
        <div className="relative z-10 space-y-6">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-[#6C63FF]/15 border border-[#6C63FF]/20">
            <Sparkles size={13} className="text-[#6C63FF]" />
            <span className="text-xs text-[#6C63FF] font-medium">AI-Powered Finance</span>
          </div>
          <h2 className="text-4xl font-bold text-[#F5F5F7] leading-tight">
            Take control of your{' '}
            <span className="gradient-text">financial future</span>
          </h2>
          <p className="text-[#8A8F9C] text-lg leading-relaxed">
            Track spending, set savings goals, and get personalized AI insights — all in one beautiful dashboard.
          </p>

          <div className="grid grid-cols-3 gap-4 pt-4">
            {[['₹4.2L', 'Avg. saved/yr'], ['87%', 'Goal completion'], ['2.3x', 'ROI tracked']].map(([val, label]) => (
              <div key={label} className="bg-[#1E2028]/60 rounded-xl p-4 border border-[#2A2D3A]">
                <p className="text-xl font-bold gradient-text">{val}</p>
                <p className="text-xs text-[#8A8F9C] mt-1">{label}</p>
              </div>
            ))}
          </div>

          {/* Security badge */}
          <div className="flex items-center gap-2 text-xs text-[#8A8F9C]">
            <ShieldCheck size={14} className="text-[#00D4AA]" />
            <span>Secured with JWT authentication · Your data stays private</span>
          </div>
        </div>

        <p className="text-xs text-[#4A4D5A] relative z-10">© 2026 ZenFi. Your finances, your future.</p>
      </div>

      {/* ── Right panel – Login form ── */}
      <div className="flex-1 flex items-center justify-center p-6">
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="w-full max-w-md"
        >
          {/* Mobile logo */}
          <div className="flex items-center gap-3 mb-8 lg:hidden">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-[#6C63FF] to-[#00D4AA] flex items-center justify-center">
              <TrendingUp size={18} className="text-white" />
            </div>
            <span className="text-[#F5F5F7] font-bold text-xl">ZenFi</span>
          </div>

          <h1 className="text-2xl font-bold text-[#F5F5F7] mb-1">Welcome back</h1>
          <p className="text-[#8A8F9C] text-sm mb-8">Sign in with your ZenFi account credentials</p>

          <form onSubmit={handleSubmit} className="space-y-5" noValidate>
            {/* Username */}
            <div>
              <label htmlFor="login-username" className="block text-sm font-medium text-[#8A8F9C] mb-1.5">
                Username
              </label>
              <input
                id="login-username"
                name="username"
                type="text"
                autoComplete="username"
                autoFocus
                value={form.username}
                onChange={handleChange}
                placeholder="Enter your username"
                required
                disabled={loading}
              />
            </div>

            {/* Password */}
            <div>
              <label htmlFor="login-password" className="block text-sm font-medium text-[#8A8F9C] mb-1.5">
                Password
              </label>
              <div className="relative">
                <input
                  id="login-password"
                  name="password"
                  type={showPass ? 'text' : 'password'}
                  autoComplete="current-password"
                  value={form.password}
                  onChange={handleChange}
                  placeholder="Enter your password"
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
            </div>

            {/* Error */}
            {error && (
              <motion.div
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex items-start gap-2.5 text-sm text-[#FF5C5C] bg-[#FF5C5C]/10 border border-[#FF5C5C]/20 rounded-xl px-4 py-3"
                role="alert"
              >
                <span className="mt-0.5 text-base">⚠️</span>
                <span>{error}</span>
              </motion.div>
            )}

            <Button
              type="submit"
              variant="primary"
              size="lg"
              loading={loading}
              disabled={!form.username || !form.password || loading}
              className="w-full mt-2"
              icon={<LogIn size={16} />}
            >
              {loading ? 'Signing in…' : 'Sign in'}
            </Button>
          </form>

          <p className="text-center text-sm text-[#8A8F9C] mt-6">
            Don't have an account?{' '}
            <Link to="/register" className="text-[#6C63FF] font-medium hover:underline">
              Create one
            </Link>
          </p>
        </motion.div>
      </div>
    </div>
  );
}
