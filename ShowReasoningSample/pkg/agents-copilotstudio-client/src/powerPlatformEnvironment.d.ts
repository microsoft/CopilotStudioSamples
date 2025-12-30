/**
 * Copyright (c) Microsoft Corporation. All rights reserved.
 * Licensed under the MIT License.
 */
import { ConnectionSettings } from './connectionSettings';
import { PowerPlatformCloud } from './powerPlatformCloud';
/**
 * Generates the connection URL for Copilot Studio.
 * @param settings - The connection settings.
 * @param conversationId - Optional conversation ID.
 * @returns The connection URL.
 * @throws Will throw an error if required settings are missing or invalid.
 */
export declare function getCopilotStudioConnectionUrl(settings: ConnectionSettings, conversationId?: string): string;
/**
 * Returns the Power Platform API Audience.
 * @param settings - Configuration Settings to use.
 * @param cloud - Optional Power Platform Cloud Hosting Agent.
 * @param cloudBaseAddress - Optional Power Platform API endpoint to use if Cloud is configured as "other".
 * @param directConnectUrl - Optional DirectConnection URL to a given Copilot Studio agent, if provided all other settings are ignored.
 * @returns The Power Platform Audience.
 * @throws Will throw an error if required settings are missing or invalid.
 */
export declare function getTokenAudience(settings?: ConnectionSettings, cloud?: PowerPlatformCloud, cloudBaseAddress?: string, directConnectUrl?: string): string;
