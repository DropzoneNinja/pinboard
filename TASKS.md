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
- [ ] `backend` service builds and runs, connects to postgres — *builds and runs with a working health check; does not yet connect to the database (no Prisma/schema yet — that's below)*
- [x] `frontend` service builds (dev mode acceptable for now)
- [x] `nginx` service: serves frontend, proxies `/api/` to backend
- [x] Health checks for postgres and backend
- [x] Restart policies (`unless-stopped` or `on-failure`) on all services
- [~] `.env.example` documents all Phase 1 variables (DB creds, JWT secrets, ports) — placeholders exist; will need real auth config once auth is implemented below
- [x] Confirm `git pull && docker compose up --build -d` works end-to-end on a clean checkout

### Database
- [ ] Prisma installed and configured in backend
- [ ] Prisma schema: `users`, `sessions`, `boards` tables per PROJECT.md §12
- [ ] Initial migration generated and applied automatically on container start
- [ ] Seed script (or startup check) to create initial two user accounts (configurable via env, not hardcoded secrets)
- [ ] Seed/startup logic to create the default **Household** board on first install only (§4 "Initial board")

### Backend — Auth
- [ ] Argon2id password hashing (hash on create, verify on login)
- [ ] `POST /api/v1/auth/login` — issues access token + refresh token
- [ ] `POST /api/v1/auth/logout` — revokes current session
- [ ] `POST /api/v1/auth/refresh` — refresh-token rotation, reject reused/revoked tokens
- [ ] `GET /api/v1/auth/me`
- [ ] `POST /api/v1/auth/revoke-sessions` — revoke all sessions for current user
- [ ] Access tokens short-lived (e.g. 15 min), refresh tokens long-lived (default 90 days, configurable via env)
- [ ] Refresh tokens stored **hashed** in `sessions` table
- [ ] Cookies: HTTP-only, SameSite, Secure-when-HTTPS
- [ ] Auth middleware enforcing login on all non-auth routes
- [ ] Brute-force protection on login (rate limiting / lockout backoff)
- [ ] Session metadata captured (user_agent, ip_address, last_used_at)

### Backend — Users & session management
- [ ] `GET /api/v1/users`
- [ ] `GET /api/v1/users/me`
- [ ] `PATCH /api/v1/users/me` (display name, author colour)
- [ ] Endpoint or inclusion in `/auth/me` to list active sessions for revocation UI (needed by §18 Settings later, but model it now)

### Backend — Boards (minimal, just enough for Phase 1)
- [ ] `GET /api/v1/boards`
- [ ] `POST /api/v1/boards`
- [ ] `GET /api/v1/boards/:id`

### Frontend
- [ ] Login page (username/password form, error states)
- [ ] Auth context/provider: holds current user, handles silent token refresh
- [ ] Persistent login across browser restarts (cookie-based, verified via `/auth/me` on load)
- [ ] Logout action
- [ ] Basic app shell: top bar with app name, user identity + colour indicator, placeholder board selector
- [ ] Routing skeleton (login vs. authenticated app)
- [ ] API client/service layer (typed fetch wrapper, handles 401 → refresh → retry)

### Phase 1 exit check
- [ ] Two seeded users can each log in independently
- [ ] Restarting the browser keeps the session alive
- [ ] "Household" board exists after first boot and is fetchable via API
- [ ] `docker compose down && docker compose up -d` preserves users/board (volume persistence confirmed)

---

## Phase 2 — Whiteboard Canvas

Goal: an infinite pannable/zoomable canvas with draggable, resizable sticky notes whose layout persists.

### Database
- [ ] `notes` table migration per §12 (position_x/y, width, height, z_index, version, etc. as separate fields from content)
- [ ] `board_views` table migration (per-user, per-board viewport_x/y, zoom_level) with unique constraint on (board_id, user_id)

### Backend
- [ ] `GET /api/v1/boards/:id/notes` (layout + metadata fields only is fine for this phase; content can be stubbed)
- [ ] `POST /api/v1/boards/:id/notes` (minimal: position, size, default colour, placeholder title)
- [ ] `PATCH /api/v1/notes/:id` supporting partial updates to position/size/z_index with **version** check (optimistic concurrency groundwork, even before realtime exists)
- [ ] `GET /api/v1/boards/:id/view` and `PUT /api/v1/boards/:id/view` (viewport persistence)
- [ ] Z-index management logic (bring-to-front / send-to-back increments/decrements correctly across concurrent notes)

### Frontend — Canvas engine
- [ ] Infinite canvas component (unlimited pan in all directions)
- [ ] Smooth pan via middle-mouse-drag and Space+left-drag
- [ ] Mouse-wheel zoom, centred on cursor position
- [ ] Reset/home view control
- [ ] Fit-all-notes-to-screen control
- [ ] Canvas viewport (x, y, zoom) loaded from `board_views` on board open, saved (debounced) on change
- [ ] Board background rendering: plain white / light grey / subtle grid / dotted paper (styles only — settings UI comes in Phase 6)

### Frontend — Sticky notes on canvas
- [ ] Render notes as absolutely-positioned elements transformed by canvas pan/zoom
- [ ] Drag note by header to move (local-only state during drag — no per-frame network writes, per §19 "Important implementation detail")
- [ ] Persist final position to backend on drag end
- [ ] Resize handles; persist final size on resize end
- [ ] Bring-to-front / send-to-back actions wired to z_index updates
- [ ] Notes can overlap and be freely positioned (no default grid snapping)
- [ ] Visual feedback while dragging/resizing (e.g. elevated shadow, outline)
- [ ] Left-click empty canvas deselects; left-click note selects
- [ ] Double-click empty canvas creates a new note at that position (basic note object; full editor arrives Phase 3)
- [ ] Toolbar: new note, new board (stub), search (stub), zoom in/out, reset view, fit-all

### Phase 2 exit check
- [ ] Create several notes, drag/resize/reorder them, reload the page — layout is identical
- [ ] Canvas viewport (pan/zoom) is remembered per user per board after reload
- [ ] Dragging feels smooth with no visible network lag/jank

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
- [ ] Re-verify Argon2id usage, refresh-token hashing, HTTP-only/SameSite/Secure cookies
- [ ] CSRF protection in place where applicable
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
