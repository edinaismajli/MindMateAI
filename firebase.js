// ============================================================
//  MindMATE AI+ — Firebase Configuration & Database Helpers
//  Instruksione:
//  1. Shko te https://firebase.google.com dhe krijo projekt
//  2. Project Settings → General → Your apps → Add Web App
//  3. Kopjo firebaseConfig dhe zëvendëso vlerat më poshtë
//  4. Aktivizo: Authentication (Email/Password) + Firestore
// ============================================================

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut, onAuthStateChanged }
  from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import { getFirestore, doc, setDoc, getDoc, collection, addDoc, getDocs, updateDoc, deleteDoc, orderBy, query, serverTimestamp }
  from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

// ── ZËVENDËSO ME TË DHËNAT E TUAT FIREBASE ──
const firebaseConfig = {
  apiKey:            "AIzaSy-VENDOS-KETU-API-KEY",
  authDomain:        "mindmate-ai-plus.firebaseapp.com",
  projectId:         "mindmate-ai-plus",
  storageBucket:     "mindmate-ai-plus.appspot.com",
  messagingSenderId: "123456789",
  appId:             "1:123456789:web:abcdef123456"
};

const app  = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db   = getFirestore(app);

// ============================================================
//  AUTH FUNCTIONS
// ============================================================

/** Regjistrim me email + password */
export async function register(email, password, name) {
  const cred = await createUserWithEmailAndPassword(auth, email, password);
  await setDoc(doc(db, "users", cred.user.uid), {
    name, email,
    createdAt: serverTimestamp(),
    streak: 0,
    totalPomodoros: 0
  });
  return cred.user;
}

/** Login */
export async function login(email, password) {
  const cred = await signInWithEmailAndPassword(auth, email, password);
  return cred.user;
}

/** Logout */
export async function logout() {
  await signOut(auth);
  window.location.href = "login.html";
}

/** Merr userin aktual — kthen null nëse nuk është i loguar */
export function getCurrentUser() {
  return auth.currentUser;
}

/** Dëgjo ndryshimin e auth state */
export function onAuth(callback) {
  onAuthStateChanged(auth, callback);
}

// ============================================================
//  MOOD FUNCTIONS
// ============================================================

/** Ruaj mood të ditës */
export async function saveMood(mood) {
  const user = auth.currentUser;
  if (!user) return;
  const today = new Date().toISOString().split("T")[0]; // "2026-05-16"
  await setDoc(doc(db, "users", user.uid, "moods", today), {
    mood,
    date: today,
    timestamp: serverTimestamp()
  });
}

/** Merr mood-et e 7 ditëve të fundit */
export async function getMoodHistory() {
  const user = auth.currentUser;
  if (!user) return [];
  const q = query(collection(db, "users", user.uid, "moods"), orderBy("date", "desc"));
  const snap = await getDocs(q);
  return snap.docs.map(d => d.data()).slice(0, 7);
}

// ============================================================
//  HABIT FUNCTIONS
// ============================================================

/** Ruaj të gjitha habits */
export async function saveHabits(habits) {
  const user = auth.currentUser;
  if (!user) return;
  await setDoc(doc(db, "users", user.uid, "data", "habits"), {
    habits,
    updatedAt: serverTimestamp()
  });
}

/** Merr habits */
export async function getHabits() {
  const user = auth.currentUser;
  if (!user) return null;
  const snap = await getDoc(doc(db, "users", user.uid, "data", "habits"));
  return snap.exists() ? snap.data().habits : null;
}

// ============================================================
//  STUDY PLANNER FUNCTIONS
// ============================================================

/** Ruaj tasks për një ditë specifike */
export async function saveTasks(dateKey, tasks) {
  const user = auth.currentUser;
  if (!user) return;
  await setDoc(doc(db, "users", user.uid, "tasks", dateKey), {
    tasks,
    updatedAt: serverTimestamp()
  });
}

/** Merr tasks për një ditë */
export async function getTasks(dateKey) {
  const user = auth.currentUser;
  if (!user) return null;
  const snap = await getDoc(doc(db, "users", user.uid, "tasks", dateKey));
  return snap.exists() ? snap.data().tasks : null;
}

// ============================================================
//  POMODORO FUNCTIONS
// ============================================================

/** Ruaj statistikat e Pomodoro */
export async function savePomodoro(cycles, minutesFocused) {
  const user = auth.currentUser;
  if (!user) return;
  const today = new Date().toISOString().split("T")[0];
  await setDoc(doc(db, "users", user.uid, "pomodoro", today), {
    cycles,
    minutesFocused,
    date: today,
    updatedAt: serverTimestamp()
  });
}

/** Merr stats të Pomodoro për sot */
export async function getTodayPomodoro() {
  const user = auth.currentUser;
  if (!user) return null;
  const today = new Date().toISOString().split("T")[0];
  const snap = await getDoc(doc(db, "users", user.uid, "pomodoro", today));
  return snap.exists() ? snap.data() : { cycles: 0, minutesFocused: 0 };
}

/** Merr stats totale për dashboard */
export async function getDashboardStats() {
  const user = auth.currentUser;
  if (!user) return null;

  // Pomodoro last 7 days
  const pomoSnap = await getDocs(
    query(collection(db, "users", user.uid, "pomodoro"), orderBy("date", "desc"))
  );
  const pomoData = pomoSnap.docs.map(d => d.data()).slice(0, 7);

  // Moods last 7 days
  const moodSnap = await getDocs(
    query(collection(db, "users", user.uid, "moods"), orderBy("date", "desc"))
  );
  const moodData = moodSnap.docs.map(d => d.data()).slice(0, 7);

  // User profile
  const userSnap = await getDoc(doc(db, "users", user.uid));
  const userData = userSnap.exists() ? userSnap.data() : {};

  const totalMinutes = pomoData.reduce((s, d) => s + (d.minutesFocused || 0), 0);
  const totalCycles  = pomoData.reduce((s, d) => s + (d.cycles || 0), 0);

  return {
    tasksCompleted: totalCycles * 2,
    studyHours: (totalMinutes / 60).toFixed(1),
    focusScore: Math.min(99, 60 + totalCycles * 2) + "%",
    streak: userData.streak || pomoData.length,
    moodHistory: moodData.reverse(),
    userName: userData.name || "Student"
  };
}

export { auth, db };
