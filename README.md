# Household Whiteboard

A private, self-hosted household whiteboard application. See [PROJECT.md](PROJECT.md) for the
full specification and [TASKS.md](TASKS.md) for implementation progress.

## Repository layout

```text
backend/    Node.js + TypeScript API and WebSocket server
frontend/   React + TypeScript single-page app
nginx/      Reverse-proxy config (public entry point)
```

## Local development (without Docker)

Each app runs independently with its own dev server:

```bash
cd backend && npm install && npm run dev     # http://localhost:4000
cd frontend && npm install && npm run dev    # http://localhost:5173
```

## Running with Docker Compose

Copy the environment template and fill in real secrets:

```bash
cp .env.example .env
```

There are two ways to run the stack, using the same `docker-compose.yml`:

- **Production / home-lab deployment** — pulls the images GitHub Actions already built and
  pushed to GHCR; never builds locally:

  ```bash
  git pull
  docker compose pull
  docker compose up -d
  ```

- **Local development against the full stack** — builds the `backend` and `frontend` images
  from source instead of pulling them:

  ```bash
  docker compose up --build -d
  ```

Nginx is published on `${HTTP_PORT}` (default `8080`) and is the only service exposed to the
host; put your existing HTTPS reverse proxy in front of it for anything beyond local use.

## Continuous integration / GHCR images

[.github/workflows/docker-build.yml](.github/workflows/docker-build.yml) builds the `backend`
and `frontend` images on every push to `main` (and on `v*.*.*` tags) and pushes them to:

```text
ghcr.io/dropzoneninja/pinboard-backend
ghcr.io/dropzoneninja/pinboard-frontend
```

Images are tagged `latest` (on `main`), with the short commit SHA, and with the semver tag on
tagged releases. Both `linux/amd64` and `linux/arm64` are built.

**One-time setup:** the first time the workflow runs, GitHub creates each package privately by
default. To let `docker compose pull` work without authentication on the home-lab host, open
each package's settings on GitHub and set visibility to **Public**:

- https://github.com/users/DropzoneNinja/packages/container/package/pinboard-backend
- https://github.com/users/DropzoneNinja/packages/container/package/pinboard-frontend

## Environment variables

See [.env.example](.env.example) for the full list. Never commit a real `.env` file.

## Backup and restore

Covered in Phase 7 of [TASKS.md](TASKS.md) — not yet implemented.
