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
      colour_palette TEXT NOT NULL DEFAULT 'princess',
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

  // Rename `theme` -> `colour_palette` (upgrading installs only — no-ops harmlessly on
  // fresh installs where the table is already created with `colour_palette`).
  try {
    await sqlite.execAsync(`ALTER TABLE profiles RENAME COLUMN theme TO colour_palette;`);
  } catch (_) {}

  // Remap legacy red/blue/green values straight to the current theme names.
  // Each UPDATE only matches its specific old literal, so re-running this on every
  // app start is a safe no-op once already migrated.
  try {
    await sqlite.execAsync(`
      UPDATE profiles SET colour_palette = 'princess' WHERE colour_palette = 'blue';
      UPDATE profiles SET colour_palette = 'dinosaur' WHERE colour_palette = 'green';
      UPDATE profiles SET colour_palette = 'space'    WHERE colour_palette = 'red';
    `);
  } catch (_) {}

  // Remap the previous water/forest theme names (used briefly before this rename)
  // to their renamed equivalents: water -> princess, forest -> dinosaur.
  try {
    await sqlite.execAsync(`
      UPDATE profiles SET colour_palette = 'princess' WHERE colour_palette = 'water';
      UPDATE profiles SET colour_palette = 'dinosaur' WHERE colour_palette = 'forest';
    `);
  } catch (_) {}
}
