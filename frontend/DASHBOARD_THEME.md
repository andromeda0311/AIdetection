# Pedestrian Safety Monitoring UI

All system and account screens share the client's Pedestrian Safety Monitoring design system.

## Home layout

- Cool-gray `#f0f4f8` canvas, white cards, subtle borders/shadows, and 12px corners.
- A single navy `#1b3b52` header with pedestrian branding, system badge, live local date/time, and settings link.
- Webcam Detection beside the person count, crossing countdown, vehicle/pedestrian lights, and warning beacon.
- Four timing adjustment fields beside the five-entry detection activity table.
- A full-width System Process workflow for webcam, pedestrian detection, and traffic-light response.

The intersection map, auto/manual buttons, hold-to-walk progress, secondary header, and diagnostics footer are removed from the home screen.

The desktop dashboard fits the viewport without scrolling. Smaller screens use panel tabs so the camera, status cards, adjustments, and activity remain accessible. Light and dark appearance are shared across every screen and saved in the browser. System Adjustments collapses to a compact header with its Hide/Show button; the camera fills the remaining space.

## Screens and navigation

The shared header menu links to monitoring, diagnostics, manual controls, system settings, testing, and audit logs. Staff management and profile screens are removed for the single-operator workflow. Administrator routes retain their access restrictions. Production sign-in and registration use the same colors, typography, cards, and controls.

The 175 generated template/demo screens, their public HTML copies, routes, static page loader, legacy sidebar/header, and HTML converter were removed. Unknown and retired URLs redirect to monitoring.

## State and settings

Local development without live telemetry displays clearly labeled preview data: one person, an 18-second timer, the requested light states, five example activity rows, and a sample crosswalk illustration. This is not live camera footage.

When telemetry is available, the dashboard uses the actual count, timers, signals, and camera stream. Recent activity records detection transitions during the current browser session. Polling can provide fresh state even if Socket.IO is unavailable; stale values clear after the freshness interval.

The Pedestrians Detected home widget displays the large current count. Its expand button opens a focused graph view showing the last 60 seconds, with gaps for unavailable camera data. Sampling continues while the graph is closed. The preview chart is labeled as sample data. These frame counts are not a total of unique completed crossings; that would require line-crossing tracking in the detection service.

Countdown Timer has a pedestrian/car selector in the upper-right corner of its header. The choice persists in the browser, and unavailable timers display `--:--`. The dark header uses the same surface color as the cards.

Save Settings validates integer durations from 1 to 300 seconds and stores all four preferences in browser local storage. Saving these preferences does not change the physical controller's timing. The current backend does not expose an atomic configuration endpoint supporting all four client fields.

## Implementation

- `src/views/DashboardView.vue`: dashboard state, preference form, and activity.
- `src/styles/app-theme.css`: shared tokens, forms, cards, navigation, and account styles.
- `src/styles/safety-dashboard.css`: responsive monitoring layout.
- `src/components/dashboard/SafetyHeader.vue`: shared branding, navigation, theme toggle, and live date/time.
- `SafetyCamera.vue`, `SafetySignal.vue`, and `SafetyIcon.vue`: visual components.
- `src/components/AppLayout.vue`: single system shell.
- `src/components/auth/AuthLayout.vue`: account shell using the shared header and theme.
- `src/composables/useLiveSystemState.ts`: Socket.IO, polling, and freshness.

Local UI preview: `http://127.0.0.1:5173/dashboard`.
Browser checks cover desktop/mobile fitting, five preview rows, removed elements, preference persistence, settings navigation, live data replacement, and stale-data handling.

Full frontend type checking and production bundling passed after the client layout refactor.
