# Fix Plan: Security First, Then Features

Scanned 23 October 2026 against `main` and the live site (`https://ai-pedes-detection.netlify.app`, backend `https://aidetection-zzeg.onrender.com`).

These are **fix phases**, separate from the hosting phases in [DEPLOYMENT_GUIDE.md](DEPLOYMENT_GUIDE.md). Do them in order: Phase 0 is a security alert and comes before any client use; Phases 1–5 make the screens show real data and working controls. The page-by-page findings they are based on are in the appendix.

| Phase | Goal | Alert | Effort |
| --- | --- | --- | --- |
| [0](#phase-0-security--high-alert) | Close security holes on the live site | 🔴 High alert | Medium |
| [1](#phase-1-show-the-real-signal-state) | Dashboard shows the real pedestrian light, countdowns and mode | Feature | Medium |
| [2](#phase-2-one-traffic-light-engine) | Manual controls, automatic cycle and audit log work together | Feature | Medium–large |
| [3](#phase-3-settings-that-change-the-system) | Timing settings actually change the lights | Feature | Small–medium |
| [4](#phase-4-honest-status-and-lasting-history) | No fake "online" status; activity survives a reload | Feature | Medium |
| [5](#phase-5-missing-screens-and-cleanup) | Decide unfinished features, remove dead code | Feature | Varies |

Severity in Phase 0: 🔴 critical · 🟠 high · 🟡 medium · 🟢 low.

---

## Phase 0: Security (high alert)

The live site is public. Until this phase is done, do not hand it to the client or connect an Arduino.

### Do today (no code needed)

| # | Sev. | Action | Who |
| --- | --- | --- | --- |
| 0.1 | 🔴 | **Check for unknown accounts.** Neon → Tables → `staff_users`. For any account you do not recognise, set `is_active` to `false`. Anyone could have registered since the site went live. | Owner |
| 0.2 | 🟠 | **Retire the leaked credentials** from the old repository `jed-bot/group11` (its history contains the Aiven database password, the old JWT secrets and the old admin password). Delete or reset the Aiven database, ask jed-bot to delete the repository or make it private, and make sure none of those passwords is reused anywhere. Production already uses new values. | Owner, jed-bot |
| 0.3 | 🟡 | **Confirm** Render's `DATABASE_URL` uses `sslmode=verify-full` (the startup log then has no SSL warning). | Owner |

### Code fixes

| # | Sev. | Problem | Fix | Where |
| --- | --- | --- | --- | --- |
| 0.4 | 🔴 | **Anyone can create an account.** `/register` creates an *active* `staff` account and logs it in immediately. Since any logged-in user can send detection reports, a stranger can fake pedestrians and start the traffic-light cycle (logged only today; real lights once an Arduino is connected). | Remove public registration (route, page, link), **or** create self-registered accounts inactive until an admin approves them. | `backend/src/routes/auth.routes.ts`, `services/auth.service.ts` (`register`), `frontend/src/views/RegisterView.vue`, `components/auth/SignUpForm.vue`, router, login page link |
| 0.5 | 🔴 | **No way to remove or approve accounts.** The staff API exists (admin-only) but there is no page. | Add an admin **Staff** page: list, create, change role, deactivate (and approve, if 0.4 uses approval). | New view; API in `frontend/src/api/index.ts` (`listStaff`, `createStaff`, `updateStaff`, `deactivateStaff`) |
| 0.6 | 🟠 | **Every staff account can drive the traffic lights.** `POST /api/live/detection` accepts any logged-in user, and several browsers can report at once. | Allow only administrators or a dedicated monitoring role to report, and accept one monitoring station at a time (reject or flag a second one). | `backend/src/routes/yolo.routes.ts`, `controllers/yolo.controller.ts`, `frontend/src/components/AppLayout.vue` (reporter `enabled`) |
| 0.7 | 🟠 | **Video upload open to all staff.** Up to 200 MB per file, saved on Render's small, temporary disk, and it returns **simulated** results (`DETECTION_MOCK=true`). A user can fill the disk or exhaust memory. | Disable `/api/detections/upload` in production until the feature is decided (Phase 5), or make it admin-only with a small limit (`UPLOAD_MAX_FILE_SIZE_MB`). | `backend/src/routes/detection.routes.ts` |
| 0.8 | 🟠 | **Vulnerable libraries in the website.** `axios` (prototype pollution, credential header exposure through `follow-redirects`), `vue` (server-renderer XSS; not used by this client-only app but flagged), `source-map-js` (build). | `npm audit fix` in `frontend/`, rebuild, run the tests, redeploy. Target: `npm audit --omit=dev` reports 0. | `frontend/package-lock.json` |
| 0.9 | 🟡 | **Live state is public.** `/api/system/status`, `/api/yolo/status` and `/api/arduino/status` show the current pedestrian count, signal phase and system state to anyone. | Require login for these three. Keep `/api/health` and `/health` public (keep-alive and Render health check). | `backend/src/routes/yolo.routes.ts` |
| 0.10 | 🟡 | **No Content-Security-Policy** on the website, so an injected script would run unrestricted. | Add a CSP in `frontend/netlify.toml`: `default-src 'self'`; `connect-src 'self' https://aidetection-zzeg.onrender.com wss://aidetection-zzeg.onrender.com`; `script-src 'self' 'wasm-unsafe-eval'`; `media-src 'self' blob:`; `img-src 'self' data: blob:`; `style-src 'self' 'unsafe-inline'`; `frame-ancestors 'none'`. Then test login, live updates, camera and model loading. | `frontend/netlify.toml` |
| 0.11 | 🟢 | **Password guessing** is limited per IP only (30 tries per 15 min). Admin-created passwords need only 8 characters, while registration also requires a letter and a number. | Add a per-account lockout or delay after repeated failures; use one password rule everywhere. | `middleware/rateLimiter.ts`, `services/auth.service.ts`, `dto/staff.dto.ts` |
| 0.12 | 🟢 | Remaining `npm audit` findings in backend **build tools** (not shipped to the live server). | Update when convenient. | `backend/package.json` dev dependencies |

### Already verified secure (no action)

- Secrets are not in the repository; production secrets are new and live only in Render and Neon.
- Backend runtime dependencies: 0 known vulnerabilities (`npm audit fix`, 23 October).
- Socket.IO refuses connections without a valid token; admin room and overrides are admin-only.
- CORS allows only the Netlify site; Netlify proxies `/api`, so the refresh cookie stays first-party.
- Refresh tokens: `httpOnly`, `Secure`, rotated on every use, and reuse revokes all sessions.
- Staff, audit-log and signal-control endpoints are admin-only; the Python ingest route needs a secret key.
- Login bypass (`VITE_AUTH_DISABLED`) is compiled out of production builds.
- HTTPS everywhere (HSTS), `nosniff`, camera limited to this site (`Permissions-Policy`).

### Done when

- [ ] `/register` is gone or creates inactive accounts; no unknown active accounts in `staff_users`.
- [ ] An admin can list, create and deactivate staff from a page.
- [ ] A normal staff account gets 403 on `POST /api/live/detection`; a second monitoring station is refused.
- [ ] Upload returns 403/404 in production (or admin-only with a small limit).
- [ ] `npm audit --omit=dev` reports 0 in both `frontend/` and `backend/`.
- [ ] The three status endpoints return 401 without login; `/api/health` stays 200.
- [ ] CSP header present; login, live updates, camera and model still work on the live site.

---

## Phase 1: Show the real signal state

**Problem.** The backend sends the pedestrian state (`WALK`/`WAIT`), car and pedestrian countdowns and the operating mode only in the Socket.IO event `signal:update`, which the website never listens to. The live state (`system:state`) does not contain `pedState`, `carTimer`, `pedTimer`, `mode` or `manualTimers`, although the frontend type expects them.

**Fix.** Add those fields to the live state the backend broadcasts (and returns from `/api/system/status`), set them during the automatic cycle, and handle `signal:update` in `frontend/src/composables/useLiveSystemState.ts`.

**Fixes:** pedestrian light never turning green · car countdown always `--:--` · "Operating mode: Unavailable/Unknown" in Diagnostics and Settings · empty countdown timers card · blank cycle length on System Testing.

**Done when:** during a red phase the pedestrian light shows WALK and both countdowns tick; the mode shows correctly right after login.

## Phase 2: One traffic-light engine

**Problem.** Two engines run separately: `backend/src/services/yoloLive.service.ts` (the automatic pedestrian cycle the dashboard shows) and `trafficSignal.service.ts` (manual mode, forced phases, test commands, signal events and the audit log). They share only the red duration.

**Fix.** Make one engine the single source of truth for the signal state and for commands to the Arduino; the other only requests changes.

**Fixes:** manual mode not stopping automatic cycles · forced phases and test cycles not appearing on the dashboard or Manual Controls status card · automatic pedestrian cycles missing from the Audit Logs (the page stays nearly empty) · YOLO enable/disable toggle only applying after a restart.

**Done when:** in manual mode a detected pedestrian does not change the lights; a forced RED appears on the dashboard within a second; every automatic cycle creates audit-log rows.

## Phase 3: Settings that change the system

**Problem.** Dashboard "System Adjustments" and Settings "Detection & crossing preferences" (detection 5 s, warning 5 s, vehicle red 30 s, crossing 20 s) are saved only in the browser (`frontend/src/composables/useSafetySettings.ts`) and have no effect. The real timings are server values: detection threshold and yellow come from environment variables (`YOLO_LIVE_DETECTION_THRESHOLD_MS`, `YOLO_LIVE_YELLOW_MS`); red comes from Controller signal timings.

**Fix.** Store the live-cycle timings on the server (`signal_config`), editable by admins only, applied with `yoloLive.setDurations`; show them read-only to staff. Remove the duplicate browser-only form. Change the System Testing result text so it does not claim a physical controller accepted the command when none is connected.

**Done when:** changing the detection time in Settings changes how long a person must be seen before the caution phase, for every browser, after a reload.

## Phase 4: Honest status and lasting history

| Problem | Fix |
| --- | --- |
| "Signal controller: online" although no Arduino exists (the `log` transport reports itself online) | Report "not connected (log mode)" for the log transport; show online only when a device answers |
| Countdown timers card says online whenever the socket is connected | Base it on real timer data (after Phase 1) |
| Recent Detection Activity is kept only in the browser (5 rows, lost on reload) | Store detection events on the server and load recent ones on the dashboard |

**Done when:** Diagnostics on the cloud server shows the controller as not connected; reloading the dashboard keeps the recent activity.

## Phase 5: Missing screens and cleanup

| Item | Decide / do |
| --- | --- |
| Uploaded-video detection (`/api/detections`) | Needs the Python service, which is not hosted; results are simulated on Render. Build a page with real detection, or remove the endpoints (see 0.7) |
| Recordings (`/api/recordings`) | Server recording is disabled in production. Browser recording is Phase 9 of the deployment guide |
| Signal event history and CSV export (`/api/signal/events`) | Add to Audit Logs or remove once Phase 2 merges the engines |
| Menu shows admin pages to staff | Hide Manual Controls, Settings, Testing and Audit Logs from staff in the menu (the router already redirects them) |
| Unused components | Delete `CameraRecordingCard`, `CrosswalkMap`, `EventLogCard`, `RecentDetectionsCard`, `SignalControlCard`, `TimerConfigCard`, `TrafficControlPanel`, `TrafficLightAnimated`, and UI `AppMain`, `AppAvatar`, `AppCheckbox`, `AppDrawer`, `AppMessage`, `AppPassword` |

---

## Appendix: current status by page

| Mark | Meaning |
| --- | --- |
| ✅ Real | Live data from the camera, the server or the database; controls work |
| ⚠️ Partial | Works, but some values are missing, misleading, or kept only in this browser session |
| ❌ Not connected | Shows a placeholder or fake status, or has no effect |
| 🚫 No screen | The backend supports it, but there is no page |
| 🔴 Security | Phase 0 |

### Live Monitoring (dashboard)

| Element | Status | Source / problem | Phase |
| --- | --- | --- | --- |
| Webcam Detection (video, boxes, Start/Stop, camera picker) | ✅ | Browser camera and on-device model | |
| Pedestrians Detected | ✅ | Browser detection; "—" when not running | |
| Pedestrian count chart | ✅ | Last 60 s in this browser; not saved | |
| Countdown Timer: Pedestrian | ⚠️ | Only during the red phase; `pedTimer` never sent | 1 |
| Countdown Timer: Car | ❌ | Always `--:--` | 1 |
| Traffic-Light Status: Vehicle | ✅ | Server live cycle | |
| Traffic-Light Status: Pedestrian | ❌ | Never WALK | 1 |
| Warning-Light Status | ✅ | Caution phase | |
| System Adjustments | ❌ | Browser only, no effect | 3 |
| Recent Detection Activity | ⚠️ | This session only, max 5 | 4 |
| Header: SYSTEM ONLINE, date and time | ✅ | Socket.IO connection, computer clock | |

### Diagnostics

| Element | Status | Source / problem | Phase |
| --- | --- | --- | --- |
| Signal controller status | ❌ | "online" without an Arduino | 4 |
| Traffic phase | ✅ | Live cycle | |
| Operating mode | ⚠️ | "Unavailable" until the mode changes | 1 |
| Countdown timers | ⚠️ | Always "Unavailable" | 1, 4 |
| Camera input, Detection engine, Server link | ✅ | Browser detection and reporter | |
| Telemetry payload, export, refresh | ✅ | Server live state | |

### Manual Controls

| Element | Status | Source / problem | Phase |
| --- | --- | --- | --- |
| Auto / Manual mode | ⚠️ | Saved, but the automatic cycle ignores it | 2 |
| Signal timers | ⚠️ | Red also sets the automatic red time; green and yellow manual only | 2, 3 |
| Force phase, run full cycle | ⚠️ | Accepted and audited, but not shown on screen | 2 |
| Telemetry status card | ⚠️ | Shows the automatic engine only | 2 |
| Access for staff | ⚠️ | Page opens, actions return 403 | 5 |

### System Settings

| Element | Status | Source / problem | Phase |
| --- | --- | --- | --- |
| Dark mode, Show System Adjustments | ✅ | This browser | |
| Detection & crossing preferences | ❌ | Browser only, no effect | 3 |
| Controller signal timings | ⚠️ | As Manual Controls | 2, 3 |
| Signal controller / operating mode | ❌ / ⚠️ | Fake "online"; mode "Unknown" | 4, 1 |
| Detection confirmation (5 s) | ✅ | Server threshold | |

### System Testing

| Element | Status | Source / problem | Phase |
| --- | --- | --- | --- |
| Connection check | ✅ | Live state | |
| Full cycle / Red phase commands | ⚠️ | Manual engine; misleading "confirm physical signals" text | 2, 3 |
| Cycle length | ⚠️ | Blank until timers change | 1 |
| Results and export | ⚠️ | This session only | |

### Audit Logs

| Element | Status | Source / problem | Phase |
| --- | --- | --- | --- |
| List, filters, details, CSV export | ✅ | `traffic_light_audit_logs` table | |
| Coverage | ❌ | Automatic pedestrian cycles never logged | 2 |

### Login and registration

| Element | Status | Source / problem | Phase |
| --- | --- | --- | --- |
| Login, session refresh, logout | ✅ | Tested on the live site | |
| Register | 🔴 | Open to anyone, instant staff access | 0 |

### Backend features with no screen

| Feature | API | Phase |
| --- | --- | --- |
| Staff management | `/api/staff` | 0 |
| Uploaded-video detection and history | `/api/detections` (simulated on Render) | 0, 5 |
| Recordings | `/api/recordings` (disabled in production) | 5 |
| Signal event history, export, config | `/api/signal/events`, `/events/export`, `/config` | 5 |
| YOLO enable/disable | `POST /api/yolo/toggle` (applies only after restart) | 2 |

### Sample data (development only)

With `VITE_AUTH_DISABLED=true` (set in the local, git-ignored `frontend/.env.development`), `npm run dev` skips login and shows sample data: an illustrated crosswalk instead of the camera, count 1, timers 18 s / 30 s, five sample activity rows, and signals in red/green. It is compiled out of production builds; the live site contains none of it.
