import { pgTable, text, timestamp, jsonb, index } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

// Server-side mirror of a client interest used by the background poller. The
// client owns the canonical interest record; the server stores just enough to
// re-run the agent pipeline on a schedule and to dedup what it has already
// pushed for that interest.
export const trackedInterestsTable = pgTable(
  "tracked_interests",
  {
    interestId: text("interest_id").primaryKey(),
    deviceId: text("device_id").notNull(),
    spec: jsonb("spec").notNull(),
    rawText: text("raw_text"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    lastSweepAt: timestamp("last_sweep_at", { withTimezone: true }),
    lastNewAt: timestamp("last_new_at", { withTimezone: true }),
  },
  (t) => ({
    byDevice: index("tracked_interests_device_idx").on(t.deviceId),
  }),
);

export const insertTrackedInterestSchema = createInsertSchema(trackedInterestsTable).omit({
  createdAt: true,
  lastSweepAt: true,
  lastNewAt: true,
});
export type InsertTrackedInterest = z.infer<typeof insertTrackedInterestSchema>;
export type TrackedInterest = typeof trackedInterestsTable.$inferSelect;
