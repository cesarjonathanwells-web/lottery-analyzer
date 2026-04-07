export const dynamic = "force-dynamic";

export async function GET() {
  const url = process.env.DATABASE_URL ?? "NOT SET";
  const masked = url.replace(/\/\/([^:]+):([^@]+)@/, "//$1:***@");

  try {
    const { default: postgres } = await import("postgres");

    const sql = postgres(url, {
      ssl: false,
      connect_timeout: 5,
      max: 1,
    });

    const rows = await sql`SELECT NOW() as now, current_database() as db`;
    const row = rows[0] as Record<string, unknown>;
    await sql.end();

    return Response.json({
      status: "connected",
      database: row.db,
      serverTime: row.now,
      connectionString: masked,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return Response.json({
      status: "error",
      error: message,
      connectionString: masked,
    }, { status: 500 });
  }
}
