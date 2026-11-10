export interface Config {
  // MCS (Copilot Studio) configuration
  mcsConnectionName: string;
  mcsEnvironmentId: string;
  mcsSchemaName: string;

  // Azure OpenAI configuration (for LangGraph orchestrator)
  azureOpenAiEndpoint?: string;
  azureOpenAiDeployment: string;
  azureOpenAiApiKey?: string;
  azureOpenAiApiVersion: string;

  // Bot auth connection name
  ssoConnectionName: string;
}

const config: Config = {
  // MCS
  mcsConnectionName: process.env.MCS_CONNECTION_NAME || "mcs",
  mcsEnvironmentId: process.env.MCS_ENVIRONMENT_ID || "",
  mcsSchemaName: process.env.MCS_SCHEMA_NAME || "",

  // Azure OpenAI
  azureOpenAiEndpoint: process.env.AZURE_OPENAI_ENDPOINT,
  azureOpenAiDeployment: process.env.AZURE_OPENAI_DEPLOYMENT || "gpt-4o",
  azureOpenAiApiKey: process.env.AZURE_OPENAI_API_KEY,
  azureOpenAiApiVersion: process.env.AZURE_OPENAI_API_VERSION || "2024-12-01-preview",

  // OAuth connection used for Teams SSO (provisioned by infra as "SsoConnection")
  ssoConnectionName: process.env.OAUTHCONNECTIONNAME || "SsoConnection",
};

export default config;
