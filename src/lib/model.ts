export function modelSettings() {
  if (process.env.OPENAI_API_KEY)
    return {
      apiKey: process.env.OPENAI_API_KEY,
      model: process.env.OPENAI_MODEL || "gpt-4.1-mini",
      configuration: undefined,
    };
  const gatewayKey =
    process.env.AI_GATEWAY_API_KEY || process.env.VERCEL_OIDC_TOKEN;
  if (process.env.AI_GATEWAY_ENABLED === "true" && gatewayKey)
    return {
      apiKey: gatewayKey,
      model: process.env.AI_GATEWAY_MODEL || "openai/gpt-4.1-mini",
      configuration: { baseURL: "https://ai-gateway.vercel.sh/v1" },
    };
  return null;
}
