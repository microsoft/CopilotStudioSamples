import { HttpError, TurnContext, UserTokenClient } from '@microsoft/agents-hosting';

export async function teamsConsentFallback(context: TurnContext, next: () => Promise<void>): Promise<void> {
  if (context.activity.channelId !== 'msteams' || context.activity.type !== 'invoke' ||
      context.activity.name !== 'signin/tokenExchange') return next();
  const client = context.turnState.get<UserTokenClient>(context.adapter.UserTokenClientKey);
  if (!client) return next();
  const exchange = client.exchangeTokenAsync;
  // SDK 1.10.1 handles an absent token with HTTP 412, but throws on ABS's consent-required response.
  // Normalize only this expected result, before the SDK deletes the pending sign-in state.
  client.exchangeTokenAsync = async (...args) => {
    try { return await exchange.apply(client, args); }
    catch (error) {
      const body = error instanceof HttpError ? error.response.data : undefined;
      if (args[1] !== 'mcs' || !(error instanceof HttpError) || error.status !== 400 ||
          !body || typeof body !== 'object' || !('error' in body) ||
          !body.error || typeof body.error !== 'object' || !('message' in body.error) ||
          body.error.message !== 'Consent Required') throw error;
      console.warn(JSON.stringify({ event: 'teams_consent_required', action: 'interactive_signin', connection: 'mcs' }));
      return { token: undefined };
    }
  };
  try { await next(); }
  finally { client.exchangeTokenAsync = exchange; }
}
