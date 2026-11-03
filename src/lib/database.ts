import { createClient } from "@libsql/client";
import { neon } from "@neondatabase/serverless";
type Statement = string | { sql: string; args: (string | number)[] };
export function createDatabase(url: string, authToken?: string) {
  if (/^postgres(ql)?:/.test(url)) {
    const client = neon(url, { fullResults: true });
    const prepare = (statement: Statement) => {
      const { sql, args } =
        typeof statement === "string"
          ? { sql: statement, args: [] }
          : statement;
      let parameter = 0;
      return {
        sql: sql
          .replace(/\?/g, () => `$${++parameter}`)
          .replace(/\bINTEGER\b/g, "BIGINT"),
        args,
      };
    };
    return {
      async execute(statement: Statement) {
        const q = prepare(statement);
        const result = await client.query(q.sql, q.args);
        return {
          rows: result.rows as Record<string, unknown>[],
          rowsAffected: result.rowCount,
        };
      },
      async batch(statements: Statement[], _mode?: string) {
        return client.transaction(
          statements.map((statement) => {
            const q = prepare(statement);
            return client.query(q.sql, q.args);
          }),
        );
      },
      close() {},
    };
  }
  const client = createClient({ url, authToken });
  return {
    async execute(statement: Statement) {
      const result = await client.execute(statement);
      return {
        rows: result.rows as Record<string, unknown>[],
        rowsAffected: result.rowsAffected,
      };
    },
    async batch(statements: Statement[], _mode?: string) {
      return client.batch(statements, "write");
    },
    close() {
      client.close();
    },
  };
}
