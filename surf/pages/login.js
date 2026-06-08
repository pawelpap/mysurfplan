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
  <label className="mb-1.5 block text-xs font-semibold text-slate-600">{children}</label>
);

const Input = (props) => (
  <input
    {...props}
    className={`w-full rounded-lg border border-slate-200 bg-white px-3.5 py-2.5 text-sm outline-none transition placeholder:text-slate-400 focus:border-teal-700 focus:ring-4 focus:ring-teal-700/10 ${props.className || ''}`}
  />
);

const Button = ({ children, variant = 'primary', ...props }) => {
  const classes =
    variant === 'primary'
      ? 'border-teal-700 bg-teal-700 text-white hover:bg-teal-800'
      : 'border-slate-200 bg-white text-slate-800 hover:border-slate-300 hover:bg-slate-50';
  return (
    <button
      {...props}
      className={`inline-flex w-full items-center justify-center rounded-lg border px-4 py-2.5 text-sm font-semibold shadow-sm transition disabled:cursor-not-allowed disabled:opacity-60 ${classes}`}
    >
      {children}
    </button>
  );
};

function LogoMark({ className = 'h-12 w-12' }) {
  return (
    <svg viewBox="0 0 96 96" className={className} aria-hidden="true">
      <rect x="6" y="6" width="84" height="84" rx="24" fill="#0D6E7A" />
      <path d="M18 58C30 39 48 40 58 50C65 57 74 57 82 48" stroke="#DFF5EA" strokeWidth="7" strokeLinecap="round" fill="none" />
      <path d="M19 66C37 54 50 55 62 64C70 70 77 70 84 63" stroke="#F4C96B" strokeWidth="6" strokeLinecap="round" fill="none" />
      <path d="M38 38C46 29 58 30 66 38" stroke="white" strokeWidth="6" strokeLinecap="round" fill="none" />
    </svg>
  );
}

function SurfIllustration() {
  return (
    <div className="relative min-h-[360px] overflow-hidden rounded-2xl bg-sky-100">
      <div className="absolute right-12 top-12 h-16 w-16 rounded-full bg-amber-300" />
      <svg viewBox="0 0 560 430" className="absolute inset-0 h-full w-full" aria-hidden="true">
        <path d="M36 318C120 218 230 235 310 312C376 375 458 368 532 292" stroke="#0D6E7A" strokeWidth="17" strokeLinecap="round" fill="none" />
        <path d="M24 362C116 304 246 315 350 366C435 408 494 405 550 345" stroke="#11A096" strokeWidth="11" strokeLinecap="round" fill="none" opacity="0.72" />
        <path d="M154 232C210 190 276 190 336 236" stroke="#EF5C49" strokeWidth="10" strokeLinecap="round" fill="none" />
        <path d="M248 200C286 176 318 178 352 202" stroke="#203039" strokeWidth="8" strokeLinecap="round" fill="none" />
        <circle cx="334" cy="162" r="15" fill="#203039" />
      </svg>
    </div>
  );
}

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
    <main className="min-h-screen bg-[#f6faf7] text-slate-950">
      <div className="mx-auto grid min-h-screen w-full max-w-6xl items-center gap-8 px-4 py-8 lg:grid-cols-[1.05fr_0.95fr]">
        <section className="space-y-8">
          <div className="flex items-center gap-3">
            <LogoMark />
            <div>
              <div className="text-2xl font-bold tracking-tight">MyWavePlan</div>
              <div className="text-sm text-slate-500">Lessons, people and surf conditions</div>
            </div>
          </div>

          <SurfIllustration />

          <div className="grid gap-3 sm:grid-cols-3">
            {['Book lessons', 'Manage people', 'Plan conditions'].map((item) => (
              <div key={item} className="rounded-xl border border-slate-200 bg-white p-4 text-sm font-semibold text-slate-800">
                {item}
              </div>
            ))}
          </div>
        </section>

        <section className="mx-auto w-full max-w-md">
          <div className="mb-6">
            <div className="text-sm font-semibold text-teal-700">Welcome back</div>
            <h1 className="mt-2 text-4xl font-bold tracking-tight">Log in</h1>
            <p className="mt-3 text-sm leading-6 text-slate-500">
              Access your school workspace, manage lessons, or continue booking a public lesson.
            </p>
            {school && (
              <div className="mt-3 inline-flex rounded-full bg-teal-50 px-3 py-1 text-xs font-semibold text-teal-800">
                School: {school}
              </div>
            )}
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
              {error && <div className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</div>}
              <Button type="submit" disabled={busy}>
                {busy ? 'Logging in...' : 'Log in'}
              </Button>
            </div>
          </form>

          <div className="mt-4 rounded-2xl border border-dashed border-slate-300 bg-white/70 p-4">
            <div className="text-sm font-semibold text-slate-900">New student registration</div>
            <p className="mt-1 text-sm leading-6 text-slate-500">
              The design is ready for student sign-up and school membership requests. Backend registration is still in the development plan.
            </p>
            <div className="mt-3">
              <Button type="button" variant="secondary" disabled>
                Sign up coming next
              </Button>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
