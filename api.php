<?php
declare(strict_types=1);

header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(204);
    exit;
}

function respond(array $data, int $status = 200): void {
    http_response_code($status);
    echo json_encode($data);
    exit;
}

function input_json(): array {
    $raw = file_get_contents('php://input');
    $data = json_decode($raw ?: '{}', true);
    return is_array($data) ? $data : [];
}

function db(): PDO {
    static $pdo = null;
    if ($pdo instanceof PDO) {
        return $pdo;
    }

    $dataDir = __DIR__ . '/api-data';
    if (!is_writable($dataDir)) {
        $dataDir = sys_get_temp_dir() . '/mindmate-ai-data';
    }
    if (!is_dir($dataDir)) {
        mkdir($dataDir, 0777, true);
    }

    $pdo = new PDO('sqlite:' . $dataDir . '/mindmate.sqlite');
    $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
    $pdo->exec('PRAGMA foreign_keys = ON');
    $pdo->exec("
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            email TEXT NOT NULL UNIQUE,
            password_hash TEXT NOT NULL,
            created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
        );
        CREATE TABLE IF NOT EXISTS sessions (
            token TEXT PRIMARY KEY,
            user_id INTEGER NOT NULL,
            created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
        );
        CREATE TABLE IF NOT EXISTS moods (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            mood TEXT NOT NULL,
            date_key TEXT NOT NULL,
            created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
            UNIQUE(user_id, date_key),
            FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
        );
        CREATE TABLE IF NOT EXISTS habits (
            user_id INTEGER PRIMARY KEY,
            habits_json TEXT NOT NULL,
            updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
        );
        CREATE TABLE IF NOT EXISTS tasks (
            user_id INTEGER NOT NULL,
            date_key TEXT NOT NULL,
            tasks_json TEXT NOT NULL,
            updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
            PRIMARY KEY(user_id, date_key),
            FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
        );
        CREATE TABLE IF NOT EXISTS pomodoro (
            user_id INTEGER NOT NULL,
            date_key TEXT NOT NULL,
            cycles INTEGER NOT NULL DEFAULT 0,
            minutes_focused INTEGER NOT NULL DEFAULT 0,
            updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
            PRIMARY KEY(user_id, date_key),
            FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
        );
    ");

    return $pdo;
}

function public_user(array $row): array {
    return [
        'uid' => (string)$row['id'],
        'id' => (int)$row['id'],
        'name' => $row['name'],
        'email' => $row['email'],
    ];
}

function auth_user(): array {
    $headers = getallheaders();
    $auth = $headers['Authorization'] ?? $headers['authorization'] ?? '';
    if (!preg_match('/Bearer\s+(.+)/', $auth, $matches)) {
        respond(['ok' => false, 'message' => 'Missing auth token.'], 401);
    }

    $stmt = db()->prepare('
        SELECT users.*
        FROM sessions
        JOIN users ON users.id = sessions.user_id
        WHERE sessions.token = ?
    ');
    $stmt->execute([$matches[1]]);
    $user = $stmt->fetch(PDO::FETCH_ASSOC);
    if (!$user) {
        respond(['ok' => false, 'message' => 'Invalid auth token.'], 401);
    }

    return $user;
}

function today_key(): string {
    return date('Y-m-d');
}

$payload = input_json();
$action = $payload['action'] ?? '';

try {
    if ($action === 'register') {
        $name = trim((string)($payload['name'] ?? ''));
        $email = strtolower(trim((string)($payload['email'] ?? '')));
        $password = (string)($payload['password'] ?? '');

        if ($name === '' || $email === '' || strlen($password) < 6) {
            respond(['ok' => false, 'message' => 'Ploteso te gjitha fushat. Password min. 6 karaktere.'], 422);
        }

        $stmt = db()->prepare('INSERT INTO users (name, email, password_hash) VALUES (?, ?, ?)');
        $stmt->execute([$name, $email, password_hash($password, PASSWORD_DEFAULT)]);
        $userId = (int)db()->lastInsertId();
        $token = bin2hex(random_bytes(32));
        db()->prepare('INSERT INTO sessions (token, user_id) VALUES (?, ?)')->execute([$token, $userId]);

        respond(['ok' => true, 'token' => $token, 'user' => ['uid' => (string)$userId, 'id' => $userId, 'name' => $name, 'email' => $email]]);
    }

    if ($action === 'login') {
        $email = strtolower(trim((string)($payload['email'] ?? '')));
        $password = (string)($payload['password'] ?? '');
        $stmt = db()->prepare('SELECT * FROM users WHERE email = ?');
        $stmt->execute([$email]);
        $user = $stmt->fetch(PDO::FETCH_ASSOC);

        if (!$user || !password_verify($password, $user['password_hash'])) {
            respond(['ok' => false, 'message' => 'Email ose password i gabuar.'], 401);
        }

        $token = bin2hex(random_bytes(32));
        db()->prepare('INSERT INTO sessions (token, user_id) VALUES (?, ?)')->execute([$token, (int)$user['id']]);
        respond(['ok' => true, 'token' => $token, 'user' => public_user($user)]);
    }

    if ($action === 'me') {
        respond(['ok' => true, 'user' => public_user(auth_user())]);
    }

    if ($action === 'logout') {
        $headers = getallheaders();
        $auth = $headers['Authorization'] ?? $headers['authorization'] ?? '';
        if (preg_match('/Bearer\s+(.+)/', $auth, $matches)) {
            db()->prepare('DELETE FROM sessions WHERE token = ?')->execute([$matches[1]]);
        }
        respond(['ok' => true]);
    }

    $user = auth_user();
    $userId = (int)$user['id'];

    if ($action === 'saveMood') {
        $mood = trim((string)($payload['mood'] ?? ''));
        if ($mood === '') {
            respond(['ok' => false, 'message' => 'Mood mungon.'], 422);
        }
        db()->prepare('
            INSERT INTO moods (user_id, mood, date_key)
            VALUES (?, ?, ?)
            ON CONFLICT(user_id, date_key) DO UPDATE SET mood = excluded.mood, created_at = CURRENT_TIMESTAMP
        ')->execute([$userId, $mood, today_key()]);
        respond(['ok' => true]);
    }

    if ($action === 'getMoodHistory') {
        $stmt = db()->prepare('SELECT mood, date_key AS date FROM moods WHERE user_id = ? ORDER BY date_key DESC LIMIT 7');
        $stmt->execute([$userId]);
        respond(['ok' => true, 'moods' => $stmt->fetchAll(PDO::FETCH_ASSOC)]);
    }

    if ($action === 'saveHabits') {
        $habits = $payload['habits'] ?? [];
        db()->prepare('
            INSERT INTO habits (user_id, habits_json, updated_at)
            VALUES (?, ?, CURRENT_TIMESTAMP)
            ON CONFLICT(user_id) DO UPDATE SET habits_json = excluded.habits_json, updated_at = CURRENT_TIMESTAMP
        ')->execute([$userId, json_encode($habits)]);
        respond(['ok' => true]);
    }

    if ($action === 'getHabits') {
        $stmt = db()->prepare('SELECT habits_json FROM habits WHERE user_id = ?');
        $stmt->execute([$userId]);
        $row = $stmt->fetch(PDO::FETCH_ASSOC);
        respond(['ok' => true, 'habits' => $row ? json_decode($row['habits_json'], true) : null]);
    }

    if ($action === 'saveTasks') {
        $dateKey = trim((string)($payload['dateKey'] ?? ''));
        $tasks = $payload['tasks'] ?? [];
        if ($dateKey === '') {
            respond(['ok' => false, 'message' => 'Data mungon.'], 422);
        }
        db()->prepare('
            INSERT INTO tasks (user_id, date_key, tasks_json, updated_at)
            VALUES (?, ?, ?, CURRENT_TIMESTAMP)
            ON CONFLICT(user_id, date_key) DO UPDATE SET tasks_json = excluded.tasks_json, updated_at = CURRENT_TIMESTAMP
        ')->execute([$userId, $dateKey, json_encode($tasks)]);
        respond(['ok' => true]);
    }

    if ($action === 'getTasks') {
        $dateKey = trim((string)($payload['dateKey'] ?? ''));
        $stmt = db()->prepare('SELECT tasks_json FROM tasks WHERE user_id = ? AND date_key = ?');
        $stmt->execute([$userId, $dateKey]);
        $row = $stmt->fetch(PDO::FETCH_ASSOC);
        respond(['ok' => true, 'tasks' => $row ? json_decode($row['tasks_json'], true) : null]);
    }

    if ($action === 'savePomodoro') {
        $cycles = (int)($payload['cycles'] ?? 0);
        $minutesFocused = (int)($payload['minutesFocused'] ?? 0);
        db()->prepare('
            INSERT INTO pomodoro (user_id, date_key, cycles, minutes_focused, updated_at)
            VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)
            ON CONFLICT(user_id, date_key) DO UPDATE SET cycles = excluded.cycles, minutes_focused = excluded.minutes_focused, updated_at = CURRENT_TIMESTAMP
        ')->execute([$userId, today_key(), $cycles, $minutesFocused]);
        respond(['ok' => true]);
    }

    if ($action === 'getTodayPomodoro') {
        $stmt = db()->prepare('SELECT cycles, minutes_focused AS minutesFocused FROM pomodoro WHERE user_id = ? AND date_key = ?');
        $stmt->execute([$userId, today_key()]);
        respond(['ok' => true, 'pomodoro' => $stmt->fetch(PDO::FETCH_ASSOC) ?: ['cycles' => 0, 'minutesFocused' => 0]]);
    }

    if ($action === 'getDashboardStats') {
        $stmt = db()->prepare('SELECT cycles, minutes_focused FROM pomodoro WHERE user_id = ? ORDER BY date_key DESC LIMIT 7');
        $stmt->execute([$userId]);
        $pomodoro = $stmt->fetchAll(PDO::FETCH_ASSOC);

        $stmt = db()->prepare('SELECT mood, date_key AS date FROM moods WHERE user_id = ? ORDER BY date_key DESC LIMIT 7');
        $stmt->execute([$userId]);
        $moods = $stmt->fetchAll(PDO::FETCH_ASSOC);

        $totalMinutes = array_sum(array_map(fn($row) => (int)$row['minutes_focused'], $pomodoro));
        $totalCycles = array_sum(array_map(fn($row) => (int)$row['cycles'], $pomodoro));

        respond([
            'ok' => true,
            'stats' => [
                'tasksCompleted' => $totalCycles * 2,
                'studyHours' => number_format($totalMinutes / 60, 1),
                'focusScore' => min(99, 60 + $totalCycles * 2) . '%',
                'streak' => max(1, count($pomodoro)),
                'moodHistory' => array_reverse($moods),
                'userName' => $user['name'],
            ],
        ]);
    }

    respond(['ok' => false, 'message' => 'Unknown action.'], 404);
} catch (PDOException $e) {
    if (str_contains($e->getMessage(), 'UNIQUE constraint failed: users.email')) {
        respond(['ok' => false, 'message' => 'Ky email eshte tashme i regjistruar.'], 409);
    }
    respond(['ok' => false, 'message' => 'Database error: ' . $e->getMessage()], 500);
} catch (Throwable $e) {
    respond(['ok' => false, 'message' => 'Server error: ' . $e->getMessage()], 500);
}
