import { integer, real, sqliteTable, text } from 'drizzle-orm/sqlite-core';

export const users = sqliteTable('users', {
  id:          text('id').primaryKey(),
  displayName: text('display_name').notNull(),
  createdAt:   integer('created_at').notNull(),
});

export const profiles = sqliteTable('profiles', {
  id:              text('id').primaryKey(),
  userId:          text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  name:            text('name').notNull(),
  avatarGender:    text('avatar_gender').notNull().default('male'),
  avatarWidth:     integer('avatar_width').notNull().default(0),
  avatarSkinTone:  integer('avatar_skin_tone').notNull().default(0),
  avatarHairStyle: integer('avatar_hair_style').notNull().default(0),
  tableVariant:    integer('table_variant').notNull().default(0),
  bowlVariant:     integer('bowl_variant').notNull().default(0),
  plantpotVariant: integer('plantpot_variant').notNull().default(0),
  wallVariant:     integer('wall_variant').notNull().default(0),
  heightUnit:      text('height_unit').notNull().default('cm'),
  createdAt:       integer('created_at').notNull(),
});

export const measurements = sqliteTable('measurements', {
  id:            text('id').primaryKey(),
  profileId:     text('profile_id').notNull().references(() => profiles.id, { onDelete: 'cascade' }),
  heightCm:      real('height_cm').notNull(),
  heightFt:      integer('height_ft'),
  heightIn:      real('height_in'),
  measuredAt:    integer('measured_at').notNull(),
  isMilestone:   integer('is_milestone').notNull().default(0),
  milestoneName: text('milestone_name'),
  notes:         text('notes'),
  createdAt:     integer('created_at').notNull(),
});

export type User        = typeof users.$inferSelect;
export type Profile     = typeof profiles.$inferSelect;
export type Measurement = typeof measurements.$inferSelect;
export type NewUser        = typeof users.$inferInsert;
export type NewProfile     = typeof profiles.$inferInsert;
export type NewMeasurement = typeof measurements.$inferInsert;
