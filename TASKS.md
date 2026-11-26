# TASKS.md — Household Whiteboard Build Plan

Tracks implementation progress against [PROJECT.md](PROJECT.md). Check items off as they're completed. Phases map to PROJECT.md §20 but are broken down into concrete, independently-testable steps. Work top to bottom — later phases assume earlier ones are functional, not just started.

Legend: `[ ]` not started · `[x]` done · `[~]` in progress / partial

---

## Phase 0 — Repository & Tooling Scaffolding

Not called out as its own phase in PROJECT.md, but needed before Phase 1 can start.

- [x] Initialize git repository, `.gitignore` (node_modules, dist, .env, uploads data, etc.)
- [x] Create directory skeleton per PROJECT.md §2 (`frontend/`, `backend/`, `nginx/`)
- [x] Root `package.json` / workspace config if using a monorepo tool (or keep frontend/backend fully independent — decide and note why) — **decision: no monorepo tool**; frontend and backend are independent npm projects, each with its own lockfile, built independently by Docker/CI. Simpler for two small apps with no shared library code yet.
- [x] `backend/`: Node.js + TypeScript project init, strict `tsconfig.json`
- [x] `frontend/`: React + TypeScript project init (Vite recommended), strict `tsconfig.json`
- [x] Shared linting/formatting config (ESLint + Prettier) for both frontend and backend
- [x] `.env.example` stub created (filled in incrementally per phase)
- [x] `docker-compose.yml` skeleton with empty service stubs (`frontend`, `backend`, `postgres`, `nginx`)
- [x] Decide and document Node LTS version, package manager (npm/pnpm) — **Node 22 LTS, npm** (see `engines` field in both `package.json` files and Docker base images)
- [x] Root `README.md` (brief dev setup instructions — distinct from PROJECT.md spec)
- [x] Public GitHub repository created (`DropzoneNinja/pinboard`)
- [x] CI: GitHub Actions workflow builds `backend` and `frontend` Docker images and pushes to GHCR (`ghcr.io/dropzoneninja/pinboard-backend`, `ghcr.io/dropzoneninja/pinboard-frontend`), multi-arch (amd64/arm64), triggered on push to `main` and on version tags
- [x] `docker-compose.yml` wired so the same file both pulls GHCR images (`image:`) for home-lab deployment and builds from source (`build:`) for local development
- [x] Verified end-to-end locally: `docker compose build` + `docker compose up -d` — postgres healthy, backend health check reachable through nginx's `/api/` proxy, frontend static build served through nginx

---

## Phase 1 — Foundation

Goal: containers run, database is reachable and migrated, a user can log in and stay logged in, one empty board exists.

### Docker & infrastructure
- [x] `postgres` service in docker-compose with named volume `postgres_data`
- [x] `backend` service builds and runs, connects to postgres
- [x] `frontend` service builds (dev mode acceptable for now)
- [x] `nginx` service: serves frontend, proxies `/api/` to backend
- [x] Health checks for postgres and backend
- [x] Restart policies (`unless-stopped` or `on-failure`) on all services
- [x] `.env.example` documents all Phase 1 variables (DB creds, JWT secrets, ports, seed users)
- [x] Confirm `git pull && docker compose up --build -d` works end-to-end on a clean checkout

### Database
- [x] Prisma installed and configured in backend — pinned to **Prisma 6.19.3** (not latest `7.x`/`8.0.0-rc`): Prisma 7 requires a new driver-adapter architecture (separate adapter package + `prisma.config.ts`) instead of the classic `datasource.url`; 6.x is the last stable release on the simpler model, which fits this project's "simplicity over complexity" goal better. Revisit if Prisma 7 stabilises and the adapter migration seems worth it.
- [x] Prisma schema: `users`, `sessions`, `boards` tables per PROJECT.md §12
- [x] Initial migration generated and applied automatically on container start (`prisma migrate deploy` runs in the backend's Docker `CMD` before the server starts)
- [x] Seed script (or startup check) to create initial two user accounts (configurable via env, not hardcoded secrets) — `backend/prisma/seed.ts`, idempotent, runs via `prisma db seed` after migrate on every container start
- [x] Seed/startup logic to create the default **Household** board on first install only (§4 "Initial board") — only when no boards exist yet

### Backend — Auth
- [x] Argon2id password hashing (hash on create, verify on login)
- [x] `POST /api/v1/auth/login` — issues access token + refresh token
- [x] `POST /api/v1/auth/logout` — revokes current session
- [x] `POST /api/v1/auth/refresh` — refresh-token rotation, reject reused/revoked tokens (reuse of a rotated token revokes the whole session — verified by test)
- [x] `GET /api/v1/auth/me`
- [x] `POST /api/v1/auth/revoke-sessions` — revoke all sessions for current user
- [x] Access tokens short-lived (15 min), refresh tokens long-lived (default 90 days, configurable via `REFRESH_TOKEN_TTL_DAYS`)
- [x] Refresh tokens stored **hashed** (HMAC-SHA256) in `sessions` table
- [x] Cookies: HTTP-only, SameSite=Lax, Secure dynamically when `req.secure` (works behind the nginx HTTPS reverse-proxy case too, via `trust proxy`)
- [x] Auth middleware enforcing login on all non-auth routes — and checks the session isn't revoked on every request (not just JWT validity), so `revoke-sessions`/logout take effect immediately rather than waiting out the access token's 15-minute lifetime
- [x] Brute-force protection on login (rate limiting: 10 attempts / 15 min / IP via `express-rate-limit`)
- [x] Session metadata captured (user_agent, ip_address, last_used_at)

### Backend — Users & session management
- [x] `GET /api/v1/users`
- [x] `GET /api/v1/users/me`
- [x] `PATCH /api/v1/users/me` (display name, author colour)
- [ ] Endpoint to list/revoke one specific session by id (only bulk "revoke all" exists today) — deferred to Phase 6 alongside the session-management Settings UI that would actually drive it; PROJECT.md §13's own endpoint list only calls out the bulk `revoke-sessions` route.

### Backend — Boards (minimal, just enough for Phase 1)
- [x] `GET /api/v1/boards`
- [x] `POST /api/v1/boards`
- [x] `GET /api/v1/boards/:id`

### Frontend
- [x] Login page (username/password form, error states)
- [x] Auth context/provider: holds current user, handles silent token refresh
- [x] Persistent login across browser restarts (cookie-based, verified via `/auth/me` on load)
- [x] Logout action
- [x] Basic app shell: top bar with app name, user identity + colour indicator, board selector
- [x] Routing skeleton (login vs. authenticated app) — react-router, `/login` + protected `/boards/:boardId`
- [x] API client/service layer (typed fetch wrapper, handles 401 → refresh → retry)

### Phase 1 exit check
- [x] Two seeded users can each log in independently
- [x] Restarting the browser keeps the session alive (verified via cookie persistence + `/auth/me`)
- [x] "Household" board exists after first boot and is fetchable via API
- [x] `docker compose down && docker compose up -d` preserves users/board (volume persistence confirmed — same user id/timestamps survived full container recreation)

---

## Phase 2 — Whiteboard Canvas

Goal: an infinite pannable/zoomable canvas with draggable, resizable sticky notes whose layout persists.

### Database
- [x] `notes` table migration per §12 (position_x/y, width, height, z_index, version, etc. as separate fields from content)
- [x] `board_views` table migration (per-user, per-board viewport_x/y, zoom_level) with unique constraint on (board_id, user_id)

### Backend
- [x] `GET /api/v1/boards/:id/notes` (layout + metadata fields only; content/title editing proper arrives Phase 3 — PATCH intentionally doesn't accept `content` yet, since that needs the sanitisation work scheduled for Phase 3)
- [x] `POST /api/v1/boards/:id/notes` (position, default size/colour, placeholder title "Untitled note")
- [x] `PATCH /api/v1/notes/:id` supporting partial updates to position/size/z_index/title/colour with **version** check — mismatch returns 409 + the latest note, verified by test
- [x] `GET /api/v1/boards/:id/view` and `PUT /api/v1/boards/:id/view` (viewport persistence)
- [x] Z-index management logic (bring-to-front / send-to-back) — implemented client-side (frontend computes max+1 / min-1 from its already-loaded notes, server just persists whatever z-index it's given); no server-side special-case needed

### Frontend — Canvas engine
- [x] Infinite canvas component (unlimited pan in all directions)
- [x] Smooth pan via middle-mouse-drag and Space+left-drag
- [x] Mouse-wheel zoom, centred on cursor position
- [x] Reset/home view control
- [x] Fit-all-notes-to-screen control
- [x] Canvas viewport (x, y, zoom) loaded from `board_views` on board open, saved (debounced 500ms) on change
- [x] Board background rendering: plain white / light grey / subtle grid / dotted paper (styles only — settings UI to *change* it comes in Phase 6)

### Frontend — Sticky notes on canvas
- [x] Render notes as absolutely-positioned elements transformed by canvas pan/zoom
- [x] Drag note by header to move (local-only state during drag — no per-frame network writes, per §19 "Important implementation detail")
- [x] Persist final position to backend on drag end
- [x] Resize handles; persist final size on resize end
- [x] Bring-to-front / send-to-back actions — small ↑/↓ buttons shown in a note's header when it's selected
- [x] Notes can overlap and be freely positioned (no default grid snapping)
- [x] Visual feedback while dragging/resizing (elevated shadow + brought-to-top visually while active)
- [x] Left-click empty canvas deselects; left-click note selects
- [x] Double-click empty canvas creates a new note centred on that position (basic placeholder note; full editor arrives Phase 3)
- [x] Toolbar: new note, new board, search (stub — shows a "coming in a later update" toast), zoom in/out, reset view, fit-all. "New board" turned out simple enough to make fully functional rather than a stub, since `POST /boards` already existed from Phase 1.

### Phase 2 exit check
- [x] Create several notes, drag/resize/reorder them, reload the page — layout is identical (verified via API: PATCH + version-conflict + re-fetch round-trips correctly)
- [x] Canvas viewport (pan/zoom) is remembered per user per board after reload (verified via API)
- [~] Dragging feels smooth with no visible network lag/jank — the drag/resize/pan code writes to local state only during movement and persists once on release, matching the no-per-frame-network-write requirement; **not independently browser-tested** (no browser-automation tool available in this session) — worth a quick manual check by actually dragging a note at `http://localhost:8080`.

---

## Phase 3 — Note Editor

Goal: clicking a note opens a floating editor with rich text, title, author/timestamp info, and robust autosave.

### Database
- [ ] Confirm `notes.content` JSONB column strategy for TipTap's JSON document format
- [ ] `content_type` field maintained (text / image / mixed / table) — decide whether computed on save or derived on read

### Backend
- [ ] `PATCH /api/v1/notes/:id` extended to accept title + content (JSONB), with version check returning 409 on conflict
- [ ] `GET /api/v1/notes/:id` returns full content, author info (created_by/updated_by resolved to display name + colour), timestamps
- [ ] Title validation: required, max 150 chars
- [ ] Server-side sanitisation of rich text HTML/JSON before persisting (XSS protection, §15)
- [ ] created_at/updated_at stored in UTC consistently

### Frontend — Editor shell
- [ ] Floating modal/pop-over editor, opens above canvas without navigation
- [ ] Sensible max width/height with internal scroll for long content
- [ ] Close button; Escape key closes editor
- [ ] Clicking outside editor does not discard unsaved changes (confirm-or-ignore, never silent loss)
- [ ] Title field prominent, editable, enforces 150-char max, required before save
- [ ] Author + created-date display; last-updated display (converted to user's local timezone, per §11)
- [ ] Delete/Archive controls in editor

### Frontend — Rich text (TipTap)
- [ ] TipTap integration with compact custom toolbar
- [ ] Marks/nodes: bold, italic, underline, strikethrough, headings, bullet list, numbered list, checklist, links, blockquote, horizontal rule, text alignment
- [ ] Keyboard shortcuts inside editor do not fight standard text-editing shortcuts (§14)

### Frontend — Autosave
- [ ] Debounced save while typing
- [ ] Immediate flush-save on editor close / switching notes
- [ ] Visible status indicator: Saving… / Saved / Unable to save
- [ ] Retry logic on failed save (don't just show the error and give up)
- [ ] Version number tracked client-side; stale-version save surfaces a conflict rather than overwriting (full resolution UX lands in Phase 5, but the plumbing starts here)

### Frontend — Sticky note front face updates
- [ ] Note front shows title, author colour indicator, last-updated date, content-type icon
- [ ] Content-type icon reflects actual note contents (text/image/mixed/table) as they're added

### Phase 3 exit check
- [ ] Create a note, type rich text, close and reopen — content persists exactly
- [ ] Autosave indicator cycles correctly through saving/saved/error states (simulate a failed save)
- [ ] Note front always shows accurate author, colour, and last-updated time

---

## Phase 4 — Content: Images & Tables

Goal: notes support inline images and formatted tables alongside rich text.

### Database
- [ ] `attachments` table migration per §12
- [ ] Upload storage directories on the persistent volume: `/data/uploads/images/`, `/data/uploads/thumbnails/`

### Backend — Images
- [ ] `POST /api/v1/notes/:id/attachments` — multipart upload handling
- [ ] File type validation (JPG/JPEG/PNG/WebP/GIF only)
- [ ] File size validation (default max 15MB, configurable via env)
- [ ] Generated (non-original) stored filenames; original filename retained as metadata
- [ ] Thumbnail generation on upload
- [ ] `GET /api/v1/attachments/:id` — serves file only to authenticated users, no arbitrary path access (defend against path traversal)
- [ ] `DELETE /api/v1/attachments/:id`
- [ ] Attachments are **not** deleted when their note is deleted — retained until the note is purged from the recycle bin (depends on Phase 6 recycle bin, but enforce the rule now: deletion is soft-delete only)
- [ ] Upload size limit configured end-to-end (backend body-parser limit, and later nginx `client_max_body_size`)

### Frontend — Images
- [ ] Image upload control inside TipTap editor (drag-drop and/or file picker)
- [ ] Inline image rendering within note content, alongside text
- [ ] Multiple images per note
- [ ] Resize images within editor, preserving aspect ratio
- [ ] Click image to view larger (lightbox/modal)

### Backend & Frontend — Tables
- [ ] TipTap table extension integrated (or equivalent lightweight table node)
- [ ] Insert table, add/delete rows, add/delete columns
- [ ] Per-cell editing with bold/italic, background colour, text alignment
- [ ] Column resizing, borders, header row toggle
- [ ] Copy/paste of table content (at least within-app; browser-native copy/paste of HTML tables as a stretch goal)
- [ ] Table structure + formatting persist correctly round-trip through JSONB content
- [ ] No formulas/functions/charts/pivot/Excel-compatibility — explicitly out of scope, don't accidentally build toward it

### Frontend — Mixed content & indicators
- [ ] Notes can contain text + images + tables together in one document
- [ ] Sticky note front shows combined content-type indicator when multiple types present
- [ ] Table indicator shown on note front when note contains a table

### Phase 4 exit check
- [ ] Upload several images into one note, confirm they persist after container restart (volume check)
- [ ] Create a table, edit cells/rows/columns, reload — formatting intact
- [ ] A single note mixing text, image, and table saves and reloads correctly
- [ ] Oversized or wrong-type file uploads are rejected with a clear error

---

## Phase 5 — Real-Time Collaboration

Goal: both users see each other's changes live, without clobbering each other's work.

### Backend — WebSocket infrastructure
- [ ] WebSocket server integrated into backend (same auth as REST — reject unauthenticated connections)
- [ ] Connection scoped/joined to board(s) currently open by that client
- [ ] Broadcast channel design: separate **board-layout events** (position/size/z-index/colour) from **note-content events** (title/body), per §19
- [ ] Nginx config updated to proxy WebSocket upgrade headers, long-lived connections

### Real-time events (per §10)
- [ ] New board created → broadcast to all connected clients
- [ ] Board renamed/settings changed → broadcast
- [ ] New note created → appears live on other user's board
- [ ] Note deleted/archived → removed live from other user's board
- [ ] Note moved → position updates live (post drag-end, not per-frame)
- [ ] Note resized → size updates live
- [ ] Note colour changed → updates live
- [ ] Note title changed → updates live
- [ ] Note content changed → updates live (consider granularity: full reload of that note vs. patch)

### Concurrency & conflict handling
- [ ] Optimistic concurrency version check enforced server-side for note content AND board/layout updates
- [ ] Stale update (version mismatch) rejected with 409, never silently applied
- [ ] Frontend: on 409 during content save, surface conflict to the user — offer "reload latest" or "keep my changes to copy/retry"
- [ ] Verify scenario: both users viewing same board — both see adds/moves live
- [ ] Verify scenario: both users creating different notes simultaneously — no collisions
- [ ] Verify scenario: one user drags a note while the other edits a different note's content — independent, no interference
- [ ] Verify scenario: both users open the *same* note and edit concurrently — conflict detected and surfaced, no silent data loss

### Presence
- [ ] Lightweight presence indicator: show which other user currently has the board open
- [ ] No chat functionality (explicitly excluded)

### Phase 5 exit check
- [ ] Two browser sessions (as each user) see each other's note moves/creates/edits without manual refresh
- [ ] Deliberately create a same-note edit conflict and confirm neither user's data is silently lost
- [ ] Kill/restart backend mid-session — clients reconnect and resync cleanly

---

## Phase 6 — Additional Features

Goal: multi-board management, search, archive, recycle bin, duplication, activity history, undo.

### Multiple boards & board management
- [ ] Board selector UI in main nav, switching active board
- [ ] Create board (name, description, background)
- [ ] Rename board, edit description
- [ ] Change board background style/colour
- [ ] Archive board / restore archived board
- [ ] Delete board → moves to recycle bin (confirmation required before this step)
- [ ] `POST /api/v1/boards/:id/archive`, `POST /api/v1/boards/:id/restore` wired end-to-end
- [ ] Both users see all boards (no per-board ACL needed, per §4)

### Search
- [ ] PostgreSQL full-text search indexing on note titles, note text content, and board names (e.g. `tsvector` + GIN index)
- [ ] `GET /api/v1/search?q=` endpoint
- [ ] Search UI (triggered by toolbar / Ctrl+F) with results list showing containing board
- [ ] Clicking a result navigates to that board and centres canvas on the note

### Archive (notes)
- [ ] Archive a note → disappears from active board
- [ ] Archive view listing archived notes (per board or global)
- [ ] Restore archived note back to its original board/position

### Recycle bin
- [ ] Soft-delete model (`deleted_at`) for both notes and boards
- [ ] `GET /api/v1/recycle-bin`
- [ ] `POST /api/v1/recycle-bin/:id/restore`
- [ ] `DELETE /api/v1/recycle-bin/:id` (permanent, confirmation required)
- [ ] Configurable retention period (default 30 days) — scheduled/cron-style purge job for expired items
- [ ] Attachments purged only when their note is permanently deleted (ties back to Phase 4 rule)

### Duplicate notes
- [ ] `POST /api/v1/notes/:id/duplicate`
- [ ] Duplicate retains title with a "copy" suffix, copies content/images/table data, offset position, attributed to the duplicating user

### Activity history
- [ ] `activity_log` table wired into note/board create/edit/move/archive/delete operations
- [ ] `GET /api/v1/boards/:id/activity`, `GET /api/v1/notes/:id/activity`
- [ ] Note editor displays created-by/at and last-updated-by/at (local timezone display, UTC storage — confirm still correct after Phase 3)

### Undo
- [ ] Client-side (or short-lived server-assisted) undo stack scoped to the current user's recent actions
- [ ] Undo covers: note movement, note resizing, note deletion, note colour change
- [ ] Undo never reverses the *other* user's changes
- [ ] Ctrl/Cmd+Z wired to undo stack; Delete key wired to delete-selected-note

### Settings UI (per §18, now that the backing features exist)
- [ ] User settings: display name, author colour, change password, session management (list + revoke sessions)
- [ ] Application settings: default note colour, default note size, autosave behaviour, recycle bin retention, date/time display prefs
- [ ] Board settings panel: rename, description, background, archive, delete

### Phase 6 exit check
- [ ] Create a second board, confirm both users see it
- [ ] Search finds a note by title and by body text, navigates and centres correctly
- [ ] Archive → restore a note; delete → restore a note from recycle bin; permanently delete and confirm it's gone
- [ ] Duplicate a note with images/table and confirm the copy is independent
- [ ] Undo a move/delete/colour-change without affecting the other user's concurrent work

---

## Phase 7 — Finalisation

Goal: production-hardened, documented, backed-up, and verified against every acceptance criterion in §21.

### Security review
- [ ] Check whether Prisma has shipped a stable (non-`rc`) `7.x`/`8.x` release yet with the `effect`/`@prisma/config` ReDoS advisories (GHSA-7589-6fvf-x4pw, GHSA-ggr8-5vv4-36mx) fixed, and upgrade off the pinned `6.19.3` if so. As of Phase 1, this only affects the `prisma` CLI's config loader (dev/build-time), not `@prisma/client` at runtime — not exploitable through the app's HTTP surface — so it was accepted rather than blocking on a major-version jump into Prisma 7's new driver-adapter architecture.
- [ ] Re-verify Argon2id usage, refresh-token hashing, HTTP-only/SameSite/Secure cookies
- [ ] CSRF protection in place where applicable — not yet implemented; cookies are `SameSite=Lax`, which blocks cross-site POSTs from most vectors, but there's no explicit CSRF token yet
- [ ] Rate limiting on auth and write-heavy endpoints
- [ ] Input validation audit on every API endpoint
- [ ] Rich text / uploaded content sanitisation audit (XSS)
- [ ] Confirm Prisma parameterisation everywhere (no raw SQL injection paths)
- [ ] File upload validation re-audit (type, size, path traversal)
- [ ] Confirm no DB credentials or secrets reach the frontend bundle
- [ ] Confirm all secrets come from environment variables, none committed to git
- [ ] Run the `security-review` skill/checklist against the full diff before calling this done

### Performance
- [ ] Canvas interaction profiling with 50+ notes on a board — confirm smooth drag/pan/zoom
- [ ] Confirm no per-frame network writes during drag/resize (re-verify §19 rule holds)
- [ ] Database query/index review for search and note-listing endpoints at realistic data volumes

### Backup & recovery
- [ ] Backup script: pg_dump + archive of uploads volume, timestamped filenames, writes to persistent backup directory
- [ ] Backup script reports failures clearly (non-zero exit, logged reason)
- [ ] Old backups are not auto-deleted unless explicitly configured (retention is opt-in)
- [ ] Documented restore procedure (step-by-step, tested at least once end-to-end)

### Error handling & resilience
- [ ] Consistent API error response shape across all endpoints
- [ ] Frontend loading/error states for every async view (boards, notes, search, settings)
- [ ] Graceful shutdown handling in backend (drain WebSocket connections, finish in-flight writes)
- [ ] Useful structured logging for troubleshooting (auth failures, upload errors, WS disconnects)

### UI refinement
- [ ] Visual pass: pastel palette, shadows, rounded corners consistent across components
- [ ] Keyboard shortcuts table (§14) fully implemented and non-conflicting with text editing
- [ ] Responsive CSS sanity check (no hardcoded dimensions that would block future mobile work), even though mobile layout itself is out of scope for v1

### Docker deployment testing
- [ ] Full clean-machine test: `git pull && docker compose up --build -d` works with zero manual steps beyond `.env` setup
- [ ] Container recreation test: data (DB + uploads) survives `docker compose down` / `up`
- [ ] Verify nginx upload size limits match backend's 15MB (or configured) max
- [ ] Verify operation behind an external HTTPS reverse proxy (secure cookies, correct forwarded headers)

### Documentation
- [ ] `.env.example` fully documents every variable used across all phases
- [ ] README covers: first-time setup, seeding initial users, backup/restore usage, upgrade workflow
- [ ] Brief architecture notes (where responsibilities live) for future-you maintaining this in a year

---

## Final Acceptance Checklist (PROJECT.md §21)

Run through literally, end to end, before calling the project done:

- [ ] 1. Two users can log in independently
- [ ] 2. Both users remain authenticated across browser restarts
- [ ] 3. Both users can access multiple shared boards
- [ ] 4. A user can create a sticky note on a board
- [ ] 5. The note displays its title and author identity
- [ ] 6. The note can be moved and resized
- [ ] 7. Its position survives application restarts
- [ ] 8. Clicking a note opens its editor
- [ ] 9. Rich text can be created and saved
- [ ] 10. Images can be uploaded and displayed
- [ ] 11. Multiple images can be included in a note
- [ ] 12. Formatted tables can be created and edited
- [ ] 13. A note can contain text, images and tables together
- [ ] 14. Changes automatically save
- [ ] 15. The other user sees changes in real time
- [ ] 16. Concurrent editing does not silently destroy data
- [ ] 17. Notes can be archived and restored
- [ ] 18. Deleted notes can be recovered
- [ ] 19. Search can locate notes across boards
- [ ] 20. Creation and modification information is accurate
- [ ] 21. Database and image data survive container recreation
- [ ] 22. Backup and restoration can be demonstrated
- [ ] 23. The complete application can be deployed using Docker Compose
