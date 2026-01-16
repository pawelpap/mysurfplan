import React, { useEffect, useMemo, useState } from 'react';

// Server-only import happens inside getServerSideProps
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

/* ------------- small UI atoms ------------- */
const Card = ({ children }) => (
  <div className="rounded-2xl shadow-sm border border-gray-100 bg-white p-4">{children}</div>
);
const Label = ({ children }) => (
  <label className="text-sm font-medium text-gray-700 mb-1 block">{children}</label>
);
const Input = (props) => (
  <input
    {...props}
    className={`w-full rounded-xl border px-3 py-2 outline-none focus:ring-2 focus:ring-black/10 ${props.className || ''}`}
  />
);
const Select = (props) => (
  <select
    {...props}
    className={`w-full rounded-xl border px-3 py-2 bg-white outline-none focus:ring-2 focus:ring-black/10 ${props.className || ''}`}
  />
);
const Btn = ({ children, variant = 'neutral', className = '', ...rest }) => {
  const base =
    'inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2 font-medium shadow-sm border transition';
  const style =
    variant === 'primary'
      ? 'bg-green-600 hover:bg-green-700 border-green-700 text-white'
      : 'bg-white hover:bg-gray-50 border-gray-300';
  return (
    <button {...rest} className={`${base} ${style} ${className}`}>
      {children}
    </button>
  );
};

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
    <div className="min-h-screen">
      <header className="sticky top-0 z-10 backdrop-blur bg-white/70 border-b">
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center gap-3">
          <div className="text-xl font-bold">🌊 {school?.name || 'School'}</div>
          <div className="ml-auto text-sm text-gray-600">Public schedule</div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-6 space-y-6">
        <Card>
          <div className="flex flex-col md:flex-row md:items-end gap-3">
            <div className="flex-1">
              <h2 className="text-2xl font-semibold">Upcoming Lessons</h2>
              <p className="text-sm text-gray-500">Browse and book (login required at checkout).</p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-3 w-full md:w-auto">
              <div>
                <Label>Difficulty</Label>
                <Select
                  value={filters.difficulty}
                  onChange={(e) => setFilters((f) => ({ ...f, difficulty: e.target.value }))}
                >
                  <option value="">All</option>
                  {['Beginner', 'Intermediate', 'Advanced'].map((d) => (
                    <option key={d} value={d}>
                      {d}
                    </option>
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
              <div className="md:pt-6">
                <Btn onClick={load} variant="primary">
                  Apply
                </Btn>
              </div>
            </div>
          </div>
          {data.error && <div className="text-sm text-rose-600 mt-2">{data.error}</div>}
        </Card>

        {Object.keys(grouped).length === 0 && !data.loading && <div className="text-gray-500">No lessons found.</div>}

        {data.loading && <div className="text-gray-500">Loading…</div>}

        {Object.entries(grouped).map(([day, items]) => (
          <section key={day} className="space-y-3">
            <h4 className="text-sm font-semibold text-gray-600 uppercase tracking-wide">{day}</h4>
            {items.map((l, idx) => {
              const start = l?.startAt || l?.startISO || '';
              const duration = Number.isFinite(l?.durationMin) ? l.durationMin : 90;
              const bookedCount = Number.isFinite(l?.bookedCount) ? l.bookedCount : 0;
              const capacity =
                typeof l?.capacity === 'number' && Number.isFinite(l.capacity) ? l.capacity : undefined;
              const spotsLeft = typeof capacity === 'number' ? Math.max(0, capacity - bookedCount) : undefined;

              return (
                <Card key={l?.id || `${day}-${idx}`}>
                  <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                    <div>
                      <div className="text-sm text-gray-500">{fmtDate(start)}</div>
                      <div className="text-xl font-semibold">
                        {fmtTime(start)} • {Math.round((duration / 60) * 10) / 10}h
                      </div>
                      <div className="text-gray-700">
                        {(l?.difficulty || '—')} • {(l?.place || '—')}
                        {/* Coaches rendering temporarily removed to avoid non-array cases */}
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      <div className="text-sm">
                        Booked: <b>{bookedCount}</b>
                        {typeof capacity === 'number' && (
                          <span className="text-gray-500"> / {capacity} ({spotsLeft} left)</span>
                        )}
                      </div>
                      <Btn
                        variant="primary"
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
          </section>
        ))}
      </main>
    </div>
  );
}
