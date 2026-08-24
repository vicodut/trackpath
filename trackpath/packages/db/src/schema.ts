import { pgTable, serial, doublePrecision, text, timestamp, boolean, integer, bigint, real, index } from 'drizzle-orm/pg-core';

export const trackingPoints = pgTable('tracking_points', {
  id: serial('id').primaryKey(),
  garminId: text('garmin_id').unique(),
  latitude: doublePrecision('latitude').notNull(),
  longitude: doublePrecision('longitude').notNull(),
  altitude: doublePrecision('altitude'),
  timestamp: text('timestamp').notNull(),
  velocity: doublePrecision('velocity'),
  course: doublePrecision('course'),
  message: text('message'),
  eventType: text('event_type'),
  createdAt: timestamp('created_at').defaultNow(),
}, (t) => [
  index('idx_tracking_timestamp').on(t.timestamp),
]);

export type TrackingPoint = typeof trackingPoints.$inferSelect;
export type NewTrackingPoint = typeof trackingPoints.$inferInsert;

// --- Better Auth tables ---

export const user = pgTable("user", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  emailVerified: boolean("email_verified").notNull(),
  image: text("image"),
  createdAt: timestamp("created_at").notNull(),
  updatedAt: timestamp("updated_at").notNull(),
});

export const session = pgTable("session", {
  id: text("id").primaryKey(),
  expiresAt: timestamp("expires_at").notNull(),
  token: text("token").notNull().unique(),
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  userId: text("user_id").notNull().references(() => user.id),
  createdAt: timestamp("created_at").notNull(),
  updatedAt: timestamp("updated_at").notNull(),
});

export const account = pgTable("account", {
  id: text("id").primaryKey(),
  accountId: text("account_id").notNull(),
  providerId: text("provider_id").notNull(),
  issuer: text("issuer").notNull(),
  userId: text("user_id").notNull().references(() => user.id),
  accessToken: text("access_token"),
  refreshToken: text("refresh_token"),
  idToken: text("id_token"),
  accessTokenExpiresAt: timestamp("access_token_expires_at"),
  refreshTokenExpiresAt: timestamp("refresh_token_expires_at"),
  scope: text("scope"),
  password: text("password"),
  createdAt: timestamp("created_at").notNull(),
  updatedAt: timestamp("updated_at").notNull(),
});

// --- Strava ---

export const stravaTokens = pgTable("strava_tokens", {
  id: serial("id").primaryKey(),
  accessToken: text("access_token").notNull(),
  refreshToken: text("refresh_token").notNull(),
  expiresAt: integer("expires_at").notNull(),
  athleteId: text("athlete_id").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const stravaActivities = pgTable("strava_activities", {
  id: serial("id").primaryKey(),
  stravaId: bigint("strava_id", { mode: "number" }).unique().notNull(),
  name: text("name"),
  type: text("type"),
  distance: doublePrecision("distance"),
  movingTime: integer("moving_time"),
  elevationGain: doublePrecision("elevation_gain"),
  startDate: text("start_date"),
  coords: text("coords"),
  syncedAt: timestamp("synced_at").defaultNow(),
  createdAt: timestamp("created_at").defaultNow(),
});

// --- Gear ---

export const gearCategories = pgTable('gear_categories', {
  id: serial('id').primaryKey(),
  name: text('name').notNull(),
  color: text('color').notNull().default('#888888'),
  sortOrder: integer('sort_order').notNull().default(0),
  createdAt: timestamp('created_at').defaultNow(),
});

export const gearItems = pgTable('gear_items', {
  id: serial('id').primaryKey(),
  categoryId: integer('category_id').notNull().references(() => gearCategories.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  weightG: real('weight_g').notNull().default(0),
  qty: integer('qty').notNull().default(1),
  worn: boolean('worn').notNull().default(false),
  consumable: boolean('consumable').notNull().default(false),
  included: boolean('included').notNull().default(true),
  notes: text('notes'),
  createdAt: timestamp('created_at').defaultNow(),
});

export type GearCategory = typeof gearCategories.$inferSelect;
export type GearItem = typeof gearItems.$inferSelect;

// --- Polls ---

export const polls = pgTable('polls', {
  id: serial('id').primaryKey(),
  question: text('question').notNull(),
  closed: boolean('closed').notNull().default(false),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const pollOptions = pgTable('poll_options', {
  id: serial('id').primaryKey(),
  pollId: integer('poll_id').notNull().references(() => polls.id, { onDelete: 'cascade' }),
  text: text('text').notNull(),
  sortOrder: integer('sort_order').notNull().default(0),
});

export const pollVotes = pgTable('poll_votes', {
  id: serial('id').primaryKey(),
  pollId: integer('poll_id').notNull().references(() => polls.id, { onDelete: 'cascade' }),
  optionId: integer('option_id').notNull().references(() => pollOptions.id, { onDelete: 'cascade' }),
  ipAddress: text('ip_address').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const pollSuggestions = pgTable('poll_suggestions', {
  id: serial('id').primaryKey(),
  question: text('question').notNull(),
  options: text('options').notNull(), // JSON array of strings
  ipAddress: text('ip_address').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const cheers = pgTable('cheers', {
  id: serial('id').primaryKey(),
  name: text('name').notNull(),
  message: text('message').notNull(),
  isPublic: boolean('is_public').notNull().default(true),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const verification = pgTable("verification", {
  id: text("id").primaryKey(),
  identifier: text("identifier").notNull(),
  value: text("value").notNull(),
  expiresAt: timestamp("expires_at").notNull(),
  createdAt: timestamp("created_at"),
  updatedAt: timestamp("updated_at"),
});
