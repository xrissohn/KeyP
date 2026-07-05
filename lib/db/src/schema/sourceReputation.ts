import { pgTable, text, integer, timestamp, primaryKey, index } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

// Per-host reputation accumulated across all interests and time. Survives
// interest deletion (no FK to tracked_interests) so users can reset interests
// without losing the system's source-quality learning.
//
// We keep BOTH a global aggregate (deviceId = "__global__") and per-device
// rows. The global row biases new users / cold-start; per-device rows
// personalize once the user has feedback. The Verifier prompt and Selector
// pre-rank both consult these stats.
export const sourceReputationTable = pgTable(
  "source_reputation",
  {
    host: text("host").notNull(),
    deviceId: text("device_id").notNull().default("__global__"),
    likes: integer("likes").notNull().default(0),
    dislikes: integer("dislikes").notNull().default(0),
    moreCount: integer("more_count").notNull().default(0),
    hideCount: integer("hide_count").notNull().default(0),
    deadCount: integer("dead_count").notNull().default(0),
    verifierPassCount: integer("verifier_pass_count").notNull().default(0),
    verifierRejectCount: integer("verifier_reject_count").notNull().default(0),
    staleRejectCount: integer("stale_reject_count").notNull().default(0),
    offTopicRejectCount: integer("off_topic_reject_count").notNull().default(0),
    dupRejectCount: integer("dup_reject_count").notNull().default(0),
    confidenceSum: integer("confidence_sum").notNull().default(0),
    confidenceCount: integer("confidence_count").notNull().default(0),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => ({
    pk: primaryKey({ columns: [t.host, t.deviceId] }),
    byHost: index("source_reputation_host_idx").on(t.host),
    byDevice: index("source_reputation_device_idx").on(t.deviceId),
  }),
);

export const insertSourceReputationSchema = createInsertSchema(sourceReputationTable).omit({
  updatedAt: true,
});
export type InsertSourceReputation = z.infer<typeof insertSourceReputationSchema>;
export type SourceReputation = typeof sourceReputationTable.$inferSelect;

export const GLOBAL_DEVICE_ID = "__global__";
