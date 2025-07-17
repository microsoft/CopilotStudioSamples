// ServiceNow Script Include: CustomDirectLineInboundTransformer
// Extends the default DirectLine transformer to trigger live agent handoff
// when a specific event ("handoff.initiate") is detected in the incoming payload.

var CustomDirectLineInboundTransformer = Class.create();
CustomDirectLineInboundTransformer.prototype = Object.extendsObject(
    sn_va_bot_ic.DirectLinePrimaryBotIntegrationInboundTransformer,
{
    /**
     * Determines whether the conversation should be escalated to a live agent.
     * This override looks for a specific Bot Framework event called "handoff.initiate".
     *
     * @returns {boolean} true if handoff event is detected; otherwise false.
     */
    shouldConnectToAgent: function() {
        // Safely retrieve the response object and activities array
        var response = this._response || {};
        var activities = response.activities || [];

        // Use Array.prototype.some for event detection
        var handoffDetected = activities.some(function(activity) {
            return activity.type === "event" && activity.name === "handoff.initiate";
        });

        if (handoffDetected) {
            gs.info("[CustomTransformer] Detected handoff.initiate event. Escalating to agent.");
            return true;
        }

        return false;
    },

    // Type identifier for logging/debugging
    type: 'CustomDirectLineInboundTransformer'
});
