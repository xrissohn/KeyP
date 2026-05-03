import { pgTable, text, timestamp, primaryKey, index } from "drizzle-orm/pg-core";

// Dedup table: per (interestId, dedupKey) we remember whether the poller has
// already delivered this item. dedupKey = url hash, falling back to normalized
// title hash when no URL is present.
export const seenAlertsTable = pgTable(
  "seen_alerts",
  {
    interestId: text("interest_id").notNull(),
    dedupKey: text("dedup_key").notNull(),
    title: text("title").notNull(),
    url: text("url"),
    seenAt: timestamp("seen_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    pk: primaryKey({ columns: [t.interestId, t.dedupKey] }),
    byInterest: index("seen_alerts_interest_idx").on(t.interestId),
  }),
);

export type SeenAlert = typeof seenAlertsTable.$inferSelect;
