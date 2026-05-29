import { motion } from 'framer-motion';

export default function LoadingSpinner({ size = 'md', text = '' }) {
  const sizes = { sm: 'w-5 h-5', md: 'w-8 h-8', lg: 'w-12 h-12' };

  return (
    <div className="flex flex-col items-center justify-center gap-3 py-8">
      <motion.div
        animate={{ rotate: 360 }}
        transition={{ repeat: Infinity, duration: 1, ease: 'linear' }}
        className={`${sizes[size]} border-2 border-[#6C63FF]/20 border-t-[#6C63FF] rounded-full`}
      />
      {text && <p className="text-sm text-[#8A8F9C]">{text}</p>}
    </div>
  );
}
