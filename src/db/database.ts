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
      avatar TEXT NOT NULL DEFAULT 'child',
      theme TEXT NOT NULL DEFAULT 'red',
      door_style TEXT NOT NULL DEFAULT 'style_1',
      door_colour TEXT NOT NULL DEFAULT 'black',
      handle_style TEXT NOT NULL DEFAULT 'handle_style_1',
      shelf_items TEXT NOT NULL DEFAULT 'rocket_1',
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

  // Non-destructive column migrations — swallow "duplicate column" errors on fresh installs
  try {
    await sqlite.execAsync(`ALTER TABLE measurements ADD COLUMN milestone_image TEXT;`);
  } catch (_) {}
  try {
    await sqlite.execAsync(`ALTER TABLE profiles ADD COLUMN profile_image TEXT;`);
  } catch (_) {}
  try {
    await sqlite.execAsync(`ALTER TABLE profiles ADD COLUMN avatar_skin_tone TEXT NOT NULL DEFAULT '#F5CBA7';`);
  } catch (_) {}
  try {
    await sqlite.execAsync(`ALTER TABLE profiles ADD COLUMN avatar_hair_style TEXT NOT NULL DEFAULT 'short_straight';`);
  } catch (_) {}
  try {
    await sqlite.execAsync(`ALTER TABLE profiles ADD COLUMN avatar_hair_colour TEXT NOT NULL DEFAULT '#4A2C0A';`);
  } catch (_) {}
  try {
    await sqlite.execAsync(`ALTER TABLE profiles ADD COLUMN avatar_clothing_style TEXT NOT NULL DEFAULT 'tshirt';`);
  } catch (_) {}
  try {
    await sqlite.execAsync(`ALTER TABLE profiles ADD COLUMN avatar_clothing_colour TEXT NOT NULL DEFAULT '#4A90D9';`);
  } catch (_) {}
  try {
    await sqlite.execAsync(`ALTER TABLE profiles ADD COLUMN avatar_id TEXT;`);
  } catch (_) {}
  try {
    await sqlite.execAsync(`ALTER TABLE profiles ADD COLUMN gender TEXT NOT NULL DEFAULT 'male';`);
  } catch (_) {}
}
