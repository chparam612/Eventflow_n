# EventFlow V2 — Smart Crowd Management for NMS

> Built for **Google Prompt Wars 2026** · Narendra Modi Stadium, Ahmedabad · 132,000 capacity

[![Live Demo](https://img.shields.io/badge/Live%20Demo-Firebase-orange)](https://eventflow-4f04a.web.app)
[![Tests](https://img.shields.io/badge/Tests-12%20Passing-brightgreen)](#running-tests)
[![Firebase](https://img.shields.io/badge/Firebase-v10.8.0-yellow)](https://firebase.google.com)

✔ **38 automated test cases** covering simulation, real-time sync, edge cases, and system reliability

---

## Live Demo

| Panel | URL |
|-------|-----|
| 🏠 Landing | `https://eventflow-4f04a.web.app/` |
| 🎟️ Fan/Attendee | `https://eventflow-4f04a.web.app/attendee` |
| 🧑‍✈️ Staff | `https://eventflow-4f04a.web.app/staff-login` |
| 🖥️ Control Room | `https://eventflow-4f04a.web.app/control-login` |

---

## Problem Statement

132,000 fans. 9 gates. 8 zones. 1 stadium. On a T20 match day at Narendra Modi Stadium, crowd management happens through walkie-talkies, gut instinct, and overhead cameras. EventFlow V2 replaces this with a **real-time AI-powered system** that connects every stakeholder — fans, ground staff, and control room — in one live loop.

---

## Our Vertical: Physical Event Experience

EventFlow targets cricket match days as the primary use case, focusing on:
- **Pre-arrival planning** (reduce gate rush)
- **In-venue navigation** (find seat without confusion)
- **Exit orchestration** (stagger the 132K departure into 9 gate flows)
- **Staff coordination** (instant instruction sync, no radio delays)

---

## Core Insight — Trust First

> *"A crowd that knows what to do doesn't need to panic."*

Most crowd incidents happen because people don't have reliable information in real time. EventFlow gives every attendee a **personal plan** before they even arrive — reducing anxiety, distributing crowd load, and preventing dangerous surges.

---

## Biomimicry Approach

EventFlow is inspired by three natural crowd intelligence systems:

- 🐜 **Ants** — pheromone trails (nudges) redirect fans away from congestion automatically
- 🐟 **Fish schools** — each zone's density influences neighboring zones' load (cascade awareness)
- 🐝 **Bees** — the control room acts as the hive brain, receiving signals and broadcasting decisions

---

## System Architecture

```
Fan App ──────────┐
                  ├── Firebase Realtime DB ──── Control Room
Staff App ────────┘                    └──────── AI Insights (Gemini)
      ↑                                                   ↓
      └── Instructions (nudges, directives) ──────────────┘
```

Three panels, one live data loop — every action in the control room is reflected in seconds across all staff devices and attendee apps.

---

## Google Services Used

| Service | How Used |
|---------|----------|
| **Firebase Realtime Database** | Live 3-panel sync — zones, staff, instructions, nudges update instantly |
| **Firebase Authentication** | Role-based access — Anonymous (fans), Email (staff/control) |
| **Firebase Hosting** | Edge-cached PWA deployment with SPA rewrite rules |
| **Google Maps JS API** | Satellite view of NMS with live zone colour overlays |
| **Google Gemini API** | AI chat for fans + automated crowd insights for control room |
| **Google Fonts** | DM Sans + Space Grotesk for premium typography |

---

## How It Works

```
Pre-event  → Fan completes 5-question intake → Gets personalized gate + timeline plan
Arrival    → Escort screen guides fan step-by-step to their seat
During     → Live zone status + smart nudges (food/restroom timing)
Exit       → AI-ranked exit options (leave now / wait 15 / stay for ceremony)
Post-match → Feedback screen → data feeds into next event improvements
```

Staff simultaneously:
- Toggle zone status (clear / crowded) → updates Firebase instantly
- Receive control room instructions in real time

Control room:
- Scrubs simulation timeline to test scenarios
- Sends instructions to specific zones
- Broadcasts nudges to all attendees
- Gets AI crowd insights every 2 minutes

---

## Demo Instructions (5-minute judge path)

### Step 1 — Control Room (desktop tab)
1. Go to `/control-login`
2. Login: `control@eventflow.demo` / `Control@123`
3. Scrub the timeline slider to `t=240` (innings break)
4. Watch North Concourse turn red on the map
5. Click "Dispatch" on the alert → send instruction to staff

### Step 2 — Staff Panel (mobile or narrow browser)
1. Open `/staff-login` in a second window
2. Login: `staff@eventflow.demo` / `Staff@123`, select "North Concourse"
3. See the instruction appear instantly from control room
4. Toggle zone to "CROWDED" → watch control room map update

### Step 3 — Attendee App (mobile or narrow browser)
1. Open `/` → tap "Match Attendee"
2. Complete the 5-question intake
3. See personalized gate recommendation
4. Tap 🤖 (AI Chat) → ask "What's the fastest exit?"
5. Navigate to "During" → see live nudge from control room

---

## Login Credentials

| Role | Email | Password |
|------|-------|----------|
| Attendee | *(tap "Match Attendee" — no login needed)* | — |
| Staff | `staff@eventflow.demo` | `Staff@123` |
| Control Room | `control@eventflow.demo` | `Control@123` |

> Create these accounts in Firebase Console → Authentication → Add users

---

## Assumptions

- Stadium coordinates: NMS, Ahmedabad (23.0921°N, 72.5952°E)
- Match simulation: T20, 18:00 IST start, ~8-hour window
- Zone overlays are approximate rectangles (not actual polygons)
- Gemini AI has a graceful text fallback when API key is not set
- Anonymous auth is required to be enabled in Firebase console

---

## Local Setup

```bash
# 1. Clone
git clone https://github.com/chparam612/Eventflow_n.git
cd Eventflow_n

# 2. Start dev server
node server.js

# 3. Open
open http://localhost:3000
```

---

## Running Tests

```bash
npm test
# or
node tests/core.test.js
```

Expected output:
```
🔹 GROUP 1 — SIMULATION ENGINE
  ✅ 1. Density always between 0 and 1
  ...
🔹 GROUP 2 — BUSINESS LOGIC
  ✅ 11. Exit plan returns exactly 3 options
  ...
🔹 GROUP 3 — DATA INTEGRITY
  ✅ 17. Zone object structure is valid (name + cap)
  ...
🔹 GROUP 4 — FIREBASE LOGIC (mocked)
  ✅ 23. writeZone does not loop infinitely
  ...
🔹 GROUP 5 — AUTH LOGIC
  ✅ 29. Staff role detection works correctly
  ...
🔹 GROUP 6 — EDGE CASES
  ✅ 33. Zero density handled without errors
  ...

──────────────────────────────────────────────────

  Results: 38/38 tests passed

🎉 All tests passed — EventFlow V2 is stable.
```

---

## Firebase Deployment

```bash
# 1. Build (copies src/ into public/src/)
node build.js

# 2. Deploy
firebase login
firebase deploy

# 3. Update .firebaserc with your actual project ID
```

---

## Future Roadmap

- [ ] Real-time WebRTC video from zone cameras into control room
- [ ] Bluetooth BLE beacon-based indoor positioning (exact row/seat)
- [ ] WhatsApp nudge delivery via Twilio/Meta API
- [ ] Predictive AI (crowd surge prediction 10 min in advance)
- [ ] Accessibility mode (larger text + screen reader support)
- [ ] Offline PWA with Service Worker caching
- [ ] Multi-stadium support (Wankhede, Eden Gardens, etc.)

---

## Accessibility

- All buttons have `title` attributes and clear emoji labels
- Color is never the sole indicator — text labels always accompany status colors
- Font sizes are minimum 0.78rem (12.5px) throughout
- High contrast dark theme meets WCAG AA for text on dark backgrounds
- Touch targets are minimum 44×44px on mobile

---

## Tech Stack

| Layer | Technology |
|-------|------------|
| Frontend | Vanilla JavaScript ES Modules (no framework) |
| Styling | CSS Variables + Vanilla CSS (no Tailwind) |
| Database | Firebase Realtime Database v10.8.0 |
| Auth | Firebase Authentication v10.8.0 |
| Hosting | Firebase Hosting |
| Maps | Google Maps JavaScript API (satellite) |
| AI | Google Gemini 2.0 Flash |
| Fonts | Google Fonts (DM Sans + Space Grotesk) |
| Tests | Node.js (no test framework needed) |

---

*EventFlow V2 · Google Prompt Wars 2026 · Built with ❤️ for NMS*