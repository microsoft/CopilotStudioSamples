import {
  CopilotStudioClient,
  ConnectionSettings,
} from "@microsoft/agents-copilotstudio-client";
import { TurnContext } from "@microsoft/agents-hosting";
import { AuthorizationLike, getMcsOboToken } from "./mcsTokenProvider";
import config from "../config";
import { logger } from "../logger";

/**
 * Builds a CopilotStudioClient for the current turn.
 * A new client is created per turn because the token is baked in at construction time.
 */
export async function createMcsClient(
  authorization: AuthorizationLike,
  turnContext: TurnContext
): Promise<CopilotStudioClient> {
  // 'MCS' is the auth handler ID (registered in agent.ts constructor).
  // The handler's OAuth connection ('mcs') handles the token exchange.
  const token = await getMcsOboToken(authorization, turnContext, "MCS");

  const settings = new ConnectionSettings({
    environmentId: config.mcsEnvironmentId,
    schemaName: config.mcsSchemaName,
  });

  logger.debug("Creating CopilotStudioClient");
  return new CopilotStudioClient(settings, token);
}
