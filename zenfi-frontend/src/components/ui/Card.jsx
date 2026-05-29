import { motion } from 'framer-motion';

export default function Card({ children, className = '', hover = false, glow = false, onClick }) {
  return (
    <motion.div
      onClick={onClick}
      whileHover={hover ? { y: -2, scale: 1.01 } : {}}
      transition={{ duration: 0.2 }}
      className={`
        bg-[#111318] border border-[#1E2028] rounded-2xl p-5
        ${glow ? 'shadow-[0_0_30px_rgba(108,99,255,0.08)]' : ''}
        ${hover ? 'cursor-pointer hover:border-[#6C63FF]/30 transition-colors duration-300' : ''}
        ${className}
      `}
    >
      {children}
    </motion.div>
  );
}
