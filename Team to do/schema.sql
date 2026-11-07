-- Cloudflare D1 SQL Schema for TeamTask
-- สร้างตารางสมาชิกและงานในระบบ

DROP TABLE IF EXISTS tasks;
DROP TABLE IF EXISTS members;

CREATE TABLE members (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  nickname TEXT NOT NULL,
  role TEXT NOT NULL,
  email TEXT,
  color TEXT DEFAULT '#3B82F6',
  avatar TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE tasks (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  member_id TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'todo',
  priority TEXT NOT NULL DEFAULT 'medium',
  start_date TEXT,
  deadline TEXT,
  tag TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (member_id) REFERENCES members (id) ON DELETE CASCADE
);

-- Index สำหรับค้นหาและจัดเรียงเร็วขึ้น
CREATE INDEX idx_tasks_member ON tasks (member_id);
CREATE INDEX idx_tasks_status ON tasks (status);
CREATE INDEX idx_tasks_deadline ON tasks (deadline);
