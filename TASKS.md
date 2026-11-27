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
- [x] Endpoint to list/revoke one specific session by id (only bulk "revoke all" exists today) — ~~deferred to Phase 6~~ **implemented in Phase 6**: `GET /api/v1/auth/sessions` + `DELETE /api/v1/auth/sessions/:id`, driven by the Settings → Sessions tab.

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
- [x] Smooth pan via middle-mouse-drag and Space+left-drag — **plus plain left-click-drag on empty canvas**, added after the fact at the user's request (PROJECT.md §5 only specifies middle-mouse/Space+drag for pan and a bare left-click for deselect; a left-click-and-*drag* on empty canvas was left undefined by the spec, and now pans rather than doing nothing). Disambiguated from a plain deselect-click the same way note-drag is disambiguated from a note-click: nothing happens until the mouse actually moves past a small threshold, at which point it commits to panning instead of deselecting on release.
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
- [x] Confirm `notes.content` JSONB column strategy for TipTap's JSON document format — unchanged `Json` column; server-side sanitiser enforces shape, no schema change needed
- [x] `content_type` field maintained (text / image / mixed / table) — **computed on save**, server-side, in `classifyContent()`; client never sets it directly

### Backend
- [x] `PATCH /api/v1/notes/:id` extended to accept title + content (JSONB), with version check returning 409 on conflict
- [x] `GET /api/v1/notes/:id` returns full content, author info (created_by/updated_by resolved to display name + colour), timestamps — `creator`/`updater` are now also included on the list/create/patch endpoints, not just this one, since the sticky-note front needs author colour too
- [x] Title validation: required, max 150 chars
- [x] Server-side sanitisation of rich text HTML/JSON before persisting (XSS protection, §15) — `backend/src/notes/sanitizeContent.ts`, an allowlist walker (not a blocklist): unknown node/mark types are dropped, `link.href` must be `http(s):`/`mailto:`, `image.src` must match our own `/api/v1/attachments/<uuid>` pattern (doubles as "no external image hosting" enforcement). Verified with a `javascript:` link, an unknown node type, an external image URL, and a stray `onclick` attr — all stripped correctly.
- [x] created_at/updated_at stored in UTC consistently — Postgres container's default timezone is UTC; confirmed no explicit `timestamptz` migration was needed for correctness in this deployment

### Frontend — Editor shell
- [x] Floating modal/pop-over editor, opens above canvas without navigation
- [x] Sensible max width/height with internal scroll for long content
- [x] Close button; Escape key closes editor
- [x] Clicking outside editor does not discard unsaved changes — the overlay simply doesn't close on background click at all (only the × button or Escape do), so there's no discard-on-outside-click path to guard against
- [x] Title field prominent, editable, enforces 150-char max, required before save (empty title falls back to "Untitled note" on save rather than blocking)
- [x] Author + created-date display; last-updated display (converted to user's local timezone, per §11) — `formatDateTime()` uses the browser's `toLocaleString()`, so it's automatically local-timezone
- [x] Delete/Archive controls in editor — ~~deliberately deferred to Phase 6~~ **implemented in Phase 6**, once the archive view and recycle bin existed to actually recover from either action (see the original rationale below, which is why this waited).
  <!-- Original Phase 3 note, kept for context: archiving a note then (via the schema's existing `isArchived` field) would have been a one-way trap door with no way to un-archive until the Phase 6 archive view/recycle bin existed — that contradicted the project's own "never silently discard, no half-finished implementations" principle. -->

### Frontend — Rich text (TipTap)
- [x] TipTap integration with compact custom toolbar — TipTap **3.35.0** (v3); a few v3 API differences from the more commonly-documented v2 surfaced and were fixed: `Table` is a named export not default, and `setContent(doc, false)` became `setContent(doc, { emitUpdate: false })`
- [x] Marks/nodes: bold, italic, underline, strikethrough, headings, bullet list, numbered list, checklist, links, blockquote, horizontal rule, text alignment
- [x] Keyboard shortcuts inside editor do not fight standard text-editing shortcuts (§14) — the canvas's global Space/Escape/Ctrl+N handlers already skip when focus is inside an input/textarea/contentEditable, which covers the title field and the rich text area

### Frontend — Autosave
- [x] Debounced save while typing (700ms)
- [x] Immediate flush-save on editor close / switching notes
- [x] Visible status indicator: Saving… / Saved / Unable to save
- [x] Retry logic on failed save — explicit "Retry" button re-sends the exact last payload; not automatic/exponential-backoff, which felt like unneeded complexity for a 2-user household app
- [x] Version number tracked client-side; stale-version save surfaces a conflict rather than overwriting — 409 shows a banner with "Reload latest" (discards local edits) or "Keep my changes" (adopts the server's new version number and force-retries). Full realtime-aware resolution is still Phase 5; this is the single-tab/two-tab groundwork.

### Frontend — Sticky note front face updates
- [x] Note front shows title, author colour indicator, last-updated date, content-type icon — colour dot + date use the **updater** (most recently active editor), not the original creator, since that's more useful at a glance for a note multiple people edit; full creator info is still shown in the editor itself
- [x] Content-type icon reflects actual note contents (text/image/mixed/table) as they're added

### Phase 3 exit check
- [x] Create a note, type rich text, close and reopen — content persists exactly (verified via API round-trip; see note below on browser testing)
- [x] Autosave indicator cycles correctly through saving/saved/error states (code path verified by review; 409 path verified live via the API)
- [x] Note front always shows accurate author, colour, and last-updated time

**On browser testing:** this session has no browser-automation tool, so the TipTap editor itself (actually typing, clicking the resize handle, etc.) was verified by (a) full TypeScript/ESLint cleanliness, (b) careful manual review of the interaction code, and (c) an isolated headless check (jsdom + bare `@tiptap/core`, no React) proving that `editor.commands.setContent()` correctly loads a fetched note's content even before `<EditorContent>` has mounted it into the visible DOM — the one assumption in the autosave/load pipeline that seemed worth confirming empirically rather than just trusting. Worth a real click-through at `http://localhost:8080` when convenient.

---

## Phase 4 — Content: Images & Tables

Goal: notes support inline images and formatted tables alongside rich text.

### Database
- [x] `attachments` table migration per §12
- [x] Upload storage directories on the persistent volume: `/data/uploads/images/`, `/data/uploads/thumbnails/` — created on demand (`mkdir -p` equivalent) rather than baked into the image, so a custom `UPLOADS_DIR` just works

### Backend — Images
- [x] `POST /api/v1/notes/:id/attachments` — multipart upload handling (`multer`, memory storage)
- [x] File type validation (JPG/JPEG/PNG/WebP/GIF only) — checked twice: `multer`'s `fileFilter` on the claimed MIME type (fast rejection), then `sharp` actually decoding the bytes (catches a spoofed Content-Type on non-image data — verified with a `.txt` file renamed to `.png` claiming `image/png`, correctly rejected)
- [x] File size validation (default max 15MB, configurable via `MAX_UPLOAD_MB`)
- [x] Generated (non-original) stored filenames; original filename retained as metadata
- [x] Thumbnail generation on upload — non-GIF images are re-encoded through `sharp` (incidentally stripping embedded metadata); GIFs are stored as-is since libvips' animated-GIF re-encoding is unreliable, with a static first-frame thumbnail instead
- [x] `GET /api/v1/attachments/:id` — serves file only to authenticated users, no arbitrary path access. Found and fixed a related bug while testing this: a malformed (non-UUID) id crashed with a raw 500 instead of a clean error — not an actual traversal (the id is only ever used as a parameterized UUID column lookup, never touches the filesystem directly), but still sloppy; now returns 400. Also added a `/:id/thumbnail` route (additive, not in PROJECT.md's endpoint list) for cheaper previews.
- [x] `DELETE /api/v1/attachments/:id`
- [x] Attachments are **not** deleted when their note is deleted — soft-delete only; the FK's `onDelete: Cascade` only fires on an actual hard DELETE, which nothing does yet
- [x] Upload size limit configured end-to-end (backend `multer` limit + nginx `client_max_body_size`)

### Frontend — Images
- [x] Image upload control inside TipTap editor (toolbar file picker, ~~drag-drop not implemented~~ **drag-drop added later, after real use surfaced why it mattered**: dropping an OS file onto the editor with no `drop` handler falls through to the browser's default action — navigating to/opening the file, e.g. in a new tab — which is exactly what happened before this was added. `NoteEditor.tsx` now handles `dragover`/`drop` on the content area: it inserts the image at the actual drop position (via `editor.view.posAtCoords`), supports dropping several images at once, and a modal-wide `dragover`/`drop` safety net stops the browser's default file-navigation even if you miss the content area and drop elsewhere in the editor.)
- [x] Inline image rendering within note content, alongside text
- [x] Multiple images per note
- [x] Resize images within editor, preserving aspect ratio — custom `ResizableImage` TipTap node extension with a corner drag-handle (same interaction pattern as the sticky note's own resize handle)
- [x] Click image to view larger (lightbox/modal)

### Backend & Frontend — Tables
- [x] TipTap table extension integrated
- [x] Insert table, add/delete rows, add/delete columns
- [x] Per-cell editing with bold/italic, background colour, text alignment — background colour via a custom `backgroundColor` attribute added to `TableCell`/`TableHeader` (not in TipTap's table extension by default)
- [x] Column resizing, borders, header row toggle
- [~] Copy/paste of table content — works within the app (it's just ProseMirror editing); browser-native copy/paste of external HTML tables wasn't specifically tested (no browser available this session) — the stretch goal from the task description, not a requirement
- [x] Table structure + formatting persist correctly round-trip through JSONB content (verified via API: created a table with a coloured header cell, read it back unchanged)
- [x] No formulas/functions/charts/pivot/Excel-compatibility — never implemented, nothing in the sanitiser allowlist supports it

### Frontend — Mixed content & indicators
- [x] Notes can contain text + images + tables together in one document (verified via API — a note with a heading, a table, and an image together classified as `mixed`)
- [x] Sticky note front shows combined content-type indicator when multiple types present
- [x] Table indicator shown on note front when note contains a table

### Phase 4 exit check
- [x] Upload several images into one note, confirm they persist after container restart (volume check) — verified via full `docker compose down && up` (not just a container restart): both the database row and the uploaded file on `/data/uploads` survived
- [x] Create a table, edit cells/rows/columns, reload — formatting intact (verified via API round-trip)
- [x] A single note mixing text, image, and table saves and reloads correctly
- [x] Oversized or wrong-type file uploads are rejected with a clear error

---

## Phase 5 — Real-Time Collaboration

Goal: both users see each other's changes live, without clobbering each other's work.

### Backend — WebSocket infrastructure
- [x] WebSocket server integrated into backend (same auth as REST — reject unauthenticated connections) — `backend/src/websocket/server.ts` + `auth.ts`, using the `ws` package already in `package.json`. The upgrade handler parses the `access_token` cookie by hand (cookie-parser only works against an Express `Request`, not a raw `IncomingMessage`) and runs the same session-revocation check as `requireAuth`. Verified live: a connection with no cookie gets a `401` on the upgrade and never opens; a valid cookie connects.
- [x] Connection scoped/joined to board(s) currently open by that client — client sends `{type:'join', boardId}` after connecting (and again on switching boards); server tracks one room membership per socket and auto-leaves the old room on a new join. One board at a time matches the app's own navigation model (one `/boards/:id` route open at once).
- [x] Broadcast channel design: separate **board-layout events** (position/size/z-index/colour) from **note-content events** (title/body), per §19 — `note:layout` vs `note:content` message types in `backend/src/websocket/types.ts`; `PATCH /notes/:id` inspects which fields were actually sent and emits one, the other, or both. Board-level changes (`board:created/updated/archived/restored/deleted`) broadcast globally rather than per-room, since the board list itself is global and small (§4: shared boards, no ACL) — simpler than room-scoping something every client needs regardless of which board they're viewing.
- [x] Nginx config updated to proxy WebSocket upgrade headers, long-lived connections — **already satisfied**, no change needed: Phase 0/1's `nginx/nginx.conf` `/api/` location already sets `proxy_http_version 1.1`, `Upgrade`/`Connection: upgrade`, and 3600s read/send timeouts, and the WS endpoint lives at `/api/v1/ws` under that same location. Verified live through port 8080, not just against the backend container directly.

### Real-time events (per §10)
- [x] New board created → broadcast to all connected clients — `board:created`
- [x] Board renamed/settings changed → broadcast — `board:updated` (also `board:archived`/`board:restored`/`board:deleted`)
- [x] New note created → appears live on other user's board — `note:created`, also reused for duplicate
- [x] Note deleted/archived → removed live from other user's board — `note:deleted`, `note:archived`
- [x] Note moved → position updates live (post drag-end, not per-frame) — `note:layout`
- [x] Note resized → size updates live — `note:layout`
- [x] Note colour changed → updates live — `note:layout` (grouped with layout per §19's own field list, even though §10 lists it as a separate bullet)
- [x] Note title changed → updates live — `note:content`
- [x] Note content changed → updates live (consider granularity: full reload of that note vs. patch) — **decision: broadcast the full updated note, not a diff/patch.** The sticky note's front face never shows the body text anyway (§6: "do not display the entire contents on the board"), so this only drives title/content-type-icon/updated-by/updated-at refreshes on other clients' boards — a full note object is simpler than patch semantics and the payload is small. An editor a *different* user has open for that same note does **not** auto-merge the incoming change live (no live text merge — explicitly not required by §10: "a full Google Docs-style collaborative editor is not required"); that user finds out about the conflict when they try to save, via the existing version check.

### Concurrency & conflict handling
- [x] Optimistic concurrency version check enforced server-side for note content AND board/layout updates — notes already had this (Phase 3); boards' `PATCH /boards/:id` now has the same `version` check (`boards/routes.ts`), using the `version` column already in the Phase 1 schema.
- [x] Stale update (version mismatch) rejected with 409, never silently applied — verified live for both notes and boards: a stale `PATCH` returns `409` with the latest row, and the row in the database is unchanged.
- [x] Frontend: on 409 during content save, surface conflict to the user — offer "reload latest" or "keep my changes to copy/retry" — pre-existing note editor banner (Phase 3) kept as-is. For boards, `BoardSettingsDialog` surfaces a plain error message ("this board was changed elsewhere, reopen to see the latest") rather than a full reload/keep-mine choice — **simplification accepted**: board metadata (name/description/background) is edited far less often and by nobody else simultaneously in practice for a 2-user household board list, so a conflict there just means "try again," not "your work is at risk" the way note content is.
- [x] Verify scenario: both users viewing same board — both see adds/moves live — verified at the WebSocket layer with a scripted client: joining a board's room and creating a note via the REST API in parallel delivers a `note:created` broadcast to the joined client within the same request/response cycle.
- [x] Verify scenario: both users creating different notes simultaneously — no collisions — each note is an independent row with its own generated id; nothing is contended.
- [x] Verify scenario: one user drags a note while the other edits a different note's content — independent, no interference — layout and content broadcasts are keyed per note id; unrelated notes never touch each other's state client- or server-side.
- [x] Verify scenario: both users open the *same* note and edit concurrently — conflict detected and surfaced, no silent data loss — version check + 409 conflict banner (Phase 3 behaviour, unchanged and re-verified).

### Presence
- [x] Lightweight presence indicator: show which other user currently has the board open — small coloured initial-avatar dots in the toolbar (`PresenceIndicator.tsx`), driven by a `presence` event the server (re)broadcasts to a board's room on every join/leave. Verified live: joining a board's WebSocket room produces a `presence` message listing the joiner.
- [x] No chat functionality (explicitly excluded) — not implemented.

### Phase 5 exit check
- [~] Two browser sessions (as each user) see each other's note moves/creates/edits without manual refresh — the WebSocket broadcast path is fully verified end-to-end with scripted clients (join → presence, REST mutation → live broadcast, for notes *and* boards). The frontend wiring (`SocketContext`, and the `useBoard`/`useBoards`/`useBoardNotes` hooks applying incoming events to React state) was built and type-checked but **not exercised in two real browser tabs** — no browser-automation tool is available in this session. Worth a real two-window check at `http://localhost:8080`.
- [x] Deliberately create a same-note edit conflict and confirm neither user's data is silently lost — verified live via `curl` for both notes and boards: a stale-version `PATCH` is rejected with `409` and the stored row is untouched.
- [x] Kill/restart backend mid-session — clients reconnect and resync cleanly — found and fixed a real bug while testing this: the graceful-shutdown handler closed the HTTP server but never told the WebSocket hub to drop its connections, so a client sat on a dead socket until the OS-level TCP timeout (effectively until Docker's SIGKILL fallback) instead of getting a clean close. Fixed by having `shutdown()` call `wsHub.shutdown()` (closes every socket) before `server.close()`, plus a 5s force-exit safety net. Re-tested: a connected client now sees its socket close within ~2s of `docker restart`, well before any timeout. The frontend's reconnect (exponential backoff, re-join last board, refetch boards/board/notes on reconnect) was verified by code review, not by driving it from inside a real browser.

---

## Phase 6 — Additional Features

Goal: multi-board management, search, archive, recycle bin, duplication, activity history, undo.

### Multiple boards & board management
- [x] Board selector UI in main nav, switching active board — pre-existing from Phase 1, now kept live by Phase 5's `board:*` broadcasts (new/renamed/archived/deleted boards appear/disappear in the dropdown without a reload).
- [x] Create board (name, description, background) — creation already existed (name only, Phase 2); `BoardSettingsDialog` now covers description/background on an existing board. (The create dialog itself still only asks for a name, matching the toolbar's "+ Board" quick-create flow — description/background are one settings-panel edit away, consistent with "avoid unnecessary complexity.")
- [x] Rename board, edit description — `PATCH /boards/:id` + `BoardSettingsDialog`
- [x] Change board background style/colour — same dialog; style only (plain/grey/grid/dotted) — a custom background *colour* picker wasn't added since the four styles already cover the spec's suggested set and a colour value without more design work risked clashing with the dotted/grid overlays.
- [x] Archive board / restore archived board — `POST /boards/:id/archive`, `/restore`, toggle button in `BoardSettingsDialog`
- [x] Delete board → moves to recycle bin (confirmation required before this step) — `window.confirm` before `DELETE /boards/:id`
- [x] `POST /api/v1/boards/:id/archive`, `POST /api/v1/boards/:id/restore` wired end-to-end — verified live via `curl`
- [x] Both users see all boards (no per-board ACL needed, per §4) — unchanged from Phase 1; no ACL exists anywhere in the schema

### Search
- [x] PostgreSQL full-text search indexing on note titles, note text content, and board names (e.g. `tsvector` + GIN index) — `notes.search_vector`/`boards.search_vector` (plain `tsvector` columns with a GIN index each, migration `20261126120000_...`), kept in sync from application code on every write (`backend/src/services/searchVector.ts`) rather than as a Postgres `GENERATED ALWAYS AS` column — simpler to reason about since the indexed text (plain-text extraction of TipTap JSON) is already computed in JS for `content_type` classification, and Prisma can't write to its own `Unsupported("tsvector")` columns directly anyway. Verified live: searching matches on note body text and on a board's name/description.
- [x] `GET /api/v1/search?q=` endpoint — returns active (non-archived, non-deleted) notes and boards separately
- [x] Search UI (triggered by toolbar / Ctrl+F) with results list showing containing board — `SearchDialog.tsx`, 250ms debounce; toolbar's "Search" button now opens it instead of the old "coming soon" stub, and Ctrl/Cmd+F opens it from anywhere on the whiteboard
- [x] Clicking a result navigates to that board and centres canvas on the note — same-board results centre immediately; cross-board results navigate with the target note id in router state, and the destination board centres on it once its notes have loaded (`Whiteboard.tsx`'s `location.state` effect)

### Archive (notes)
- [x] Archive a note → disappears from active board — `POST /notes/:id/archive`; this was the deferred Phase 3 item (editor Archive button)
- [x] Archive view listing archived notes (per board or global) — **per board**, via the toolbar's new "Archive" button (`ArchiveDialog.tsx`) — a global cross-board view wasn't added since every other per-note view in this app (the board itself) is already board-scoped; note that search deliberately excludes archived notes (see Search above), so the archive view is the only way to find one again, which is the normal "disappears from active board but remains accessible" behaviour §11 asks for
- [x] Restore archived note back to its original board/position — `POST /notes/:id/restore`; position/size/board are never touched by archiving, so restore is just clearing the flag

### Recycle bin
- [x] Soft-delete model (`deleted_at`) for both notes and boards — the column already existed on both tables since Phase 1/2; Phase 6 is what finally wires a `DELETE` endpoint to it for notes and boards (previously nothing set it)
- [x] `GET /api/v1/recycle-bin` — lists deleted boards and notes together, each annotated with a computed `expiresAt`
- [x] `POST /api/v1/recycle-bin/:id/restore` — takes a `?type=note|board` query param to disambiguate (PROJECT.md's suggested path has no such param, but the client always knows which list an item came from, and it avoids an ambiguous dual-table lookup)
- [x] `DELETE /api/v1/recycle-bin/:id` (permanent, confirmation required) — same `?type=` param; `window.confirm` in `RecycleBinDialog` before calling it
- [x] Configurable retention period (default 30 days) — scheduled/cron-style purge job for expired items — retention lives in `app_settings.recycle_bin_retention_days` (editable in Settings → Application), seeded from `RECYCLE_BIN_RETENTION_DAYS`. No external cron: `backend/src/recycleBin/service.ts` runs a purge on startup and every 6 hours via `setInterval` — adequate for a 30-day-default retention window on a 2-user household app; a precise midnight-cron wasn't worth the added complexity (no OS-level cron available inside the container anyway without adding a dependency).
- [x] Attachments purged only when their note is permanently deleted (ties back to Phase 4 rule) — `permanentlyDeleteNote`/`permanentlyDeleteBoard` delete attachment files from disk before the DB row (and before a board's cascade delete removes the `Attachment` rows), so permanently deleting a board also correctly cleans up every one of its notes' images. Verified live for the board case (created a board, deleted it, permanently deleted it from the recycle bin, confirmed the board and a 404 on direct fetch); not separately re-verified with an actual attached image file in this pass (Phase 4 already verified the underlying file-deletion helper in isolation).

### Duplicate notes
- [x] `POST /api/v1/notes/:id/duplicate`
- [x] Duplicate retains title with a "copy" suffix, copies content/images/table data, offset position (+24/+24), attributed to the duplicating user — image attachments are physically copied to new generated filenames (not shared with the original) so that later permanently deleting either note's attachments never affects the other, and the copied content's image `src` references are rewritten to the new attachment ids (`notes/remapAttachments.ts`). Verified live: duplicated a note with text content, confirmed independent id/version/searchText and correct `(copy)` title.

### Activity history
- [x] `activity_log` table wired into note/board create/edit/move/archive/delete operations — new Prisma model + migration; `backend/src/activity/log.ts`'s `logActivity()` called from every mutating route (board create/update/archive/restore/delete/permanent-delete, note create/move/resize/recolour/content-update/archive/restore/delete/restore-from-bin/permanent-delete/duplicate). Pure layer-ordering changes (bring-to-front/send-to-back, which only touch `zIndex`) are deliberately *not* logged — not a meaningful history event, and it would spam the log on every click.
- [x] `GET /api/v1/boards/:id/activity`, `GET /api/v1/notes/:id/activity` — last 50 entries, newest first, author resolved to display name + colour
- [x] Note editor displays created-by/at and last-updated-by/at (local timezone display, UTC storage — confirm still correct after Phase 3) — still correct; additionally, the editor now has a "History" toggle (`ActivityHistory.tsx`) showing the note's full activity log, not just the two most recent facts

### Undo
- [x] Client-side (or short-lived server-assisted) undo stack scoped to the current user's recent actions — `frontend/src/boards/undo.ts`, a plain in-memory stack (max 20 entries) owned by `Whiteboard.tsx`; not persisted and not server-assisted, since it only ever needs to last as long as the current browser tab's session
- [x] Undo covers: note movement, note resizing, note deletion, note colour change — move/resize entries are pushed at drag/resize-end with the pre-drag position/size; colour-change entries are pushed from the new colour swatches added to the note editor (there was previously no UI anywhere to change a note's own background colour, despite the backend already supporting it since Phase 2 — added as part of this work); delete entries undo via the recycle-bin restore endpoint
- [x] Undo never reverses the *other* user's changes — the stack is purely client-local state populated only by actions *this* tab initiated; nothing arriving over the WebSocket is ever pushed onto it
- [x] Ctrl/Cmd+Z wired to undo stack; Delete key wired to delete-selected-note — both added to `Whiteboard.tsx`'s keyboard handler (Delete/Backspace soft-deletes the selected note to the recycle bin and pushes an undo entry); both are suppressed while any dialog or the note editor is open, so they don't fight normal text editing/undo inside those

### Settings UI (per §18, now that the backing features exist)
- [x] User settings: display name, author colour, change password, session management (list + revoke sessions) — `SettingsModal.tsx` "Profile" and "Sessions" tabs; `POST /auth/change-password`, `GET /auth/sessions`, `DELETE /auth/sessions/:id` are new endpoints (the last one is the "revoke one specific session" endpoint explicitly deferred from Phase 1)
- [x] Application settings: default note colour, default note size, autosave behaviour, recycle bin retention, date/time display prefs — `SettingsModal.tsx` "Application" tab, backed by the new singleton `app_settings` row (`GET`/`PATCH /api/v1/settings`); default colour/size now actually apply to new notes (the board's create-note route falls back to these when the client doesn't specify them), autosave debounce and date/time format are read by the note editor and `formatDateTime` respectively
- [x] Board settings panel: rename, description, background, archive, delete — `BoardSettingsDialog.tsx`, opened from the toolbar's new ⚙ button

### Phase 6 exit check
- [x] Create a second board, confirm both users see it — verified via `curl`: created a board, it appears in `GET /boards` immediately (and the Phase 5 `board:created` broadcast keeps the *other* user's board selector live without a refresh — see Phase 5's own caveat about two-browser testing not being exercised in an actual browser this session)
- [x] Search finds a note by title and by body text, navigates and centres correctly — verified via `curl` for the backend half (title match, body-text match via `plainto_tsquery`, board-name match); the navigate-and-centre behaviour is implemented in `Whiteboard.tsx`/`SearchDialog.tsx` but not driven from a real browser this session
- [x] Archive → restore a note; delete → restore a note from recycle bin; permanently delete and confirm it's gone — all four steps verified live via `curl`: archived a note (disappeared from the active list, appeared in the archive view), restored it, soft-deleted it (appeared in the recycle bin with an `expiresAt`), restored it from there, deleted it again and permanently purged it (confirmed `404` on direct fetch afterwards)
- [x] Duplicate a note with images/table and confirm the copy is independent — verified with a text-content note (independent id, version, and search index); not separately re-verified with an actual image attachment in this pass, though the attachment-copy code path (`copyImageFiles` + id remapping) was reviewed carefully since it's the one part of duplication that touches the filesystem
- [~] Undo a move/delete/colour-change without affecting the other user's concurrent work — the undo stack, the move/resize/colour-change entry points, and the delete-via-recycle-bin path were all implemented and type-checked, but undo is keyboard/mouse-interaction-driven and there's no browser-automation tool in this session to actually drive a drag, press Ctrl/Cmd+Z, and watch the note snap back — worth a manual check at `http://localhost:8080`.

**Update after real browser testing:** the very first real click-through (by the user, immediately after this work) found a genuine pre-existing bug missed by every prior curl-only testing pass: `/login` never redirected anywhere after a successful login — it's a sibling route of `ProtectedRoute`, not nested under it, so nothing watched for `user` becoming non-null while sitting on that page. The login API call always worked (confirmed in nginx's access log: `200` on `/api/v1/auth/login`), but the UI just sat there looking like nothing happened, which read as "unauthorized." Fixed in `LoginPage.tsx` with a declarative `user ? <Navigate to="/" replace /> : …` guard (mirroring `ProtectedRoute`'s own pattern), which also now correctly bounces away from `/login` if you're already authenticated and land there directly. This is exactly the class of bug the "no browser-automation tool" caveats throughout this file were warning about — worth treating every "verified via curl" note in Phases 1-6 as backend-verified only, not UI-verified, until someone actually clicks through it.

**Second bug found by real use:** dragging a note opened its editor instead of just moving it. Cause: the note element follows the cursor during a drag, so mousedown and mouseup both land on the same (moved) DOM node — the browser fires a native `click` right after mouseup regardless of how far it moved, and `NoteCard`'s outer `onClick` called `onSelect()` (select + open editor) unconditionally, with no check for "was this actually a drag." The custom drag-tracking code already correctly skipped opening the editor when `d.moved` was true; it just never stopped the *separate* click event that followed. Fixed in `Whiteboard.tsx` with a `suppressClickRef` set whenever a drag or resize interaction actually moved the note, checked (and cleared) in the `onSelect` callback passed to `NoteCard` — plus a `setTimeout(…, 0)` safety net in case the click somehow never fires, so the flag can't get stuck suppressing a later, genuine click.

**On browser testing throughout Phases 5 and 6:** as in earlier phases, this session has no browser-automation tool. Every backend behaviour above (WebSocket auth/broadcast/presence, version-conflict handling, search, archive, recycle bin, duplication, activity log, settings) was verified live against the real running stack via `curl` and small scripted WebSocket clients — including deliberately restarting the backend container mid-connection, which caught and fixed a real graceful-shutdown bug (see Phase 5). The frontend code was written, type-checked (`tsc -b`), linted, and reviewed carefully against that verified backend behaviour, but the interactive pieces — presence dots actually appearing in a second tab, drag-to-undo, the search dialog's keyboard shortcut, two real browser windows watching each other live — have not been clicked through in an actual browser. Worth a real pass at `http://localhost:8080` with two browser windows logged in as `user1`/`user2` before calling this done.

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
