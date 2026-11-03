import { NextResponse } from "next/server";
import { randomBytes, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { db, init } from "@/lib/db";
import { employees } from "@/lib/types";
import { auth } from "@/lib/auth";
import { modelSettings } from "@/lib/model";
export async function GET() {
  try {
    return NextResponse.json({
      ...(await auth()),
      mode: modelSettings() ? "llm" : "demo",
    });
  } catch {
    return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  }
}
export async function POST(req: Request) {
  await init();
  const { email, password } = (await req.json()) as {
    email: string;
    password: string;
  };
  if (
    typeof email !== "string" ||
    typeof password !== "string" ||
    password.length < 1 ||
    password.length > 200
  )
    return NextResponse.json(
      { error: "Informe e-mail e senha." },
      { status: 400 },
    );
  const normalized = email.trim().toLowerCase();
  const analyst = normalized === "analista@nexo.com";
  const expected =
    process.env.ANALYST_PASSWORD ||
    (process.env.NODE_ENV === "production" ? "" : "nexo-demo");
  const validAnalyst =
    analyst &&
    !!expected &&
    Buffer.byteLength(expected) === Buffer.byteLength(password) &&
    timingSafeEqual(Buffer.from(expected), Buffer.from(password));
  if (!employees.some((e) => e.email === normalized) && !validAnalyst)
    return NextResponse.json(
      { error: "Credenciais inválidas. Use um funcionário de demonstração." },
      { status: 401 },
    );
  const token = randomBytes(32).toString("hex");
  await db.execute({
    sql: "INSERT INTO sessions VALUES (?,?,?,?)",
    args: [
      token,
      normalized,
      analyst ? "analyst" : "employee",
      Date.now() + 8 * 3600000,
    ],
  });
  (await cookies()).set("nexo-session", token, {
    httpOnly: true,
    sameSite: "strict",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 8 * 3600,
  });
  return NextResponse.json({ ok: true });
}
export async function DELETE() {
  const jar = await cookies();
  const token = jar.get("nexo-session")?.value;
  if (token)
    await db.execute({
      sql: "DELETE FROM sessions WHERE token=?",
      args: [token],
    });
  jar.delete("nexo-session");
  return NextResponse.json({ ok: true });
}
