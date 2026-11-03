"use client";
import { useEffect, useRef, useState, type FormEvent } from "react";
import {
  ArrowRight,
  Send,
  MessageSquare,
  LogOut,
  Plus,
  UserRound,
  Check,
  ChevronRight,
  Clock,
  Headphones,
  Ticket as TicketIcon,
  Search,
  ShieldCheck,
  ArrowUpRight,
} from "lucide-react";
import {
  employees,
  type Conversation,
  type Message,
  type Ticket,
  type Draft,
} from "@/lib/types";
import { isOverdue } from "@/lib/policy";
type Session = { email: string; role: string; mode: string };
const statusLabels: Record<Conversation["status"], string> = {
  agent: "Com o Nexo Assist",
  waiting: "Aguardando analista",
  human: "Em atendimento",
  closed: "Encerrada",
};
async function api<T>(
  path: string,
  body?: unknown,
  method?: string,
  onProgress?: (label: string) => void,
): Promise<T> {
  const r = await fetch(`/api/${path}`, {
    method: method || (body ? "POST" : "GET"),
    headers: body
      ? {
          "Content-Type": "application/json",
          ...(onProgress ? { Accept: "application/x-ndjson" } : {}),
        }
      : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  if (r.headers.get("content-type")?.includes("application/x-ndjson")) {
    const reader = r.body!.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    let result: T | undefined;
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      let pos: number;
      while ((pos = buffer.indexOf("\n")) >= 0) {
        const line = buffer.slice(0, pos);
        buffer = buffer.slice(pos + 1);
        if (!line) continue;
        const event = JSON.parse(line) as {
          type: string;
          label: string;
          data: T;
          error: string;
        };
        if (event.type === "error") throw new Error(event.error);
        if (event.type === "progress") onProgress?.(event.label);
        if (event.type === "result") result = event.data;
      }
    }
    if (!result)
      throw new Error(
        "Resposta incompleta. Consulte o histórico antes de repetir.",
      );
    return result;
  }
  const data = await r.json();
  if (!r.ok) throw new Error(data.error || "Não foi possível concluir.");
  return data as T;
}
function Brand() {
  return (
    <div className="brand">
      <span className="brand-mark">N</span>Nexo Assist
    </div>
  );
}
function TicketCard({
  ticket: t,
  onSelect,
}: {
  ticket: Ticket;
  onSelect?: (id: string) => void;
}) {
  return (
    <button
      className="ticket-card"
      onClick={() => onSelect?.(t.id)}
      disabled={!onSelect}
    >
      <div className="row">
        <small>Chamado · {t.id}</small>
        <span className={`badge ${isOverdue(t) ? "warning" : ""}`}>
          {isOverdue(t) ? "Prazo vencido" : t.status}
        </span>
      </div>
      <h3>{t.title}</h3>
      <p>{t.description}</p>
      <div className="ticket-meta">
        <span>
          Categoria<strong>{t.category}</strong>
        </span>
        <span>
          Prioridade<strong>{t.priority}</strong>
        </span>
        <span>
          Última atualização
          <strong>{new Date(t.updatedAt).toLocaleDateString("pt-BR")}</strong>
        </span>
        <span>
          Próximo prazo
          <strong>{new Date(t.dueAt).toLocaleString("pt-BR")}</strong>
        </span>
      </div>
    </button>
  );
}
function DraftCard({
  draft: d,
  onAction,
}: {
  draft: Draft;
  onAction?: (v: string) => void;
}) {
  return (
    <div className="draft">
      <div className="row">
        <small>
          {d.targetId
            ? `Atualização · ${d.targetId}`
            : "Novo chamado · Rascunho"}
        </small>
        <span className="badge warning">Aguardando confirmação</span>
      </div>
      <h3>{d.ticket.title}</h3>
      <p>{d.ticket.description}</p>
      <div className="ticket-meta">
        <span>
          Tipo<strong>{d.ticket.type}</strong>
        </span>
        <span>
          Categoria<strong>{d.ticket.category}</strong>
        </span>
        <span>
          Prioridade<strong>{d.ticket.priority}</strong>
        </span>
        <span>
          Afetados<strong>{d.ticket.affected}</strong>
        </span>
      </div>
      <p className="muted">
        Prazo:{" "}
        {
          {
            Crítica: "1 hora",
            Alta: "4 horas úteis",
            Média: "3 dias úteis",
            Baixa: "5 dias úteis",
          }[d.ticket.priority]
        }
      </p>
      {onAction && (
        <div className="draft-actions">
          <button className="primary" onClick={() => onAction("Confirmar")}>
            Confirmar <Check size={14} />
          </button>
          <button onClick={() => onAction("Editar")}>Editar</button>
          <button onClick={() => onAction("Cancelar")}>Cancelar</button>
        </div>
      )}
    </div>
  );
}
function Bubble({
  message: m,
  onAction,
  active,
}: {
  message: Message;
  onAction: (v: string) => void;
  active: boolean;
}) {
  return (
    <div className={`message ${m.role}`}>
      <div className="message-label">
        {m.role === "user"
          ? "Você"
          : m.role === "analyst"
            ? "Analista de TI"
            : m.role === "system"
              ? "Atendimento"
              : "Nexo Assist"}{" "}
        <time>
          {new Date(m.at).toLocaleTimeString("pt-BR", {
            hour: "2-digit",
            minute: "2-digit",
          })}
        </time>
      </div>
      {m.trace && (
        <details className="trace">
          <summary>
            <Check size={12} />
            {m.trace.map((t) => t.action).join(" · ")}{" "}
            <ChevronRight size={12} />
          </summary>
          <div className="trace-detail">
            {m.trace.map((t, i) => (
              <div key={i}>
                <strong>{t.action}</strong>
                <span>
                  Intenção: {t.intent} · Segurança:{" "}
                  {Math.round(t.confidence * 100)}%
                </span>
                <p>{t.reason}</p>
                <small>Fonte: {t.source}</small>
              </div>
            ))}
          </div>
        </details>
      )}
      <div className="bubble">{m.text}</div>
      {m.tickets?.map((t) => (
        <TicketCard
          key={t.id}
          ticket={t}
          onSelect={active ? onAction : undefined}
        />
      ))}
      {m.draft && (
        <DraftCard draft={m.draft} onAction={active ? onAction : undefined} />
      )}{" "}
      {active && !m.draft && m.options && (
        <div className="quick-options">
          {m.options.map((o) => (
            <button key={o} onClick={() => onAction(o)}>
              {o}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
export default function Home() {
  const [progress, setProgress] = useState("Processando sua solicitação…");
  const [session, setSession] = useState<Session | null>(null),
    [loading, setLoading] = useState(true),
    [email, setEmail] = useState("ana.silva@nexo.com"),
    [password, setPassword] = useState(""),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [conversations, setConversations] = useState<Conversation[]>([]),
    [selected, setSelected] = useState<Conversation | null>(null),
    [tickets, setTickets] = useState<Ticket[]>([]),
    [text, setText] = useState(""),
    [view, setView] = useState("chat"),
    [filter, setFilter] = useState("all"),
    [query, setQuery] = useState("");
  const bottom = useRef<HTMLDivElement>(null);
  async function refresh() {
    const data = await api<{
      conversations: Conversation[];
      tickets: Ticket[];
    }>("conversations");
    setConversations(data.conversations);
    setTickets(data.tickets);
    return data;
  }
  useEffect(() => {
    api<Session>("session")
      .then(async (s) => {
        setSession(s);
        const d = await refresh();
        setSelected(d.conversations[0] || null);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);
  useEffect(() => {
    if (!session) return;
    const timer = setInterval(() => {
      refresh().catch(() => {});
      if (selected)
        api<{ conversation: Conversation; tickets: Ticket[] }>(
          `conversations/${selected.id}`,
        )
          .then((d) => {
            setSelected(d.conversation);
            setTickets(d.tickets);
          })
          .catch(() => {});
    }, 3500);
    return () => clearInterval(timer);
  }, [session, selected?.id]);
  useEffect(() => {
    bottom.current?.scrollIntoView({ behavior: "smooth" });
  }, [selected?.messages.length, busy]);
  async function login(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      await api("session", { email, password });
      const s = await api<Session>("session");
      setSession(s);
      const d = await refresh();
      setSelected(d.conversations[0] || null);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function newChat() {
    setBusy(true);
    setError("");
    try {
      const c = await api<Conversation>("conversations", {});
      setSelected(c);
      setView("chat");
      await refresh();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function select(c: Conversation) {
    setSelected(c);
    setView("chat");
    try {
      const d = await api<{ conversation: Conversation; tickets: Ticket[] }>(
        `conversations/${c.id}`,
      );
      setSelected(d.conversation);
      setTickets(d.tickets);
    } catch (e) {
      setError((e as Error).message);
    }
  }
  async function send(value: string, action?: string) {
    if (busy || (!value.trim() && !action)) return;
    setBusy(true);
    setError("");
    try {
      let c = selected;
      if (!c) {
        c = await api<Conversation>("conversations", {});
        setSelected(c);
      }
      const updated = await api<Conversation>(
        `conversations/${c.id}`,
        action ? { action } : { text: value },
        undefined,
        setProgress,
      );
      setSelected(updated);
      setText("");
      await refresh();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  if (loading)
    return (
      <div className="loading">
        <Brand />
        <p>Preparando seu atendimento…</p>
      </div>
    );
  if (!session)
    return (
      <main className="login">
        <section className="login-story">
          <Brand />
          <div className="story-body">
            <small>Service desk de TI da Nexo</small>
            <h1>
              Seu problema de TI,
              <br />
              resolvido em uma conversa.
            </h1>
            <p>
              Descreva o que está acontecendo. O assistente consulta seus
              chamados, busca na central de ajuda e chama um analista quando
              precisa.
            </p>
            <div className="example">
              <div className="example-user">
                Meu notebook não conecta na VPN. Erro 809.
              </div>
              <small>
                Nexo Assist <Check size={12} /> consultou a central de ajuda
              </small>
              <p>
                Preciso saber a versão do seu Windows para te orientar com
                segurança.
              </p>
              <span className="badge">
                Uma conversa. O próximo passo certo.
              </span>
            </div>
          </div>
          <div className="story-footer">
            <span>
              <ShieldCheck size={18} /> Seus dados protegidos
            </span>
            <span>
              <Headphones size={18} /> Pessoas quando você precisa
            </span>
          </div>
        </section>
        <section className="login-form">
          <small className="help-link">
            Problemas para entrar?{" "}
            <a href="mailto:suporte@nexo.example">
              Fale com o suporte <ArrowUpRight size={11} />
            </a>
          </small>
          <form onSubmit={login}>
            <h2>Entrar</h2>
            <p>Use seu e-mail corporativo e a senha da rede Nexo.</p>
            <label htmlFor="email">E-mail corporativo</label>
            <input
              id="email"
              type="email"
              autoComplete="username"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
            <label htmlFor="password">Senha</label>
            <input
              id="password"
              type="password"
              placeholder="Digite sua senha"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
            {error && (
              <p role="alert" className="error">
                {error}
              </p>
            )}
            <button className="primary login-submit" disabled={busy}>
              {busy ? "Entrando…" : "Entrar"}
              <ArrowRight size={16} />
            </button>
            <div className="demo-access">
              <strong>Acesso de demonstração</strong>
              <p>Funcionários abaixo aceitam qualquer senha.</p>
              {employees.map((e) => (
                <button
                  type="button"
                  key={e.email}
                  onClick={() => setEmail(e.email)}
                >
                  {e.email}
                </button>
              ))}
              <small>Console: analista@nexo.com · senha local: nexo-demo</small>
            </div>
          </form>
          <footer>
            © 2026 Nexo · Service desk de TI <span>Privacidade por padrão</span>
          </footer>
        </section>
      </main>
    );
  const analyst = session.role === "analyst";
  const person = employees.find((e) => e.email === session.email);
  const visible = conversations.filter(
    (c) =>
      (filter === "all" || c.status === filter) &&
      `${c.owner} ${c.summary || ""}`
        .toLowerCase()
        .includes(query.toLowerCase()),
  );
  return (
    <div className={`workspace ${analyst ? "analyst-workspace" : ""}`}>
      <aside className="sidebar">
        <Brand />
        <div className="nav">
          <button
            className={view === "chat" ? "selected" : ""}
            onClick={() => setView("chat")}
          >
            <MessageSquare size={16} />
            {analyst ? "Conversas" : "Atendimento"}
          </button>
          {!analyst && (
            <>
              <button
                className={view === "tickets" ? "selected" : ""}
                onClick={() => setView("tickets")}
              >
                <TicketIcon size={16} />
                Meus chamados
              </button>
              <button onClick={newChat} disabled={busy}>
                <Plus size={16} />
                Nova conversa
              </button>
            </>
          )}
        </div>
        {!analyst && (
          <div className="history">
            <small>CONVERSAS RECENTES</small>
            {conversations.slice(0, 8).map((c) => (
              <button
                className={selected?.id === c.id ? "current" : ""}
                key={c.id}
                onClick={() => select(c)}
              >
                <MessageSquare size={13} />
                <span>
                  {c.messages.find((m) => m.role === "user")?.text ||
                    "Nova conversa"}
                </span>
              </button>
            ))}
          </div>
        )}
        <div className="profile">
          <span className="avatar">
            {analyst
              ? "SD"
              : person?.name
                  .split(" ")
                  .map((w) => w[0])
                  .join("")}
          </span>
          <div>
            <strong>{analyst ? "Service desk" : person?.name}</strong>
            <small>{analyst ? "Suporte N1 e N2" : person?.department}</small>
          </div>
          <button
            aria-label="Sair"
            onClick={async () => {
              await api("session", undefined, "DELETE");
              setSession(null);
              setSelected(null);
              setConversations([]);
            }}
          >
            <LogOut size={15} />
          </button>
        </div>
      </aside>
      <div className="main">
        <header className="topbar">
          <span>
            Service desk de TI <ChevronRight size={13} />
            <strong>
              {analyst
                ? "Console do analista"
                : view === "tickets"
                  ? "Meus chamados"
                  : "Atendimento"}
            </strong>
          </span>
          <div>
            <span className="online">
              <i />
              {session.mode === "demo"
                ? "Modo demonstração"
                : "Assistente online"}
            </span>
          </div>
        </header>
        <div className="content-layout">
          {analyst && (
            <aside className="queue">
              <div className="queue-title">
                <h2>Conversas</h2>
                <span className="badge">{conversations.length}</span>
              </div>
              <label className="search">
                <Search size={14} />
                <input
                  aria-label="Buscar conversas"
                  placeholder="Buscar funcionário…"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                />
              </label>
              <select
                aria-label="Filtrar status"
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
              >
                <option value="all">Todos os status</option>
                {Object.entries(statusLabels).map(([v, l]) => (
                  <option key={v} value={v}>
                    {l}
                  </option>
                ))}
              </select>
              {visible.map((c) => (
                <button
                  className={`queue-item ${selected?.id === c.id ? "active" : ""}`}
                  key={c.id}
                  onClick={() => select(c)}
                >
                  <strong>
                    {employees.find((e) => e.email === c.owner)?.name ||
                      c.owner}
                  </strong>
                  <small>{statusLabels[c.status]}</small>
                  <p>
                    {c.messages.filter((m) => m.role === "user").at(-1)?.text ||
                      "Nova conversa"}
                  </p>
                  <time>
                    {new Date(c.updatedAt).toLocaleTimeString("pt-BR", {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </time>
                </button>
              ))}
              {!visible.length && (
                <p className="empty-small">Nenhuma conversa neste filtro.</p>
              )}
            </aside>
          )}
          {view === "tickets" && !analyst ? (
            <section className="ticket-page">
              <h1>Meus chamados</h1>
              <p className="muted">Acompanhe suas solicitações e prazos.</p>
              {tickets.map((t) => (
                <TicketCard
                  key={t.id}
                  ticket={t}
                  onSelect={(id) => {
                    setView("chat");
                    void send(id);
                  }}
                />
              ))}
            </section>
          ) : (
            <section className="chat">
              <div className="chat-header">
                <div>
                  <strong>
                    {analyst
                      ? employees.find((e) => e.email === selected?.owner)
                          ?.name || "Selecione uma conversa"
                      : "Seu atendimento de TI"}
                  </strong>
                  <small>
                    {selected
                      ? statusLabels[selected.status]
                      : "Uma conversa para resolver seu próximo passo."}
                  </small>
                </div>
                {analyst && selected && (
                  <div className="console-actions">
                    {selected.status === "waiting" && (
                      <button
                        className="primary"
                        disabled={busy}
                        onClick={() => send("", "claim")}
                      >
                        Assumir atendimento
                      </button>
                    )}
                    {selected.status === "human" && (
                      <>
                        <button
                          disabled={busy}
                          onClick={() => send("", "release")}
                        >
                          Devolver ao agent
                        </button>
                        <button
                          className="primary"
                          disabled={busy}
                          onClick={() => send("", "close")}
                        >
                          Encerrar
                        </button>
                      </>
                    )}
                  </div>
                )}
              </div>
              {selected &&
                (selected.status === "waiting" ||
                  selected.status === "human") && (
                  <div className="handoff-banner">
                    <Headphones size={17} />
                    <span>
                      {selected.status === "waiting"
                        ? "Aguardando um analista."
                        : "Analista atendendo."}{" "}
                      O agent está pausado.
                    </span>
                  </div>
                )}
              <div className="messages" aria-live="polite">
                {!selected && (
                  <div className="welcome">
                    <span className="welcome-icon">
                      <MessageSquare size={26} />
                    </span>
                    <small>NEXO ASSIST</small>
                    <h1>Como posso ajudar hoje?</h1>
                    <p>
                      Da dúvida rápida ao chamado resolvido.
                      <br />
                      Seu suporte de TI começa aqui.
                    </p>
                    {!analyst && (
                      <div className="welcome-options">
                        {[
                          [
                            "Consultar meus chamados",
                            "Veja o andamento e os prazos.",
                          ],
                          [
                            "Estou com um problema",
                            "Vamos encontrar o próximo passo.",
                          ],
                          [
                            "Falar com um analista",
                            "Converse com nossa equipe.",
                          ],
                        ].map(([title, desc]) => (
                          <button
                            key={title}
                            disabled={busy}
                            onClick={() => send(title)}
                          >
                            <strong>
                              {title}
                              <ArrowUpRight size={15} />
                            </strong>
                            <span>{desc}</span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}
                {selected?.messages.map((m, i) => (
                  <Bubble
                    key={m.id}
                    message={m}
                    active={
                      !analyst &&
                      !busy &&
                      selected.status === "agent" &&
                      i === selected.messages.length - 1
                    }
                    onAction={(v) => send(v)}
                  />
                ))}
                {busy && (
                  <div className="thinking">
                    <span /> {progress}
                  </div>
                )}
                <div ref={bottom} />
              </div>
              {error && (
                <div className="error" role="alert">
                  {error}
                </div>
              )}
              <form
                className="composer"
                onSubmit={(e) => {
                  e.preventDefault();
                  void send(text);
                }}
              >
                <div className="compose-box">
                  <textarea
                    aria-label="Mensagem"
                    placeholder={
                      selected?.status === "closed"
                        ? "Conversa encerrada"
                        : "Escreva para " +
                          (analyst ? "o funcionário…" : "o Nexo…")
                    }
                    value={text}
                    onChange={(e) => setText(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.shiftKey) {
                        e.preventDefault();
                        void send(text);
                      }
                    }}
                    disabled={
                      busy ||
                      selected?.status === "closed" ||
                      (analyst && selected?.status !== "human")
                    }
                    rows={1}
                  />
                  <button
                    className="primary"
                    disabled={
                      busy ||
                      !text.trim() ||
                      selected?.status === "closed" ||
                      (analyst && selected?.status !== "human")
                    }
                  >
                    <Send size={14} />
                    <span>Enviar</span>
                  </button>
                </div>
                <div className="composer-foot">
                  <span>
                    <ShieldCheck size={11} /> Não compartilhe senhas ou códigos
                    de acesso.
                  </span>
                  <span>{selected?.count || 0}/30 mensagens nesta sessão</span>
                </div>
              </form>
            </section>
          )}
          {analyst && selected && (
            <aside className="context-panel">
              <div className="context-person">
                <span className="avatar">
                  <UserRound size={20} />
                </span>
                <h3>
                  {employees.find((e) => e.email === selected.owner)?.name}
                </h3>
                <p>{selected.owner}</p>
              </div>
              <h3>Resumo do encaminhamento</h3>
              <p className="summary-text">
                {selected.summary || "Conversa ainda com o assistente."}
              </p>
              <h3>
                <TicketIcon size={16} /> Chamados do funcionário
              </h3>
              {tickets.map((t) => (
                <TicketCard key={t.id} ticket={t} />
              ))}
              <small>
                <Clock size={12} /> Atualização automática a cada 3,5 segundos
              </small>
            </aside>
          )}
        </div>
      </div>
    </div>
  );
}
