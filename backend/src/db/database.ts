import { createClient, Client } from '@libsql/client';
import path from 'path';

const DB_PATH = process.env.DB_PATH || path.join(process.cwd(), 'training-coach.db');

const db: Client = createClient({ url: `file:${DB_PATH}` });

export async function initializeDatabase(): Promise<void> {
  await db.executeMultiple(`
    CREATE TABLE IF NOT EXISTS measurements (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      date TEXT NOT NULL UNIQUE,
      waist_cm REAL NOT NULL,
      arm_right_cm REAL NOT NULL,
      arm_left_cm REAL NOT NULL,
      weight_kg REAL NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS meals (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      date TEXT NOT NULL,
      meal_type TEXT NOT NULL CHECK (meal_type IN ('breakfast', 'lunch', 'dinner', 'snack', 'shake')),
      description TEXT NOT NULL,
      calories REAL NOT NULL,
      protein_g REAL NOT NULL,
      carbs_g REAL NOT NULL,
      fat_g REAL NOT NULL,
      photo_url TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS settings (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      waist_goal_cm REAL NOT NULL DEFAULT 94,
      goal_date TEXT NOT NULL DEFAULT '2026-09-27',
      baseline_waist_cm REAL NOT NULL DEFAULT 100.5,
      baseline_date TEXT NOT NULL DEFAULT '2026-07-27',
      protein_min_g REAL NOT NULL DEFAULT 150,
      protein_max_g REAL NOT NULL DEFAULT 170,
      protein_floor_g REAL NOT NULL DEFAULT 140,
      calories_min REAL NOT NULL DEFAULT 2100,
      calories_max REAL NOT NULL DEFAULT 2300,
      carbs_min_g REAL NOT NULL DEFAULT 180,
      carbs_max_g REAL NOT NULL DEFAULT 220,
      fat_min_g REAL NOT NULL DEFAULT 60,
      fat_max_g REAL NOT NULL DEFAULT 70,
      height_cm REAL NOT NULL DEFAULT 178,
      initial_weight_kg REAL NOT NULL DEFAULT 85.4
    );

    INSERT OR IGNORE INTO settings (id) VALUES (1);

    CREATE TABLE IF NOT EXISTS supplements (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      date TEXT NOT NULL,
      supplement_type TEXT NOT NULL CHECK (supplement_type IN ('creatine', 'protein_powder')),
      taken INTEGER NOT NULL DEFAULT 0,
      UNIQUE(date, supplement_type)
    );

    CREATE TABLE IF NOT EXISTS goals (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      metric TEXT NOT NULL,
      label TEXT NOT NULL,
      direction TEXT NOT NULL CHECK (direction IN ('decrease', 'increase', 'maintain')),
      target_value REAL NOT NULL,
      baseline_value REAL NOT NULL,
      start_date TEXT NOT NULL,
      target_date TEXT NOT NULL,
      active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);

  const cols = await db.execute("PRAGMA table_info(settings)");
  const colNames = (cols.rows as unknown as { name: string }[]).map((r) => r.name);
  if (!colNames.includes('height_cm')) {
    await db.execute("ALTER TABLE settings ADD COLUMN height_cm REAL NOT NULL DEFAULT 178");
  }
  if (!colNames.includes('initial_weight_kg')) {
    await db.execute("ALTER TABLE settings ADD COLUMN initial_weight_kg REAL NOT NULL DEFAULT 85.4");
  }

  const goalsCount = await db.execute("SELECT COUNT(*) as cnt FROM goals");
  const cnt = (goalsCount.rows[0] as unknown as { cnt: number }).cnt;
  if (cnt === 0) {
    await db.execute({
      sql: `INSERT INTO goals (metric, label, direction, target_value, baseline_value, start_date, target_date)
            VALUES ('waist_cm', 'Reducir cintura', 'decrease', 94, 100.5, '2026-07-27', '2026-09-27'),
                   ('arm_right_cm', 'Mantener brazo derecho', 'maintain', 35.5, 35.5, '2026-07-27', '2026-09-27'),
                   ('arm_left_cm', 'Mantener brazo izquierdo', 'maintain', 35.3, 35.3, '2026-07-27', '2026-09-27'),
                   ('weight_kg', 'Reducir peso', 'decrease', 80, 85.4, '2026-07-27', '2026-09-27')`,
      args: [],
    });
  }
}

export default db;
