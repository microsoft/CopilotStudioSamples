/**
 * DL_GetConversation
 * Starts a new DirectLine conversation with Copilot Studio.
 * Called from Einstein Bot to initialize the connection.
 * Uses Named Credential for authentication (default: 'DirectLine').
 */
public with sharing class DL_GetConversation {

    private static final String DEFAULT_NAMED_CREDENTIAL = 'Directline';

    public class Input {
        @InvocableVariable(label='Named Credential' description='Name of the Named Credential to use (default: DirectLine)')
        public String namedCredential;
    }

    public class Output {
        @InvocableVariable(label='Conversation ID' description='The DirectLine conversation ID')
        public String conversationId;

        @InvocableVariable(label='Response Code' description='HTTP response code')
        public Integer responseCode;

        @InvocableVariable(label='Error Message' description='Error message if failed')
        public String errorMessage;
    }

    @InvocableMethod(label='Start DirectLine Conversation' description='Initiates a new conversation with Copilot Studio via DirectLine API')
    public static List<Output> getConversationID(List<Input> inputs) {
        List<Output> outputs = new List<Output>();

        for (Input input : inputs) {
            Output output = new Output();

            try {
                String credentialName = String.isNotBlank(input.namedCredential) ? input.namedCredential : DEFAULT_NAMED_CREDENTIAL;
                String endpoint = 'callout:' + credentialName + '/v3/directline/conversations';

                HttpRequest req = new HttpRequest();
                req.setEndpoint(endpoint);
                req.setMethod('POST');
                // Authorization header automatically added by Named Credential
                req.setHeader('Content-Type', 'application/json');
                req.setBody('{}');
                req.setTimeout(30000);

                Http http = new Http();
                HttpResponse res = http.send(req);

                output.responseCode = res.getStatusCode();

                if (res.getStatusCode() == 200 || res.getStatusCode() == 201) {
                    Map<String, Object> responseMap = (Map<String, Object>) JSON.deserializeUntyped(res.getBody());
                    output.conversationId = (String) responseMap.get('conversationId');
                } else {
                    output.errorMessage = 'Failed to start conversation: ' + res.getStatus() + ' - ' + res.getBody();
                }
            } catch (Exception e) {
                output.responseCode = 500;
                output.errorMessage = 'Exception: ' + e.getMessage();
            }

            outputs.add(output);
        }

        return outputs;
    }
}
