import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

// Lazy singleton — avoids crashing at build time when DATABASE_URL is absent
const globalForDb = globalThis as unknown as {
  pgClient: ReturnType<typeof postgres> | undefined;
  drizzleDb: ReturnType<typeof drizzle<typeof schema>> | undefined;
};

function getDb() {
  if (globalForDb.drizzleDb) return globalForDb.drizzleDb;

  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL environment variable is not set");
  }

  const client =
    globalForDb.pgClient ??
    postgres(connectionString, {
      ssl: false,
      connect_timeout: 10,
      idle_timeout: 20,
      max: 10,
    });

  globalForDb.pgClient = client;

  const instance = drizzle(client, { schema });
  globalForDb.drizzleDb = instance;

  return instance;
}

export const db = new Proxy({} as ReturnType<typeof getDb>, {
  get(_target, prop) {
    return (getDb() as unknown as Record<string | symbol, unknown>)[prop];
  },
});

export type Database = ReturnType<typeof getDb>;
