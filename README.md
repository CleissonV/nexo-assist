# Nexo Assist

Service desk de TI conversacional para o desafio Beyond the Bytes. TypeScript estrito, Next.js, LangGraph.js, SQLite/libSQL local e Neon Postgres no deploy Vercel. Interface baseada nas telas do protótipo Pencil: login em dois painéis, navegação lateral, chat com cartões e console de três colunas.

## Rodar localmente

Requer Node.js 22 ou 24 e npm.

```sh
npm ci
cp .env.example .env.local
npm run dev
```

No PowerShell, use `Copy-Item .env.example .env.local`. Abra http://localhost:3000. O banco `nexo.db` é criado e populado automaticamente, sem Docker ou serviço externo. Reiniciar a aplicação preserva conversas, chamados, sessões e transferências. Não remova o arquivo para manter os dados.

Funcionários (qualquer senha não vazia, conforme o PRD):

- ana.silva@nexo.com — Marketing
- bruno.costa@nexo.com — Financeiro
- carla.souza@nexo.com — Produto

Console: `analista@nexo.com`, senha local `nexo-demo`. Em produção, definir `ANALYST_PASSWORD`: o acesso não usa senha padrão. Todos os dados são fictícios. A autenticação dos funcionários é deliberadamente uma simulação e não deve receber dados reais.

## IA e modo demonstração

**Opção sem compra de créditos:** configure `GEMINI_API_KEY` no arquivo `.env.local`, usando uma chave de projeto Google AI Studio na faixa gratuita. O modelo padrão é `gemini-3.1-flash-lite`, configurável por `GEMINI_MODEL`. O adaptador usa o endpoint de compatibilidade oficial do Gemini, sem alterar o grafo ou as regras. A faixa gratuita tem limites e pode ser insuficiente para alto volume; sua disponibilidade depende da conta. Não ative faturamento para testar sem custos. [Preços](https://ai.google.dev/gemini-api/docs/pricing) e [compatibilidade oficial](https://ai.google.dev/gemini-api/docs/openai).

Ordem de seleção de credenciais: Gemini, OpenAI e Gateway explicitamente habilitado. Apenas o provedor selecionado recebe as mensagens.

Configure `OPENAI_API_KEY` em `.env.local` para ativar a interpretação pelo modelo. `OPENAI_MODEL` permite escolher o modelo; padrão `gpt-4.1-mini`, por suportar saída estruturada para extração de intenção e fatos. A escolha privilegia uma única extração curta por turno, em vez de um loop autônomo de ferramentas. Chaves são usadas apenas no servidor.

Alternativa na Vercel: `AI_GATEWAY_ENABLED=true` usa o token OIDC de curta duração da plataforma; `AI_GATEWAY_MODEL=openai/gpt-4.1-mini`. A conta deve estar verificada e com acesso liberado ao Gateway. A autenticação foi testada, mas a conta retornou `customer_verification_required`; por isso a integração não é ativada silenciosamente. Localmente também é possível usar `AI_GATEWAY_API_KEY`.

**Sem chave, a aplicação identifica claramente “Modo demonstração”.** Nesse modo o mesmo grafo LangGraph usa classificação determinística para desenvolvimento. O deploy utiliza **Gemini real**, validado com cenários de dúvida, privacidade, triagem, prioridade, confirmação, escopo e transferência crítica. Falha do provedor ou baixa confiança transferem para humano; não há execução silenciosa com uma decisão improvisada.

## Arquitetura e decisões

```text
Interface React → rotas autenticadas → LangGraph
                                    ├─ interpretação estruturada (LLM ou demo)
                                    └─ política e ferramentas
                                         ├─ central de ajuda (8 artigos)
                                         └─ serviço de chamados → libSQL
```

- `src/agent`: grafo com interpretação e aplicação da política. O LLM não recebe acesso direto de escrita nem decide identidade do proprietário.
- `src/services/tickets.ts`: serviço simulado separado do agente; consultas, abertura e atualização com filtro obrigatório por proprietário e três tentativas com espera progressiva em caso de falha.
- `src/lib`: persistência, sessão, limites, calendário e regras reutilizáveis.
- `src/app/api`: controle de acesso e transições de estado; trava persistida por conversa contra operações simultâneas.
- `src/app/page.tsx`: login, histórico, chamados, chat e console. Progresso real das etapas enviado por NDJSON; mensagens e cartões são publicados após validação e persistência. Não há animação artificial simulando tokens de LLM.

O cliente faz polling de 3,5 segundos para receber mensagens do analista e alterações de status. Ao assumir, devolver ou encerrar, uma mensagem de sistema registra a transição. O agente fica bloqueado no servidor enquanto o estado é `waiting` ou `human`, inclusive após reinício.

### Como o agente decide

1. Extrai intenção, categoria, impacto, urgência, sistema e identificador explicitamente informados. Usa até oito mensagens recentes e fatos persistidos.

Consultas com identificador explícito, comandos de confirmação e pedidos explícitos de atendimento humano são resolvidos diretamente pela política, sem chamada de LLM. O histórico identifica essas ações como “Política determinística”. O modelo é usado para interpretar linguagem livre e preencher fatos de triagem; isso evita custo e latência em operações que não exigem interpretação semântica.
2. Redireciona assuntos fora de TI. Pedido humano, confiança inferior a 70%, incidente crítico ou chamado vencido transferem com resumo.
3. Consulta somente chamados do funcionário autenticado. Artigos têm identificador de fonte; o erro VPN 809 exige verificar a versão do Windows.
4. Pergunta quem é afetado e qual a urgência. A matriz determina a prioridade; o modelo não pode sobrescrevê-la.
5. Procura chamados relacionados abertos ou resolvidos nos últimos sete dias. Propõe complemento/reabertura em vez de duplicar.
6. Persiste um rascunho e só grava após o comando explícito “Confirmar”. Editar e cancelar não gravam chamado.
7. Registra intenção, ação, grau de segurança declarado, justificativa objetiva e fonte. Clique nas ações acima de cada resposta para expandir. Esses registros são explicações operacionais, não cadeia de pensamento privada do modelo.

Prazos: crítica em uma hora corrida; alta em quatro horas úteis; média em três dias úteis; baixa em cinco dias úteis. Calendário adotado: São Paulo, segunda a sexta, 8h–18h; dez horas por dia útil, sem feriados. Cada atualização reinicia o prazo. Chamados resolvidos não são marcados vencidos.

## Qualidade e validação

```sh
npm test
npm run typecheck
npm run build
```

Avaliação opcional com um provedor real configurado em `.env.local`: `node --env-file=.env.local --import tsx tests/live-evaluation.ts`. Ela usa banco de teste separado e consome a cota do provedor. O teste integrado contra um servidor está em `tests/api-smoke.mjs`; configure `TEST_BASE_URL` e `TEST_ANALYST_PASSWORD` sem colocar a senha em argumentos de terminal.

Testes exercitam classificação por impacto/urgência, fim de semana, fronteira de sete dias, isolamento por proprietário, tentativa de atualização indevida, confirmação sem duplicação, reabertura, transferência crítica/vencida/incerta, persistência do estado, aplicabilidade do artigo VPN e retries. Os testes usam banco separado em `work/`.

Roteiro manual:

1. Entre como Ana e consulte `INC-20311`: está vencido e transfere com contexto.
2. Entre como analista, filtre aguardando, assuma a conversa, envie uma mensagem e devolva ao agente ou encerre.
3. Entre como Carla: “Meu teclado parou” → “Somente eu” → “Há alternativa”. Confira rascunho, confirme e veja o cartão. Repita “Confirmar”: não deve criar outro chamado.
4. Ana: “Minha senha do SAP está bloqueada” → impacto e urgência. O rascunho propõe reabrir `INC-20150`.
5. “Como resolver VPN erro 809?” → selecione Windows 11: não deve orientar reinstalação.
6. Entre como Bruno: chamados de Ana não aparecem. Um ID de outro funcionário retorna não encontrado.
7. Reinicie o servidor: histórico e estado humano permanecem.

## Segurança e custo

Cookie de sessão aleatório, HttpOnly, SameSite Strict, Secure em produção, validade de oito horas; autorização em todas as rotas e no serviço de chamados. Nenhum segredo no cliente ou no Git. Máximo de 4.000 caracteres por mensagem, 30 turnos de agente por conversa, até 60 extrações LLM/hora por funcionário e 200/dia globalmente, com contadores persistidos. Histórico do modelo limitado a oito mensagens; confirmações não precisam de nova extração. Configure também limites de gasto no provedor.

## Deploy

O backend não funciona em GitHub Pages, que hospeda arquivos estáticos. O projeto Vercel `nexo-assist` utiliza um banco Neon Postgres exclusivo, provisionado no plano gratuito, em São Paulo (`gru1`). A aplicação recusa banco local no ambiente Vercel, evitando perda de dados entre execuções. O adaptador usa consultas parametrizadas e transações HTTP no Neon; o modo local continua usando SQLite sem infraestrutura adicional.

1. Conecte um banco Neon pelo Marketplace da Vercel. A integração define `DATABASE_URL` automaticamente. Como alternativa, banco libSQL no Turso continua aceito com URL e token.
2. Importe este repositório na Vercel, framework Next.js, Node.js 22 ou 24.
3. Cadastre `ANALYST_PASSWORD` e as variáveis de IA como segredos do servidor. `DATABASE_AUTH_TOKEN` só é necessário para libSQL; Neon usa a URL protegida fornecida pela integração.
4. Execute deploy. Esquema e dados de exemplo são inicializados automaticamente sem sobrescrever dados existentes.
5. Teste o roteiro acima no endereço publicado. Compartilhe senha do analista diretamente com os avaliadores, nunca no repositório público.

**Deploy público:** https://nexo-assist-zeta.vercel.app — Gemini real e banco Neon persistente. Chaves e senha do analista estão como segredos do servidor. A página de produção é pública; os endereços de versões e previews mantêm Standard Protection da Vercel. O teste integrado pela URL pública passou em privacidade, transferência, pausa, assumir atendimento, responder como analista, devolver ao agente, encerrar e progresso real.

Documentação: [LangGraph](https://docs.langchain.com/oss/javascript/langgraph/graph-api), [Turso](https://docs.turso.tech/quickstart), [OpenAI](https://developers.openai.com/api/docs/quickstart).

## Trade-offs e próximos passos

- Duplicidade por termos significativos é conservadora e simples de inspecionar; pode encontrar falsos positivos. Um rascunho confirmado permite revisão humana. Com mais tempo: busca semântica com avaliação de pares de chamados.
- A confiança do modelo é autodeclarada, não probabilidade calibrada. Com mais tempo: conjunto de avaliação versionado, avaliação com LLM real e limiar calibrado por intenção.
- Respostas operacionais usam templates com fatos verificados; restringem criatividade para evitar inventar status, prazos ou instruções técnicas.
- SQLite local reduz instalação; Neon Postgres serve ao deploy. Escrita do chamado e gravação da conversa ainda são operações distintas; o ID estável do rascunho impede duplicar uma criação ao repetir a confirmação após interrupção. Próximo passo: outbox/transação para atomicidade completa.
- O limite de 30 turnos aplica-se ao agente; após transferência, o humano pode continuar atendendo. Controles por identidade de demonstração não equivalem a autenticação corporativa real.
- Em produção real: SSO, RBAC por analista, auditoria separada imutável, calendário de feriados, idempotência ponta a ponta, retenção de dados, alertas e testes de carga.

Implementação feita com auxílio de IA. Decisões e limitações ficam explícitas para facilitar revisão e discussão técnica.
