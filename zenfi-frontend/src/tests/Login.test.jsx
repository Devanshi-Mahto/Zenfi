import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';
import Login from '../pages/Login';

// Helper: render Login with a mocked AuthContext
const mockLogin = vi.fn();

const mockAuthValue = {
  login: mockLogin,
  loading: false,
  error: null,
  clearError: vi.fn(),
  isAuthenticated: false,
};

function renderLogin(overrides = {}) {
  const value = { ...mockAuthValue, ...overrides };
  return render(
    <AuthContext.Provider value={value}>
      <MemoryRouter>
        <Login />
      </MemoryRouter>
    </AuthContext.Provider>
  );
}

describe('Login Page', () => {
  beforeEach(() => {
    mockLogin.mockReset();
  });

  it('renders username and password fields', () => {
    renderLogin();
    expect(screen.getByPlaceholderText(/enter your username/i)).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/enter your password/i)).toBeInTheDocument();
  });

  it('renders the Sign in button', () => {
    renderLogin();
    expect(screen.getByRole('button', { name: /sign in/i })).toBeInTheDocument();
  });

  it('shows error message when error exists', () => {
    renderLogin({ error: 'Invalid credentials. Please try again.' });
    expect(screen.getByText(/invalid credentials/i)).toBeInTheDocument();
  });

  it('calls login with username and password on submit', async () => {
    mockLogin.mockResolvedValue(false);
    renderLogin();

    fireEvent.change(screen.getByPlaceholderText(/enter your username/i), {
      target: { value: 'testuser' },
    });
    fireEvent.change(screen.getByPlaceholderText(/enter your password/i), {
      target: { value: 'password123' },
    });
    fireEvent.click(screen.getByRole('button', { name: /sign in/i }));

    await waitFor(() => {
      expect(mockLogin).toHaveBeenCalledWith('testuser', 'password123');
    });
  });

  it('disables button when loading', () => {
    renderLogin({ loading: true });
    expect(screen.getByRole('button', { name: /sign in/i })).toBeDisabled();
  });

  it('has a link to the register page', () => {
    renderLogin();
    expect(screen.getByText(/create one/i)).toBeInTheDocument();
  });
});
