import { useState } from 'react';
import { X, Lock, Mail, User as UserIcon, Phone, KeyRound } from 'lucide-react';
import { apiRequest, setAuthToken } from '../api.ts';
import type { User, UserRole } from '../types.ts';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (user: User) => void;
}

const DEMO_ACCOUNTS: { label: string; email: string; roleLabel: string }[] = [
  { label: 'Customer', email: 'customer@grocerygo.demo', roleLabel: 'Shop, Cart, Checkout & Track' },
  { label: 'Store Owner', email: 'owner@grocerygo.demo', roleLabel: 'Accept Orders & Manage Stock' },
  { label: 'Delivery Partner', email: 'driver@grocerygo.demo', roleLabel: 'Pickups & Delivery Updates' },
  { label: 'QA Tester / Admin', email: 'qa@grocerygo.demo', roleLabel: 'Full STQA Testing Suite' },
];

export function AuthModal({ isOpen, onClose, onSuccess }: Props) {
  const [mode, setMode] = useState<'login' | 'register' | 'forgot'>('login');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<UserRole>('customer');
  const [resetCode, setResetCode] = useState('');
  const [issuedCode, setIssuedCode] = useState('');
  const [resetStep, setResetStep] = useState<'request' | 'confirm'>('request');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');

  if (!isOpen) return null;

  const resetMessages = () => {
    setError('');
    setInfo('');
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    resetMessages();
    setLoading(true);
    try {
      const res = await apiRequest<{ token: string; user: User }>('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, password }),
      });
      setAuthToken(res.token);
      onSuccess(res.user);
      onClose();
    } catch (err: any) {
      setError(err.message || 'Sign in failed.');
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    resetMessages();
    setLoading(true);
    try {
      const res = await apiRequest<{ token: string; user: User }>('/api/auth/register', {
        method: 'POST',
        body: JSON.stringify({ name, email, phone, password, role }),
      });
      setAuthToken(res.token);
      onSuccess(res.user);
      onClose();
    } catch (err: any) {
      setError(err.message || 'Registration failed.');
    } finally {
      setLoading(false);
    }
  };

  const handleForgotRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    resetMessages();
    setLoading(true);
    try {
      const res = await apiRequest<{ message: string; simulatedResetCode: string }>(
        '/api/auth/forgot-password',
        {
          method: 'POST',
          body: JSON.stringify({ email }),
        }
      );
      setIssuedCode(res.simulatedResetCode);
      setResetCode(res.simulatedResetCode);
      setInfo(res.message);
      setResetStep('confirm');
    } catch (err: any) {
      setError(err.message || 'Could not initiate password reset.');
    } finally {
      setLoading(false);
    }
  };

  const handleResetConfirm = async (e: React.FormEvent) => {
    e.preventDefault();
    resetMessages();
    setLoading(true);
    try {
      const res = await apiRequest<{ message: string }>('/api/auth/reset-password', {
        method: 'POST',
        body: JSON.stringify({ email, resetCode, newPassword: password }),
      });
      setInfo(res.message);
      setMode('login');
      setPassword('');
    } catch (err: any) {
      setError(err.message || 'Failed to reset password.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
      <div className="bg-white border border-slate-200 rounded-xl shadow-xl w-full max-w-lg overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-slate-50">
          <div>
            <h2 className="text-lg font-bold text-slate-900">
              {mode === 'login' && 'Sign in to GroceryGo STQA'}
              {mode === 'register' && 'Create GroceryGo Account'}
              {mode === 'forgot' && 'Reset Account Password'}
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Authenticated via JWT and bcrypt password verification
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-500 hover:text-slate-900 rounded-lg hover:bg-slate-200/60 transition-colors"
            aria-label="Close authentication modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="px-6 pt-4">
          <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg">
            <button
              type="button"
              onClick={() => {
                setMode('login');
                resetMessages();
              }}
              className={`flex-1 py-2 px-3 text-sm font-medium rounded-md transition-colors whitespace-nowrap ${
                mode === 'login'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Sign In
            </button>
            <button
              type="button"
              data-testid="register-tab"
              onClick={() => {
                setMode('register');
                resetMessages();
              }}
              className={`flex-1 py-2 px-3 text-sm font-medium rounded-md transition-colors whitespace-nowrap ${
                mode === 'register'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Create Account
            </button>
            <button
              type="button"
              onClick={() => {
                setMode('forgot');
                setResetStep('request');
                resetMessages();
              }}
              className={`flex-1 py-2 px-3 text-sm font-medium rounded-md transition-colors whitespace-nowrap ${
                mode === 'forgot'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Forgot Password
            </button>
          </div>
        </div>

        <div className="p-6">
          {error && (
            <div
              data-testid="auth-error"
              className="mb-4 p-3 rounded-lg bg-red-50 border border-red-200 text-sm text-red-700"
            >
              {error}
            </div>
          )}
          {info && (
            <div className="mb-4 p-3 rounded-lg bg-emerald-50 border border-emerald-200 text-sm text-emerald-800">
              {info}
            </div>
          )}

          {mode === 'login' && (
            <>
              <form onSubmit={handleLogin} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Email Address
                  </label>
                  <div className="relative">
                    <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                    <input
                      data-testid="login-email"
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="name@grocerygo.demo"
                      className="w-full pl-9 pr-3 py-2.5 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Password</label>
                  <div className="relative">
                    <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                    <input
                      data-testid="login-password"
                      type="password"
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Enter your password"
                      className="w-full pl-9 pr-3 py-2.5 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    />
                  </div>
                </div>
                <button
                  data-testid="login-submit"
                  type="submit"
                  disabled={loading}
                  className="w-full py-2.5 px-4 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-semibold text-sm rounded-lg transition-colors"
                >
                  {loading ? 'Signing in...' : 'Sign In'}
                </button>
              </form>

              <div className="mt-5 pt-4 border-t border-slate-200">
                <p className="text-xs font-semibold text-slate-700 mb-2">
                  Seeded Demo Credentials (Password: <code className="font-mono">Demo@123</code>)
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {DEMO_ACCOUNTS.map((acc) => (
                    <button
                      key={acc.email}
                      type="button"
                      onClick={() => {
                        setEmail(acc.email);
                        setPassword('Demo@123');
                        resetMessages();
                      }}
                      className="text-left p-2.5 rounded-lg border border-slate-200 hover:border-emerald-400 hover:bg-emerald-50/40 transition-colors"
                    >
                      <div className="text-xs font-semibold text-slate-900">{acc.label}</div>
                      <div className="text-[11px] font-mono text-slate-500 truncate">{acc.email}</div>
                      <div className="text-[11px] text-emerald-700 mt-0.5">{acc.roleLabel}</div>
                    </button>
                  ))}
                </div>
              </div>
            </>
          )}

          {mode === 'register' && (
            <form onSubmit={handleRegister} className="space-y-3.5">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Full Name</label>
                <div className="relative">
                  <UserIcon className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                  <input
                    data-testid="register-name"
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Priya Nair"
                    className="w-full pl-9 pr-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Email</label>
                  <div className="relative">
                    <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                    <input
                      data-testid="register-email"
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="you@example.com"
                      className="w-full pl-9 pr-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Phone</label>
                  <div className="relative">
                    <Phone className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                    <input
                      data-testid="register-phone"
                      type="tel"
                      required
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      placeholder="9876543210"
                      className="w-full pl-9 pr-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    />
                  </div>
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Password</label>
                  <input
                    data-testid="register-password"
                    type="password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Min 6 chars, letter + number"
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Account Role</label>
                  <select
                    value={role}
                    onChange={(e) => setRole(e.target.value as UserRole)}
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  >
                    <option value="customer">Customer</option>
                    <option value="store_owner">Store Owner</option>
                    <option value="delivery_partner">Delivery Partner</option>
                  </select>
                </div>
              </div>
              <button
                data-testid="register-submit"
                type="submit"
                disabled={loading}
                className="w-full py-2.5 px-4 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-semibold text-sm rounded-lg transition-colors"
              >
                {loading ? 'Creating Account...' : 'Create Account'}
              </button>
            </form>
          )}

          {mode === 'forgot' && (
            <form
              onSubmit={resetStep === 'request' ? handleForgotRequest : handleResetConfirm}
              className="space-y-4"
            >
              <div className="p-3 rounded-lg bg-slate-50 border border-slate-200 text-xs text-slate-600">
                Academic Reset Mode: Generates a real MongoDB-persisted reset token without external email delivery.
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Account Email</label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="customer@grocerygo.demo"
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              {resetStep === 'confirm' && (
                <>
                  {issuedCode && (
                    <div className="p-2.5 rounded-lg bg-amber-50 border border-amber-200 text-xs text-amber-900">
                      Simulated Reset Code: <strong className="font-mono">{issuedCode}</strong>
                    </div>
                  )}
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Reset Code</label>
                    <div className="relative">
                      <KeyRound className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                      <input
                        type="text"
                        required
                        value={resetCode}
                        onChange={(e) => setResetCode(e.target.value)}
                        className="w-full pl-9 pr-3 py-2 text-sm font-mono border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">New Password</label>
                    <input
                      type="password"
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Min 6 chars, letter + number"
                      className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    />
                  </div>
                </>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full py-2.5 px-4 bg-slate-900 hover:bg-slate-800 disabled:opacity-50 text-white font-semibold text-sm rounded-lg transition-colors"
              >
                {loading
                  ? 'Processing...'
                  : resetStep === 'request'
                  ? 'Generate Reset Code'
                  : 'Update Password'}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
