import { pgTable, text, integer, timestamp } from "drizzle-orm/pg-core";

// Persistent per-device plan + monthly boost quota counter. No FK to
// push_devices because that table may be pruned on DeviceNotRegistered
// eviction; we want billing/plan history to survive a token rotation.
export const devicePlansTable = pgTable("device_plans", {
  deviceId: text("device_id").primaryKey(),
  plan: text("plan").notNull().default("free"),
  boostQuotaUsed: integer("boost_quota_used").notNull().default(0),
  boostQuotaPeriod: text("boost_quota_period").notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});

export type DevicePlan = typeof devicePlansTable.$inferSelect;
