export const dynamic = "force-dynamic";

export async function GET() {
  const url = process.env.DATABASE_URL ?? "NOT SET";
  const masked = url.replace(/\/\/([^:]+):([^@]+)@/, "//$1:***@");

  // Use a hard timeout with AbortController pattern
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);

  try {
    const { default: postgres } = await import("postgres");

    const connectPromise = (async () => {
      const sql = postgres(url, {
        ssl: false,
        connect_timeout: 5,
        max: 1,
      });
      const result = await sql`SELECT NOW() as now, current_database() as db`;
      await sql.end();
      return { strategy: "no-ssl", ...result[0] };
    })();

    const abortPromise = new Promise<never>((_, reject) => {
      controller.signal.addEventListener("abort", () =>
        reject(new Error("Connection timed out after 8s"))
      );
    });

    const result = await Promise.race([connectPromise, abortPromise]);
    clearTimeout(timeout);

    return Response.json({
      status: "connected",
      strategy: result.strategy,
      database: result.db,
      serverTime: result.now,
      connectionString: masked,
    });
  } catch (error) {
    clearTimeout(timeout);
    const message = error instanceof Error ? error.message : String(error);

    return Response.json({
      status: "error",
      error: message,
      connectionString: masked,
      env: {
        NODE_ENV: process.env.NODE_ENV,
        hasDbUrl: !!process.env.DATABASE_URL,
      },
    }, { status: 500 });
  }
}
