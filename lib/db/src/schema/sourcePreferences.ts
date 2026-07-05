import { pgTable, text, timestamp, primaryKey, index } from "drizzle-orm/pg-core";

// Per-interest source-host preferences. mode='block' filters that host out of
// candidate set; mode='boost' moves it to the top of the ordering.
export const sourcePreferencesTable = pgTable(
  "source_preferences",
  {
    interestId: text("interest_id").notNull(),
    host: text("host").notNull(),
    mode: text("mode").notNull(), // 'block' | 'boost'
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    pk: primaryKey({ columns: [t.interestId, t.host] }),
    byInterest: index("source_preferences_interest_idx").on(t.interestId),
  }),
);

export type SourcePreference = typeof sourcePreferencesTable.$inferSelect;
