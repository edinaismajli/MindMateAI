// MindMATE AI+ PHP API helper.

const API_URL = (() => {
  if (window.location.protocol === 'file:') {
    return 'http://127.0.0.1:8000/api.php';
  }

  const basePath = window.location.pathname.replace(/\/[^/]*$/, '');
  return `${window.location.origin}${basePath}/api.php`;
})();

const TOKEN_KEY = 'mindmate_token';
const USER_KEY = 'mindmate_user';

function getToken() {
  return localStorage.getItem(TOKEN_KEY);
}

function setSession(token, user) {
  localStorage.setItem(TOKEN_KEY, token);
  localStorage.setItem(USER_KEY, JSON.stringify(user));
}

function clearSession() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
}

function savedUser() {
  try {
    return JSON.parse(localStorage.getItem(USER_KEY) || 'null');
  } catch {
    return null;
  }
}

async function api(action, data = {}, needsAuth = true) {
  const headers = { 'Content-Type': 'application/json' };
  const token = getToken();

  if (needsAuth && token) {
    headers.Authorization = `Bearer ${token}`;
  }

  let res;
  try {
    res = await fetch(API_URL, {
      method: 'POST',
      headers,
      body: JSON.stringify({ action, ...data }),
    });
  } catch {
    throw new Error('Serveri PHP nuk eshte ndezur. Hape start-server.bat dhe provo perseri.');
  }

  const json = await res.json().catch(() => ({}));
  if (!res.ok || json.ok === false) {
    const err = new Error(json.message || 'API request failed.');
    err.code = json.code || 'api/error';
    throw err;
  }

  return json;
}

export async function register(email, password, name) {
  const json = await api('register', { email, password, name }, false);
  setSession(json.token, json.user);
  return json.user;
}

export async function login(email, password) {
  const json = await api('login', { email, password }, false);
  setSession(json.token, json.user);
  return json.user;
}

export async function logout() {
  try {
    if (getToken()) {
      await api('logout', {}, true);
    }
  } catch {
    // Local logout should still happen if the server is not reachable.
  }
  clearSession();
  window.location.href = 'login.html';
}

export function getCurrentUser() {
  return savedUser();
}

export function onAuth(callback) {
  callback(savedUser());
}

export async function saveMood(mood) {
  if (!getToken()) return;
  await api('saveMood', { mood });
}

export async function getMoodHistory() {
  if (!getToken()) return [];
  const json = await api('getMoodHistory');
  return json.moods || [];
}

export async function saveHabits(habits) {
  if (!getToken()) return;
  await api('saveHabits', { habits });
}

export async function getHabits() {
  if (!getToken()) return null;
  const json = await api('getHabits');
  return json.habits || null;
}

export async function saveTasks(dateKey, tasks) {
  if (!getToken()) return;
  await api('saveTasks', { dateKey, tasks });
}

export async function getTasks(dateKey) {
  if (!getToken()) return null;
  const json = await api('getTasks', { dateKey });
  return json.tasks || null;
}

export async function savePomodoro(cycles, minutesFocused) {
  if (!getToken()) return;
  await api('savePomodoro', { cycles, minutesFocused });
}

export async function getTodayPomodoro() {
  if (!getToken()) return null;
  const json = await api('getTodayPomodoro');
  return json.pomodoro || { cycles: 0, minutesFocused: 0 };
}

export async function getDashboardStats() {
  if (!getToken()) return null;
  const json = await api('getDashboardStats');
  return json.stats || null;
}
