/**
 * EventFlow V2 — Firebase Module
 * Version: 10.8.0 ONLY — never mix versions
 */
import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js';
import {
  getDatabase, ref, set, push, onValue,
  query, orderByChild, equalTo, limitToLast, off
} from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-database.js';
import { getAnalytics, isSupported as analyticsSupported, logEvent } from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-analytics.js';
import {
  getRemoteConfig, isSupported as remoteConfigSupported,
  fetchAndActivate, getValue
} from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-remote-config.js';
import { initializeAppCheck, ReCaptchaV3Provider } from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-app-check.js';
import { getPerformance, isSupported as performanceSupported, trace } from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-performance.js';
import { getFunctions, httpsCallable } from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-functions.js';
import { buildTelemetryRecord, sanitizeTelemetryParams, toBooleanSetting, toNumberSetting } from '/src/observability.js';

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
let analytics = null;
let remoteConfig = null;
let performance = null;
let ingestTelemetryFn = null;
let googleServicesInitPromise = null;

const REMOTE_CONFIG_DEFAULTS = {
  ai_insights_interval_ms: '120000',
  auto_alert_cooldown_ms: '300000',
  telemetry_sink: 'database',
  telemetry_function_enabled: 'false'
};

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

async function initRemoteConfig() {
  const supported = await remoteConfigSupported();
  if (!supported) return null;
  remoteConfig = getRemoteConfig(app);
  remoteConfig.defaultConfig = REMOTE_CONFIG_DEFAULTS;
  remoteConfig.settings.minimumFetchIntervalMillis = 60000;
  await fetchAndActivate(remoteConfig).catch(() => {});
  return remoteConfig;
}

async function initAnalytics() {
  const supported = await analyticsSupported();
  if (!supported) return null;
  analytics = getAnalytics(app);
  return analytics;
}

async function initPerformance() {
  const supported = await performanceSupported();
  if (!supported) return null;
  performance = getPerformance(app);
  return performance;
}

function initAppCheckIfConfigured() {
  const siteKey = window.__EF_APPCHECK_SITE_KEY || '';
  if (!siteKey) return;
  initializeAppCheck(app, {
    provider: new ReCaptchaV3Provider(siteKey),
    isTokenAutoRefreshEnabled: true
  });
}

function initFunctionsSink() {
  try {
    const functions = getFunctions(app, 'asia-south1');
    ingestTelemetryFn = httpsCallable(functions, 'ingestTelemetry');
  } catch (e) {
    ingestTelemetryFn = null;
  }
}

export function getConfigValue(key, fallback = '') {
  if (!remoteConfig) return fallback;
  try {
    const val = getValue(remoteConfig, key)?.asString?.() ?? '';
    return val === '' ? fallback : val;
  } catch (e) {
    return fallback;
  }
}

export function getNumberConfig(key, fallback, min = Number.NEGATIVE_INFINITY, max = Number.POSITIVE_INFINITY) {
  return toNumberSetting(getConfigValue(key, fallback), fallback, min, max);
}

export function getBooleanConfig(key, fallback = false) {
  return toBooleanSetting(getConfigValue(key, String(fallback)), fallback);
}

export async function initGoogleServices(source = 'app') {
  if (googleServicesInitPromise) return googleServicesInitPromise;
  googleServicesInitPromise = (async () => {
    initAppCheckIfConfigured();
    initFunctionsSink();
    await Promise.allSettled([
      initRemoteConfig(),
      initAnalytics(),
      initPerformance()
    ]);
    void trackEvent('google_services_initialized', { source }, { route: '/' });
  })();
  return googleServicesInitPromise;
}

export function startPerformanceTrace(name) {
  if (!performance || !name) return null;
  try {
    const t = trace(performance, String(name).slice(0, 80));
    t.start();
    return t;
  } catch (e) {
    return null;
  }
}

export function stopPerformanceTrace(perfTrace, attributes = {}) {
  if (!perfTrace) return;
  try {
    Object.entries(sanitizeTelemetryParams(attributes)).forEach(([k, v]) => perfTrace.putAttribute(k, String(v)));
    perfTrace.stop();
  } catch (e) {}
}

export async function trackEvent(eventName, params = {}, context = {}) {
  const record = buildTelemetryRecord(eventName, params, context);
  try {
    const tasks = [push(ref(db, 'analyticsEvents'), record)];
    if (analytics) {
      logEvent(analytics, record.eventName, sanitizeTelemetryParams(record.params));
    }
    const useFunctions =
      context.forceFunctions ||
      getConfigValue('telemetry_sink', 'database') === 'functions' ||
      getBooleanConfig('telemetry_function_enabled', false);
    if (useFunctions && ingestTelemetryFn) {
      tasks.push(ingestTelemetryFn(record));
    }
    await Promise.allSettled(tasks);
  } catch (e) {
    if (!String(e?.message || '').includes('permission_denied')) {
      console.warn('[Firebase] telemetry failed:', e.message || e);
    }
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
    await trackEvent('feedback_submitted', {
      rating: data?.rating || 0,
      helpfulness: data?.helpfulness || 'na'
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
