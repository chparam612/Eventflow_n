/**
 * EventFlow V2 — Firebase Module
 * Version: 10.8.0 ONLY — never mix versions
 */
import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js';
import {
  getDatabase, ref, set, push, onValue,
  query, orderByChild, equalTo, limitToLast, off
} from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-database.js';

// ─── Firebase Config ───────────────────────────────────────────────────────
// Replace with your actual Firebase project config
const firebaseConfig = {
  apiKey: "YOUR_API_KEY",
  authDomain: "eventflow-4f04a.firebaseapp.com",
  databaseURL: "https://eventflow-4f04a-default-rtdb.firebaseio.com",
  projectId: "eventflow-4f04a",
  storageBucket: "eventflow-4f04a.firebasestorage.app",
  messagingSenderId: "YOUR_MESSAGING_SENDER_ID",
  appId: "YOUR_APP_ID",
  measurementId: "YOUR_MEASUREMENT_ID"
};


// ─── App Init ──────────────────────────────────────────────────────────────
export const app = initializeApp(firebaseConfig);
const db = getDatabase(app);

// ─── Write Guard — prevents infinite recursion loops ──────────────────────
const _writing = new Set();

async function safeWrite(key, fn) {
  if (_writing.has(key)) return;
  _writing.add(key);
  try {
    await fn();
  } catch (e) {
    console.warn('[Firebase] Write failed:', key, e.message);
  } finally {
    _writing.delete(key);
  }
}

// ─── Write Helpers ─────────────────────────────────────────────────────────

export async function writeZone(zoneId, density, status) {
  await safeWrite('zone:' + zoneId, () =>
    set(ref(db, 'zones/' + zoneId), {
      density,
      status,
      updatedAt: Date.now()
    })
  );
}

export async function writeStaffStatus(uid, zone, status, online = true) {
  await safeWrite('staff:' + uid, () =>
    set(ref(db, 'staff/' + uid), {
      zone,
      status,
      online,
      updatedAt: Date.now()
    })
  );
}

export async function pushInstruction(zoneId, message, sentBy) {
  await safeWrite('instr:' + zoneId + ':' + Date.now(), () =>
    push(ref(db, 'instructions'), {
      zoneId,
      message,
      sentBy,
      sentAt: Date.now(),
      acked: []
    })
  );
}

export async function pushNudge(zoneId, message) {
  await safeWrite('nudge:' + zoneId + ':' + Date.now(), () =>
    push(ref(db, 'nudges'), {
      zoneId,
      message,
      sentAt: Date.now()
    })
  );
}

export async function saveAttendeeData(uid, data) {
  await safeWrite('att:' + uid, () =>
    set(ref(db, 'attendees/' + uid), {
      ...data,
      savedAt: Date.now()
    })
  );
}

export async function saveFeedback(data) {
  try {
    await push(ref(db, 'feedback'), {
      ...data,
      submittedAt: Date.now()
    });
  } catch (e) {
    console.warn('[Firebase] Feedback save failed:', e.message);
  }
}

export async function setEmergencyStatus(active, type = null, zone = null) {
  try {
    await safeWrite('emergency_status', () =>
      set(ref(db, 'emergency/status'), {
        active,
        type,
        zone,
        timestamp: active ? Date.now() : null
      })
    );
  } catch (error) {
    console.error("Emergency write failed:", error);
  }
}

// ─── Listeners ─────────────────────────────────────────────────────────────

export function listenZones(cb) {
  const r = ref(db, 'zones');
  onValue(r, snap => cb(snap.val() || {}));
  return () => off(r);
}

export function listenInstructions(zoneId, cb) {
  const q = query(
    ref(db, 'instructions'),
    orderByChild('zoneId'),
    equalTo(zoneId),
    limitToLast(10)
  );
  onValue(q, snap => {
    const items = [];
    snap.forEach(c => items.push({ id: c.key, ...c.val() }));
    if (cb) cb(items.reverse());
  });
  return () => off(q);
}

export function listenNudges(cb) {
  const q = query(ref(db, 'nudges'), limitToLast(5));
  onValue(q, snap => {
    const items = [];
    snap.forEach(c => items.push({ id: c.key, ...c.val() }));
    if (cb) cb(items.reverse());
  });
  return () => off(q);
}

export function listenAllStaff(cb) {
  const r = ref(db, 'staff');
  onValue(r, snap => cb(snap.val() || {}));
  return () => off(r);
}

export function listenEmergency(cb) {
  const r = ref(db, 'emergency/status');
  onValue(r, snap => {
    const val = snap.val();
    if (!val) {
      // Initialize if missing
      set(ref(db, 'emergency/status'), { active: false });
      cb({ active: false });
    } else {
      cb(val);
    }
  });
  return () => off(r);
}
