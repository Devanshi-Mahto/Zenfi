import { describe, it, expect } from 'vitest';
import {
  formatCurrency,
  formatDate,
  calcProgress,
  daysUntil,
  getCategoryColor,
  getCategoryEmoji,
} from '../utils/formatters';

describe('formatCurrency', () => {
  it('formats INR currency correctly', () => {
    const result = formatCurrency(1500);
    expect(result).toContain('1,500');
  });

  it('returns compact form with K for thousands', () => {
    expect(formatCurrency(25000, true)).toBe('₹25.0K');
  });

  it('returns compact form with L for lakhs', () => {
    expect(formatCurrency(150000, true)).toBe('₹1.5L');
  });

  it('handles zero', () => {
    const result = formatCurrency(0);
    expect(result).toContain('0');
  });
});

describe('calcProgress', () => {
  it('calculates correct percentage', () => {
    expect(calcProgress(500, 1000)).toBe(50);
  });

  it('caps at 100%', () => {
    expect(calcProgress(1500, 1000)).toBe(100);
  });

  it('returns 0 for zero target', () => {
    expect(calcProgress(100, 0)).toBe(0);
  });

  it('returns 0 when saved is 0', () => {
    expect(calcProgress(0, 1000)).toBe(0);
  });
});

describe('getCategoryColor', () => {
  it('returns correct color for food', () => {
    expect(getCategoryColor('food')).toBe('#6C63FF');
  });

  it('returns correct color for shopping', () => {
    expect(getCategoryColor('shopping')).toBe('#FFB547');
  });

  it('returns default color for unknown category', () => {
    expect(getCategoryColor('unknown_xyz')).toBe('#8A8F9C');
  });
});

describe('getCategoryEmoji', () => {
  it('returns food emoji', () => {
    expect(getCategoryEmoji('food')).toBe('🍽️');
  });

  it('returns travel emoji', () => {
    expect(getCategoryEmoji('travel')).toBe('✈️');
  });

  it('returns default emoji for unknown', () => {
    expect(getCategoryEmoji('unknown')).toBe('💰');
  });
});

describe('daysUntil', () => {
  it('returns positive number for future date', () => {
    const future = new Date(Date.now() + 1000 * 60 * 60 * 24 * 10).toISOString().split('T')[0];
    expect(daysUntil(future)).toBeGreaterThan(0);
  });

  it('returns negative or zero for past date', () => {
    const past = '2020-01-01';
    expect(daysUntil(past)).toBeLessThanOrEqual(0);
  });
});
