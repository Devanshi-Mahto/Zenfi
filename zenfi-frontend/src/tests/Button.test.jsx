import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import Button from '../components/ui/Button';

describe('Button', () => {
  it('renders children text', () => {
    render(<Button>Click Me</Button>);
    expect(screen.getByText('Click Me')).toBeInTheDocument();
  });

  it('calls onClick when clicked', () => {
    const handleClick = vi.fn();
    render(<Button onClick={handleClick}>Submit</Button>);
    fireEvent.click(screen.getByText('Submit'));
    expect(handleClick).toHaveBeenCalledTimes(1);
  });

  it('is disabled when disabled prop is true', () => {
    render(<Button disabled>Disabled</Button>);
    expect(screen.getByRole('button')).toBeDisabled();
  });

  it('is disabled and shows spinner when loading is true', () => {
    render(<Button loading>Loading</Button>);
    const btn = screen.getByRole('button');
    expect(btn).toBeDisabled();
  });

  it('does not call onClick when disabled', () => {
    const handleClick = vi.fn();
    render(<Button disabled onClick={handleClick}>No Click</Button>);
    fireEvent.click(screen.getByRole('button'));
    expect(handleClick).not.toHaveBeenCalled();
  });

  it('renders with secondary variant class', () => {
    render(<Button variant="secondary" id="sec-btn">Secondary</Button>);
    expect(screen.getByText('Secondary')).toBeInTheDocument();
  });

  it('renders with danger variant', () => {
    render(<Button variant="danger">Delete</Button>);
    expect(screen.getByText('Delete')).toBeInTheDocument();
  });
});
