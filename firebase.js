import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";

import {
  getAuth,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  GoogleAuthProvider,
  signInWithPopup,
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";

import {
  getFirestore,
  doc,
  setDoc,
  getDoc,
  collection,
  getDocs,
  query,
  orderBy,
  serverTimestamp,
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

// ======================================================
//  FIREBASE CONFIG
//  KTU VEQ NDRROJI ME TUTAT PREJ FIREBASE
// ======================================================

const firebaseConfig = {
  apiKey: "PASTE_API_KEY",
  authDomain: "PASTE_AUTH_DOMAIN",
  projectId: "PASTE_PROJECT_ID",
  storageBucket: "PASTE_STORAGE_BUCKET",
  messagingSenderId: "PASTE_SENDER_ID",
  appId: "PASTE_APP_ID",
};

// ======================================================
//  INIT
// ======================================================

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db = getFirestore(app);

// ======================================================
//  AUTH FUNCTIONS
// ======================================================

export async function register(email, password, name) {
  const cred = await createUserWithEmailAndPassword(auth, email, password);

  await setDoc(doc(db, "users", cred.user.uid), {
    name: name,
    email: email,
    createdAt: serverTimestamp(),
    streak: 0,
    totalPomodoros: 0,
  });

  return cred.user;
}

export async function login(email, password) {
  const cred = await signInWithEmailAndPassword(auth, email, password);

  return cred.user;
}

export async function logout() {
  await signOut(auth);

  window.location.href = "login.html";
}

export function onAuth(callback) {
  onAuthStateChanged(auth, callback);
}

// ======================================================
//  GOOGLE LOGIN
// ======================================================

export async function googleLogin() {
  const provider = new GoogleAuthProvider();

  const result = await signInWithPopup(auth, provider);

  return result.user;
}

// ======================================================
//  USER DATA
// ======================================================

export async function getUserData() {
  const user = auth.currentUser;

  if (!user) return null;

  const snap = await getDoc(doc(db, "users", user.uid));

  if (!snap.exists()) return null;

  return snap.data();
}

// ======================================================
//  MOODS
// ======================================================

export async function saveMood(mood) {
  const user = auth.currentUser;

  if (!user) return;

  const today = new Date().toISOString().split("T")[0];

  await setDoc(doc(db, "users", user.uid, "moods", today), {
    mood,
    date: today,
    timestamp: serverTimestamp(),
  });
}

export async function getMoodHistory() {
  const user = auth.currentUser;

  if (!user) return [];

  const q = query(
    collection(db, "users", user.uid, "moods"),
    orderBy("date", "desc"),
  );

  const snap = await getDocs(q);

  return snap.docs.map((doc) => doc.data()).slice(0, 7);
}
