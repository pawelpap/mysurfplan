import { LanguageSelector, useLocale } from "../../components/locale";
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
import { ThemeSelector } from "../../components/theme";
import SchoolPresentation from "../../components/workspace/school-presentation";

export default function PublicSchedule() {
  const { locale, t } = useLocale();
  const router = useRouter();
  const slug = typeof router.query.slug === "string" ? router.query.slug : "";
  const schools = useData(slug ? "/api/schools?public=1" : null);
  const branding = useData(slug ? `/api/public/school-branding?school=${encodeURIComponent(slug)}` : null);
  const source = useData(
    slug ? `/api/public/lessons?school=${encodeURIComponent(slug)}` : null,
  );
  const [date, setDate] = useState("");
  const [level, setLevel] = useState("");
  const published=branding.data?.schoolId?branding.data:null;
  const school = published||schools.data.find((s) => s.slug === slug);
  const filtered = source.data.filter(
    (l) =>
      lessonStatus(l) !== "Past" &&
      (!date || dateKey(l.startAt, l.spotTimezone) === date) &&
      (!level || l.difficulty === level),
  );
  const groups = filtered.reduce((days, lesson) => {
    const day = dateLabel(lesson.startAt, lesson.spotTimezone, locale);
    (days[day] ||= []).push(lesson);
    return days;
  }, {});
  const bookingUrl = (lesson) =>
    `/?view=lessons&school=${encodeURIComponent(slug)}&lesson=${lesson.id}`;
  return (
    <>
      <Head>
        <title>{(school?.name || t("School schedule")) + " · MyWavePlan"}</title>
      </Head>
      <header className="public-header" lang={locale}>
        <div>
          <Brand />
          <div className="public-header-actions">
            <ThemeSelector compact />
            <LanguageSelector compact />
            <a
              className="button"
              href={`/login?school=${encodeURIComponent(slug)}&next=${encodeURIComponent(`/?school=${slug}`)}`}
            >{t("Log in")}</a>
          </div>
        </div>
      </header>
      <main className="public-main" lang={locale}>
        {published&&<SchoolPresentation data={published}/>}
        <PageHeading
          title={published?t("School schedule"):school?.name || t("School schedule")}
          description={t("Find your next surf lesson. Choose a session to review the details and book.")}
        />
        <div className="toolbar">
          <Field
            label={t("Date")}
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            onInput={(e) => setDate(e.currentTarget.value)}
          />
          <SelectField
            label={t("Level")}
            value={level}
            onChange={(e) => setLevel(e.target.value)}
            options={[
              { value: "", label: t("All levels") },
              ...levels.map((value) => ({ value, label: t(value) })),
            ]}
          />
          {(date || level) && (
            <Button
              tone="quiet"
              onClick={() => {
                setDate("");
                setLevel("");
              }}
            >{t("Clear filters")}</Button>
          )}
        </div>
        {source.loading || schools.loading ? (
          <Loading label={t("Loading the schedule…")} />
        ) : source.error || schools.error ? (
          <>
            <Message>{source.error || schools.error}</Message>
            <Button
              onClick={() => {
                source.reload();
                schools.reload();
              }}
            >{t("Try again")}</Button>
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
                        {timeLabel(lesson.startAt, lesson.spotTimezone, locale)} ·{" "}
                        {t(lesson.difficulty)}
                      </h3>
                      <p>
                        {lesson.spotName} · {lesson.durationMin} {t("minutes")}</p>
                      <p>
                        {lesson.place} · {lesson.spotTimezone}
                      </p>
                      {lesson.coaches?.length > 0 && (
                        <p>{t("With")} {lesson.coaches.map((c) => c.name).join(", ")}
                        </p>
                      )}
                    </div>
                    <div className="actions">
                      <span
                        className={`pill ${lessonStatus(lesson) === "Full" ? "full" : ""}`}
                      >
                        {lessonStatus(lesson) === "Full"
                          ? t("Full")
                          : lesson.capacity == null
                            ? t("Places available")
                            : t("{1} places left", { 1: Math.max(0, lesson.capacity - lesson.bookedCount) })}
                      </span>
                      {lessonStatus(lesson) === "Full" ? (
                        <Button disabled>{t("Lesson full")}</Button>
                      ) : (
                        <a className="button primary" href={bookingUrl(lesson)}>{t("View lesson →")}</a>
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
                ? t("No lessons match your filters")
                : t("No upcoming lessons")
            }
            action={
              date || level ? (
                <Button
                  onClick={() => {
                    setDate("");
                    setLevel("");
                  }}
                >{t("Show all upcoming lessons")}</Button>
              ) : school?.contact_email ? (
                <a className="button" href={`mailto:${school.contact_email}`}>{t("Contact the school")}</a>
              ) : null
            }
          >
            {date || level
              ? t("Try another date or level.")
              : t("The school has not published its next sessions yet. Check back soon or contact the school for availability.")}
          </Empty>
        )}
        <p className="muted-note">{t("Times shown in each spot’s local time. You need a school account to book.")}</p>
      </main>
    </>
  );
}
