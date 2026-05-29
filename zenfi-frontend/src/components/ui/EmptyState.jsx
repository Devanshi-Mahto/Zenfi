import { motion } from 'framer-motion';

export default function EmptyState({ icon, title, description, action }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex flex-col items-center justify-center py-16 px-6 text-center"
    >
      {icon && (
        <div className="text-5xl mb-4">{icon}</div>
      )}
      <h3 className="text-lg font-semibold text-[#F5F5F7] mb-2">{title}</h3>
      {description && (
        <p className="text-sm text-[#8A8F9C] max-w-xs">{description}</p>
      )}
      {action && <div className="mt-6">{action}</div>}
    </motion.div>
  );
}
