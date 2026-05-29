import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import ProgressBar from '../components/ui/ProgressBar';

describe('ProgressBar', () => {
  it('renders without crashing', () => {
    const { container } = render(<ProgressBar value={50} max={100} />);
    expect(container.firstChild).toBeTruthy();
  });

  it('shows label when showLabel is true', () => {
    render(<ProgressBar value={75} max={100} showLabel />);
    expect(screen.getByText(/75%/)).toBeInTheDocument();
  });

  it('does not show label by default', () => {
    render(<ProgressBar value={40} max={100} />);
    expect(screen.queryByText(/40%/)).not.toBeInTheDocument();
  });

  it('handles 0 value', () => {
    const { container } = render(<ProgressBar value={0} max={100} />);
    expect(container.firstChild).toBeTruthy();
  });

  it('caps at 100% with overflow value', () => {
    render(<ProgressBar value={150} max={100} showLabel />);
    // Should show 100%, not 150%
    expect(screen.getByText(/100%/)).toBeInTheDocument();
  });
});
