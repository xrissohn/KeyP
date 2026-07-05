import { pgTable, text, integer, date, primaryKey, index } from "drizzle-orm/pg-core";

// Per-device daily quota counter for `/agents/generate-alerts`. Reset
// implicitly by the (deviceId, day) primary key — each new UTC day starts
// fresh because no row exists for it yet.
export const usageQuotaTable = pgTable(
  "usage_quota",
  {
    deviceId: text("device_id").notNull(),
    day: date("day").notNull(), // YYYY-MM-DD (UTC)
    endpoint: text("endpoint").notNull(),
    count: integer("count").notNull().default(0),
  },
  (t) => ({
    pk: primaryKey({ columns: [t.deviceId, t.day, t.endpoint] }),
    byDay: index("usage_quota_day_idx").on(t.day),
  }),
);

export type UsageQuotaRow = typeof usageQuotaTable.$inferSelect;
