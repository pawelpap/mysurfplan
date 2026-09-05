import { useState } from "react";
import { LessonConditions } from "../conditions/shared";
import { zonedFields, zonedDateTimeToISO } from "../../lib/conditions/time.mjs";
import { dateKey } from "../../lib/conditions/model.mjs";
import {
  Button,
  Field,
  SelectField,
  Message,
  Empty,
  Loading,
  PageHeading,
  FormActions,
  dateLabel,
  timeLabel,
  fullName,
  isAdmin,
  request,
  useData,
} from "./ui";
import {
  levels,
  lessonStatus,
  validateLesson,
} from "../../lib/lesson-input.mjs";

const levelOptions = levels.map((value) => ({ value, label: value }));
const bookedBy = (lesson, session) =>
  (lesson.attendees || []).some(
    (p) => p.email?.toLowerCase() === session.email?.toLowerCase(),
  );
const instructors = (lesson) =>
  lesson.coaches?.map((c) => c.name).join(", ") || "Not assigned";
const spaces = (lesson) =>
  lesson.capacity == null
    ? `${lesson.bookedCount} booked · No limit`
    : `${lesson.bookedCount} / ${lesson.capacity} booked`;

export default function Lessons({ school, session, query, go, onForecast }) {
  const source = useData(
    school ? `/api/lessons?school=${encodeURIComponent(school.slug)}` : null,
  );
  const [search, setSearch] = useState("");
  const [level, setLevel] = useState("");
  const [notice, setNotice] = useState("");
  const admin = isAdmin(session.role);
  const period = ["past", "mine"].includes(query.period)
    ? query.period
    : "upcoming";
  const back = () => go({ period });
  const open = (lesson, action) => {
    setNotice("");
    go({ period, lesson: lesson.id, ...(action ? { action } : {}) });
  };
  const saved = (lesson) => {
    source.reload();
    setNotice("Lesson saved.");
    go({
      period: lessonStatus(lesson) === "Past" ? "past" : "upcoming",
      lesson: lesson.id,
    });
  };

  if (!school)
    return (
      <Empty title="Choose a school">Select a school to see its lessons.</Empty>
    );
  if (query.action === "new" && admin)
    return <LessonForm school={school} onCancel={back} onSaved={saved} />;
  if (source.loading) return <Loading label="Loading lessons…" />;
  if (source.error)
    return (
      <>
        <Message>{source.error}</Message>
        <Button onClick={source.reload}>Try again</Button>
      </>
    );

  if (query.lesson) {
    const lesson = source.data.find((l) => l.id === query.lesson);
    if (!lesson)
      return (
        <Empty
          title="Lesson not found"
          action={<Button onClick={back}>Back to lessons</Button>}
        >
          This lesson may have been removed or is not available to your account.
        </Empty>
      );
    if (query.action === "edit" && admin)
      return (
        <LessonForm
          key={lesson.id}
          school={school}
          lesson={lesson}
          onCancel={() => open(lesson)}
          onSaved={saved}
        />
      );
    if (query.action === "instructors" && admin)
      return (
        <InstructorForm
          school={school}
          lesson={lesson}
          onCancel={() => open(lesson)}
          onSaved={() => {
            source.reload();
            open(lesson);
            setNotice("Instructors saved.");
          }}
        />
      );
    if (
      ["bookings", "add-booking"].includes(query.action) &&
      session.role !== "student"
    )
      return (
        <Bookings
          lesson={lesson}
          session={session}
          adding={query.action === "add-booking"}
          onBack={() => open(lesson)}
          onAdd={() => open(lesson, "add-booking")}
          onList={() => open(lesson, "bookings")}
          reload={source.reload}
        />
      );
    return (
      <LessonDetail
        lesson={lesson}
        onForecast={() =>
          onForecast(
            lesson.spotId,
            dateKey(lesson.startAt, lesson.spotTimezone || "Europe/Lisbon"),
          )
        }
        session={session}
        notice={notice}
        onBack={back}
        onEdit={() => open(lesson, "edit")}
        onInstructors={() => open(lesson, "instructors")}
        onBookings={() => open(lesson, "bookings")}
        onDeleted={() => {
          source.reload();
          back();
        }}
        reload={source.reload}
      />
    );
  }

  const filtered = source.data
    .filter((l) => {
      const past = lessonStatus(l) === "Past";
      return (
        (period === "past" ? past : !past) &&
        (period !== "mine" || bookedBy(l, session)) &&
        (!level || l.difficulty === level) &&
        `${l.spotName || ""} ${l.place} ${instructors(l)}`
          .toLowerCase()
          .includes(search.toLowerCase())
      );
    })
    .sort((a, b) =>
      period === "past"
        ? new Date(b.startAt) - new Date(a.startAt)
        : new Date(a.startAt) - new Date(b.startAt),
    );
  return (
    <>
      <PageHeading
        title={session.role === "coach" ? "Your lessons" : "Lessons"}
        description={
          session.role === "coach"
            ? "Review the lessons you are assigned to teach."
            : "Find a lesson and open it to see the details."
        }
        action={
          admin && (
            <Button
              tone="primary"
              onClick={() => go({ period, action: "new" })}
            >
              + Add lesson
            </Button>
          )
        }
      />
      <div className="segment" aria-label="Lesson period">
        {[
          ["upcoming", "Upcoming"],
          ...(session.role === "student" ? [["mine", "My bookings"]] : []),
          ["past", "Past"],
        ].map(([value, label]) => (
          <button
            key={value}
            aria-pressed={period === value}
            className={period === value ? "active" : ""}
            onClick={() => go({ period: value })}
          >
            {label}
          </button>
        ))}
      </div>
      <div className="toolbar">
        <Field
          label="Search lessons"
          type="search"
          placeholder="Surf spot, meeting point or instructor"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <SelectField
          label="Level"
          value={level}
          onChange={(e) => setLevel(e.target.value)}
          options={[{ value: "", label: "All levels" }, ...levelOptions]}
        />
      </div>
      {filtered.length ? (
        <div className="surface">
          <div className="list-header" aria-hidden="true">
            <span>Date and time</span>
            <span>Surf spot / meeting point</span>
            <span>Instructors</span>
            <span>Bookings</span>
            <span />
          </div>
          {filtered.map((lesson) => (
            <button
              className="list-row"
              key={lesson.id}
              onClick={() => open(lesson)}
              aria-label={`View ${lesson.difficulty} lesson at ${lesson.place}, ${dateLabel(lesson.startAt, lesson.spotTimezone)}, ${timeLabel(lesson.startAt, lesson.spotTimezone)}`}
            >
              <span>
                <strong>
                  {dateLabel(lesson.startAt, lesson.spotTimezone)}
                </strong>
                <small>
                  {timeLabel(lesson.startAt, lesson.spotTimezone)} ·{" "}
                  {lesson.durationMin} min
                </small>
              </span>
              <span>
                <strong>{lesson.spotName || lesson.place}</strong>
                {lesson.spotName && <small>{lesson.place}</small>}
                <small>{lesson.difficulty}</small>
              </span>
              <span>{instructors(lesson)}</span>
              <span>
                <strong>
                  {lesson.capacity == null
                    ? lesson.bookedCount
                    : `${lesson.bookedCount} / ${lesson.capacity}`}
                </strong>
                <small>
                  {bookedBy(lesson, session)
                    ? "You’re booked"
                    : lessonStatus(lesson) === "Full"
                      ? "Full"
                      : "booked"}
                </small>
              </span>
              <span className="row-action">View →</span>
            </button>
          ))}
        </div>
      ) : (
        <Empty
          title={
            search || level
              ? "No matching lessons"
              : period === "past"
                ? "No past lessons"
                : period === "mine"
                  ? "No upcoming bookings"
                  : "No upcoming lessons"
          }
          action={
            search || level ? (
              <Button
                onClick={() => {
                  setSearch("");
                  setLevel("");
                }}
              >
                Clear filters
              </Button>
            ) : admin && period === "upcoming" ? (
              <Button tone="primary" onClick={() => go({ action: "new" })}>
                Add a lesson
              </Button>
            ) : period === "upcoming" && source.data.length ? (
              <Button onClick={() => go({ period: "past" })}>
                View past lessons
              </Button>
            ) : null
          }
        >
          {search || level
            ? "Try another meeting point, instructor or level."
            : period === "upcoming"
              ? admin
                ? "Create the next lesson to start filling your schedule."
                : "Your school has not published any upcoming lessons yet."
              : period === "mine"
                ? "Choose a lesson from Upcoming to make a booking."
                : "Completed lessons will appear here."}
        </Empty>
      )}
      <div className="list-caption">
        <span>
          {filtered.length} {filtered.length === 1 ? "lesson" : "lessons"}
        </span>
        <span>Times shown in each spot’s local time</span>
      </div>
    </>
  );
}

function localDateTime(value) {
  const date = new Date(value);
  return new Date(date.getTime() - date.getTimezoneOffset() * 60000)
    .toISOString()
    .slice(0, 16);
}
function LessonForm({ school, lesson, onCancel, onSaved }) {
  const spots = useData("/api/spots");
  const [form, setForm] = useState({
    date: lesson
      ? zonedFields(lesson.startAt, lesson.spotTimezone).date
      : localDateTime(new Date(Date.now() + 86400000)).slice(0, 10),
    time: lesson
      ? zonedFields(lesson.startAt, lesson.spotTimezone).time
      : "10:00",
    durationMin: lesson?.durationMin || 90,
    difficulty: lesson?.difficulty || "Beginner",
    place: lesson?.place || "",
    spotId: lesson?.spotId || "",
    capacity: lesson?.capacity ?? "",
  });
  const spotTimezone =
    spots.data.find((s) => s.id === form.spotId)?.timezone ||
    lesson?.spotTimezone ||
    Intl.DateTimeFormat().resolvedOptions().timeZone;
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const bind = (name) => ({
    value: form[name],
    onChange: (e) => setForm((old) => ({ ...old, [name]: e.target.value })),
  });
  async function submit(event) {
    event.preventDefault();
    setError("");
    setBusy(true);
    try {
      const fields = new FormData(event.currentTarget);
      const body = validateLesson({
        ...form,
        startAt: zonedDateTimeToISO(
          fields.get("date"),
          fields.get("time"),
          spotTimezone,
        ),
      });
      const data = await request(
        lesson ? `/api/lessons/${lesson.id}` : "/api/lessons",
        {
          method: lesson ? "PUT" : "POST",
          body: JSON.stringify({ ...body, school: school.slug }),
        },
      );
      onSaved(data);
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="form-screen">
      <PageHeading
        title={lesson ? "Edit lesson" : "Add lesson"}
        description={
          lesson
            ? "Update the lesson details."
            : "Set the details first. You can assign instructors after saving."
        }
        back={{
          label: lesson ? "Lesson details" : "Lessons",
          onClick: onCancel,
        }}
      />
      <form className="surface padded" onSubmit={submit}>
        <div className="form-grid">
          <Field
            label="Date"
            type="date"
            required
            name="date"
            defaultValue={form.date}
            hint={`Time at the spot: ${spotTimezone}`}
          />
          <Field
            label="Start time"
            type="time"
            required
            name="time"
            defaultValue={form.time}
          />
          <Field
            label="Duration (minutes)"
            type="number"
            min="15"
            max="720"
            required
            {...bind("durationMin")}
          />
          <SelectField
            label="Surf spot"
            required
            options={[
              {
                value: "",
                label: spots.loading ? "Loading spots…" : "Choose a surf spot",
              },
              ...spots.data.map((s) => ({
                value: s.id,
                label: `${s.name} · ${s.region}, ${s.countryCode}`,
              })),
            ]}
            {...bind("spotId")}
          />
          <Field
            label="Meeting point"
            placeholder="e.g. West entrance, next to the school flag"
            required
            maxLength={200}
            {...bind("place")}
          />
          <SelectField
            label="Level"
            options={levelOptions}
            {...bind("difficulty")}
          />
          <Field
            label="Capacity"
            type="number"
            min="1"
            max="1000"
            placeholder="No limit"
            hint="Leave blank for no booking limit."
            {...bind("capacity")}
          />
        </div>
        {spots.error && <Message>{spots.error}</Message>}
        <FormActions
          busy={
            busy || spots.loading || Boolean(spots.error) || !spots.data.length
          }
          error={error}
          onCancel={onCancel}
          label={lesson ? "Save changes" : "Create lesson"}
        />
      </form>
    </div>
  );
}

function InstructorForm({ school, lesson, onCancel, onSaved }) {
  const source = useData(
    `/api/coaches?school=${encodeURIComponent(school.slug)}`,
  );
  const [selected, setSelected] = useState(lesson.coaches.map((c) => c.id));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      await request(`/api/lessons/${lesson.id}/coaches`, {
        method: "PUT",
        body: JSON.stringify({ coachIds: selected }),
      });
      onSaved();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="form-screen">
      <PageHeading
        title="Assign instructors"
        description={`${dateLabel(lesson.startAt, lesson.spotTimezone)} · ${timeLabel(lesson.startAt, lesson.spotTimezone)} · ${lesson.place}`}
        back={{ label: "Lesson details", onClick: onCancel }}
      />
      <form className="surface padded" onSubmit={submit}>
        {source.loading ? (
          <Loading />
        ) : source.error ? (
          <Message>{source.error}</Message>
        ) : source.data.length ? (
          <fieldset>
            <legend>Select instructors for this lesson</legend>
            <div className="check-list">
              {source.data.map((coach) => (
                <label key={coach.id}>
                  <input
                    type="checkbox"
                    checked={selected.includes(coach.id)}
                    onChange={(e) =>
                      setSelected((old) =>
                        e.target.checked
                          ? [...old, coach.id]
                          : old.filter((id) => id !== coach.id),
                      )
                    }
                  />
                  {coach.name}
                </label>
              ))}
            </div>
          </fieldset>
        ) : (
          <p>No instructors are available for this school.</p>
        )}
        <FormActions
          busy={busy || source.loading || Boolean(source.error)}
          error={error}
          onCancel={onCancel}
        />
      </form>
    </div>
  );
}

function LessonDetail({
  lesson,
  session,
  notice,
  onBack,
  onEdit,
  onInstructors,
  onBookings,
  onForecast,
  onDeleted,
  reload,
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const admin = isAdmin(session.role);
  const booked = bookedBy(lesson, session);
  const status = lessonStatus(lesson);
  async function book() {
    if (booked && !window.confirm("Cancel your booking for this lesson?"))
      return;
    setBusy(true);
    setError("");
    setSuccess("");
    try {
      await request(`/api/lessons/${lesson.id}/book`, {
        method: booked ? "DELETE" : "POST",
        body: JSON.stringify({ name: fullName(session), email: session.email }),
      });
      setSuccess(
        booked
          ? "Your booking has been cancelled."
          : "You are booked for this lesson.",
      );
      reload();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  async function remove() {
    if (
      !window.confirm(
        `Remove this lesson at ${lesson.place} on ${dateLabel(lesson.startAt, lesson.spotTimezone)}? It will disappear from the schedule and public booking page.`,
      )
    )
      return;
    setBusy(true);
    setError("");
    try {
      await request(`/api/lessons/${lesson.id}`, { method: "DELETE" });
      onDeleted();
    } catch (e) {
      setError(e.message);
      setBusy(false);
    }
  }
  return (
    <div className="form-screen">
      <PageHeading
        title={`${lesson.difficulty} lesson`}
        description={`${dateLabel(lesson.startAt, lesson.spotTimezone)} · ${timeLabel(lesson.startAt, lesson.spotTimezone)}`}
        back={{ label: "Lessons", onClick: onBack }}
        action={
          admin && (
            <Button tone="primary" onClick={onEdit}>
              Edit lesson
            </Button>
          )
        }
      />
      <Message success>{success || notice}</Message>
      <Message>{error}</Message>
      <section className="surface padded" aria-label="Lesson details">
        <dl className="detail-grid">
          <div>
            <dt>Surf spot</dt>
            <dd>{lesson.spotName || "Not assigned"}</dd>
          </div>
          <div>
            <dt>Meeting point</dt>
            <dd>{lesson.place}</dd>
          </div>
          <div>
            <dt>Duration</dt>
            <dd>{lesson.durationMin} minutes</dd>
          </div>
          <div>
            <dt>Level</dt>
            <dd>{lesson.difficulty}</dd>
          </div>
          <div>
            <dt>Bookings</dt>
            <dd>{spaces(lesson)}</dd>
          </div>
          <div className="wide">
            <dt>Instructors</dt>
            <dd>{instructors(lesson)}</dd>
          </div>
        </dl>
        <div className="task-actions">
          {session.role === "student" ? (
            <>
              <Button
                tone="primary"
                onClick={book}
                disabled={
                  busy ||
                  status === "Past" ||
                  (!booked && (status === "Full" || !lesson.spotActive))
                }
              >
                {busy
                  ? "Updating…"
                  : booked
                    ? "Cancel my booking"
                    : !lesson.spotActive
                      ? "Spot confirmation needed"
                      : status === "Full"
                        ? "Lesson full"
                        : status === "Past"
                          ? "Lesson has finished"
                          : "Book this lesson"}
              </Button>
              {booked && <span className="pill booked">You’re booked</span>}
            </>
          ) : (
            <>
              <Button tone="primary" onClick={onBookings}>
                View bookings ({lesson.bookedCount})
              </Button>
              {admin && (
                <Button onClick={onInstructors}>Assign instructors</Button>
              )}
            </>
          )}
        </div>
      </section>
      <LessonConditions lesson={lesson} onForecast={onForecast} />
      <p className="muted-note">
        Times shown in{" "}
        {lesson.spotTimezone ||
          Intl.DateTimeFormat().resolvedOptions().timeZone}
        .
      </p>
      {admin && (
        <div className="danger-zone">
          <Button tone="danger" disabled={busy} onClick={remove}>
            Remove lesson
          </Button>
        </div>
      )}
    </div>
  );
}

function Bookings({ lesson, session, adding, onBack, onAdd, onList, reload }) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const admin = isAdmin(session.role);
  const status = lessonStatus(lesson);
  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      await request(`/api/lessons/${lesson.id}/book`, {
        method: "POST",
        body: JSON.stringify({ name, email }),
      });
      reload();
      onList();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  async function cancel(person) {
    if (
      !window.confirm(`Cancel the booking for ${person.name || person.email}?`)
    )
      return;
    setBusy(true);
    setError("");
    try {
      await request(`/api/lessons/${lesson.id}/book`, {
        method: "DELETE",
        body: JSON.stringify({ email: person.email }),
      });
      reload();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  if (adding && admin && status === "Available" && lesson.spotActive)
    return (
      <div className="form-screen">
        <PageHeading
          title="Add booking"
          description={`${dateLabel(lesson.startAt, lesson.spotTimezone)} · ${timeLabel(lesson.startAt, lesson.spotTimezone)} · ${lesson.place}`}
          back={{ label: "Bookings", onClick: onList }}
        />
        <form className="surface padded" autoComplete="off" onSubmit={submit}>
          <div className="form-grid">
            <Field
              label="Student name"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoComplete="off"
            />
            <Field
              label="Student email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="off"
            />
          </div>
          <p className="muted-note">
            This reserves a place. It does not create a login account or send a
            confirmation email.
          </p>
          <FormActions
            busy={busy}
            error={error}
            onCancel={onList}
            label="Add booking"
          />
        </form>
      </div>
    );
  return (
    <>
      <PageHeading
        title="Lesson bookings"
        description={`${dateLabel(lesson.startAt, lesson.spotTimezone)} · ${timeLabel(lesson.startAt, lesson.spotTimezone)} · ${lesson.place}`}
        back={{ label: "Lesson details", onClick: onBack }}
        action={
          admin &&
          status === "Available" &&
          lesson.spotActive && (
            <Button tone="primary" onClick={onAdd}>
              + Add booking
            </Button>
          )
        }
      />
      <Message>{error}</Message>
      {lesson.attendees.length ? (
        <div className="surface">
          {lesson.attendees.map((person) => (
            <div className="booking-row" key={person.id}>
              <div>
                <strong>{person.name || "Student"}</strong>
                <small>{person.email}</small>
              </div>
              {admin && (
                <Button
                  tone="quiet"
                  disabled={busy}
                  onClick={() => cancel(person)}
                >
                  Cancel booking
                </Button>
              )}
            </div>
          ))}
        </div>
      ) : (
        <Empty title="No bookings yet">
          Students booked on this lesson will appear here.
        </Empty>
      )}
      <div className="list-caption">
        <span>{spaces(lesson)}</span>
        <span>
          {status === "Past"
            ? "Past lesson"
            : status === "Full"
              ? "Lesson full"
              : ""}
        </span>
      </div>
    </>
  );
}
