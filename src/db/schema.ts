import { integer, real, sqliteTable, text } from 'drizzle-orm/sqlite-core';

export const users = sqliteTable('users', {
  id:          text('id').primaryKey(),
  displayName: text('display_name').notNull(),
  createdAt:   integer('created_at').notNull(),
});

export const profiles = sqliteTable('profiles', {
  id:          text('id').primaryKey(),
  userId:      text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  name:        text('name').notNull(),
  avatar:      text('avatar').notNull().default('child'),
  theme:       text('theme').notNull().default('red'),
  doorStyle:   text('door_style').notNull().default('style_1'),
  doorColour:  text('door_colour').notNull().default('black'),
  handleStyle: text('handle_style').notNull().default('handle_style_1'),
  shelfItems:  text('shelf_items').notNull().default('rocket_1'),
  heightUnit:  text('height_unit').notNull().default('cm'),
  createdAt:   integer('created_at').notNull(),
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
