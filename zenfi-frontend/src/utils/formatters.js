// Format currency in INR
export const formatCurrency = (amount, compact = false) => {
  if (compact && amount >= 100000) {
    return `₹${(amount / 100000).toFixed(1)}L`;
  }
  if (compact && amount >= 1000) {
    return `₹${(amount / 1000).toFixed(1)}K`;
  }
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(amount);
};

// Format date to readable string
export const formatDate = (dateStr) => {
  const date = new Date(dateStr);
  return date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
};

// Format relative time
export const formatRelativeDate = (dateStr) => {
  const date = new Date(dateStr);
  const now = new Date();
  const diffDays = Math.floor((now - date) / (1000 * 60 * 60 * 24));
  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return `${diffDays} days ago`;
  return formatDate(dateStr);
};

// Calculate progress percentage
export const calcProgress = (saved, target) => {
  if (!target || target === 0) return 0;
  return Math.min(Math.round((saved / target) * 100), 100);
};

// Days until deadline
export const daysUntil = (dateStr) => {
  const target = new Date(dateStr);
  const now = new Date();
  const diff = Math.ceil((target - now) / (1000 * 60 * 60 * 24));
  return diff;
};

// Get category color
export const getCategoryColor = (category) => {
  const colors = {
    food: '#6C63FF',
    shopping: '#FFB547',
    travel: '#00D4AA',
    bills: '#FF5C5C',
    entertainment: '#5CE1E6',
    other: '#8A8F9C',
    savings: '#00D4AA',
    tech: '#6C63FF',
    vehicle: '#FFB547',
    education: '#5CE1E6',
    investment: '#FF5C5C',
    health: '#FF8FA3',
    home: '#B5A4FF',
  };
  return colors[category] || '#8A8F9C';
};

// Get category emoji
export const getCategoryEmoji = (category) => {
  const emojis = {
    food: '🍽️',
    shopping: '🛍️',
    travel: '✈️',
    bills: '📄',
    entertainment: '🎬',
    other: '📦',
    savings: '🏦',
    tech: '💻',
    vehicle: '🚗',
    education: '🎓',
    investment: '📈',
    health: '❤️',
    home: '🏠',
  };
  return emojis[category] || '💰';
};
