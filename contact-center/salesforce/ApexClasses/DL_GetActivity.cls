/**
 * DL_GetActivity
 * Retrieves bot responses from Copilot Studio via DirectLine API.
 * Called from Einstein Bot to get the AI response.
 * Supports configurable delay and retry for async responses.
 * Uses Named Credential for authentication (default: 'DirectLine').
 */
public with sharing class DL_GetActivity {

    private static final String DEFAULT_NAMED_CREDENTIAL = 'Directline';

    public class Input {
        @InvocableVariable(label='Conversation ID' description='The DirectLine conversation ID' required=true)
        public String conversationId;

        @InvocableVariable(label='Watermark' description='Watermark from previous call to get only new messages')
        public String watermark;

        @InvocableVariable(label='Initial Delay (seconds)' description='Seconds to wait before first attempt. Default: 5')
        public Integer delaySeconds;

        @InvocableVariable(label='Max Retries' description='Number of retry attempts if no response. Default: 5')
        public Integer maxRetries;

        @InvocableVariable(label='Named Credential' description='Name of the Named Credential to use (default: DirectLine)')
        public String namedCredential;
    }

    public class Output {
        @InvocableVariable(label='Message' description='The bot response message')
        public String message;

        @InvocableVariable(label='Watermark' description='Updated watermark for next call')
        public String watermark;

        @InvocableVariable(label='Response Code' description='HTTP response code')
        public Integer responseCode;

        @InvocableVariable(label='Error Message' description='Error message if failed')
        public String errorMessage;

        @InvocableVariable(label='Has More Messages' description='Whether there are more messages to retrieve')
        public Boolean hasMoreMessages;

        @InvocableVariable(label='Is Handoff' description='Whether the bot is requesting handoff to agent')
        public Boolean isHandoff;
    }

    @InvocableMethod(label='Get Copilot Studio Response' description='Retrieves bot responses from Copilot Studio via DirectLine API')
    public static List<Output> getActivity(List<Input> inputs) {
        List<Output> outputs = new List<Output>();

        for (Input input : inputs) {
            Output output = new Output();
            output.hasMoreMessages = false;
            output.isHandoff = false;

            // Set defaults for delay and retries
            Integer initialDelay = (input.delaySeconds != null && input.delaySeconds > 0) ? input.delaySeconds : 5;
            Integer retries = (input.maxRetries != null && input.maxRetries > 0) ? input.maxRetries : 5;
            String credentialName = String.isNotBlank(input.namedCredential) ? input.namedCredential : DEFAULT_NAMED_CREDENTIAL;

            try {
                // Initial delay before first attempt
                if (initialDelay > 0) {
                    waitSeconds(initialDelay);
                }

                String endpoint = 'callout:' + credentialName + '/v3/directline/conversations/' + input.conversationId + '/activities';
                if (String.isNotBlank(input.watermark) && input.watermark != '0') {
                    endpoint += '?watermark=' + input.watermark;
                }

                // Retry loop
                Integer attempts = 0;
                while (attempts <= retries) {
                    HttpRequest req = new HttpRequest();
                    req.setEndpoint(endpoint);
                    req.setMethod('GET');
                    // Authorization header automatically added by Named Credential
                    req.setTimeout(30000);

                    Http http = new Http();
                    HttpResponse res = http.send(req);

                    output.responseCode = res.getStatusCode();

                    if (res.getStatusCode() == 200) {
                        Map<String, Object> responseMap = (Map<String, Object>) JSON.deserializeUntyped(res.getBody());

                        // Update watermark
                        output.watermark = (String) responseMap.get('watermark');

                        // Process activities
                        List<Object> activities = (List<Object>) responseMap.get('activities');
                        Boolean foundMessage = false;

                        if (activities != null && !activities.isEmpty()) {
                            // Find the last bot message (skip user messages)
                            for (Integer i = activities.size() - 1; i >= 0; i--) {
                                Map<String, Object> activity = (Map<String, Object>) activities[i];
                                String activityType = (String) activity.get('type');
                                Map<String, Object> fromObj = (Map<String, Object>) activity.get('from');
                                String fromId = fromObj != null ? (String) fromObj.get('id') : '';

                                // Check for handoff event
                                if (activityType == 'event') {
                                    String eventName = (String) activity.get('name');
                                    if (eventName == 'handoff.initiate') {
                                        output.isHandoff = true;
                                        output.message = 'Transferring to agent...';
                                        foundMessage = true;
                                        break;
                                    }
                                }

                                // Look for bot messages (not from user)
                                if (activityType == 'message' && !fromId.startsWith('user')) {
                                    output.message = (String) activity.get('text');
                                    output.hasMoreMessages = (i < activities.size() - 1);
                                    foundMessage = true;
                                    break;
                                }
                            }
                        }

                        // If message found, exit retry loop
                        if (foundMessage) {
                            break;
                        }

                        // No message yet - retry if attempts remaining
                        attempts++;
                        if (attempts <= retries) {
                            waitSeconds(1); // 1 second between retries
                        }
                    } else {
                        output.errorMessage = 'Failed to get activities: ' + res.getStatus() + ' - ' + res.getBody();
                        break; // Don't retry on HTTP errors
                    }
                }

                // If no message found after all retries
                if (String.isBlank(output.message) && !output.isHandoff) {
                    output.message = '';
                }
            } catch (Exception e) {
                output.responseCode = 500;
                output.errorMessage = 'Exception: ' + e.getMessage();
            }

            outputs.add(output);
        }

        return outputs;
    }

    // Helper method to wait for specified seconds
    private static void waitSeconds(Integer seconds) {
        Long startTime = DateTime.now().getTime();
        Long endTime = startTime + (seconds * 1000);
        while (DateTime.now().getTime() < endTime) {
            // Busy wait - keeps CPU usage minimal by doing nothing
        }
    }
}
