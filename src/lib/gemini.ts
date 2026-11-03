import { z } from "zod";
/** Native structured extraction; credentials stay in a header, never in a URL. */
async function requestGemini<T>(
  schema: z.ZodType<T>,
  messages: { role: string; content: string }[],
): Promise<T> {
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw new Error("Gemini key not configured");
  const model = process.env.GEMINI_MODEL || "gemini-3.1-flash-lite";
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`,
    {
      method: "POST",
      headers: { "x-goog-api-key": key, "content-type": "application/json" },
      body: JSON.stringify({
        systemInstruction: {
          parts: messages
            .filter((m) => m.role === "system")
            .map((m) => ({ text: m.content })),
        },
        contents: messages
          .filter((m) => m.role !== "system")
          .map((m) => ({ role: "user", parts: [{ text: m.content }] })),
        generationConfig: {
          temperature: 0,
          maxOutputTokens: 1200,
          responseMimeType: "application/json",
          responseJsonSchema: z.toJSONSchema(schema),
          thinkingConfig: { thinkingLevel: "MINIMAL" },
        },
      }),
      signal: AbortSignal.timeout(20000),
    },
  );
  if (!response.ok)
    throw Object.assign(new Error("Gemini request failed"), {
      status: response.status,
    });
  const result = (await response.json()) as {
    candidates?: {
      content?: { parts?: { text?: string; thought?: boolean }[] };
    }[];
  };
  const text = result.candidates?.[0]?.content?.parts
    ?.filter((p) => p.text && !p.thought)
    .map((p) => p.text)
    .join("");
  if (!text) throw new Error("Gemini returned no structured content");
  return schema.parse(JSON.parse(text));
}
export async function extractGemini<T>(
  schema: z.ZodType<T>,
  messages: { role: string; content: string }[],
): Promise<T> {
  for (let attempt = 0; ; attempt++) {
    try {
      return await requestGemini(schema, messages);
    } catch (error) {
      const status =
        typeof error === "object" && error !== null && "status" in error
          ? Number(error.status)
          : 0;
      const transient =
        (error instanceof Error &&
          ["TimeoutError", "TypeError"].includes(error.name)) ||
        status >= 500;
      if (attempt >= 1 || !transient) throw error;
      await new Promise((resolve) => setTimeout(resolve, 300));
    }
  }
}
