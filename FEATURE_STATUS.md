# Feature Status: What Is Real, Partial, or Not Connected

Scanned 23 October 2026 against `main` and the live site (`https://ai-pedes-detection.netlify.app`, backend `https://aidetection-zzeg.onrender.com`). For each screen, this lists where the displayed data comes from and whether the controls actually do anything.

| Mark | Meaning |
| --- | --- |
| ✅ Real | Live data from the camera, the server or the database; controls work. |
| ⚠️ Partial | Works, but some values are missing, misleading, or only kept in this browser session. |
| ❌ Not connected | Looks functional but shows a placeholder, a fake status, or has no effect. |
| 🚫 No screen | The backend supports it, but there is no page for it. |
| 🔴 Security | Must be fixed before real use. |

## Critical: anyone can create an account (🔴)

`/register` is public. A new account is created **active, with the `staff` role, and logged in immediately** (`backend/src/services/auth.service.ts`, `register`). No approval exists, and there is no Staff page to remove accounts.

Why it matters: since Phase 3, any logged-in user can send detection reports (`POST /api/live/detection`). A stranger could register and fake pedestrians, starting the traffic-light cycle. Today the cloud server only logs light commands; once an Arduino is connected, these would switch real lights. Staff can also read the dashboard, diagnostics and signal history.

Fix first:
1. Disable public registration (remove the route and page), **or** create self-registered accounts inactive until an administrator approves them.
2. Add a Staff page (the API already exists: list, create, update, deactivate).
3. Check Neon → `staff_users` now for accounts you do not recognise and set `is_active` to false.

## Summary

| Area | Status |
| --- | --- |
| Webcam detection, people count, boxes, 60 s trend | ✅ Real (runs in the browser) |
| Automatic traffic-light cycle (5 s detection → caution → red) | ✅ Real (server), commands are logged only: no Arduino in the cloud |
| Vehicle signal, warning light | ✅ Real |
| Pedestrian signal (WALK) | ❌ Never turns green |
| Car countdown | ❌ Always `--:--` |
| Dashboard "System Adjustments" / Settings "Detection & crossing preferences" | ❌ Saved in this browser only; no effect on the lights |
| Signal controller "online" | ❌ Reported online although no Arduino is connected |
| Manual Controls (mode, force phase, run cycle) | ⚠️ Server accepts them, but the dashboard does not show the result, and manual mode does not stop the automatic cycle |
| Audit Logs | ⚠️ Real database, but automatic pedestrian cycles are never logged |
| Recent Detection Activity | ⚠️ Real, but only this session (max 5 rows, lost on reload) |
| Login | ✅ Real |
| Registration | 🔴 Open to anyone |
| Staff management, video upload detection, recordings, signal event history | 🚫 No screen |

## Root causes

Most ❌ and ⚠️ items come from three gaps:

1. **The dashboard ignores `signal:update`.** The backend sends the pedestrian state (`WALK`/`WAIT`), car and pedestrian countdowns, and manual phase changes only in a Socket.IO event called `signal:update`. The frontend never listens to it (`frontend/src/composables/useLiveSystemState.ts`), and the live state (`system:state`) does not contain `pedState`, `carTimer`, `pedTimer`, `mode` or `manualTimers`, although the frontend type expects them.
2. **Two separate traffic-light engines.** `yoloLive.service.ts` runs the automatic pedestrian cycle the dashboard shows. `trafficSignal.service.ts` runs manual mode, forced phases, test commands and the audit log. They share only the red duration. So manual commands do not appear on the dashboard, manual mode does not pause automatic cycles, and automatic cycles are not audited.
3. **Browser-only settings.** The four "System Adjustments" values are stored in `localStorage` (`frontend/src/composables/useSafetySettings.ts`) and never sent to the server. The real live-cycle timings are server environment values (`YOLO_LIVE_DETECTION_THRESHOLD_MS` = 5 s, `YOLO_LIVE_YELLOW_MS` = 3 s) plus the red duration from Controller signal timings.

## Page by page

### Live Monitoring (dashboard)

| Element | Status | Source / problem |
| --- | --- | --- |
| Webcam Detection (video, boxes, Start/Stop, camera picker) | ✅ | Browser camera and on-device model |
| Pedestrians Detected | ✅ | Browser detection; "—" when not running |
| Pedestrian count chart (expand icon) | ✅ | Last 60 s in this browser; not saved |
| Countdown Timer: Pedestrian | ⚠️ | Shows only during the red phase (from `cycleRemainingSec`); `pedTimer` is never sent |
| Countdown Timer: Car | ❌ | Always `--:--`: `carTimer` is never sent in the live state |
| Traffic-Light Status: Vehicle | ✅ | Server live cycle (`normal`/`caution`/`stopped`) |
| Traffic-Light Status: Pedestrian | ❌ | Stays RED/"Pedestrians Wait" even during the red phase: `pedState` is never sent |
| Warning-Light Status | ✅ | Active during the caution phase |
| System Adjustments (Detection, Warning, Vehicle red, Crossing) | ❌ | Saved in this browser only ("Settings saved on this device"); the lights ignore them |
| Recent Detection Activity | ⚠️ | Real events from this browser session; max 5; cleared on reload; not read from the database |
| System Process | — | Static description |
| Header: SYSTEM ONLINE, date and time | ✅ | Socket.IO connection and the computer clock |

### Diagnostics

| Element | Status | Source / problem |
| --- | --- | --- |
| Signal controller: status | ❌ | Shows **online** on Render, where no Arduino exists: the `log` transport reports itself online |
| Signal controller: traffic phase | ✅ | Live cycle |
| Signal controller: operating mode | ⚠️ | "Unavailable" until someone changes the mode (mode is not in the live state) |
| Countdown timers | ⚠️ | Card says online whenever connected; both timers always "Unavailable" |
| Camera input, Detection engine, Server link | ✅ | Browser detection and the reporter |
| Latest telemetry payload, Export diagnostics, Refresh | ✅ | Live state from the server |

### Manual Controls

| Element | Status | Source / problem |
| --- | --- | --- |
| Auto / Manual mode | ⚠️ | Saved on the server, but the automatic pedestrian cycle does not check it: detections still trigger the lights in manual mode |
| Signal timers (green, yellow, red) | ⚠️ | Saved on the server; red also sets the automatic cycle's red time, green and yellow affect manual cycles only |
| Direct controls (force phase, run full cycle) | ⚠️ | Accepted and audited by the manual engine, but the status card and dashboard show the automatic engine, so nothing appears to change |
| Telemetry status card | ⚠️ | Shows the automatic engine only |
| Access | ⚠️ | Staff users can open the page, but every action needs an administrator (403) |

### System Settings

| Element | Status | Source / problem |
| --- | --- | --- |
| Dark mode, Show System Adjustments | ✅ | This browser |
| Detection & crossing preferences | ❌ | Same values as dashboard System Adjustments: browser only, no effect |
| Controller signal timings | ⚠️ | As in Manual Controls |
| System connection: signal controller | ❌ | "online" without an Arduino (see Diagnostics) |
| System connection: operating mode | ⚠️ | "Unknown" until the mode changes |
| Detection confirmation (5 s) | ✅ | Server threshold |

### System Testing

| Element | Status | Source / problem |
| --- | --- | --- |
| Connection check | ✅ | Live state |
| Full cycle / Red phase commands | ⚠️ | Go to the manual engine; the result text says "Confirm physical signals at the installation" although the cloud server has no controller |
| Cycle length | ⚠️ | Blank until timers are changed during the session |
| Results list and export | ⚠️ | This session only |

### Audit Logs

| Element | Status | Source / problem |
| --- | --- | --- |
| List, filters, details, CSV export | ✅ | `traffic_light_audit_logs` table |
| What gets logged | ❌ | Only manual, forced and test phases. **Automatic pedestrian cycles, the main feature, are never logged**, so the page stays mostly empty in normal use |

### Login and registration

| Element | Status | Source / problem |
| --- | --- | --- |
| Login, session refresh, logout | ✅ | Tested on the live site |
| Register | 🔴 | See Critical section |

## Backend features with no screen (🚫)

| Feature | API | Notes |
| --- | --- | --- |
| Staff management | `GET/POST/PATCH/DELETE /api/staff` | Needed to approve or disable accounts |
| Uploaded-video detection and history | `/api/detections` | On Render `DETECTION_MOCK=true`, so uploads would return **simulated** detections; the real path needs the Python service, which is not hosted. Uploads are also lost when Render restarts |
| Recordings | `/api/recordings` | Server recording is disabled in production (it recorded the Python stream); browser recording is Phase 9 |
| Signal event history, CSV export, signal config | `/api/signal/events`, `/events/export`, `/config` | Data exists for the manual engine only |
| YOLO enable/disable | `POST /api/yolo/toggle` | The automatic cycle reads this setting once at startup, so toggling has no effect until a restart |

Unused frontend components left from earlier designs (safe to delete): `CameraRecordingCard`, `CrosswalkMap`, `EventLogCard`, `RecentDetectionsCard`, `SignalControlCard`, `TimerConfigCard`, `TrafficControlPanel`, `TrafficLightAnimated`, and UI `AppMain`, `AppAvatar`, `AppCheckbox`, `AppDrawer`, `AppMessage`, `AppPassword`.

## Sample data (development only)

With `VITE_AUTH_DISABLED=true` (set in the local, git-ignored `frontend/.env.development`), `npm run dev` skips login and shows sample data: an illustrated crosswalk instead of the camera, count 1, timers 18 s / 30 s, five sample activity rows, and signals in red/green. This is compiled out of production builds; the live site was checked and contains none of it.

## Recommended fix order

| Priority | Work | Effort |
| --- | --- | --- |
| P0 | Close public registration (or require approval); add a Staff page; review existing accounts | Small–medium |
| P1 | Send `pedState`, `carTimer`, `pedTimer`, `mode` and `manualTimers` in the live state, and handle `signal:update` → fixes pedestrian WALK, car countdown, operating mode, testing cycle length | Medium |
| P1 | Make the automatic cycle respect manual mode, show manual commands on the dashboard, and write automatic cycles to the audit log (connect the two engines) | Medium |
| P1 | Connect System Adjustments to the server (admin-only), or remove them and show the real timings read-only | Small–medium |
| P2 | Report the signal controller as "not connected (log mode)" when no Arduino is attached | Small |
| P2 | Store detection activity on the server so Recent Detection Activity survives reloads | Medium |
| P3 | Decide on video upload detection, recordings and the YOLO toggle (build screens or remove the endpoints); delete unused components | Varies |
