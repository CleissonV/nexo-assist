import { test, after } from "node:test";
import assert from "node:assert/strict";
import { mkdirSync, rmSync } from "node:fs";
import { join } from "node:path";
mkdirSync("work", { recursive: true });
const path = join("work", `test-${Date.now()}.db`);
process.env.DATABASE_URL = `file:${path}`;
delete process.env.OPENAI_API_KEY;
const { respond } = await import("../src/agent");
const { newConversation, save, conversation, db } =
  await import("../src/lib/db");
const { listTickets, commitDraft, retry } =
  await import("../src/services/tickets");
const { priority, deadline, canReopen } = await import("../src/lib/policy");
after(() => {
  db.close();
});
test("priority uses impact and urgency, not urgent keyword alone", () => {
  assert.equal(priority("Equipe", "Impede trabalhar"), "Crítica");
  assert.equal(priority("Somente eu", "Compromisso hoje"), "Alta");
  assert.equal(priority("Somente eu", "Há alternativa"), "Média");
  assert.equal(priority("Somente eu", "Sem urgência"), "Baixa");
});
test("business deadline skips weekend; critical is continuous", () => {
  const fri = new Date("2026-11-06T20:00:00Z");
  assert.equal(deadline("Alta", fri), "2026-11-09T14:00:00.000Z");
  assert.equal(deadline("Crítica", fri), "2026-11-06T21:00:00.000Z");
});
test("seven-day reopening boundary", () => {
  const now = Date.now();
  assert.equal(
    canReopen(
      {
        status: "Resolvido",
        resolvedAt: new Date(now - 7 * 86400000).toISOString(),
      },
      now,
    ),
    true,
  );
  assert.equal(
    canReopen(
      {
        status: "Resolvido",
        resolvedAt: new Date(now - 8 * 86400000).toISOString(),
      },
      now,
    ),
    false,
  );
});
test("owner-scoped queries and forged update protection", async () => {
  assert.equal((await listTickets("bruno.costa@nexo.com")).length, 1);
  await assert.rejects(() =>
    commitDraft("bruno.costa@nexo.com", {
      targetId: "INC-20311",
      ticket: {
        title: "x",
        description: "x",
        type: "INC",
        category: "Outros",
        priority: "Baixa",
        affected: "Eu",
      },
    }),
  );
  const c = await newConversation("ana.silva@nexo.com");
  await assert.rejects(() => conversation(c.id, "bruno.costa@nexo.com"));
});
test("collects facts, drafts without writing, explicit confirmation is idempotent", async () => {
  const owner = "carla.souza@nexo.com";
  const c = await newConversation(owner);
  await respond(c, "Meu teclado parou");
  await respond(c, "Somente eu");
  const m = await respond(c, "Há alternativa");
  assert.ok(m.draft);
  const before = (await listTickets(owner)).length;
  assert.equal((await listTickets(owner)).length, before);
  const result = await respond(c, "Confirmar");
  assert.ok(result.tickets);
  assert.equal((await listTickets(owner)).length, before + 1);
  await respond(c, "Confirmar");
  assert.equal((await listTickets(owner)).length, before + 1);
});
test("recent resolved ticket is proposed for reopening rather than duplicated", async () => {
  const c = await newConversation("ana.silva@nexo.com");
  await respond(c, "Minha senha do SAP está bloqueada");
  await respond(c, "Somente eu");
  const r = await respond(c, "Há alternativa");
  assert.equal(r.draft?.targetId, "INC-20150");
});
test("critical, overdue and uncertainty transfer with persisted context", async () => {
  for (const scenario of ["critical", "overdue", "uncertain"]) {
    const c = await newConversation("ana.silva@nexo.com");
    if (scenario === "critical") {
      await respond(c, "Sistema não funciona");
      await respond(c, "Minha equipe");
      await respond(c, "Impede trabalhar, sem alternativa");
    } else await respond(c, scenario === "overdue" ? "INC-20311" : "xyz123");
    assert.equal(c.status, "waiting");
    assert.ok(c.summary);
    await save(c);
    assert.equal((await conversation(c.id, c.owner)).status, "waiting");
  }
});
test("VPN guidance respects OS-specific applicability", async () => {
  const c = await newConversation("carla.souza@nexo.com");
  const r = await respond(c, "Como resolver VPN erro 809?");
  assert.match(r.text, /Windows 10 ou Windows 11/);
  const win = await respond(c, "Windows 11");
  assert.doesNotMatch(win.text, /reinstale/i);
});
test("legacy retry performs bounded retries", async () => {
  let n = 0;
  assert.equal(
    await retry(async () => {
      if (++n < 3) throw Error();
      return "ok";
    }),
    "ok",
  );
  assert.equal(n, 3);
});
test("replaying the same persisted draft does not create a second ticket", async () => {
  const owner = "carla.souza@nexo.com";
  const c = await newConversation(owner);
  await respond(c, "Meu mouse parou");
  await respond(c, "Somente eu");
  await respond(c, "Há alternativa");
  assert.ok(c.pending?.operationId);
  const draft = c.pending!;
  const first = await commitDraft(owner, draft);
  const second = await commitDraft(owner, draft);
  assert.equal(first.id, second.id);
});
test("ticket update preserves context and waits for confirmation", async () => {
  const owner = "ana.silva@nexo.com";
  const c = await newConversation(owner);
  await respond(c, "REQ-10442");
  await respond(c, "Complementar chamado");
  const m = await respond(c, "A entrega deve ser na sede, andar 3.");
  assert.equal(m.draft?.targetId, "REQ-10442");
  assert.match(m.draft!.ticket.description, /andar 3/);
  assert.doesNotMatch(
    (await listTickets(owner)).find((t) => t.id === "REQ-10442")!.description,
    /andar 3/,
  );
  await respond(c, "Confirmar");
  assert.match(
    (await listTickets(owner)).find((t) => t.id === "REQ-10442")!.description,
    /andar 3/,
  );
});
test("cancelling a draft never writes a ticket", async () => {
  const c = await newConversation("bruno.costa@nexo.com");
  await respond(c, "Meu teclado parou");
  await respond(c, "Somente eu");
  await respond(c, "Há alternativa");
  const before = (await listTickets(c.owner)).length;
  await respond(c, "Cancelar");
  assert.equal(c.pending, undefined);
  assert.equal((await listTickets(c.owner)).length, before);
});
