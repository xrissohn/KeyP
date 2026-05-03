import { pgTable, text, timestamp, serial, index } from "drizzle-orm/pg-core";

// Free-form beta feedback / abuse report channel. Decoupled from any auth —
// keyed only by deviceId so a user can report without identifying themselves.
export const userReportsTable = pgTable(
  "user_reports",
  {
    id: serial("id").primaryKey(),
    deviceId: text("device_id").notNull(),
    alertId: text("alert_id"),
    interestId: text("interest_id"),
    kind: text("kind").notNull(), // 'feedback' | 'abuse' | 'bug' | 'other'
    body: text("body").notNull(),
    contact: text("contact"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    byDevice: index("user_reports_device_idx").on(t.deviceId),
    byCreated: index("user_reports_created_idx").on(t.createdAt),
  }),
);

export type UserReport = typeof userReportsTable.$inferSelect;
