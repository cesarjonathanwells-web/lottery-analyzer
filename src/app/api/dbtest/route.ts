import postgres from "postgres";

export const dynamic = "force-dynamic";

export async function GET() {
  const url = process.env.DATABASE_URL ?? "NOT SET";
  const masked = url.replace(/\/\/([^:]+):([^@]+)@/, "//$1:***@");

  try {
    const sql = postgres(url, {
      ssl: false,
      connect_timeout: 5,
      idle_timeout: 5,
      max: 1,
    });

    const result = await sql`SELECT NOW() as now, current_database() as db`;
    await sql.end();

    return Response.json({
      status: "connected",
      database: result[0].db,
      serverTime: result[0].now,
      connectionString: masked,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const code = error instanceof Error ? (error as unknown as Record<string, unknown>).code : undefined;

    return Response.json({
      status: "error",
      error: message,
      errorCode: code,
      connectionString: masked,
    }, { status: 500 });
  }
}
