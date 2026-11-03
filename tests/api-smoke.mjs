import assert from "node:assert/strict";
const base = "http://localhost:3000/api/";
async function login(email, password) {
  const r = await fetch(base + "session", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  assert.equal(r.status, 200);
  return r.headers.get("set-cookie").split(";")[0];
}
async function api(path, cookie, body) {
  const r = await fetch(base + path, {
    method: body ? "POST" : "GET",
    headers: { cookie, "content-type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
  return { status: r.status, data: await r.json() };
}
const ana = await login("ana.silva@nexo.com", "teste");
const bruno = await login("bruno.costa@nexo.com", "teste");
const analyst = await login("analista@nexo.com", "nexo-demo");
const { data: c } = await api("conversations", ana, {});
const path = "conversations/" + c.id;
assert.equal((await api(path, bruno)).status, 404);
let result = await api(path, ana, { text: "INC-20311" });
assert.equal(result.data.status, "waiting");
assert.ok(result.data.summary);
const assistantCount = result.data.messages.filter(
  (m) => m.role === "assistant",
).length;
result = await api(path, ana, { text: "Preciso de mais ajuda" });
assert.equal(
  result.data.messages.filter((m) => m.role === "assistant").length,
  assistantCount,
);
assert.equal(
  (await api(path, analyst, { action: "claim" })).data.status,
  "human",
);
assert.equal(
  (
    await api(path, analyst, { text: "Olá, vou verificar o notebook." })
  ).data.messages.at(-1).role,
  "analyst",
);
assert.equal(
  (await api(path, analyst, { action: "release" })).data.status,
  "agent",
);
assert.equal(
  (await api(path, ana, { text: "Falar com um analista" })).data.status,
  "waiting",
);
await api(path, analyst, { action: "claim" });
assert.equal(
  (await api(path, analyst, { action: "close" })).data.status,
  "closed",
);
assert.equal((await api(path, ana, { text: "Olá" })).status, 400);
const { data: s } = await api("conversations", ana, {});
const stream = await fetch(base + "conversations/" + s.id, {
  method: "POST",
  headers: {
    cookie: ana,
    "content-type": "application/json",
    accept: "application/x-ndjson",
  },
  body: JSON.stringify({ text: "Qual o horário do service desk?" }),
});
const events = (await stream.text()).trim().split("\n").map(JSON.parse);
assert.equal(events.filter((e) => e.type === "progress").length, 3);
assert.equal(events.at(-1).type, "result");
console.log(
  "API smoke: privacy, handoff, agent pause, claim, human reply, release, close and live progress passed.",
);
