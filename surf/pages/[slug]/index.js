import React, { useEffect, useMemo, useState } from 'react';

// ❗ No server-only imports at the top of this file.
// We will import `getSchoolBySlug` only inside getServerSideProps.

const DIFFICULTIES = ['Beginner', 'Intermediate', 'Advanced'];

export async function getServerSideProps(ctx) {
  const { slug } = ctx.params || {};
  try {
    // Safe: this runs only on the server
    const { getSchoolBySlug } = await import('../../lib/slug');
    const school = await getSchoolBySlug(slug);
    if (!school) return { notFound: true };
    return { props: { school } };
  } catch {
    return { notFound: true };
  }
}

/* UI atoms (minimal, Tailwind-based) */
const Card = ({ children }) => (
  <div className="rounded-2xl shadow-sm border border-gray-100 bg-white p-4">{children}</div>
);
const Label = ({ children }) => (
  <label className="text-sm font-medium text-gray-700 mb-1 block">{children}</label>
);
const Input = (props) => (
  <input {...props} className={`w-full rounded-xl border px-3 py-2 outline-none focus:ring-2 focus:ring-black/10 ${props.className||''}`} />
);
const Select = (props) => (
  <select {...props} className={`w-full rounded-xl border px-3 py-2 bg-white outline-none focus:ring-2 focus:ring-black/10 ${props.className||''}`} />
);
const Btn = ({ children, variant='neutral', className='', ...rest }) => {
  const base = 'inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2 font-medium shadow-sm border transition';
  const style = variant === 'primary'
    ? 'bg-green-600 hover:bg-green-700 border-green-700 text-white'
    : 'bg-white hover:bg-gray-50 border-gray-300';
  return <button {...rest} className={`${base} ${style} ${className}`}>{children}</button>;
};

function fmtDate(iso) {
  return new Date(iso).toLocaleDateString(undefined, { weekday:'short', year:'numeric', month:'short', day:'numeric' });
}
function fmtTime(iso) {
  return new Date(iso).toLocaleTimeString(undefined, { hour:'2-digit', minute:'2-digit' });
}

export default function PublicSchoolPage({ school }) {
  const [filters, setFilters] = useState({ difficulty:'', from:'', to:'' });
  const [data, setData] = useState({ loading:true, error:'', lessons:[] });

  async function load() {
    setData(d => ({ ...d, loading:true, error:'' }));
    const params = new URLSearchParams({ school: school.slug });
    if (filters.from) params.set('from', filters.from);
    if (filters.to) params.set('to', filters.to);
    if (filters.difficulty) params.set('difficulty', filters.difficulty);
    try {
      const res = await fetch(`/api/public/lessons?${params.toString()}`);
      const json = await res.json();
      if (!json.ok) throw new Error(json.error || 'Failed');
      setData({ loading:false, error:'', lessons: json.data });
    } catch (e) {
      setData({ loading:false, error: e.message, lessons: [] });
    }
  }
  useEffect(() => { load(); }, []); // initial
  useEffect(() => { load(); }, [filters.from, filters.to, filters.difficulty]);

  // group by day for display
  const grouped = useMemo(() => {
    const by = {};
    for (const l of data.lessons) {
      const key = new Date(l.startAt).toDateString();
      (by[key] ||= []).push(l);
    }
    return by;
  }, [data.lessons]);

  return (
    <div className="min-h-screen">
      {/* Simple header */}
      <header className="sticky top-0 z-10 backdrop-blur bg-white/70 border-b">
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center gap-3">
          <div className="text-xl font-bold">🌊 {school.name}</div>
          <div className="ml-auto text-sm text-gray-600">Public schedule</div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-6 space-y-6">
        {/* Filters */}
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
                  onChange={(e)=> setFilters(f => ({ ...f, difficulty: e.target.value }))}
                >
                  <option value="">All</option>
                  {['Beginner','Intermediate','Advanced'].map(d => <option key={d} value={d}>{d}</option>)}
                </Select>
              </div>
              <div>
                <Label>From</Label>
                <Input type="date" value={filters.from} onChange={(e)=> setFilters(f=>({ ...f, from:e.target.value }))} />
              </div>
              <div>
                <Label>To</Label>
                <Input type="date" value={filters.to} onChange={(e)=> setFilters(f=>({ ...f, to:e.target.value }))} />
              </div>
              <div className="md:pt-6">
                <Btn onClick={load} variant="primary">Apply</Btn>
              </div>
            </div>
          </div>
          {data.error && <div className="text-sm text-rose-600 mt-2">{data.error}</div>}
        </Card>

        {/* List */}
        {Object.keys(grouped).length === 0 && !data.loading && (
          <div className="text-gray-500">No lessons found.</div>
        )}

        {data.loading && <div className="text-gray-500">Loading…</div>}

        {Object.entries(grouped).map(([day, items]) => (
          <section key={day} className="space-y-3">
            <h4 className="text-sm font-semibold text-gray-600 uppercase tracking-wide">{day}</h4>
            {items.map((l) => (
              <Card key={l.id}>
                <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                  <div>
                    <div className="text-sm text-gray-500">{fmtDate(l.startAt)}</div>
                    <div className="text-xl font-semibold">{fmtTime(l.startAt)} • {Math.round(l.durationMin/60*10)/10}h</div>
                    <div className="text-gray-700">
                      {l.difficulty} • {l.place}
                      {Array.isArray(l.coaches) && l.coaches.length > 0 && (
                        <span className="ml-2 text-gray-600">
                          — Coaches:
                          {l.coaches.map((c, i) => (
                            <span key={c.id || i} className="ml-1 inline-block rounded-lg border px-2 py-0.5 text-xs">
                              {c.name}
                            </span>
                          ))}
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <div className="text-sm">
                      Booked: <b>{l.bookedCount}</b>
                      {typeof l.capacity === 'number' && (
                        <span className="text-gray-500"> / {l.capacity} ({l.spotsLeft} left)</span>
                      )}
                    </div>
                    {/* Booking requires login – send to login with return path */}
                    <Btn
                      variant="primary"
                      onClick={() => {
                        const next = `/${school.slug}#lesson=${l.id}`;
                        window.location.href = `/login?school=${encodeURIComponent(school.slug)}&next=${encodeURIComponent(next)}`;
                      }}
                    >
                      Book
                    </Btn>
                  </div>
                </div>
              </Card>
            ))}
          </section>
        ))}
      </main>
    </div>
  );
}
