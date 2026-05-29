import { motion } from 'framer-motion';

export default function Button({
  children,
  variant = 'primary',
  size = 'md',
  disabled = false,
  loading = false,
  onClick,
  type = 'button',
  className = '',
  icon,
}) {
  const base = 'inline-flex items-center justify-center gap-2 font-semibold rounded-xl transition-all duration-200 select-none';

  const variants = {
    primary: 'bg-gradient-to-r from-[#6C63FF] to-[#5A52D5] text-white hover:opacity-90 shadow-[0_4px_20px_rgba(108,99,255,0.3)]',
    secondary: 'bg-[#1E2028] text-[#F5F5F7] border border-[#2A2D3A] hover:border-[#6C63FF]/50 hover:bg-[#252830]',
    danger: 'bg-[#FF5C5C]/10 text-[#FF5C5C] border border-[#FF5C5C]/30 hover:bg-[#FF5C5C]/20',
    ghost: 'text-[#8A8F9C] hover:text-[#F5F5F7] hover:bg-[#1E2028]',
    teal: 'bg-gradient-to-r from-[#00D4AA] to-[#00B894] text-[#0A0B0F] hover:opacity-90 shadow-[0_4px_20px_rgba(0,212,170,0.3)]',
  };

  const sizes = {
    sm: 'px-3 py-1.5 text-xs',
    md: 'px-4 py-2.5 text-sm',
    lg: 'px-6 py-3 text-base',
  };

  return (
    <motion.button
      whileTap={!disabled ? { scale: 0.97 } : {}}
      type={type}
      onClick={onClick}
      disabled={disabled || loading}
      className={`${base} ${variants[variant]} ${sizes[size]} ${disabled || loading ? 'opacity-50 cursor-not-allowed' : ''} ${className}`}
    >
      {loading ? (
        <span className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
      ) : icon ? (
        <span className="w-4 h-4">{icon}</span>
      ) : null}
      {children}
    </motion.button>
  );
}
