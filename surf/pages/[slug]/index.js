import React, { useEffect, useMemo, useState } from 'react';

export async function getServerSideProps(ctx) {
  const { slug } = ctx.params || {};
  try {
    const { getSchoolBySlug } = await import('../../lib/slug');
    const school = await getSchoolBySlug(slug);
    if (!school) return { notFound: true };
    return { props: { school } };
  } catch {
    return { notFound: true };
  }
}

const Card = ({ children, className = '' }) => (
  <div className={`rounded-2xl border border-slate-200 bg-white p-4 shadow-sm ${className}`}>{children}</div>
);
const Label = ({ children }) => (
  <label className="mb-1.5 block text-xs font-semibold text-slate-600">{children}</label>
);
const Input = (props) => (
  <input
    {...props}
    className={`w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none transition focus:border-teal-700 focus:ring-4 focus:ring-teal-700/10 ${props.className || ''}`}
  />
);
const Select = (props) => (
  <select
    {...props}
    className={`w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none transition focus:border-teal-700 focus:ring-4 focus:ring-teal-700/10 ${props.className || ''}`}
  />
);
const Btn = ({ children, variant = 'primary', className = '', ...rest }) => {
  const style =
    variant === 'primary'
      ? 'border-teal-700 bg-teal-700 text-white hover:bg-teal-800'
      : 'border-slate-200 bg-white text-slate-800 hover:border-slate-300 hover:bg-slate-50';
  return (
    <button {...rest} className={`inline-flex items-center justify-center rounded-lg border px-4 py-2 text-sm font-semibold shadow-sm transition ${style} ${className}`}>
      {children}
    </button>
  );
};

function LogoMark() {
  return (
    <svg viewBox="0 0 96 96" className="h-10 w-10" aria-hidden="true">
      <rect x="6" y="6" width="84" height="84" rx="24" fill="#0D6E7A" />
      <path d="M18 58C30 39 48 40 58 50C65 57 74 57 82 48" stroke="#DFF5EA" strokeWidth="7" strokeLinecap="round" fill="none" />
      <path d="M19 66C37 54 50 55 62 64C70 70 77 70 84 63" stroke="#F4C96B" strokeWidth="6" strokeLinecap="round" fill="none" />
      <path d="M38 38C46 29 58 30 66 38" stroke="white" strokeWidth="6" strokeLinecap="round" fill="none" />
    </svg>
  );
}

function fmtDate(iso) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString(undefined, { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' });
}
function fmtTime(iso) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
}

export default function PublicSchoolPage({ school }) {
  const [filters, setFilters] = useState({ difficulty: '', from: '', to: '' });
  const [data, setData] = useState({ loading: true, error: '', lessons: [] });

  async function load() {
    setData((d) => ({ ...d, loading: true, error: '' }));
    const params = new URLSearchParams({ school: school.slug });
    if (filters.from) params.set('from', filters.from);
    if (filters.to) params.set('to', filters.to);
    if (filters.difficulty) params.set('difficulty', filters.difficulty);
    try {
      const res = await fetch(`/api/public/lessons?${params.toString()}`);
      const json = await res.json();
      if (!json.ok) throw new Error(json.error || 'Failed');
      const list = Array.isArray(json.data) ? json.data : [];
      setData({ loading: false, error: '', lessons: list });
    } catch (e) {
      setData({ loading: false, error: e.message, lessons: [] });
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters.from, filters.to, filters.difficulty]);

  const grouped = useMemo(() => {
    const out = {};
    const list = Array.isArray(data.lessons) ? data.lessons : [];
    for (const l of list) {
      const key = new Date(l?.startAt || l?.startISO || 0).toDateString();
      (out[key] ||= []).push(l || {});
    }
    return out;
  }, [data.lessons]);

  return (
    <div className="min-h-screen bg-[#f6faf7] text-slate-950">
      <header className="sticky top-0 z-20 border-b border-slate-200 bg-white/85 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-3">
          <LogoMark />
          <div>
            <div className="text-lg font-bold">{school?.name || 'School'}</div>
            <div className="text-xs font-medium text-slate-500">Public lesson schedule</div>
          </div>
          <Btn
            className="ml-auto"
            variant="secondary"
            onClick={() => {
              window.location.href = `/login?school=${encodeURIComponent(school.slug)}&next=${encodeURIComponent(`/${school.slug}`)}`;
            }}
          >
            Log in
          </Btn>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-8">
        <section className="mb-8 grid gap-6 lg:grid-cols-[1fr_380px]">
          <div>
            <div className="text-sm font-semibold text-teal-700">Book your next session</div>
            <h1 className="mt-2 max-w-3xl text-4xl font-bold tracking-tight md:text-5xl">Upcoming lessons</h1>
            <p className="mt-4 max-w-2xl text-base leading-7 text-slate-600">
              Browse available lessons by day. You will log in before confirming a booking.
            </p>
          </div>
          <Card>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-1">
              <div>
                <Label>Difficulty</Label>
                <Select
                  value={filters.difficulty}
                  onChange={(e) => setFilters((f) => ({ ...f, difficulty: e.target.value }))}
                >
                  <option value="">All</option>
                  {['Beginner', 'Intermediate', 'Advanced'].map((d) => (
                    <option key={d} value={d}>{d}</option>
                  ))}
                </Select>
              </div>
              <div>
                <Label>From</Label>
                <Input
                  type="date"
                  value={filters.from}
                  onChange={(e) => setFilters((f) => ({ ...f, from: e.target.value }))}
                />
              </div>
              <div>
                <Label>To</Label>
                <Input type="date" value={filters.to} onChange={(e) => setFilters((f) => ({ ...f, to: e.target.value }))} />
              </div>
              <Btn onClick={load}>Apply filters</Btn>
            </div>
            {data.error && <div className="mt-3 rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">{data.error}</div>}
          </Card>
        </section>

        {Object.keys(grouped).length === 0 && !data.loading && (
          <Card className="py-10 text-center text-slate-500">No lessons found for these filters.</Card>
        )}

        {data.loading && <Card className="text-slate-500">Loading lessons...</Card>}

        <div className="space-y-8">
          {Object.entries(grouped).map(([day, items]) => (
            <section key={day} className="space-y-3">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">{day}</h2>
              <div className="grid gap-3">
                {items.map((l, idx) => {
                  const start = l?.startAt || l?.startISO || '';
                  const duration = Number.isFinite(l?.durationMin) ? l.durationMin : 90;
                  const bookedCount = Number.isFinite(l?.bookedCount) ? l.bookedCount : 0;
                  const capacity =
                    typeof l?.capacity === 'number' && Number.isFinite(l.capacity) ? l.capacity : undefined;
                  const spotsLeft = typeof capacity === 'number' ? Math.max(0, capacity - bookedCount) : undefined;

                  return (
                    <Card key={l?.id || `${day}-${idx}`}>
                      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                        <div className="min-w-0">
                          <div className="text-sm font-semibold text-teal-700">{fmtDate(start)}</div>
                          <div className="mt-1 text-2xl font-bold">
                            {fmtTime(start)} · {Math.round((duration / 60) * 10) / 10}h
                          </div>
                          <div className="mt-2 flex flex-wrap gap-2 text-sm text-slate-600">
                            <span className="rounded-full bg-slate-100 px-3 py-1">{l?.difficulty || 'Level TBC'}</span>
                            <span className="rounded-full bg-slate-100 px-3 py-1">{l?.place || 'Spot TBC'}</span>
                            <span className="rounded-full bg-slate-100 px-3 py-1">
                              {bookedCount} booked{typeof capacity === 'number' ? ` / ${capacity}` : ''}
                            </span>
                          </div>
                        </div>

                        <div className="flex items-center gap-3">
                          {typeof spotsLeft === 'number' && (
                            <div className="text-right text-sm">
                              <div className="font-semibold text-slate-900">{spotsLeft} left</div>
                              <div className="text-slate-500">available spots</div>
                            </div>
                          )}
                          <Btn
                            onClick={() => {
                              const next = `/${school.slug}#lesson=${l?.id ?? ''}`;
                              window.location.href = `/login?school=${encodeURIComponent(
                                school.slug
                              )}&next=${encodeURIComponent(next)}`;
                            }}
                          >
                            Book
                          </Btn>
                        </div>
                      </div>
                    </Card>
                  );
                })}
              </div>
            </section>
          ))}
        </div>
      </main>
    </div>
  );
}
