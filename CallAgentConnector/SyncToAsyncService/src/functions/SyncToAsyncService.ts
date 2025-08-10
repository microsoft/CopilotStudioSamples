import { app, HttpRequest, HttpResponseInit, InvocationContext } from "@azure/functions";
import { Activity, ActivityTypes } from '@microsoft/agents-activity';
import { ConnectionSettings, CopilotStudioClient } from '@microsoft/agents-copilotstudio-client';

interface RequestBody {
    environmentId: string;
    agentIdentifier: string;
    message: string;
    conversationId?: string;
}

export async function SyncToAsyncService(request: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> {
    context.log(`Http function processed request for url "${request.url}"`);

    try {
        // Extract bearer token from Authorization header
        const authHeader = request.headers.get('Authorization');
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return {
                status: 401,
                body: JSON.stringify({
                    error: "Unauthorized: Bearer token required in Authorization header"
                }),
                headers: { "Content-Type": "application/json" }
            };
        }
        const bearerToken = authHeader.substring(7); // Remove 'Bearer ' prefix

        // Parse request body
        const body = await request.json() as RequestBody;
        
        if (!body.environmentId || !body.agentIdentifier || !body.message) {
            return {
                status: 400,
                body: JSON.stringify({
                    error: "Missing required parameters: environmentId, agentIdentifier, and message are required"
                }),
                headers: { "Content-Type": "application/json" }
            };
        }

        // Create connection settings
        const settings: ConnectionSettings = {
            environmentId: body.environmentId,
            agentIdentifier: body.agentIdentifier,
            tenantId: '', // You may need to extract this from the token or pass it as a parameter
            appClientId: '' // Not needed when using a provided bearer token
        };

        // Create Copilot Studio client with the bearer token from header
        const copilotClient = new CopilotStudioClient(settings, bearerToken);

        // Start conversation if no conversationId is provided
        let conversationId = body.conversationId;
        if (!conversationId) {
            const startActivity = await copilotClient.startConversationAsync(true);
            conversationId = startActivity.conversation?.id;
        }

        // Ask the question using the message from the body
        const replies = await copilotClient.askQuestionAsync(body.message, conversationId!);

        // Format the response - just return all activities as-is
        const responseData = {
            conversationId,
            replies: replies.map((act: Activity) => ({
                type: act.type,
                text: act.text,
                suggestedActions: act.suggestedActions,
                attachments: act.attachments,
                channelData: act.channelData
            }))
        };

        return {
            status: 200,
            body: JSON.stringify(responseData),
            headers: { "Content-Type": "application/json" }
        };

    } catch (error) {
        context.error('Error in SyncToAsyncService:', error);
        
        let errorMessage = "Internal server error";
        let statusCode = 500;
        
        if (error instanceof Error) {
            // Check if it's an Axios error
            if ('isAxiosError' in error && error.isAxiosError) {
                const axiosError = error as any;
                
                if (axiosError.response) {
                    // Pass through the status code and message from the API
                    statusCode = axiosError.response.status;
                    errorMessage = axiosError.response.data?.message || axiosError.response.statusText || error.message;
                } else if (axiosError.code === 'ENOTFOUND') {
                    statusCode = 400;
                    errorMessage = "Invalid environment ID";
                } else if (axiosError.code === 'ERR_NETWORK') {
                    errorMessage = "Network error";
                }
            } else {
                errorMessage = error.message;
            }
        }
        
        return {
            status: statusCode,
            body: JSON.stringify({
                error: errorMessage
            }),
            headers: { "Content-Type": "application/json" }
        };
    }
}

app.http('SyncToAsyncService', {
    methods: ['POST'],
    authLevel: 'anonymous',
    handler: SyncToAsyncService
});
