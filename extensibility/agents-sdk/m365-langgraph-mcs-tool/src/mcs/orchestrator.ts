import { AzureChatOpenAI } from "@langchain/openai";
import { createReactAgent } from "@langchain/langgraph/prebuilt";
import type { CompiledStateGraph } from "@langchain/langgraph";
import { tool } from "@langchain/core/tools";
import { z } from "zod";
import { mcsTool } from "./mcsTool";
import config from "../config";
import { logger } from "../logger";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type OrchestratorGraph = CompiledStateGraph<any, any, any>;

/**
 * Simple demo tool that returns the current date/time.
 * Demonstrates multi-tool orchestration alongside the MCS tool.
 */
const getCurrentTimeTool = tool(
  async (): Promise<string> => {
    const now = new Date();
    return `Current date and time: ${now.toISOString()} (${now.toLocaleString("en-US", { timeZone: "UTC" })} UTC)`;
  },
  {
    name: "get_current_time",
    description:
      "Get the current date and time. Use this when the user asks about the current time or date.",
    schema: z.object({}),
  }
);

/**
 * Creates the LangGraph ReAct agent with Azure OpenAI and the tool set.
 */
export function createOrchestrator(): OrchestratorGraph {
  if (!config.azureOpenAiEndpoint) {
    throw new Error("AZURE_OPENAI_ENDPOINT is not configured.");
  }

  const model = new AzureChatOpenAI({
    azureOpenAIEndpoint: config.azureOpenAiEndpoint,
    azureOpenAIApiDeploymentName: config.azureOpenAiDeployment,
    azureOpenAIApiKey: config.azureOpenAiApiKey,
    azureOpenAIApiVersion: config.azureOpenAiApiVersion,
    temperature: 0,
    streaming: true,
  });

  const tools = [mcsTool, getCurrentTimeTool];

  const agent = createReactAgent({
    llm: model,
    tools,
    prompt:
      "You are a helpful assistant that orchestrates between tools to answer user questions.\n\n" +
      "AVAILABLE TOOLS:\n" +
      "- ask_copilot_studio_agent: A Copilot Studio agent that specializes in finding hotels and answering hotel-related questions. " +
      "Use this for ANY question about hotels, accommodations, bookings, or travel.\n" +
      "- get_current_time: Returns the current date and time.\n\n" +
      "RULES:\n" +
      "1. For hotel/accommodation/travel questions, ALWAYS use ask_copilot_studio_agent.\n" +
      "2. If the user mentions 'Copilot Studio', 'agent', or asks you to forward a message, use ask_copilot_studio_agent.\n" +
      "3. For time/date questions, use get_current_time.\n" +
      "4. For simple greetings, respond directly.\n" +
      "5. After calling ask_copilot_studio_agent, do NOT repeat the response — the user already saw it via streaming. " +
      "Just say something brief or nothing at all.\n",
  });

  logger.info(
    `Orchestrator created with Azure OpenAI (${config.azureOpenAiDeployment}) and ${tools.length} tools`
  );
  return agent;
}
