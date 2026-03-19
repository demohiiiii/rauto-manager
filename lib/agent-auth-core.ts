function getConfiguredAgentApiKey(): string | null {
  const apiKey = process.env.AGENT_API_KEY?.trim();
  return apiKey ? apiKey : null;
}

function extractBearerToken(headerValue?: string | null): string | null {
  if (!headerValue) {
    return null;
  }

  const normalized = headerValue.trim();
  if (!normalized.toLowerCase().startsWith("bearer ")) {
    return null;
  }

  const token = normalized.slice(7).trim();
  return token || null;
}

export function validateAgentHeaderValues(
  authorization?: string | null,
  apiKey?: string | null
): boolean {
  const expectedApiKey = getConfiguredAgentApiKey();

  if (!expectedApiKey) {
    return true;
  }

  const bearerToken = extractBearerToken(authorization);
  if (bearerToken === expectedApiKey) {
    return true;
  }

  return apiKey?.trim() === expectedApiKey;
}

