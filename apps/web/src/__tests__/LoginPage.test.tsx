import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { MemoryRouter } from 'react-router';

const signUp = vi.fn();
const signIn = vi.fn();

vi.mock('../hooks/useAuth.js', () => ({
  useAuth: () => ({ session: null, signIn, signUp }),
}));

import { LoginPage } from '../pages/LoginPage.js';

function submitSignUp() {
  render(
    <MemoryRouter>
      <LoginPage />
    </MemoryRouter>,
  );
  fireEvent.click(screen.getByRole('button', { name: /sign up/i }));
  fireEvent.change(screen.getByLabelText(/email/i), {
    target: { value: 'new@example.com' },
  });
  fireEvent.change(screen.getByLabelText(/password/i), {
    target: { value: 'Password-123!' },
  });
  fireEvent.click(screen.getByRole('button', { name: /create account/i }));
}

describe('LoginPage', () => {
  afterEach(cleanup);

  beforeEach(() => {
    signUp.mockReset();
  });

  it('asks the user to confirm their email when sign up needs confirmation', async () => {
    signUp.mockResolvedValue({ needsEmailConfirmation: true });
    submitSignUp();

    expect(await screen.findByText(/check your email/i)).toBeInTheDocument();
    expect(signUp).toHaveBeenCalledWith('new@example.com', 'Password-123!');
  });

  it('tells password managers which credentials each mode wants', () => {
    render(
      <MemoryRouter>
        <LoginPage />
      </MemoryRouter>,
    );
    expect(screen.getByLabelText(/email/i)).toHaveAttribute('autocomplete', 'email');
    expect(screen.getByLabelText(/password/i)).toHaveAttribute('autocomplete', 'current-password');

    fireEvent.click(screen.getByRole('button', { name: /sign up/i }));
    expect(screen.getByLabelText(/password/i)).toHaveAttribute('autocomplete', 'new-password');
  });

  it('shows no confirmation notice when sign up signs the user in', async () => {
    signUp.mockResolvedValue({ needsEmailConfirmation: false });
    submitSignUp();

    await vi.waitFor(() => expect(signUp).toHaveBeenCalled());
    expect(screen.queryByText(/check your email/i)).not.toBeInTheDocument();
  });
});
