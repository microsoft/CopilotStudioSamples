/**
 * DL_PostActivity
 * Sends a user message to Copilot Studio via DirectLine API.
 * Called from Einstein Bot when the user sends a message.
 * Uses Named Credential for authentication (default: 'DirectLine').
 */
public with sharing class DL_PostActivity {

    private static final String DEFAULT_NAMED_CREDENTIAL = 'Directline';

    public class Input {
        @InvocableVariable(label='Conversation ID' description='The DirectLine conversation ID' required=true)
        public String conversationId;

        @InvocableVariable(label='User Message' description='The message from the user' required=true)
        public String userMessage;

        @InvocableVariable(label='User ID' description='Optional user identifier')
        public String userId;

        @InvocableVariable(label='User Name' description='Optional user display name')
        public String userName;

        @InvocableVariable(label='Named Credential' description='Name of the Named Credential to use (default: DirectLine)')
        public String namedCredential;
    }

    public class Output {
        @InvocableVariable(label='Response Code' description='HTTP response code')
        public Integer responseCode;

        @InvocableVariable(label='Error Message' description='Error message if failed')
        public String errorMessage;

        @InvocableVariable(label='Watermark' description='Watermark for retrieving responses')
        public String watermark;
    }

    @InvocableMethod(label='Post Message to Copilot Studio' description='Sends a user message to Copilot Studio via DirectLine API')
    public static List<Output> postActivity(List<Input> inputs) {
        List<Output> outputs = new List<Output>();

        for (Input input : inputs) {
            Output output = new Output();

            try {
                String credentialName = String.isNotBlank(input.namedCredential) ? input.namedCredential : DEFAULT_NAMED_CREDENTIAL;
                String endpoint = 'callout:' + credentialName + '/v3/directline/conversations/' + input.conversationId + '/activities';

                // Build the activity payload
                Map<String, Object> activity = new Map<String, Object>();
                activity.put('type', 'message');
                activity.put('text', input.userMessage);

                // Add from information
                Map<String, Object> fromObj = new Map<String, Object>();
                fromObj.put('id', String.isNotBlank(input.userId) ? input.userId : 'user');
                if (String.isNotBlank(input.userName)) {
                    fromObj.put('name', input.userName);
                }
                activity.put('from', fromObj);

                HttpRequest req = new HttpRequest();
                req.setEndpoint(endpoint);
                req.setMethod('POST');
                // Authorization header automatically added by Named Credential
                req.setHeader('Content-Type', 'application/json');
                req.setBody(JSON.serialize(activity));
                req.setTimeout(30000);

                Http http = new Http();
                HttpResponse res = http.send(req);

                output.responseCode = res.getStatusCode();

                if (res.getStatusCode() == 200 || res.getStatusCode() == 204) {
                    // Watermark will be retrieved in GetActivity call
                    output.watermark = '0';
                } else {
                    output.errorMessage = 'Failed to post activity: ' + res.getStatus() + ' - ' + res.getBody();
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
