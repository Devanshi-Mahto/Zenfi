export default function Badge({ children, variant = 'default', className = '' }) {
  const variants = {
    default: 'bg-[#1E2028] text-[#8A8F9C]',
    primary: 'bg-[#6C63FF]/15 text-[#6C63FF]',
    success: 'bg-[#00D4AA]/15 text-[#00D4AA]',
    warning: 'bg-[#FFB547]/15 text-[#FFB547]',
    danger: 'bg-[#FF5C5C]/15 text-[#FF5C5C]',
    info: 'bg-[#5CE1E6]/15 text-[#5CE1E6]',
  };

  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${variants[variant]} ${className}`}>
      {children}
    </span>
  );
}
