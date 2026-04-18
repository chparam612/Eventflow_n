/**
 * EventFlow V2 — Firebase Module
 * Version: 10.8.0 ONLY — never mix versions
 */
import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js';
import {
  getAnalytics,
  isSupported,
  logEvent as firebaseLogEvent
} from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-analytics.js';
import {
  getDatabase, ref, set, push, onValue,
  query, orderByChild, equalTo, limitToLast, off
} from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-database.js';
import { buildTelemetryRecord } from '/src/observability.js';

// ─── Firebase Config ───────────────────────────────────────────────────────
// Replace with your actual Firebase project config
const firebaseConfig = {
  apiKey: "AIzaSyBYRQswMKJZITJwta4IBnZfdQ-Sw7kercQ",
  authDomain: "eventflow-4f04a.firebaseapp.com",
  databaseURL: "https://eventflow-4f04a-default-rtdb.firebaseio.com",
  projectId: "eventflow-4f04a",
  storageBucket: "eventflow-4f04a.firebasestorage.app",
  messagingSenderId: "48936766474",
  appId: "1:48936766474:web:605b8c457f3a73ca0463f3",
  measurementId: "G-ZJ6Q3RCY0N"
};


// ─── App Init ──────────────────────────────────────────────────────────────
export const app = initializeApp(firebaseConfig);
const db = getDatabase(app);
const CLOUD_BACKEND_BASE = (typeof window !== 'undefined' && window.__EF_CLOUD_BACKEND_BASE__) || '';
let _cloudEndpointWarned = false;
let _analytics = null;
let _analyticsInitPromise = null;
const MAX_ANALYTICS_SCOPE_LENGTH = 32;

// ─── Write Guard — prevents infinite recursion loops ──────────────────────
const _writing = new Set();
const _activeListeners = new Map();

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

function registerListener(key, targetRef, handler) {
  const existing = _activeListeners.get(key);
  if (existing?.targetRef) {
    try { off(existing.targetRef); } catch (_) {}
  }
  onValue(targetRef, handler);
  _activeListeners.set(key, { targetRef });
  return () => {
    const current = _activeListeners.get(key);
    if (current?.targetRef === targetRef) {
      try { off(targetRef); } catch (_) {}
      _activeListeners.delete(key);
      return;
    }
    try { off(targetRef); } catch (_) {}
  };
}

async function writeAuditTrail(action, payload = {}, actor = 'system') {
  try {
    await push(ref(db, 'auditTrail'), {
      action,
      actor,
      payload,
      timestamp: Date.now()
    });
  } catch (_) {}
}

export async function pushAnalyticsEvent(type, payload = {}) {
  try {
    const event = {
      type,
      payload,
      source: 'eventflow-web',
      timestamp: Date.now()
    };
    await push(ref(db, 'analytics/events'), event);
    return event;
  } catch (_) {
    return null;
  }
}

export async function pushPerformanceMetric(name, value, context = {}) {
  return pushAnalyticsEvent('performance_metric', { name, value, ...context });
}

export async function initGoogleServices(scope = 'app') {
  if (_analyticsInitPromise) return _analyticsInitPromise;
  _analyticsInitPromise = (async () => {
    if (typeof window === 'undefined') return { analyticsEnabled: false };
    try {
      const analyticsSupported = await isSupported().catch(error => {
        console.warn('[Firebase] Analytics support check failed. Analytics will be disabled:', error?.message || error);
        return false;
      });
      if (!analyticsSupported) return { analyticsEnabled: false };
      _analytics = getAnalytics(app);
      try {
        firebaseLogEvent(_analytics, 'google_services_initialized', {
          scope: String(scope || 'app').slice(0, MAX_ANALYTICS_SCOPE_LENGTH)
        });
      } catch (_) {}
      return { analyticsEnabled: true };
    } catch (error) {
      console.warn('[Firebase] Analytics init failed:', error?.message || error);
      return { analyticsEnabled: false };
    }
  })();
  return _analyticsInitPromise;
}

export async function trackEvent(eventName, params = {}, context = {}) {
  const record = buildTelemetryRecord(eventName, params, {
    source: 'eventflow-web',
    ...context
  });
  try {
    await initGoogleServices('trackEvent');
    if (_analytics) {
      firebaseLogEvent(_analytics, record.eventName, record.params);
    }
  } catch (_) {}
  await pushAnalyticsEvent(record.eventName, {
    ...record.params,
    route: record.route,
    role: record.role,
    uid: record.uid
  });
  return record;
}

export async function invokeCloudWorkflow(route, payload = {}) {
  if (!CLOUD_BACKEND_BASE) {
    if (!_cloudEndpointWarned) {
      _cloudEndpointWarned = true;
      console.info('[Firebase] Cloud workflow endpoint is not configured; using local fallback only.');
    }
    return null;
  }
  try {
    const res = await fetch(`${CLOUD_BACKEND_BASE}${route}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    if (!res.ok) return null;
    return await res.json();
  } catch (_) {
    return null;
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
      updatedBy: uid,
      updatedAt: Date.now()
    })
  );
  await writeAuditTrail('staff_status_updated', { uid, zone, status, online }, uid);
}

export async function pushInstruction(zoneId, message, sentBy) {
  const key = 'instr:' + zoneId + ':' + Date.now();
  await safeWrite(key, async () => {
    await push(ref(db, 'instructions'), {
      zoneId,
      message,
      sentBy,
      sentAt: Date.now(),
      acked: {}
    });
  });
  await pushAnalyticsEvent('instruction_dispatched', { zoneId, sentBy, messageLength: message.length });
  await writeAuditTrail('instruction_dispatched', { zoneId, message }, sentBy || 'unknown');
}

export async function pushNudge(zoneId, message) {
  await safeWrite('nudge:' + zoneId + ':' + Date.now(), () =>
    push(ref(db, 'nudges'), {
      zoneId,
      message,
      sentAt: Date.now()
    })
  );
  await pushAnalyticsEvent('attendee_nudge_sent', { zoneId, messageLength: message.length });
}

export async function pushStaffReport(uid, zoneId, type, message = '') {
  await safeWrite('staff_report:' + uid + ':' + Date.now(), async () => {
    await push(ref(db, 'staffReports'), {
      uid,
      zoneId,
      type,
      message,
      createdAt: Date.now()
    });
  });
  await pushAnalyticsEvent('staff_quick_report', { uid, zoneId, type });
  await writeAuditTrail('staff_report_submitted', { uid, zoneId, type }, uid);
}

export async function ackInstruction(instructionId, staffUid, zoneId) {
  if (!instructionId || !staffUid) return;
  const ackAt = Date.now();
  await safeWrite('ack:' + instructionId + ':' + staffUid, async () => {
    await set(ref(db, `instructions/${instructionId}/acked/${staffUid}`), ackAt);
  });
  await pushAnalyticsEvent('instruction_acknowledged', { instructionId, staffUid, zoneId, ackAt });
  await writeAuditTrail('instruction_acknowledged', { instructionId, zoneId, ackAt }, staffUid);
  await invokeCloudWorkflow('/instructionAck', { instructionId, staffUid, zoneId, ackAt });
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
  await safeWrite('emergency_status', () =>
    set(ref(db, 'emergency/status'), {
      active,
      type,
      zone,
      timestamp: active ? Date.now() : null
    })
  );
}

// ─── Listeners ─────────────────────────────────────────────────────────────

export function listenZones(cb) {
  const r = ref(db, 'zones');
  return registerListener('zones:global', r, snap => cb(snap.val() || {}));
}

export function listenInstructions(zoneId, cb, options = {}) {
  const limit = Math.max(1, Math.min(30, options.limit || 10));
  const since = options.since || 0;
  const q = query(
    ref(db, 'instructions'),
    orderByChild('zoneId'),
    equalTo(zoneId),
    limitToLast(limit)
  );
  return registerListener('instructions:' + zoneId, q, snap => {
    const items = [];
    snap.forEach(c => {
      const row = { id: c.key, ...c.val() };
      if (!since || (row.sentAt || 0) >= since) items.push(row);
    });
    if (cb) cb(items.reverse());
  });
}

export function listenNudges(cb) {
  const q = query(ref(db, 'nudges'), limitToLast(5));
  return registerListener('nudges:global', q, snap => {
    const items = [];
    snap.forEach(c => items.push({ id: c.key, ...c.val() }));
    if (cb) cb(items.reverse());
  });
}

export function listenAllStaff(cb) {
  const r = ref(db, 'staff');
  return registerListener('staff:all', r, snap => cb(snap.val() || {}));
}

export function listenEmergency(cb) {
  const r = ref(db, 'emergency/status');
  return registerListener('emergency:status', r, snap => {
    const val = snap.val();
    if (!val) {
      // Initialize if missing
      set(ref(db, 'emergency/status'), { active: false });
      cb({ active: false });
    } else {
      cb(val);
    }
  });
}
