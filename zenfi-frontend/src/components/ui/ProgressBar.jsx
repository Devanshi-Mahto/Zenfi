import { motion } from 'framer-motion';

export default function ProgressBar({
  value = 0,
  max = 100,
  color = '#6C63FF',
  height = 8,
  showLabel = false,
  animated = true,
  className = '',
}) {
  const pct = Math.min((value / max) * 100, 100);

  const getColor = () => {
    if (pct >= 90) return '#00D4AA';
    if (pct >= 60) return '#6C63FF';
    if (pct >= 30) return '#FFB547';
    return '#FF5C5C';
  };

  const barColor = color === 'auto' ? getColor() : color;

  return (
    <div className={`w-full ${className}`}>
      <div
        className="w-full rounded-full bg-[#1E2028] overflow-hidden"
        style={{ height: `${height}px` }}
      >
        <motion.div
          initial={animated ? { width: 0 } : { width: `${pct}%` }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.8, ease: 'easeOut' }}
          className="h-full rounded-full"
          style={{ background: `linear-gradient(90deg, ${barColor}cc, ${barColor})` }}
        />
      </div>
      {showLabel && (
        <div className="flex justify-between mt-1">
          <span className="text-xs text-[#8A8F9C]">{Math.round(pct)}% reached</span>
        </div>
      )}
    </div>
  );
}
