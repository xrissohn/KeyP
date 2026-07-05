import { pgTable, text, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

/**
 * Browser Web Push subscriptions (PWA / desktop browser). One row per
 * (endpoint) — the endpoint URL is unique per browser/profile/device, so it
 * works as the natural primary key. Multiple rows per deviceId are allowed
 * (e.g. user installs PWA on phone + opens site on desktop, same KeyP
 * device account). On 404/410 from the push service we delete the row.
 */
export const webPushSubscriptionsTable = pgTable("web_push_subscriptions", {
  endpoint: text("endpoint").primaryKey(),
  deviceId: text("device_id").notNull(),
  p256dh: text("p256dh").notNull(),
  auth: text("auth").notNull(),
  userAgent: text("user_agent"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});

export const insertWebPushSubscriptionSchema = createInsertSchema(
  webPushSubscriptionsTable,
).omit({ createdAt: true, updatedAt: true });
export type InsertWebPushSubscription = z.infer<typeof insertWebPushSubscriptionSchema>;
export type WebPushSubscription = typeof webPushSubscriptionsTable.$inferSelect;
