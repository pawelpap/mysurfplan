import Head from "next/head";
import { useRouter } from "next/router";
import { useState } from "react";
import {
  Brand,
  Button,
  Empty,
  Field,
  Loading,
  Message,
  PageHeading,
  SelectField,
  dateLabel,
  timeLabel,
  useData,
} from "../../components/workspace/ui";
import { dateKey } from "../../lib/conditions/model.mjs";
import { levels, lessonStatus } from "../../lib/lesson-input.mjs";

export default function PublicSchedule() {
  const router = useRouter();
  const slug = typeof router.query.slug === "string" ? router.query.slug : "";
  const schools = useData(slug ? "/api/schools" : null);
  const source = useData(
    slug ? `/api/public/lessons?school=${encodeURIComponent(slug)}` : null,
  );
  const [date, setDate] = useState("");
  const [level, setLevel] = useState("");
  const school = schools.data.find((s) => s.slug === slug);
  const filtered = source.data.filter(
    (l) =>
      lessonStatus(l) !== "Past" &&
      (!date || dateKey(l.startAt, l.spotTimezone) === date) &&
      (!level || l.difficulty === level),
  );
  const groups = filtered.reduce((days, lesson) => {
    const day = dateLabel(lesson.startAt, lesson.spotTimezone);
    (days[day] ||= []).push(lesson);
    return days;
  }, {});
  const bookingUrl = (lesson) =>
    `/?view=lessons&school=${encodeURIComponent(slug)}&lesson=${lesson.id}`;
  return (
    <>
      <Head>
        <title>{school?.name || "School schedule"} · MyWavePlan</title>
      </Head>
      <header className="public-header">
        <div>
          <Brand />
          <a
            className="button"
            href={`/login?school=${encodeURIComponent(slug)}&next=${encodeURIComponent(`/?school=${slug}`)}`}
          >
            Log in
          </a>
        </div>
      </header>
      <main className="public-main">
        <PageHeading
          title={school?.name || "School schedule"}
          description="Find your next surf lesson. Choose a session to review the details and book."
        />
        <div className="toolbar">
          <Field
            label="Date"
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            onInput={(e) => setDate(e.currentTarget.value)}
          />
          <SelectField
            label="Level"
            value={level}
            onChange={(e) => setLevel(e.target.value)}
            options={[
              { value: "", label: "All levels" },
              ...levels.map((value) => ({ value, label: value })),
            ]}
          />
          {(date || level) && (
            <Button
              tone="quiet"
              onClick={() => {
                setDate("");
                setLevel("");
              }}
            >
              Clear filters
            </Button>
          )}
        </div>
        {source.loading || schools.loading ? (
          <Loading label="Loading the schedule…" />
        ) : source.error || schools.error ? (
          <>
            <Message>{source.error || schools.error}</Message>
            <Button
              onClick={() => {
                source.reload();
                schools.reload();
              }}
            >
              Try again
            </Button>
          </>
        ) : Object.keys(groups).length ? (
          Object.entries(groups).map(([day, lessons]) => (
            <section key={day} aria-label={day}>
              <h2 className="public-day">{day}</h2>
              <div className="surface">
                {lessons.map((lesson) => (
                  <article className="public-card" key={lesson.id}>
                    <div>
                      <h3>
                        {timeLabel(lesson.startAt, lesson.spotTimezone)} ·{" "}
                        {lesson.difficulty}
                      </h3>
                      <p>
                        {lesson.spotName} · {lesson.durationMin} minutes
                      </p>
                      <p>
                        {lesson.place} · {lesson.spotTimezone}
                      </p>
                      {lesson.coaches?.length > 0 && (
                        <p>
                          With {lesson.coaches.map((c) => c.name).join(", ")}
                        </p>
                      )}
                    </div>
                    <div className="actions">
                      <span
                        className={`pill ${lessonStatus(lesson) === "Full" ? "full" : ""}`}
                      >
                        {lessonStatus(lesson) === "Full"
                          ? "Full"
                          : lesson.capacity == null
                            ? "Places available"
                            : `${Math.max(0, lesson.capacity - lesson.bookedCount)} places left`}
                      </span>
                      {lessonStatus(lesson) === "Full" ? (
                        <Button disabled>Lesson full</Button>
                      ) : (
                        <a className="button primary" href={bookingUrl(lesson)}>
                          View lesson →
                        </a>
                      )}
                    </div>
                  </article>
                ))}
              </div>
            </section>
          ))
        ) : (
          <Empty
            title={
              date || level
                ? "No lessons match your filters"
                : "No upcoming lessons"
            }
            action={
              date || level ? (
                <Button
                  onClick={() => {
                    setDate("");
                    setLevel("");
                  }}
                >
                  Show all upcoming lessons
                </Button>
              ) : school?.contact_email ? (
                <a className="button" href={`mailto:${school.contact_email}`}>
                  Contact the school
                </a>
              ) : null
            }
          >
            {date || level
              ? "Try another date or level."
              : "The school has not published its next sessions yet. Check back soon or contact the school for availability."}
          </Empty>
        )}
        <p className="muted-note">
          Times shown in each spot’s local time. You need a school account to
          book.
        </p>
      </main>
    </>
  );
}
