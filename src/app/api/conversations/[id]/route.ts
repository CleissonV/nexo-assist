import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { auth } from "@/lib/auth";
import { conversation, save, withLock } from "@/lib/db";
import { respond } from "@/agent";
import { listTickets } from "@/services/tickets";
export const maxDuration = 60;
type Context = { params: Promise<{ id: string }> };
export async function GET(_: Request, ctx: Context) {
  try {
    const u = await auth();
    const c = await conversation(
      (await ctx.params).id,
      u.role === "employee" ? u.email : undefined,
    );
    return NextResponse.json({
      conversation: c,
      tickets: await listTickets(c.owner),
    });
  } catch {
    return NextResponse.json(
      { error: "Conversa não encontrada" },
      { status: 404 },
    );
  }
}
async function processMessage(
  req: Request,
  ctx: Context,
  onStep?: (label: string) => void,
) {
  try {
    const user = await auth();
    const { text, action } = (await req.json()) as {
      text?: string;
      action?: string;
    };
    const id = (await ctx.params).id;
    return await withLock(id, async () => {
      const c = await conversation(
        id,
        user.role === "employee" ? user.email : undefined,
      );
      if (user.role === "analyst") {
        if (action === "claim" && c.status === "waiting") c.status = "human";
        else if (action === "release" && c.status === "human")
          c.status = "agent";
        else if (action === "close" && c.status === "human")
          c.status = "closed";
        else if (text && c.status === "human" && text.length <= 4000)
          c.messages.push({
            id: randomUUID(),
            role: "analyst",
            text,
            at: new Date().toISOString(),
          });
        else throw new Error("Ação indisponível para o estado atual");
        if (action)
          c.messages.push({
            id: randomUUID(),
            role: "system",
            text:
              action === "claim"
                ? "Analista assumiu o atendimento."
                : action === "release"
                  ? "Atendimento devolvido ao Nexo Assist."
                  : "Conversa encerrada pelo analista.",
            at: new Date().toISOString(),
          });
        await save(c);
        return NextResponse.json(c);
      }
      if (!text || typeof text !== "string" || text.length > 4000)
        throw new Error("Mensagem inválida (máximo 4.000 caracteres)");
      if (c.status === "closed")
        throw new Error("Conversa encerrada. Inicie outra conversa.");
      if (c.status === "waiting" || c.status === "human") {
        c.messages.push({
          id: randomUUID(),
          role: "user",
          text,
          at: new Date().toISOString(),
        });
        await save(c);
        return NextResponse.json(c);
      }
      if (c.count >= 30)
        throw new Error(
          "Limite de 30 mensagens atingido. Inicie outra conversa.",
        );
      c.count++;
      c.messages.push({
        id: randomUUID(),
        role: "user",
        text,
        at: new Date().toISOString(),
      });
      try {
        c.messages.push(await respond(c, text, onStep));
      } catch {
        c.messages.push({
          id: randomUUID(),
          role: "assistant",
          text: "O serviço de chamados está temporariamente indisponível. Nenhuma confirmação será presumida. Tente novamente em instantes.",
          at: new Date().toISOString(),
          trace: [
            {
              action: "Serviço indisponível",
              intent: "error",
              confidence: 1,
              reason: "Falha após três tentativas com espera progressiva.",
              source: "Serviço de chamados",
            },
          ],
        });
      }
      await save(c);
      return NextResponse.json(c);
    });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Não foi possível concluir" },
      { status: 400 },
    );
  }
}
export async function POST(req: Request, ctx: Context) {
  if (req.headers.get("accept") !== "application/x-ndjson")
    return processMessage(req, ctx);
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const emit = (value: unknown) =>
        controller.enqueue(encoder.encode(JSON.stringify(value) + "\n"));
      try {
        emit({ type: "progress", label: "Interpretando sua solicitação…" });
        const response = await processMessage(req, ctx, (label) =>
          emit({ type: "progress", label }),
        );
        const data = await response.json();
        emit(
          response.ok
            ? { type: "result", data }
            : { type: "error", error: data.error },
        );
      } catch {
        emit({
          type: "error",
          error:
            "Conexão interrompida. Consulte o histórico antes de repetir a ação.",
        });
      } finally {
        controller.close();
      }
    },
  });
  return new Response(stream, {
    headers: {
      "Content-Type": "application/x-ndjson",
      "Cache-Control": "no-cache, no-transform",
      "X-Accel-Buffering": "no",
    },
  });
}
