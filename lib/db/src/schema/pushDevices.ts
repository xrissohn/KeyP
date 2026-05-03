import { pgTable, text, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const pushDevicesTable = pgTable("push_devices", {
  deviceId: text("device_id").primaryKey(),
  expoPushToken: text("expo_push_token").notNull(),
  platform: text("platform").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});

export const insertPushDeviceSchema = createInsertSchema(pushDevicesTable).omit({
  createdAt: true,
  updatedAt: true,
});
export type InsertPushDevice = z.infer<typeof insertPushDeviceSchema>;
export type PushDevice = typeof pushDevicesTable.$inferSelect;
