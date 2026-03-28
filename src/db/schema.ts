import { pgTable, serial, doublePrecision, text, timestamp } from 'drizzle-orm/pg-core';

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
});

export type TrackingPoint = typeof trackingPoints.$inferSelect;
export type NewTrackingPoint = typeof trackingPoints.$inferInsert;
