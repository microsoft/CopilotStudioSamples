"use strict";
/**
 * Copyright (c) Microsoft Corporation. All rights reserved.
 * Licensed under the MIT License.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.getCopilotStudioConnectionUrl = getCopilotStudioConnectionUrl;
exports.getTokenAudience = getTokenAudience;
const agentType_1 = require("./agentType");
const logger_1 = require("@microsoft/agents-activity/logger");
const powerPlatformCloud_1 = require("./powerPlatformCloud");
const prebuiltBotStrategy_1 = require("./strategies/prebuiltBotStrategy");
const publishedBotStrategy_1 = require("./strategies/publishedBotStrategy");
const logger = (0, logger_1.debug)('copilot-studio:power-platform');
/**
 * Generates the connection URL for Copilot Studio.
 * @param settings - The connection settings.
 * @param conversationId - Optional conversation ID.
 * @returns The connection URL.
 * @throws Will throw an error if required settings are missing or invalid.
 */
function getCopilotStudioConnectionUrl(settings, conversationId) {
    var _a, _b, _c, _d, _e, _f;
    if ((_a = settings.directConnectUrl) === null || _a === void 0 ? void 0 : _a.trim()) {
        logger.debug(`Using direct connection: ${settings.directConnectUrl}`);
        if (!isValidUri(settings.directConnectUrl)) {
            throw new Error('directConnectUrl must be a valid URL');
        }
        // FIX for Missing Tenant ID
        if (settings.directConnectUrl.toLowerCase().includes('tenants/00000000-0000-0000-0000-000000000000')) {
            logger.debug(`Direct connection cannot be used, forcing default settings flow. Tenant ID is missing in the URL: ${settings.directConnectUrl}`);
            // Direct connection cannot be used, ejecting and forcing the normal settings flow:
            return getCopilotStudioConnectionUrl({ ...settings, directConnectUrl: '' }, conversationId);
        }
        return createURL(settings.directConnectUrl, conversationId).href;
    }
    const cloudSetting = (_b = settings.cloud) !== null && _b !== void 0 ? _b : powerPlatformCloud_1.PowerPlatformCloud.Prod;
    const agentType = (_c = settings.copilotAgentType) !== null && _c !== void 0 ? _c : agentType_1.AgentType.Published;
    logger.debug(`Using cloud setting: ${cloudSetting}`);
    logger.debug(`Using agent type: ${agentType}`);
    if (!((_d = settings.environmentId) === null || _d === void 0 ? void 0 : _d.trim())) {
        throw new Error('EnvironmentId must be provided');
    }
    if (!((_e = settings.agentIdentifier) === null || _e === void 0 ? void 0 : _e.trim())) {
        throw new Error('AgentIdentifier must be provided');
    }
    if (cloudSetting === powerPlatformCloud_1.PowerPlatformCloud.Other) {
        if (!((_f = settings.customPowerPlatformCloud) === null || _f === void 0 ? void 0 : _f.trim())) {
            throw new Error('customPowerPlatformCloud must be provided when PowerPlatformCloud is Other');
        }
        else if (isValidUri(settings.customPowerPlatformCloud)) {
            logger.debug(`Using custom Power Platform cloud: ${settings.customPowerPlatformCloud}`);
        }
        else {
            throw new Error('customPowerPlatformCloud must be a valid URL');
        }
    }
    const host = getEnvironmentEndpoint(cloudSetting, settings.environmentId, settings.customPowerPlatformCloud);
    const strategy = {
        [agentType_1.AgentType.Published]: () => new publishedBotStrategy_1.PublishedBotStrategy({
            host,
            schema: settings.agentIdentifier,
        }),
        [agentType_1.AgentType.Prebuilt]: () => new prebuiltBotStrategy_1.PrebuiltBotStrategy({
            host,
            identifier: settings.agentIdentifier,
        }),
    }[agentType]();
    const url = strategy.getConversationUrl(conversationId);
    logger.debug(`Generated Copilot Studio connection URL: ${url}`);
    return url;
}
/**
 * Returns the Power Platform API Audience.
 * @param settings - Configuration Settings to use.
 * @param cloud - Optional Power Platform Cloud Hosting Agent.
 * @param cloudBaseAddress - Optional Power Platform API endpoint to use if Cloud is configured as "other".
 * @param directConnectUrl - Optional DirectConnection URL to a given Copilot Studio agent, if provided all other settings are ignored.
 * @returns The Power Platform Audience.
 * @throws Will throw an error if required settings are missing or invalid.
 */
function getTokenAudience(settings, cloud = powerPlatformCloud_1.PowerPlatformCloud.Unknown, cloudBaseAddress = '', directConnectUrl = '') {
    var _a, _b;
    if (!directConnectUrl && !(settings === null || settings === void 0 ? void 0 : settings.directConnectUrl)) {
        if (cloud === powerPlatformCloud_1.PowerPlatformCloud.Other && !cloudBaseAddress) {
            throw new Error('cloudBaseAddress must be provided when PowerPlatformCloudCategory is Other');
        }
        if (!settings && cloud === powerPlatformCloud_1.PowerPlatformCloud.Unknown) {
            throw new Error('Either settings or cloud must be provided');
        }
        if (settings && settings.cloud && settings.cloud !== powerPlatformCloud_1.PowerPlatformCloud.Unknown) {
            cloud = settings.cloud;
        }
        if (cloud === powerPlatformCloud_1.PowerPlatformCloud.Other) {
            if (cloudBaseAddress && isValidUri(cloudBaseAddress)) {
                cloud = powerPlatformCloud_1.PowerPlatformCloud.Other;
            }
            else if ((settings === null || settings === void 0 ? void 0 : settings.customPowerPlatformCloud) && isValidUri(settings.customPowerPlatformCloud)) {
                cloud = powerPlatformCloud_1.PowerPlatformCloud.Other;
                cloudBaseAddress = settings.customPowerPlatformCloud;
            }
            else {
                throw new Error('Either CustomPowerPlatformCloud or cloudBaseAddress must be provided when PowerPlatformCloudCategory is Other');
            }
        }
        cloudBaseAddress !== null && cloudBaseAddress !== void 0 ? cloudBaseAddress : (cloudBaseAddress = 'api.unknown.powerplatform.com');
        return `https://${getEndpointSuffix(cloud, cloudBaseAddress)}/.default`;
    }
    else {
        if (!directConnectUrl) {
            directConnectUrl = (_a = settings === null || settings === void 0 ? void 0 : settings.directConnectUrl) !== null && _a !== void 0 ? _a : '';
        }
        if (directConnectUrl && isValidUri(directConnectUrl)) {
            if (decodeCloudFromURI(new URL(directConnectUrl)) === powerPlatformCloud_1.PowerPlatformCloud.Unknown) {
                const cloudToTest = (_b = settings === null || settings === void 0 ? void 0 : settings.cloud) !== null && _b !== void 0 ? _b : cloud;
                if (cloudToTest === powerPlatformCloud_1.PowerPlatformCloud.Other || cloudToTest === powerPlatformCloud_1.PowerPlatformCloud.Unknown) {
                    throw new Error('Unable to resolve the PowerPlatform Cloud from DirectConnectUrl. The Token Audience resolver requires a specific PowerPlatformCloudCategory.');
                }
                if (cloudToTest !== powerPlatformCloud_1.PowerPlatformCloud.Unknown) {
                    return `https://${getEndpointSuffix(cloudToTest, '')}/.default`;
                }
                else {
                    throw new Error('Unable to resolve the PowerPlatform Cloud from DirectConnectUrl. The Token Audience resolver requires a specific PowerPlatformCloudCategory.');
                }
            }
            return `https://${getEndpointSuffix(decodeCloudFromURI(new URL(directConnectUrl)), '')}/.default`;
        }
        else {
            throw new Error('DirectConnectUrl must be provided when DirectConnectUrl is set');
        }
    }
}
function isValidUri(uri) {
    try {
        const absoluteUrl = uri.startsWith('http') ? uri : `https://${uri}`;
        const newUri = new URL(absoluteUrl);
        return !!newUri;
    }
    catch {
        return false;
    }
}
function createURL(base, conversationId) {
    const url = new URL(base);
    if (!url.searchParams.has('api-version')) {
        url.searchParams.append('api-version', '2022-03-01-preview');
    }
    if (url.pathname.endsWith('/')) {
        url.pathname = url.pathname.slice(0, -1);
    }
    if (url.pathname.includes('/conversations')) {
        url.pathname = url.pathname.substring(0, url.pathname.indexOf('/conversations'));
    }
    url.pathname = `${url.pathname}/conversations`;
    if (conversationId) {
        url.pathname = `${url.pathname}/${conversationId}`;
    }
    return url;
}
function getEnvironmentEndpoint(cloud, environmentId, cloudBaseAddress) {
    if (cloud === powerPlatformCloud_1.PowerPlatformCloud.Other && (!cloudBaseAddress || !cloudBaseAddress.trim())) {
        throw new Error('cloudBaseAddress must be provided when PowerPlatformCloud is Other');
    }
    cloudBaseAddress = cloudBaseAddress !== null && cloudBaseAddress !== void 0 ? cloudBaseAddress : 'api.unknown.powerplatform.com';
    const normalizedResourceId = environmentId.toLowerCase().replaceAll('-', '');
    const idSuffixLength = getIdSuffixLength(cloud);
    const hexPrefix = normalizedResourceId.substring(0, normalizedResourceId.length - idSuffixLength);
    const hexSuffix = normalizedResourceId.substring(normalizedResourceId.length - idSuffixLength);
    return new URL(`https://${hexPrefix}.${hexSuffix}.environment.${getEndpointSuffix(cloud, cloudBaseAddress)}`);
}
function getEndpointSuffix(category, cloudBaseAddress) {
    switch (category) {
        case powerPlatformCloud_1.PowerPlatformCloud.Local:
            return 'api.powerplatform.localhost';
        case powerPlatformCloud_1.PowerPlatformCloud.Exp:
            return 'api.exp.powerplatform.com';
        case powerPlatformCloud_1.PowerPlatformCloud.Dev:
            return 'api.dev.powerplatform.com';
        case powerPlatformCloud_1.PowerPlatformCloud.Prv:
            return 'api.prv.powerplatform.com';
        case powerPlatformCloud_1.PowerPlatformCloud.Test:
            return 'api.test.powerplatform.com';
        case powerPlatformCloud_1.PowerPlatformCloud.Preprod:
            return 'api.preprod.powerplatform.com';
        case powerPlatformCloud_1.PowerPlatformCloud.FirstRelease:
        case powerPlatformCloud_1.PowerPlatformCloud.Prod:
            return 'api.powerplatform.com';
        case powerPlatformCloud_1.PowerPlatformCloud.GovFR:
            return 'api.gov.powerplatform.microsoft.us';
        case powerPlatformCloud_1.PowerPlatformCloud.Gov:
            return 'api.gov.powerplatform.microsoft.us';
        case powerPlatformCloud_1.PowerPlatformCloud.High:
            return 'api.high.powerplatform.microsoft.us';
        case powerPlatformCloud_1.PowerPlatformCloud.DoD:
            return 'api.appsplatform.us';
        case powerPlatformCloud_1.PowerPlatformCloud.Mooncake:
            return 'api.powerplatform.partner.microsoftonline.cn';
        case powerPlatformCloud_1.PowerPlatformCloud.Ex:
            return 'api.powerplatform.eaglex.ic.gov';
        case powerPlatformCloud_1.PowerPlatformCloud.Rx:
            return 'api.powerplatform.microsoft.scloud';
        case powerPlatformCloud_1.PowerPlatformCloud.Other:
            return cloudBaseAddress;
        default:
            throw new Error(`Invalid cluster category value: ${category}`);
    }
}
function getIdSuffixLength(cloud) {
    switch (cloud) {
        case powerPlatformCloud_1.PowerPlatformCloud.FirstRelease:
        case powerPlatformCloud_1.PowerPlatformCloud.Prod:
            return 2;
        default:
            return 1;
    }
}
function decodeCloudFromURI(uri) {
    const host = uri.host.toLowerCase();
    switch (host) {
        case 'api.powerplatform.localhost':
            return powerPlatformCloud_1.PowerPlatformCloud.Local;
        case 'api.exp.powerplatform.com':
            return powerPlatformCloud_1.PowerPlatformCloud.Exp;
        case 'api.dev.powerplatform.com':
            return powerPlatformCloud_1.PowerPlatformCloud.Dev;
        case 'api.prv.powerplatform.com':
            return powerPlatformCloud_1.PowerPlatformCloud.Prv;
        case 'api.test.powerplatform.com':
            return powerPlatformCloud_1.PowerPlatformCloud.Test;
        case 'api.preprod.powerplatform.com':
            return powerPlatformCloud_1.PowerPlatformCloud.Preprod;
        case 'api.powerplatform.com':
            return powerPlatformCloud_1.PowerPlatformCloud.Prod;
        case 'api.gov.powerplatform.microsoft.us':
            return powerPlatformCloud_1.PowerPlatformCloud.GovFR;
        case 'api.high.powerplatform.microsoft.us':
            return powerPlatformCloud_1.PowerPlatformCloud.High;
        case 'api.appsplatform.us':
            return powerPlatformCloud_1.PowerPlatformCloud.DoD;
        case 'api.powerplatform.partner.microsoftonline.cn':
            return powerPlatformCloud_1.PowerPlatformCloud.Mooncake;
        default:
            return powerPlatformCloud_1.PowerPlatformCloud.Unknown;
    }
}
//# sourceMappingURL=powerPlatformEnvironment.js.map