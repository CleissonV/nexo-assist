import { db, init } from "./db";
export async function consumeLimit(key: string, max: number, windowMs: number) {
  await init();
  await db.execute(
    "CREATE TABLE IF NOT EXISTS limits (key TEXT PRIMARY KEY, used INTEGER NOT NULL, reset INTEGER NOT NULL)",
  );
  const now = Date.now();
  const result = await db.execute({
    sql: "INSERT INTO limits VALUES (?,1,?) ON CONFLICT(key) DO UPDATE SET used=CASE WHEN limits.reset<=? THEN 1 ELSE limits.used+1 END, reset=CASE WHEN limits.reset<=? THEN excluded.reset ELSE limits.reset END RETURNING used",
    args: [key, now + windowMs, now, now],
  });
  if (Number(result.rows[0]?.used) > max)
    throw new Error("Limite de uso atingido. Tente novamente mais tarde.");
}
