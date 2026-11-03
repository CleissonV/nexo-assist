import { createClient } from "@libsql/client";
import { randomUUID } from "node:crypto";
import { employees, type Ticket, type Conversation } from "./types";
import { deadline } from "./policy";
if (
  process.env.VERCEL &&
  (!process.env.DATABASE_URL || process.env.DATABASE_URL.startsWith("file:"))
)
  throw new Error("Configure um banco libsql persistente antes do deploy.");
export const db = createClient({
  url: process.env.DATABASE_URL || "file:nexo.db",
  authToken: process.env.DATABASE_AUTH_TOKEN,
});
let initialized: Promise<void> | undefined;
export function init() {
  return (initialized ??= setup());
}
async function setup() {
  await db.batch(
    [
      "CREATE TABLE IF NOT EXISTS tickets (id TEXT PRIMARY KEY, owner TEXT NOT NULL, data TEXT NOT NULL)",
      "CREATE TABLE IF NOT EXISTS conversations (id TEXT PRIMARY KEY, owner TEXT NOT NULL, data TEXT NOT NULL)",
      "CREATE TABLE IF NOT EXISTS sessions (token TEXT PRIMARY KEY, email TEXT NOT NULL, role TEXT NOT NULL, expires INTEGER NOT NULL)",
      "CREATE TABLE IF NOT EXISTS locks (id TEXT PRIMARY KEY, expires INTEGER NOT NULL)",
    ],
    "write",
  );
  const now = Date.now();
  const seeds: Ticket[] = [
    {
      id: "INC-20311",
      owner: employees[0].email,
      title: "Notebook lento após atualização do Windows",
      description:
        "Lentidão geral após atualização. Reiniciar e executar diagnóstico não resolveu.",
      type: "INC",
      category: "Hardware",
      priority: "Média",
      affected: "Ana Silva",
      status: "Aguardando analista",
      updatedAt: new Date(now - 6 * 86400000).toISOString(),
      dueAt: new Date(now - 3 * 86400000).toISOString(),
    },
    {
      id: "REQ-10442",
      owner: employees[0].email,
      title: "Segundo monitor para home office",
      description: "Monitor para trabalho remoto.",
      type: "REQ",
      category: "Hardware",
      priority: "Baixa",
      affected: "Ana Silva",
      status: "Aprovado",
      updatedAt: new Date().toISOString(),
      dueAt: deadline("Baixa"),
    },
    {
      id: "INC-20150",
      owner: employees[0].email,
      title: "Senha do SAP bloqueada",
      description: "Acesso ao SAP bloqueado.",
      type: "INC",
      category: "Acesso",
      priority: "Média",
      affected: "Ana Silva",
      status: "Resolvido",
      updatedAt: new Date(now - 4 * 86400000).toISOString(),
      dueAt: new Date(now - 3 * 86400000).toISOString(),
      resolvedAt: new Date(now - 4 * 86400000).toISOString(),
    },
    {
      id: "INC-20400",
      owner: employees[1].email,
      title: "VPN indisponível no financeiro",
      description: "VPN com erro 809 no Windows 11.",
      type: "INC",
      category: "Rede e VPN",
      priority: "Alta",
      affected: "Bruno Costa",
      status: "Aberto",
      updatedAt: new Date().toISOString(),
      dueAt: deadline("Alta"),
    },
    {
      id: "REQ-10460",
      owner: employees[2].email,
      title: "Licença de software",
      description: "Solicitação de licença para ferramenta de produto.",
      type: "REQ",
      category: "Software",
      priority: "Baixa",
      affected: "Carla Souza",
      status: "Aberto",
      updatedAt: new Date().toISOString(),
      dueAt: deadline("Baixa"),
    },
  ];
  await db.batch(
    seeds.map((t) => ({
      sql: "INSERT OR IGNORE INTO tickets VALUES (?,?,?)",
      args: [t.id, t.owner, JSON.stringify(t)],
    })),
    "write",
  );
}
export async function listConversations(owner?: string) {
  await init();
  const r = await db.execute(
    owner
      ? { sql: "SELECT data FROM conversations WHERE owner=?", args: [owner] }
      : "SELECT data FROM conversations",
  );
  return r.rows
    .map((r) => JSON.parse(String(r.data)) as Conversation)
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}
export async function conversation(id: string, owner?: string) {
  const all = await listConversations(owner);
  const c = all.find((c) => c.id === id);
  if (!c) throw new Error("Conversa não encontrada");
  return c;
}
export async function save(c: Conversation) {
  c.updatedAt = new Date().toISOString();
  await db.execute({
    sql: "INSERT INTO conversations VALUES (?,?,?) ON CONFLICT(id) DO UPDATE SET data=excluded.data",
    args: [c.id, c.owner, JSON.stringify(c)],
  });
}
export async function newConversation(owner: string) {
  await init();
  const c: Conversation = {
    id: randomUUID(),
    owner,
    status: "agent",
    messages: [
      {
        id: randomUUID(),
        role: "assistant",
        text: "Olá! Sou o Nexo Assist. Como posso ajudar com TI hoje?",
        at: new Date().toISOString(),
        options: [
          "Consultar meus chamados",
          "Estou com um problema",
          "Falar com um analista",
        ],
      },
    ],
    count: 0,
    facts: {},
    updatedAt: new Date().toISOString(),
  };
  await save(c);
  return c;
}
export async function withLock<T>(id: string, fn: () => Promise<T>) {
  await init();
  await db.execute({
    sql: "DELETE FROM locks WHERE expires<?",
    args: [Date.now()],
  });
  try {
    await db.execute({
      sql: "INSERT INTO locks VALUES (?,?)",
      args: [id, Date.now() + 120000],
    });
  } catch {
    throw new Error("Há uma operação em andamento. Aguarde.");
  }
  try {
    return await fn();
  } finally {
    await db.execute({ sql: "DELETE FROM locks WHERE id=?", args: [id] });
  }
}
