# MyWavePlan Development Plan

Last updated: 2026-04-28

This file is the persistent working plan for the app. Update it after each meaningful code change so a future session can resume without relying on chat context.

## Current State

- Next.js Pages Router app in `surf/`.
- Deployed through Vercel.
- `main` publishes production: `https://mywaveplan.com/`.
- `staging` publishes staging: `https://staging.mywaveplan.com/`.
- Data uses Neon/Postgres-style SQL through `surf/lib/db.js`.
- Contentful provides global settings through `surf/lib/cms.js`.
- Existing auth is a prototype signed-cookie flow where the frontend can choose a role.
- Existing core entities: schools, coaches, students, lessons, lesson coaches, bookings.
- Schema now includes `user_role` and `users` as the future source of login identity.
- Neon staging database has been updated with the `user_role` enum, `users` table, and `users.phone`.
- Neon production database has been updated with the `user_role` enum, `users` table, and `users.phone`.
- Public school schedule pages exist at `/:slug`.
- Public booking currently links to `/login`, but `/login` does not exist yet.

## Guiding Direction

Build a production-ready school management and booking app in this order:

1. Real authentication.
2. Durable user and role model.
3. Admin pages for schools, coaches, users, lessons, and bookings.
4. Public booking flow for students.
5. Production hardening and cleanup.

## Data Model Plan

### Users

Add a real `users` table and use it as the source of identity.

Proposed fields:

- `id UUID PRIMARY KEY`
- `school_id UUID NULL REFERENCES schools(id)`
- `name TEXT NOT NULL`
- `email TEXT NOT NULL`
- `phone TEXT NULL`
- `role user_role NOT NULL`
- `password_hash TEXT NULL`
- `email_verified_at TIMESTAMPTZ NULL`
- `last_login_at TIMESTAMPTZ NULL`
- `created_at TIMESTAMPTZ NOT NULL DEFAULT now()`
- `updated_at TIMESTAMPTZ NOT NULL DEFAULT now()`
- `deleted_at TIMESTAMPTZ NULL`

Notes:

- Telephone number is optional.
- Email should be normalized to lower case before storage.
- A user belongs to one school except `platform_admin`, which can have `school_id = NULL`.
- Later, if one user needs access to multiple schools, add a `user_school_roles` join table.

### Roles

Initial roles:

- `platform_admin`: manages all schools, users, and global configuration.
- `school_admin`: manages one school, coaches, students, lessons, and bookings.
- `coach`: views assigned lessons and manages attendance/bookings where allowed.
- `student`: views, books, and cancels their own lessons.

Optional later roles:

- `front_desk`
- `owner`
- `parent`

### Coaches And Students

Keep `coaches` and `students` as domain profiles, but link them to users:

- `coaches.user_id UUID NULL REFERENCES users(id)`
- `students.user_id UUID NULL REFERENCES users(id)`

This allows:

- A coach to log in.
- A student to log in.
- Existing data to migrate gradually.
- Staff to create offline students without a login at first.

## Auth Plan

Replace the current role picker with real login.

Initial approach:

- Add `/login`.
- Add `POST /api/auth/login`.
- Keep signed HTTP-only cookie sessions for now.
- Change `/api/auth/session` so it only returns, refreshes, or clears a real session.
- Remove the production ability to choose arbitrary roles from the frontend.
- Require `SESSION_SECRET` outside development.

Password approach options:

- Short term: password login with `password_hash`.
- Later: magic links or email verification.

Security requirements:

- Never allow the client to set its own role.
- Always scope non-platform-admin access by `school_id`.
- Student users can only book/cancel for their own email/user id.
- Staging and production must not run with `dev-insecure-session-secret`.

## UI Plan

### Login

Create `/login` with:

- Email.
- Password.
- Optional registration path for students.
- Redirect support with `next`.
- School context support with `school`.

Public booking flow:

1. Student opens `/:slug`.
2. Student clicks a lesson.
3. If logged out, redirect to `/login?school=<slug>&next=/<slug>#lesson=<lessonId>`.
4. After login or signup, return to the lesson and book.

### Admin Workspace

Use authenticated role and school scope to drive navigation.

Pages or screens to add:

- Schools: list, create, edit, soft delete.
- Users: list, create, edit, deactivate, assign role.
- Coaches: list, create, edit, soft delete, link to user.
- Students: list, create, edit, soft delete, link to user.
- Lessons: list/calendar, create, edit, delete, capacity, coaches.
- Bookings: view per lesson, add student, cancel booking.

Suggested path structure:

- `/admin`
- `/admin/schools`
- `/admin/users`
- `/admin/coaches`
- `/admin/students`
- `/admin/lessons`

The current `/` workspace can either become `/admin` or redirect based on role after login.

## API Plan

Add or update endpoints:

- `POST /api/auth/login`
- `DELETE /api/auth/session`
- `GET /api/auth/session`
- `GET /api/users`
- `POST /api/users`
- `GET /api/users/[id]`
- `PUT /api/users/[id]`
- `DELETE /api/users/[id]`
- `PUT /api/schools/[id]`
- `PUT /api/coaches/[id]`
- `PUT /api/students/[id]`
- `PUT /api/lessons/[id]`

Refactor shared helpers:

- `resolveSchoolScope`
- `requireAuth`
- role/scope checks
- body validation
- email normalization
- phone normalization

## Production Hardening

- Declare `@neondatabase/serverless` directly in `package.json`.
- Add `.env.example`.
- Move Tailwind from CDN to a local Tailwind/PostCSS setup.
- Add basic tests for auth, school scoping, and booking capacity.
- Hide or remove `/test/*` playground routes from production.
- Add no-cache headers for authenticated API responses where appropriate.
- Add audit-friendly error handling without leaking internals in production.

## Near-Term Implementation Checklist

- [x] Add database schema for `user_role` and `users`.
- [x] Add optional `phone` to users, and decide whether to also mirror it on `students`.
- [ ] Add `user_id` columns to `coaches` and `students`.
- [ ] Add password hashing dependency or use a runtime-safe built-in strategy.
- [ ] Build `/login`.
- [ ] Add `POST /api/auth/login`.
- [ ] Change `/api/auth/session` to stop accepting arbitrary role creation.
- [ ] Update `/` workspace to use the real session.
- [ ] Remove role selector from production UI.
- [ ] Add admin user management.
- [ ] Add edit pages/actions for schools and coaches.
- [ ] Add lesson editing, including capacity.
- [ ] Wire public booking redirect back from `/login`.

## Decisions Made

- Telephone number should be an optional user field.
- Telephone number is stored on `users.phone`; do not mirror it onto `students` unless a later workflow needs offline student phone numbers without user accounts.
- Role-based admin work should come after real authentication.
- Current prototype auth should not be treated as production-ready.

## Open Questions

- Should students be able to self-register immediately, or should schools invite/create them first?
- Should the first authentication version use passwords, magic links, or both?
- Should a coach be allowed to create bookings, or only manage attendance for assigned lessons?
- Should a user be able to belong to multiple schools in version one?
- Should production keep the current `/` workspace path, or move staff tools to `/admin`?

## Change Log

- 2026-04-28: Created this plan. Added optional telephone number to the proposed user model.
- 2026-04-28: Added `user_role` enum and `users` table to `surf/db/schema.sql`, including optional `phone`, school scope constraint, active email uniqueness, role/school indexes, and update trigger.
- 2026-04-28: Applied `surf/db/schema.sql` to the Neon staging database and verified `user_role`, `users`, and `users.phone` exist.
- 2026-04-28: Applied `surf/db/schema.sql` to the Neon production database and verified `user_role`, `users`, and `users.phone` exist.
