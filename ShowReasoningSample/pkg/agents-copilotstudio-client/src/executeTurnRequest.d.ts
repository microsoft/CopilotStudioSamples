/**
 * Copyright (c) Microsoft Corporation. All rights reserved.
 * Licensed under the MIT License.
 */
import { Activity } from '@microsoft/agents-activity';
/**
 * Represents a request to execute a turn in a conversation.
 * This class encapsulates the activity to be executed during the turn.
 */
export declare class ExecuteTurnRequest {
    /** The activity to be executed. */
    activity?: Activity;
    /**
     * Creates an instance of ExecuteTurnRequest.
     * @param activity The activity to be executed.
     */
    constructor(activity?: Activity);
}
