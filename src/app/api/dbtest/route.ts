import postgres from "postgres";

export const dynamic = "force-dynamic";
export const maxDuration = 15;

export async function GET() {
  const url = process.env.DATABASE_URL ?? "NOT SET";
  const masked = url.replace(/\/\/([^:]+):([^@]+)@/, "//$1:***@");

  // Try multiple connection strategies
  const strategies = [
    { name: "no-ssl", ssl: false },
    { name: "ssl-no-verify", ssl: "require" as const },
  ];

  for (const strategy of strategies) {
    try {
      const sql = postgres(url, {
        ssl: strategy.ssl,
        connect_timeout: 5,
        idle_timeout: 5,
        max: 1,
      });

      const result = await sql`SELECT NOW() as now, current_database() as db`;
      await sql.end();

      return Response.json({
        status: "connected",
        strategy: strategy.name,
        database: result[0].db,
        serverTime: result[0].now,
        connectionString: masked,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      // Try next strategy
      console.log(`DB strategy ${strategy.name} failed: ${message}`);
      continue;
    }
  }

  return Response.json({
    status: "all_strategies_failed",
    connectionString: masked,
    note: "Tried: no-ssl, ssl-no-verify",
  }, { status: 500 });
}
