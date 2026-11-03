// Optional integration evaluation. Requires .env.local with a real provider.
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { mkdirSync } from "node:fs";
import type { Conversation } from "../src/lib/types";
mkdirSync("work", { recursive: true });
process.env.DATABASE_URL = `file:work/live-evaluation-${Date.now()}.db`;
const { newConversation, db } = await import("../src/lib/db");
const { respond } = await import("../src/agent");
async function turn(c: Conversation, text: string) {
  c.messages.push({
    id: randomUUID(),
    role: "user",
    text,
    at: new Date().toISOString(),
  });
  const m = await respond(c, text);
  c.messages.push(m);
  assert.equal(
    m.trace?.[0].source,
    text === "Confirmar" || /INC-20400/.test(text)
      ? "Política determinística"
      : "LLM + política do service desk",
  );
  assert.ok(
    m.trace![0].confidence >= 0.7,
    `Unexpected low confidence: ${m.trace?.[0].reason}`,
  );
  return m;
}
try {
  const help = await newConversation("ana.silva@nexo.com");
  let m = await turn(help, "Qual é o horário do service desk?");
  assert.match(m.text, /8h.*18h/);
  m = await turn(help, "Quero consultar o chamado INC-20400.");
  assert.match(m.text, /não encontrei/i);
  const create = await newConversation("carla.souza@nexo.com");
  await turn(create, "Meu teclado parou de funcionar hoje de manhã.");
  await turn(create, "Somente eu.");
  m = await turn(
    create,
    "Ainda consigo trabalhar usando o teclado virtual, tenho alternativa.",
  );
  assert.ok(m.draft);
  assert.equal(m.draft.ticket.priority, "Média");
  assert.equal(m.draft.ticket.category, "Hardware");
  m = await turn(create, "Confirmar");
  assert.ok(m.tickets?.length);
  const outside = await newConversation("ana.silva@nexo.com");
  m = await turn(outside, "Quero consultar minhas férias e meu salário.");
  assert.match(m.text, /RH|financeiro/);
  assert.equal(outside.status, "agent");
  const critical = await newConversation("bruno.costa@nexo.com");
  await turn(critical, "O ERP parou de funcionar.");
  await turn(critical, "Toda a minha equipe está afetada.");
  await turn(
    critical,
    "A equipe inteira está parada, sem alternativa para trabalhar.",
  );
  assert.equal(critical.status, "waiting");
  console.log(
    "PASS: real LLM knowledge, privacy, triage, priority, confirmed creation, scope and critical handoff.",
  );
} finally {
  db.close();
}
