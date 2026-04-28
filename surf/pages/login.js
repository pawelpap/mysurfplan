import React, { useState } from 'react';

export async function getServerSideProps(ctx) {
  const { next = '/', school = '' } = ctx.query || {};
  return {
    props: {
      nextPath: typeof next === 'string' ? next : '/',
      school: typeof school === 'string' ? school : '',
    },
  };
}

const Label = ({ children }) => (
  <label className="text-sm font-medium text-slate-700 mb-1 block">{children}</label>
);

const Input = (props) => (
  <input
    {...props}
    className={`w-full rounded-xl border border-slate-300 px-3 py-2 outline-none focus:ring-2 focus:ring-slate-900/10 ${props.className || ''}`}
  />
);

const Button = ({ children, ...props }) => (
  <button
    {...props}
    className="inline-flex w-full items-center justify-center rounded-xl border border-slate-900 bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
  >
    {children}
  </button>
);

function safeNext(nextPath) {
  if (typeof nextPath !== 'string') return '/';
  if (!nextPath.startsWith('/') || nextPath.startsWith('//')) return '/';
  return nextPath;
}

export default function LoginPage({ nextPath, school }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || json.ok === false) {
        throw new Error(json.error || 'Login failed');
      }
      window.location.href = safeNext(nextPath);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="min-h-screen bg-slate-50 text-slate-900">
      <div className="mx-auto flex min-h-screen w-full max-w-md flex-col justify-center px-4 py-10">
        <div className="mb-8">
          <div className="text-sm uppercase tracking-[0.24em] text-slate-500">MyWavePlan</div>
          <h1 className="mt-2 text-3xl font-semibold">Log in</h1>
          {school && <div className="mt-2 text-sm text-slate-500">School: {school}</div>}
        </div>

        <form onSubmit={submit} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="space-y-4">
            <div>
              <Label>Email</Label>
              <Input
                type="email"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
            <div>
              <Label>Password</Label>
              <Input
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>
            {error && <div className="text-sm text-rose-600">{error}</div>}
            <Button type="submit" disabled={busy}>
              {busy ? 'Logging in...' : 'Log in'}
            </Button>
          </div>
        </form>
      </div>
    </main>
  );
}
