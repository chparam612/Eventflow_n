# EventFlow V2 — Smart Crowd Management for NMS

> Built for **Google Prompt Wars 2026** · Narendra Modi Stadium, Ahmedabad · 132,000 capacity

[![Live Demo](https://img.shields.io/badge/Live%20Demo-eventflow--4f04a.web.app-orange)](https://eventflow-4f04a.web.app)
[![GitHub](https://img.shields.io/badge/GitHub-chparam612%2FEventflow__n-blue)](https://github.com/chparam612/Eventflow_n)
[![Tests](https://img.shields.io/badge/Tests-38%20Passing-brightgreen)](#running-tests)
[![Firebase](https://img.shields.io/badge/Firebase-v10.8.0-yellow)](https://firebase.google.com)

✔ **38 automated test cases** — simulation, real-time sync, business logic, edge cases  
✔ **Repo size < 1 MB · Single branch (main) · Public · Google Services integrated**

---

## 🌐 Live URLs

| Panel | URL |
|-------|-----|
| 🏠 Landing | [eventflow-4f04a.web.app](https://eventflow-4f04a.web.app/) |
| 🎟️ Fan/Attendee | [/attendee](https://eventflow-4f04a.web.app/attendee) |
| 🧑‍✈️ Staff | [/staff-login](https://eventflow-4f04a.web.app/staff-login) |
| 🖥️ Control Room | [/control-login](https://eventflow-4f04a.web.app/control-login) |

---

## 🎯 Chosen Vertical: Physical Event Experience

EventFlow targets cricket match days at Narendra Modi Stadium as the primary use case:

- **Pre-arrival planning** — reduce gate rush by distributing crowd before they arrive
- **In-venue navigation** — guide fans step-by-step to their seat without confusion
- **Exit orchestration** — stagger 132K departure into 9 gate flows using AI ranking
- **Staff coordination** — instant instruction sync from control room, no radio delays

---

## 🧠 Approach and Logic

> *"A crowd that knows what to do doesn't need to panic."*

Most crowd incidents happen because people don't have reliable real-time information. EventFlow gives every attendee a **personal plan before they even arrive** — reducing anxiety, distributing crowd load, and preventing dangerous surges.

### Biomimicry Inspiration
| Animal | Behaviour | EventFlow Equivalent |
|--------|-----------|----------------------|
| 🐜 Ants | Pheromone trails redirect flow | Nudges steer fans from congested zones |
| 🐟 Fish | Neighbour-aware schooling | Zone density cascades to adjacent zones |
| 🐝 Bees | Hive broadcasts decisions | Control room dispatches to all staff/fans |

### System Architecture

```
Fan App ──────────┐
                  ├── Firebase Realtime DB ──── Control Room
Staff App ────────┘                    └──────── AI Insights (Gemini)
      ↑                                                   ↓
      └── Instructions (nudges, directives) ──────────────┘
```

Three panels, one live data loop — every action in the control room reflects in seconds.

---

## ☁️ Google Services Used

| Service | Integration |
|---------|-------------|
| **Firebase Realtime Database** | Live 3-panel sync — zones, staff, instructions, nudges |
| **Firebase Authentication** | Anonymous (fans) + Email/Password (staff/control) |
| **Firebase Hosting** | Edge-cached PWA with SPA rewrite rules |
| **Google Maps JS API** | Satellite view of NMS with dynamic Density-Aware Dijkstra Routing |
| **Gemini 2.0 Flash API** | AI chat for fans + automated crowd insights for control room |
| **Google Fonts** | DM Sans + Space Grotesk typography |

---

## ⚙️ How the Solution Works

```
Pre-event  → Fan answers 5 intake questions → Gets personalized gate + arrival timeline
Arrival    → Live Google Map routing using Density-Aware Dijkstra logic avoids congested zones
During     → Real-time path tracing with colour-coded Polylines (Green/Yellow/Red)
Exit       → AI-ranked exit options: leave now / wait 15 min / stay for ceremony
Post-match → Star-rating feedback → data feeds next event improvements
```

**Staff panel simultaneously:**
- Toggle zone status (clear / crowded) → Firebase updates instantly
- Receive control room instructions in real time with acknowledgement

**Control room simultaneously:**
- Scrub a simulation timeline slider (t=0 to t=480 min) to test any scenario
- Send targeted instructions to specific zones
- Broadcast nudges to all attendees
- Get AI-generated crowd insights every 2 minutes (Gemini)

---

## 🖥️ Demo Path (5 minutes for judges)

### Step 1 — Control Room *(open on desktop)*
1. Go to [/control-login](https://eventflow-4f04a.web.app/control-login)
2. Login: `control@eventflow.demo` / `Control@123`
3. Drag the **Timeline** slider to `t=240` (innings break)
4. Watch North zone turn **red** on the satellite map
5. Click **Dispatch** → send instruction to staff

### Step 2 — Staff Panel *(open in second window)*
1. Go to [/staff-login](https://eventflow-4f04a.web.app/staff-login)
2. Login: `staff@eventflow.demo` / `Staff@123`, zone → *North Concourse*
3. The instruction from Step 1 appears instantly
4. Toggle zone to **CROWDED** → see map update in control room

### Step 3 — Attendee App *(open on mobile or narrow window)*
1. Go to [eventflow-4f04a.web.app](https://eventflow-4f04a.web.app/)
2. Tap **Match Attendee** (no login needed)
3. Complete the 5-question intake
4. Check personalized gate recommendation
5. Tap 🤖 → ask *"What's the fastest exit?"*
6. Navigate to **During** → see the live nudge from control room

---

## 🔑 Login Credentials

| Role | Email | Password |
|------|-------|----------|
| Attendee | *(tap "Match Attendee" — anonymous)* | — |
| Staff | `staff@eventflow.demo` | `Staff@123` |
| Control Room | `control@eventflow.demo` | `Control@123` |

> Create these accounts in **Firebase Console → Authentication → Add user**

---

## 📌 Assumptions Made

- Stadium coordinates: NMS, Ahmedabad (23.0918°N, 72.5972°E)
- Match simulation: T20, 18:00 IST start, 8-hour simulation window
- Zone overlays are approximate bounding rectangles (not exact CAD polygons)
- Gemini AI has a graceful hardcoded fallback when the API key is not set
- Firebase Anonymous Authentication must be enabled in the Firebase console
- Staff/Control accounts must be manually created in Firebase Authentication

---

## 💻 Local Setup

```bash
# Clone
git clone https://github.com/chparam612/Eventflow_n.git
cd Eventflow_n

# Add your real API keys to:
# - src/firebase.js     (Firebase config)
# - public/index.html   (Google Maps key)

# Run dev server (no npm install needed)
node server.js

# Open
http://localhost:3000
```

---

## 🧪 Running Tests

```bash
node tests/core.test.js
```

Expected result:
```
Results: 38/38 tests passed
🎉 All tests passed — EventFlow V2 is stable.
```

---

## 🚀 Firebase Deployment

```bash
node build.js          # copies src/ → public/src/
firebase login
firebase deploy
```

---

## 🔮 Future Roadmap

- [ ] WebRTC video from zone cameras into control room
- [ ] BLE beacon indoor positioning (exact row/seat)
- [ ] WhatsApp nudges via Meta API
- [ ] Predictive surge AI (10-minute advance warning)
- [ ] Service Worker offline PWA caching
- [ ] Multi-stadium support (Wankhede, Eden Gardens)

---

## ♿ Accessibility

- All buttons have `title` attributes and emoji labels
- Color is never the sole status indicator — text labels always accompany colors
- Minimum font size: 0.78rem (~12.5px) throughout
- Dark theme meets WCAG AA contrast ratio
- Touch targets minimum 44×44px on mobile

---

## 🛠️ Tech Stack

| Layer | Technology |
|-------|------------|
| Frontend | Vanilla JavaScript ES Modules (zero framework) |
| Styling | CSS Variables + Vanilla CSS |
| Database | Firebase Realtime Database v10.8.0 |
| Auth | Firebase Authentication v10.8.0 |
| Hosting | Firebase Hosting (edge-cached) |
| Maps | Google Maps JavaScript API — satellite + zone overlays |
| AI | Google Gemini 2.0 Flash |
| Fonts | Google Fonts — DM Sans + Space Grotesk |
| Tests | Node.js native (no test framework) |

---

*EventFlow V2 · Google Prompt Wars 2026 · Built with ❤️ for NMS*