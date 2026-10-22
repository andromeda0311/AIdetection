# Thesis Backend — Staff Authentication + Pedestrian Detection API

Secure Node.js + Express + TypeScript backend for the traffic enforcer project.
Implements staff-only authentication with JWT access + rotating refresh tokens,
role-based access (admin / staff), a clean MVC + service/repository layout, video
upload with pedestrian detection, and an Arduino traffic light controller.

Full design notes: see [PLAN.md](./PLAN.md).

## Tech stack

- Node.js 24, Express 5, TypeScript (ESM)
- PostgreSQL via `pg` (works with the Aiven instance in `.env`)
- `zod` request validation, `jsonwebtoken`, `bcryptjs` password hashing
- `multer` + `file-type` uploads, `serialport` for the Arduino traffic light
- `helmet`, `cors`, `express-rate-limit`, `pino` logging

## Folder structure

```
src/
  config/        env validation (zod) + Postgres pool
  db/            schema.sql, migrate, seed scripts
  models/        data-access layer (raw SQL repositories)
  dto/           request validation schemas + inferred types
  services/      business logic (auth, tokens, passwords, detections, signal)
  controllers/   HTTP layer (parse/respond, no business logic)
  middleware/    auth, role guard, validation, upload, rate limits, errors
  routes/        route wiring
  utils/         ApiError, asyncHandler, logger, response helpers
  types/         shared domain types + Express augmentation
arduino/         traffic light firmware sketch
```

Flow: `route -> middleware (validate/auth) -> controller -> service -> model -> Postgres`.

## Setup

```bash
npm install
cp .env.example .env        # then edit values
npm run db:migrate          # apply schema (staff_users, refresh_tokens, detections, signal_events)
npm run db:seed             # create/update the admin account from ADMIN_EMAIL/ADMIN_PASSWORD
npm run dev                 # start dev server (tsx watch) on http://localhost:4000
```

Uploads are stored under `UPLOAD_DIR` (`./storage` locally). The folder is
git-ignored; it maps to the `files_data` volume (`/app/storage`) when deployed.

## Scripts

| Script            | Purpose                                  |
| ----------------- | ---------------------------------------- |
| `npm run dev`     | Dev server with watch                    |
| `npm run build`   | Compile TS + copy schema.sql to dist     |
| `npm start`       | Run compiled build                       |
| `npm run typecheck` | Type-check without emitting            |
| `npm run db:migrate` | Apply database schema                 |
| `npm run db:seed` | Upsert the admin account                 |
| `npm test`        | Run unit tests (vitest)                  |

## API

Base URL: `http://localhost:4000/api`

### Auth

| Method | Endpoint          | Access token | Description                       |
| ------ | ----------------- | ------------ | --------------------------------- |
| POST   | `/auth/login`     | No           | Login (email + password)          |
| POST   | `/auth/refresh`   | No           | Rotate refresh token (cookie)     |
| POST   | `/auth/logout`    | No           | Revoke refresh token (cookie)     |
| GET    | `/auth/me`        | Yes          | Current authenticated user        |

### Access model

There is exactly one account: the administrator created by `npm run db:seed:prod` (`ADMIN_EMAIL`, `ADMIN_PASSWORD` of 12+ characters with a letter and a number). Seeding deactivates every other account. There is no registration or staff management; only an active admin can log in, refresh a session, call the API or open a Socket.IO connection. Login allows 5 failed attempts per IP per 15 minutes. With `NETLIFY_PROXY_SECRET` set, `/api/*` (except `/api/health`) only accepts requests signed by the website's Netlify proxy.

### Detections (staff)

| Method | Endpoint                             | Description                                  |
| ------ | ------------------------------------ | -------------------------------------------- |
| POST   | `/detections/upload`                 | Upload a video (multipart field `file`); starts async detection (202). Not available when `NODE_ENV=production` |
| GET    | `/detections`                        | List detections (`?page=1&limit=20`)         |
| GET    | `/detections/:id`                    | Detection detail incl. detected frames       |
| GET    | `/detections/:id/input/file`         | Download the original uploaded video         |
| GET    | `/detections/:id/frames/:frameId/file` | Download one detected frame                |

### Traffic signal

| Method | Endpoint              | Access | Description                |
| ------ | --------------------- | ------ | -------------------------- |
| GET    | `/signal/status`      | staff  | Current light state        |
| GET    | `/signal/events`      | staff  | Signal transition log      |
| POST   | `/signal/green\|yellow\|red` | admin | Manual override   |

### Auth flow

1. `POST /auth/login` with `{ email, password }`
   → returns `{ user, accessToken }` and sets an httpOnly `refreshToken` cookie.
2. Send `Authorization: Bearer <accessToken>` on protected requests.
3. When the access token expires, call `POST /auth/refresh` (cookie is sent automatically)
   → returns a new access token and rotates the refresh token.
4. `POST /auth/logout` revokes the refresh token.

Responses use a consistent envelope: `{ success, message, data? }`.

## Detection & traffic light flow

1. Staff uploads a video → backend validates it (magic bytes), stores the raw file,
   and returns `202` with a `detection.id`.
2. A background job calls the detection client. A **mock client** is active until the
   real YOLOv11 API is available (`DETECTION_MOCK=true`).
3. Detected frames are saved and recorded in the database; on completion an event is
   emitted. If a pedestrian is detected, the signal machine runs
   **GREEN → YELLOW (3s) → RED (20s) → GREEN**, holding RED while pedestrians remain.
4. Commands are sent to the Arduino over USB serial (`GREEN\n`, `YELLOW\n`, `RED\n`);
   every transition is logged to `signal_events`.

### Arduino

- Firmware: `arduino/traffic_light/traffic_light.ino` (LEDs on pins 9/10/11).
- Set `SIGNAL_TRANSPORT=serial` and `SIGNAL_SERIAL_PORT` (e.g. `COM3`).
- Serial requires the backend on the host PC — Docker on Windows cannot reach COM ports.
- No hardware? Keep `SIGNAL_TRANSPORT=log`; transitions are still recorded.

### Swapping in the real YOLO API

Implement `detectVideo()` in `src/services/detection.client.ts`, set
`DETECTION_MOCK=false` and `DETECTION_API_URL`, and normalize the response into
`DetectionApiResult`. No other code changes.

## Security notes

- Passwords hashed with bcrypt (10 rounds); hashes are never returned.
- Refresh tokens are stored hashed (SHA-256) and rotated on every use.
- Presenting a revoked refresh token revokes all of the user's sessions (reuse detection).
- Login is rate limited and returns a generic error to prevent user enumeration.
- Access tokens are short-lived (default 15m); refresh tokens default to 7d.
- Refresh cookie is `httpOnly` + `sameSite`; set `COOKIE_SECURE=true` when serving over HTTPS.
- `DB_SSL=true` enables TLS to the database (Aiven enforces SSL). It connects with
  `rejectUnauthorized: false` — use a CA certificate for stricter verification in production.

## Environment variables

See `.env.example` for the full list with comments. Secrets (JWT, DB password) must never
be committed. `DATABASE_URL` overrides the individual `DB_*` variables when set.
