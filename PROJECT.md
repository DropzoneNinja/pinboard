# PROJECT.md — Shared Household Whiteboard

## 1. Project Overview

Build a private, self-hosted household whiteboard application that allows two users (initially husband and wife) to create, organise, edit and share persistent notes on multiple virtual whiteboards.

The application should feel like a physical noticeboard covered in colourful Post-it notes rather than a conventional notes management application.

Users can:
- Create multiple independent whiteboards.
- Create, edit, move, resize and delete sticky notes.
- Open notes to view and edit their contents.
- Add formatted text, images and formatted tables.
- See who authored each note.
- See when notes were created and last updated.
- Collaborate in real time.
- Access their boards and notes from different desktop computers and browsers.

All information must be stored persistently in PostgreSQL, with uploaded images stored on a persistent Docker volume.

This is a long-term household application. Data persistence, reliability, simplicity and ease of use are more important than introducing unnecessary complexity.

## 2. Technology Stack

Use the following technology stack.

| Component | Technology |
|---|---|
| Frontend | React |
| Language | TypeScript |
| Backend | Node.js + TypeScript |
| API | REST |
| Real-time communication | WebSockets |
| Database | PostgreSQL |
| Database access | Prisma ORM |
| Web server | Nginx |
| Deployment | Docker Compose |
| Authentication | Local username/password |
| Password hashing | Argon2id |
| Rich text editor | TipTap |
| Image storage | Local filesystem / Docker volume |

### Architecture requirements

- Entire application must run using Docker Compose.
- No Kubernetes.
- No external cloud services.
- No dependency on third-party authentication providers.
- No externally hosted database.
- No external image hosting.
- No requirement for paid APIs or subscriptions.
- All application data must remain within the home-lab environment.

Use a modular architecture with clearly separated frontend, backend, database and file-storage responsibilities.

Suggested project structure:

```text
household-whiteboard/
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   ├── boards/
│   │   ├── notes/
│   │   ├── editor/
│   │   ├── spreadsheet/
│   │   ├── hooks/
│   │   ├── services/
│   │   ├── contexts/
│   │   └── styles/
│   └── Dockerfile
│
├── backend/
│   ├── src/
│   │   ├── api/
│   │   ├── auth/
│   │   ├── boards/
│   │   ├── notes/
│   │   ├── attachments/
│   │   ├── spreadsheet/
│   │   ├── websocket/
│   │   ├── database/
│   │   └── services/
│   └── Dockerfile
│
├── nginx/
│   └── nginx.conf
│
├── docker-compose.yml
├── .env.example
├── .gitignore
└── PROJECT.md
```

Claude may adjust the internal structure where technically appropriate, but must preserve the separation of responsibilities.

## 3. User Accounts and Authentication

### Users

Initially support two individual user accounts.

Each user has:
- Unique username.
- Password.
- Display name.
- Assigned author colour.
- Account creation date.
- Last login date.

The system must support adding additional users in the future without requiring database restructuring.

### Authentication

Implement local username/password authentication.

Requirements:
- Passwords hashed using Argon2id.
- Secure login and logout.
- Long-lived persistent login sessions.
- Access tokens with short expiry.
- Refresh tokens with a configurable long lifetime (default 90 days).
- Refresh-token rotation.
- Refresh tokens stored hashed in the database.
- Ability to revoke individual sessions.
- Ability to revoke all sessions for a user.
- Secure, HTTP-only, SameSite cookies.
- Secure cookies when accessed through HTTPS.
- Protection against brute-force login attempts.
- Authentication required for all boards, notes and attachments.

The user should not need to log in every time they open the application.

Include a session management mechanism so compromised or unwanted sessions can be revoked.

### Author identification

Each user must have a distinctive author colour.

Suggested defaults:

- User 1: Blue.
- User 2: Purple.

Colours must be configurable in user settings.

The author colour is independent of the sticky note's background colour.

## 4. Application Navigation

The application consists of multiple independent whiteboards.

### Main interface

The primary interface should provide:

- Application name/logo.
- Board selector.
- Currently selected board.
- User identity and colour indicator.
- Account/settings access.
- Create board button.
- Search access.

### Board management

Users can:
- Create a board.
- Rename a board.
- Change its description.
- Change its background.
- Archive a board.
- Restore an archived board.
- Delete a board.

Both users have access to all boards.

Boards must be persistent and shared.

Deleting a board must require confirmation. Board deletion should move it to the recycle bin before permanent removal.

### Initial board

On first installation, create an initial board called:

**Household**

This provides an immediately usable starting point.

Do not automatically create additional boards.

## 5. Whiteboard Interface

The whiteboard is the central feature of the application.

It should resemble a physical noticeboard with Post-it notes placed freely across a large workspace.

### Canvas

Implement an infinite canvas.

Requirements:

- Unlimited horizontal and vertical working area.
- Smooth panning.
- Mouse-wheel zoom.
- Zoom centred around the mouse pointer.
- Drag-and-drop sticky notes.
- Notes can overlap.
- Notes can be freely positioned.
- Notes can be resized.
- Notes can be brought to the foreground.
- Notes can be sent to the background.
- Canvas position and zoom are persisted independently for each user and board.
- A reset/home view control.
- A fit-all-notes-to-screen control.

The canvas must maintain its spatial layout when the application is closed and reopened.

### Canvas interaction

Mouse interaction:

- Left-click empty canvas: deselect.
- Left-click a note: select/open note.
- Drag a note by its header: move note.
- Drag resize handles: resize note.
- Middle mouse button or Space + left mouse drag: pan canvas.
- Mouse wheel: zoom.
- Double-click empty canvas: optionally create a new note at that position.

Provide clear visual feedback when moving or resizing notes.

Do not snap notes to a grid by default.

### Toolbar

Provide a compact toolbar with:

- New note.
- New board.
- Search.
- Zoom in.
- Zoom out.
- Reset view.
- Fit all notes.
- Optional board settings.

The toolbar should not consume excessive screen space.

### Board background

Use a clean, light background by default.

Allow the board background to be changed in board settings.

Possible background styles:
- Plain white.
- Light grey.
- Subtle grid.
- Dotted paper.

Avoid visually distracting backgrounds.

## 6. Sticky Notes

Sticky notes are the primary content objects.

### Appearance

Each sticky note should look like a physical Post-it note.

Each note displays on its front:

- Note title.
- Author indicator.
- Last updated date.
- Small content-type indicators where appropriate.

The author indicator must use the author's assigned colour.

Use a subtle shadow and slight visual depth to give notes a physical appearance.

Avoid excessive decorative effects.

### Sticky note colours

Users can select a note background colour independently of the author.

Suggested palette:

- Yellow.
- Pale blue.
- Pink.
- Green.
- Orange.
- Purple.
- White.
- Light grey.

Colours should be soft pastel shades suitable for extended viewing.

Provide a colour selector when creating or editing a note.

### Note operations

Each note supports:

- Create.
- Open.
- Edit.
- Move.
- Resize.
- Change colour.
- Duplicate.
- Bring to front.
- Send to back.
- Archive.
- Delete.

### Note creation

When creating a note:

1. Create the note at the selected canvas position.
2. Open the note editor automatically.
3. Allow the user to enter a title and contents.
4. Save automatically.

A note must have a title.

### Note display

The note front should remain visually simple.

Do not display the entire contents on the board.

The title should be clearly readable, even when the note is relatively small.

Show a small icon indicating the content type:

- Text.
- Image.
- Mixed content.
- Table.

If a note contains multiple content types, show appropriate indicators.

## 7. Note Editor

Clicking a sticky note opens a floating editor window.

The editor should appear above the whiteboard without navigating away from it.

### Editor behaviour

- Display the note title prominently.
- Display author and creation information.
- Display last updated information.
- Allow editing the title.
- Allow editing the note contents.
- Save automatically.
- Close button.
- Delete/archive controls.
- Support multiple content types.

The editor should have a sensible maximum width and height, with internal scrolling for longer content.

On desktop, it should behave like a modal pop-over window.

Clicking outside the editor should not accidentally discard changes.

### Title

The title is mandatory.

The title appears on the front of the sticky note.

Allow a reasonable title length (maximum 150 characters).

### Rich text content

Use TipTap for rich text editing.

Support:

- Plain text.
- Bold.
- Italic.
- Underline.
- Strikethrough.
- Headings.
- Bulleted lists.
- Numbered lists.
- Checklists.
- Hyperlinks.
- Blockquotes.
- Horizontal separators.
- Basic text alignment.

Keep the editing toolbar compact.

Do not attempt to recreate a full word processor.

### Auto-save

All changes must be automatically saved.

Requirements:

- Debounced saving while typing.
- Immediate saving when closing the editor or switching notes.
- Visible save status.
- Saving indicator.
- Saved indicator.
- Error indicator if saving fails.
- Retry failed saves.
- Never silently discard unsaved changes.

Display a subtle status such as:

- Saving...
- Saved.
- Unable to save.

## 8. Images and Attachments

Notes must support uploaded images.

### Image functionality

- Upload images from the local computer.
- Support multiple images in a single note.
- Display images inline within the note.
- Resize images within the editor.
- Preserve image aspect ratios.
- Click images to view them at a larger size.
- Support common formats: JPG, JPEG, PNG, WebP and GIF.

Allow images to appear alongside text.

### Image storage

Store uploaded images on the server's persistent filesystem volume.

Suggested structure:

```text
/data/
├── uploads/
│   ├── images/
│   └── thumbnails/
└── backups/
```

Requirements:

- Images must survive container recreation.
- Store attachment metadata in PostgreSQL.
- Use generated filenames rather than original filenames.
- Validate file types and file sizes.
- Default maximum upload size: 15 MB per image.
- Generate thumbnails where useful.
- Serve files only through authenticated application routes.
- Prevent users from accessing arbitrary filesystem paths.

The original filename may be retained as metadata.

Deleting a note should not immediately remove its attachments. Retain them until the note is permanently deleted from the recycle bin.

## 9. Formatted Tables / Simple Spreadsheet

Support formatted tables within notes.

This is intended for household information such as:

- Shopping lists.
- Inventories.
- Expense breakdowns.
- Measurements.
- Lists of items.
- Comparisons.

This is NOT intended to be a replacement for Microsoft Excel.

### Table functionality

Support:

- Insert table.
- Add rows.
- Delete rows.
- Add columns.
- Delete columns.
- Edit individual cells.
- Bold text.
- Italic text.
- Cell background colours.
- Text alignment.
- Basic column resizing.
- Table borders.
- Header rows.
- Copy and paste table content.

Tables must be editable within the note editor.

### Spreadsheet behaviour

Use a lightweight editable table implementation.

Do not implement:
- Formula calculations.
- Complex spreadsheet functions.
- Charts.
- Pivot tables.
- Excel file compatibility.

A simple formatted table is sufficient.

Tables must persist their structure and formatting.

### Display

Tables should display neatly within the note editor.

If a note contains a table, show a small table indicator on its sticky note.

## 10. Real-Time Collaboration

Both users should be able to use the application simultaneously.

Implement WebSocket-based real-time communication.

### Real-time events

Synchronise:

- New boards.
- Board changes.
- New notes.
- Note deletion.
- Note movement.
- Note resizing.
- Note colour changes.
- Note title changes.
- Note content changes.
- Archive operations.

When one user moves a note, the other user should see the updated position without refreshing.

When one user creates a note, it should appear on the other user's board automatically.

### Concurrent editing

Support the following scenarios:

- Both users viewing the same board.
- Both users creating different notes.
- One user moving a note while the other edits a different note.
- Both users editing different notes.

Prevent stale updates from silently overwriting newer changes.

Use optimistic concurrency/version checking for note content and board data.

If both users edit the same note simultaneously:

- Detect the conflict.
- Do not silently discard either user's changes.
- Notify the affected user.
- Provide a way to reload the latest version or preserve their unsaved content.

A full Google Docs-style collaborative editor is not required.

### Presence

Optionally display a small indicator showing which other user is currently viewing the board.

Do not implement unnecessary chat functionality.

## 11. Additional Features

Include the following features because they improve the long-term usefulness of the application.

### Search

Provide a global search function.

Search across:
- Note titles.
- Note text content.
- Board names.

Search results should identify the board containing the note.

Clicking a result should navigate to the relevant board and centre the canvas on the note.

Implement appropriate PostgreSQL search indexing.

### Archive

Allow users to archive individual notes.

Archived notes disappear from the active board but remain accessible through an archive view.

Allow archived notes to be restored to their original board.

### Recycle bin

Deleted notes and boards should initially move to a recycle bin.

Allow restoration.

Permanent deletion must require confirmation.

Provide a configurable retention period, defaulting to 30 days.

### Duplicate notes

Allow a user to duplicate a note.

The duplicated note should:
- Retain the original title with a copy suffix.
- Copy its content.
- Copy images and table data.
- Be placed slightly offset from the original.
- Be attributed to the user performing the duplication.

### Activity information

Every note should display:

- Created by.
- Created date/time.
- Last updated by.
- Last updated date/time.

Dates should use the user's local timezone.

Store timestamps in UTC.

Maintain a lightweight activity history for note creation, editing, moving, archiving and deletion.

### Undo

Provide a basic undo function for recent board operations, especially:

- Note movement.
- Note resizing.
- Note deletion.
- Note colour changes.

Undo should not reverse unrelated changes made by the other user.

## 12. Database Design

Use PostgreSQL.

Use Prisma ORM and database migrations.

Suggested entities:

### users

- id (UUID, primary key)
- username (unique)
- password_hash
- display_name
- author_colour
- created_at
- updated_at
- last_login_at
- is_active

### sessions

- id (UUID, primary key)
- user_id (foreign key)
- refresh_token_hash
- expires_at
- created_at
- last_used_at
- revoked_at
- user_agent
- ip_address

### boards

- id (UUID, primary key)
- name
- description
- background_style
- background_colour
- created_by
- created_at
- updated_at
- is_archived
- deleted_at
- version

### board_views

Stores individual user canvas preferences.

- id (UUID, primary key)
- board_id (foreign key)
- user_id (foreign key)
- viewport_x
- viewport_y
- zoom_level
- updated_at

Unique constraint on board_id + user_id.

### notes

- id (UUID, primary key)
- board_id (foreign key)
- title
- content (JSONB)
- content_type
- background_colour
- position_x
- position_y
- width
- height
- z_index
- created_by
- updated_by
- created_at
- updated_at
- is_archived
- deleted_at
- version

Store rich text and formatted table structures in JSONB.

Keep position and size data as separate database fields so layout updates do not overwrite note contents.

### attachments

- id (UUID, primary key)
- note_id (foreign key)
- original_filename
- stored_filename
- mime_type
- file_size
- width
- height
- created_at
- uploaded_by

### activity_log

- id (UUID, primary key)
- user_id (foreign key)
- board_id (foreign key)
- note_id (nullable foreign key)
- action
- metadata (JSONB)
- created_at

Use appropriate indexes and foreign-key constraints.

Implement database migrations from the beginning.

## 13. API Design

Create a REST API under:

`/api/v1/`

Suggested endpoints:

### Authentication

```text
POST   /auth/login
POST   /auth/logout
POST   /auth/refresh
GET    /auth/me
POST   /auth/revoke-sessions
```

### Users

```text
GET    /users
GET    /users/me
PATCH  /users/me
```

### Boards

```text
GET    /boards
POST   /boards
GET    /boards/:id
PATCH  /boards/:id
DELETE /boards/:id
POST   /boards/:id/archive
POST   /boards/:id/restore
```

### Board views

```text
GET    /boards/:id/view
PUT    /boards/:id/view
```

### Notes

```text
GET    /boards/:id/notes
POST   /boards/:id/notes
GET    /notes/:id
PATCH  /notes/:id
DELETE /notes/:id
POST   /notes/:id/duplicate
POST   /notes/:id/archive
POST   /notes/:id/restore
```

### Attachments

```text
POST   /notes/:id/attachments
GET    /attachments/:id
DELETE /attachments/:id
```

### Search

```text
GET    /search?q=search-term
```

### Recycle bin

```text
GET    /recycle-bin
POST   /recycle-bin/:id/restore
DELETE /recycle-bin/:id
```

### Activity

```text
GET    /boards/:id/activity
GET    /notes/:id/activity
```

All endpoints must enforce authentication and authorisation.

Use consistent API response structures and proper HTTP status codes.

## 14. Frontend Design

### Design philosophy

The application should feel:

- Friendly.
- Simple.
- Relaxed.
- Visual.
- Uncluttered.
- Practical.

The whiteboard is the main focus.

Avoid conventional enterprise dashboard styling.

Use a clean modern interface with subtle shadows, rounded corners and pastel colours.

### Desktop-first design

The initial release is specifically designed for desktop computers.

Prioritise:
- Large desktop screens.
- Mouse interaction.
- Keyboard shortcuts.
- Efficient canvas navigation.
- Multiple open windows where appropriate.

Do not spend development time implementing a dedicated mobile interface in version 1.

However, use responsive CSS and avoid hardcoding dimensions in ways that would prevent future mobile support.

### Keyboard shortcuts

Implement useful shortcuts:

| Shortcut | Action |
|---|---|
| Ctrl/Cmd + N | New note |
| Ctrl/Cmd + F | Search |
| Ctrl/Cmd + Z | Undo |
| Delete | Delete selected note |
| Escape | Close editor / deselect |
| Space + drag | Pan canvas |

Avoid overriding standard text-editing shortcuts while typing inside the note editor.

## 15. Security

Security requirements:

- All application routes require authentication except login and required authentication refresh endpoints.
- Passwords hashed with Argon2id.
- Refresh tokens stored hashed.
- Secure session management.
- HTTP-only cookies.
- CSRF protection where applicable.
- Rate limiting.
- Input validation on every API endpoint.
- Sanitisation of rich text and uploaded content.
- Protection against XSS.
- Protection against SQL injection through Prisma.
- File upload validation.
- Restrict file access to authenticated users.
- Do not expose internal filesystem paths.
- Do not expose database credentials to the frontend.
- Secrets supplied through environment variables.
- No credentials committed to Git.

The application should be suitable for access through an existing home-lab HTTPS reverse proxy.

## 16. Docker Compose Deployment

Provide a complete Docker Compose deployment.

Suggested services:

```text
frontend
backend
postgres
nginx
```

Nginx should be the public entry point.

The frontend and backend should not need to be independently exposed to the host.

PostgreSQL must remain internal to the Docker network.

### Persistent volumes

```yaml
volumes:
  postgres_data:
  uploads_data:
```

Both volumes must survive container recreation and application updates.

### Deployment requirements

The application should support the established home-lab deployment workflow:

```bash
git pull
docker compose up --build -d
```

Include:

- Health checks.
- Restart policies.
- Persistent database storage.
- Persistent attachment storage.
- Database migrations.
- Environment configuration.
- Useful container logging.
- Graceful shutdown.

Provide `.env.example` with all required configuration variables.

Do not include real secrets.

### Nginx

Nginx must:

- Serve the frontend.
- Proxy `/api/` to the backend.
- Proxy WebSocket connections.
- Support long-lived WebSocket connections.
- Set appropriate upload size limits.
- Apply sensible security headers.
- Support operation behind an existing HTTPS reverse proxy.

## 17. Backup and Recovery

This application will contain important household information.

Data protection is essential.

Ensure that the following can be backed up independently:

1. PostgreSQL database.
2. Uploaded images and attachments.
3. Application configuration.

Provide a backup script that:

- Creates a PostgreSQL dump.
- Archives uploaded files.
- Uses timestamped backup filenames.
- Stores backups in a persistent backup directory.
- Reports failures clearly.

Provide a restore procedure.

Do not automatically delete old backups without explicit configuration.

## 18. Application Settings

Provide a simple settings interface.

Include:

### User settings
- Display name.
- Author colour.
- Change password.
- Session management.

### Application settings
- Default note colour.
- Default note dimensions.
- Auto-save behaviour.
- Recycle bin retention.
- Date/time display preferences.

### Board settings
- Rename board.
- Description.
- Background style.
- Archive board.
- Delete board.

## 19. Development and Implementation Guidelines

Claude must follow these principles throughout development.

1. Build the application incrementally.
2. Keep frontend and backend TypeScript.
3. Use strict TypeScript settings.
4. Avoid unnecessary dependencies.
5. Use reusable React components.
6. Keep business logic out of presentation components.
7. Use database migrations for schema changes.
8. Never store important application data only in browser local storage.
9. Ensure all user-visible changes are persisted.
10. Implement error handling and loading states.
11. Do not use mock data in the production application.
12. Provide useful logging for troubleshooting.
13. Keep the application compatible with Docker Compose.
14. Do not introduce external services without approval.
15. Document environment variables and deployment requirements.

### Important implementation detail

Canvas interactions must be smooth.

Do not write to PostgreSQL on every mouse movement during dragging.

Instead:
- Update note positions locally while dragging.
- Persist the final position when dragging finishes.
- Broadcast the completed position to other connected users.
- Ensure the database is the authoritative source of persisted state.

For rich text editing, debounce updates and use version checks to prevent accidental overwrites.

For concurrent changes, separate board-layout events from note-content events.

## 20. Implementation Phases

Develop the application in the following phases.

### Phase 1 — Foundation

- Docker Compose environment.
- PostgreSQL.
- Nginx.
- React frontend.
- Node backend.
- Database schema and migrations.
- User authentication.
- Persistent sessions.
- Initial household board.

### Phase 2 — Whiteboard

- Canvas implementation.
- Infinite canvas.
- Pan and zoom.
- Sticky note creation.
- Dragging.
- Resizing.
- Layer ordering.
- Position persistence.
- Per-user viewport persistence.

### Phase 3 — Note Editor

- Floating note editor.
- Titles.
- Rich text editing.
- Auto-save.
- Author information.
- Note colours.
- Creation and modification timestamps.

### Phase 4 — Content

- Image uploads.
- Image storage.
- Image previews.
- Formatted tables.
- Mixed content notes.

### Phase 5 — Collaboration

- WebSocket infrastructure.
- Real-time note creation.
- Real-time movement.
- Real-time content updates.
- Concurrent editing protection.
- User presence indicators.

### Phase 6 — Additional Features

- Multiple boards.
- Board management.
- Search.
- Archive.
- Recycle bin.
- Duplicate notes.
- Activity history.
- Undo functionality.

### Phase 7 — Finalisation

- Security review.
- Performance testing.
- Backup and restore.
- Error handling.
- UI refinement.
- Docker deployment testing.
- Documentation.

## 21. Acceptance Criteria

The application is considered complete when the following can be demonstrated:

1. Two users can log in independently.
2. Both users remain authenticated across browser restarts.
3. Both users can access multiple shared boards.
4. A user can create a sticky note on a board.
5. The note displays its title and author identity.
6. The note can be moved and resized.
7. Its position survives application restarts.
8. Clicking a note opens its editor.
9. Rich text can be created and saved.
10. Images can be uploaded and displayed.
11. Multiple images can be included in a note.
12. Formatted tables can be created and edited.
13. A note can contain text, images and tables together.
14. Changes automatically save.
15. The other user sees changes in real time.
16. Concurrent editing does not silently destroy data.
17. Notes can be archived and restored.
18. Deleted notes can be recovered.
19. Search can locate notes across boards.
20. Creation and modification information is accurate.
21. Database and image data survive container recreation.
22. Backup and restoration can be demonstrated.
23. The complete application can be deployed using Docker Compose.

---

# Final Product Vision

The finished application should feel like having a shared physical noticeboard at home, except that it is persistent, searchable and accessible from either person's computer.

It should be fun and intuitive to use.

The whiteboard should be the star of the application, not a secondary feature hidden behind menus.

Prioritise the experience of creating, moving, reading and editing colourful sticky notes.

Keep the implementation reliable, self-hosted and maintainable for years to come.