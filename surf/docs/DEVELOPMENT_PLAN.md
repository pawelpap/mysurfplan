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
- Workspace access is now intended to be driven by real login sessions instead of the role selector.
- Existing core entities: schools, coaches, students, lessons, lesson coaches, bookings.
- Schema now includes `user_role` and `users` as the future source of login identity.
- `coaches` and `students` now have nullable `user_id` links to `users` in the code schema.
- Neon staging database has been updated with nullable `coaches.user_id` and `students.user_id` links.
- Neon production database has been updated with nullable `coaches.user_id` and `students.user_id` links.
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
- A user can belong to multiple schools.
- `users.school_id` is a temporary compatibility field from the first auth iteration and should not be treated as the final membership model.
- Add a `user_school_roles` join table so a user can have different roles/statuses per school.

### School Memberships

Add a school membership model for users who belong to one or more schools.

Proposed table:

- `id UUID PRIMARY KEY`
- `user_id UUID NOT NULL REFERENCES users(id)`
- `school_id UUID NOT NULL REFERENCES schools(id)`
- `role user_role NOT NULL`
- `status TEXT NOT NULL DEFAULT 'pending'`
- `requested_at TIMESTAMPTZ NOT NULL DEFAULT now()`
- `approved_at TIMESTAMPTZ NULL`
- `approved_by UUID NULL REFERENCES users(id)`
- `created_at TIMESTAMPTZ NOT NULL DEFAULT now()`
- `updated_at TIMESTAMPTZ NOT NULL DEFAULT now()`
- `deleted_at TIMESTAMPTZ NULL`

Initial statuses:

- `pending`: student requested to join a school.
- `active`: school admin approved the membership.
- `rejected`: school admin rejected the request.
- `suspended`: access is disabled without deleting history.

### Roles

Initial roles:

- `platform_admin`: manages all schools, users, and global configuration.
- `school_admin`: manages one or more schools through approved school memberships.
- `coach`: views assigned lessons and manages attendance for assigned lessons only.
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
- Add `POST /api/auth/bootstrap` as a temporary, token-gated first-admin path. It only works when `BOOTSTRAP_ADMIN_TOKEN` is set and no active users exist.
- Keep signed HTTP-only cookie sessions for now.
- Use `hashPassword`, `verifyPassword`, and `validatePassword` from `surf/lib/auth.js` for password handling.
- Change `/api/auth/session` so it only returns or clears a real session.
- Remove the production ability to choose arbitrary roles from the frontend.
- Require `SESSION_SECRET` outside development.

Password approach options:

- Short term: password login with `password_hash` using Node `crypto.scrypt`.
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
- Optional telephone number when registering or completing a user profile.
- Student registration path.
- Redirect support with `next`.
- School context support with `school`.

Public booking flow:

1. Student opens `/:slug`.
2. Student clicks a lesson.
3. If logged out, redirect to `/login?school=<slug>&next=/<slug>#lesson=<lessonId>`.
4. If the student is new, they can register immediately.
5. If the student is not yet approved for that school, create a pending school membership request.
6. School admin approves the school membership.
7. After approval, the student can book lessons for that school.

### Admin Workspace

Use authenticated role and school scope to drive navigation.

Pages or screens to add:

- Schools: list, create, edit, soft delete.
- Users: list, create, edit, deactivate, assign role, capture optional telephone number.
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

Path decision:

- Keep `/:slug` for public school schedule pages.
- Move staff/admin tools to `/admin` over time.
- Use `/` as a role-aware app entry point: logged-out users go to `/login`, staff users go to `/admin`, students go to their student dashboard or relevant school page.
- The current `/` workspace can remain during transition, but it should not be the permanent staff-admin URL.

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
- [x] Add `user_id` columns to `coaches` and `students`.
- [x] Add password hashing dependency or use a runtime-safe built-in strategy.
- [x] Build `/login`.
- [x] Add optional telephone number fields to login/signup and user profile/admin UI.
- [x] Add `POST /api/auth/login`.
- [x] Change `/api/auth/session` to stop accepting arbitrary role creation.
- [x] Update `/` workspace to use the real session.
- [x] Remove role selector from production UI.
- [x] Add admin user management.
- [ ] Add multi-school membership table and approval workflow.
- [ ] Add immediate student self-registration.
- [ ] Add edit pages/actions for schools and coaches.
- [ ] Add lesson editing, including capacity.
- [ ] Wire public booking redirect back from `/login`.
- [ ] Move staff workspace toward `/admin` and make `/` a role-aware entry point.

## Decisions Made

- Telephone number should be an optional user field.
- Telephone number is stored on `users.phone`; do not mirror it onto `students` unless a later workflow needs offline student phone numbers without user accounts.
- Telephone number is not captured in the current UI yet; add it when building login/signup, user profile, and admin user forms.
- Password hashing uses built-in Node `crypto.scrypt`, with versioned hash strings from `surf/lib/auth.js`; no password hashing dependency is currently needed.
- First real admin user should be created through `POST /api/auth/bootstrap`, guarded by `BOOTSTRAP_ADMIN_TOKEN` and disabled after the first active user exists.
- Students should be able to self-register immediately.
- Students can belong to multiple schools.
- Student membership in a school should use a school-admin approval workflow.
- Authentication should use passwords for now; magic links are not needed in the first version.
- Coaches should only manage attendance for assigned lessons; they should not create lessons or create bookings in the normal workflow.
- School admins can create lessons and manage bookings for their school.
- Staff/admin tools should move toward `/admin`; `/` should become a role-aware entry point rather than the permanent admin workspace.
- Role-based admin work should come after real authentication.
- Current prototype auth should not be treated as production-ready.

## Resolved Questions

- Students should be able to self-register immediately, and can request membership in one or more schools.
- School membership should require school admin approval.
- Password authentication is enough for the first authentication version.
- Coaches should manage attendance only for assigned lessons.
- Users should be able to belong to multiple schools in version one.
- Staff tools should move toward `/admin`; `/` should become a role-aware entry point.

## Open Questions

- What should the student dashboard path be: `/app`, `/student`, or `/me`?
- Should a student be able to request school membership from the public school page before choosing a lesson?
- Should school admins approve student memberships manually only, or should schools be able to enable auto-approval later?
- What exact attendance states should coaches manage: present, absent, late, no-show, cancelled?

## Change Log

- 2026-04-28: Created this plan. Added optional telephone number to the proposed user model.
- 2026-04-28: Added `user_role` enum and `users` table to `surf/db/schema.sql`, including optional `phone`, school scope constraint, active email uniqueness, role/school indexes, and update trigger.
- 2026-04-28: Applied `surf/db/schema.sql` to the Neon staging database and verified `user_role`, `users`, and `users.phone` exist.
- 2026-04-28: Applied `surf/db/schema.sql` to the Neon production database and verified `user_role`, `users`, and `users.phone` exist.
- 2026-04-28: Added nullable `user_id` links from `coaches` and `students` to `users` in `surf/db/schema.sql`, with active-profile indexes and uniqueness guards.
- 2026-04-28: Applied the coach/student `user_id` schema update to the Neon staging database and verified columns plus indexes exist.
- 2026-04-28: Applied the coach/student `user_id` schema update to the Neon production database and verified columns plus indexes exist.
- 2026-04-28: Recorded that optional telephone number still needs to be added to login/signup, profile, and admin user UI.
- 2026-04-28: Added password validation, hashing, and verification helpers in `surf/lib/auth.js` using Node `crypto.scrypt`.
- 2026-04-28: Added `/login`, `POST /api/auth/login`, and token-gated `POST /api/auth/bootstrap` for creating the first `platform_admin`.
- 2026-04-28: Updated the workspace to require a real login session, removed role self-selection, added role-based navigation, disabled arbitrary session creation, and added basic user management APIs/UI.
- 2026-04-28: Resolved product decisions around student self-registration, multi-school membership, password-only auth, coach permissions, and moving staff tools toward `/admin`.
