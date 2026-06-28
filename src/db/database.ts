import { drizzle } from 'drizzle-orm/expo-sqlite';
import { openDatabaseSync } from 'expo-sqlite';
import * as schema from './schema';

const sqlite = openDatabaseSync('forever.db', { enableChangeListener: true });

export const db = drizzle(sqlite, { schema });

export async function initDatabase() {
  await sqlite.execAsync(`
    PRAGMA journal_mode = WAL;
    PRAGMA foreign_keys = ON;

    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY NOT NULL,
      display_name TEXT NOT NULL,
      created_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS profiles (
      id TEXT PRIMARY KEY NOT NULL,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      avatar_gender TEXT NOT NULL DEFAULT 'male',
      avatar_width INTEGER NOT NULL DEFAULT 0,
      avatar_skin_tone INTEGER NOT NULL DEFAULT 0,
      avatar_hair_style INTEGER NOT NULL DEFAULT 0,
      table_variant INTEGER NOT NULL DEFAULT 0,
      bowl_variant INTEGER NOT NULL DEFAULT 0,
      plantpot_variant INTEGER NOT NULL DEFAULT 0,
      wall_variant INTEGER NOT NULL DEFAULT 0,
      height_unit TEXT NOT NULL DEFAULT 'cm',
      created_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS measurements (
      id TEXT PRIMARY KEY NOT NULL,
      profile_id TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
      height_cm REAL NOT NULL,
      height_ft INTEGER,
      height_in REAL,
      measured_at INTEGER NOT NULL,
      is_milestone INTEGER NOT NULL DEFAULT 0,
      milestone_name TEXT,
      notes TEXT,
      created_at INTEGER NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_measurements_profile_date
      ON measurements(profile_id, measured_at);

    CREATE INDEX IF NOT EXISTS idx_measurements_milestone
      ON measurements(profile_id, is_milestone);
  `);
}
