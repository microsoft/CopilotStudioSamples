import { TurnContext } from "@microsoft/agents-hosting";
import { logger } from "../logger";

/**
 * Minimal interface matching the M365 Agents SDK Authorization service.
 */
export interface AuthorizationLike {
  getToken(
    turnContext: TurnContext,
    authHandlerId: string
  ): Promise<{ token: string | undefined; status?: string }>;
}

/**
 * Extracts the token from the MCS auth handler.
 * The token is acquired via the Bot Service OAuth connection configured for the handler.
 */
export async function getMcsOboToken(
  authorization: AuthorizationLike,
  turnContext: TurnContext,
  authHandlerId: string
): Promise<string> {
  const response = await authorization.getToken(turnContext, authHandlerId);

  if (!response.token) {
    throw new Error(
      `MCS token unavailable. Handler: '${authHandlerId}', status: ${response.status ?? "unknown"}. ` +
        `Ensure the OAuth connection is configured in Azure Bot Service.`
    );
  }

  // Decode JWT to verify audience and scopes
  try {
    const parts = response.token.split(".");
    if (parts.length >= 2) {
      const payload = JSON.parse(Buffer.from(parts[1], "base64url").toString());
      logger.debug(
        `MCS token claims — aud: ${payload.aud}, scp: ${payload.scp ?? "N/A"}`
      );
    }
  } catch {
    logger.debug("Could not decode MCS token for inspection");
  }

  logger.debug(`MCS token acquired (length: ${response.token.length})`);
  return response.token;
}
