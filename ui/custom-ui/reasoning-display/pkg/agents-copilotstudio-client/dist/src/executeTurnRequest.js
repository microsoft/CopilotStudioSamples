"use strict";
/**
 * Copyright (c) Microsoft Corporation. All rights reserved.
 * Licensed under the MIT License.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.ExecuteTurnRequest = void 0;
/**
 * Represents a request to execute a turn in a conversation.
 * This class encapsulates the activity to be executed during the turn.
 */
class ExecuteTurnRequest {
    /**
     * Creates an instance of ExecuteTurnRequest.
     * @param activity The activity to be executed.
     */
    constructor(activity) {
        this.activity = activity;
    }
}
exports.ExecuteTurnRequest = ExecuteTurnRequest;
//# sourceMappingURL=executeTurnRequest.js.map