/**
 * EventFlow V2 — Auth Module
 * Firebase Auth version 10.8.0 ONLY
 */
import {
  getAuth,
  signInWithEmailAndPassword,
  signInAnonymously,
  signOut,
  onAuthStateChanged
} from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js';

import { app } from '/src/firebase.js';

const auth = getAuth(app);

// ─── Wait for Firebase auth to settle before reading user ─────────────────
export function waitForAuth() {
  return new Promise(resolve => {
    const unsub = onAuthStateChanged(auth, user => {
      unsub();
      resolve(user);
    });
  });
}

// Always use this — never auth.currentUser directly
export async function getCurrentUser() {
  return waitForAuth();
}

// ─── Email Login ───────────────────────────────────────────────────────────
export async function loginWithEmail(email, password) {
  try {
    const cred = await signInWithEmailAndPassword(auth, email, password);
    const user = cred.user;

    // Determine role from email
    let role = 'unknown';
    if (user.email?.includes('staff'))   role = 'staff';
    if (user.email?.includes('control')) role = 'control';

    localStorage.setItem('ef_role', role);
    localStorage.setItem('ef_uid', user.uid);
    localStorage.setItem('ef_email', user.email);
    return user;
  } catch (e) {
    const friendlyCodes = [
      'auth/invalid-credential',
      'auth/wrong-password',
      'auth/user-not-found',
      'auth/invalid-email'
    ];
    if (friendlyCodes.includes(e.code)) {
      throw new Error('Invalid email or password');
    }
    throw new Error('Login failed. Check your connection.');
  }
}

// ─── Anonymous Login (attendees) ───────────────────────────────────────────
export async function loginAnonymously() {
  try {
    const cred = await signInAnonymously(auth);
    localStorage.setItem('ef_role', 'attendee');
    localStorage.setItem('ef_uid', cred.user.uid);
    return cred.user;
  } catch (e) {
    // Graceful fallback — app still works offline/unauthenticated
    console.warn('[Auth] Anonymous login failed:', e.code);
    const fakeUid = 'local_' + Math.random().toString(36).slice(2, 10);
    localStorage.setItem('ef_role', 'attendee');
    localStorage.setItem('ef_uid', fakeUid);
    return { uid: fakeUid, isAnonymous: true };
  }
}

// ─── Logout ────────────────────────────────────────────────────────────────
export async function logout() {
  try { await signOut(auth); } catch (e) { /* ignore */ }
  localStorage.clear();
  sessionStorage.clear();
  window.location.replace('/');
}

// ─── Role Checks ───────────────────────────────────────────────────────────
export function isStaffUser(user) {
  return Boolean(user?.email?.includes('staff'));
}

export function isControlUser(user) {
  return Boolean(user?.email?.includes('control'));
}

export function isAttendee(user) {
  return Boolean(user?.isAnonymous || localStorage.getItem('ef_role') === 'attendee');
}
