/**
 * Copyright (c) Microsoft Corporation. All rights reserved.
 * Licensed under the MIT License.
 */

import { AgentType } from './agentType'
import { ConnectionSettings } from './connectionSettings'
import { debug } from '@microsoft/agents-activity/logger'
import { PowerPlatformCloud } from './powerPlatformCloud'
import { PrebuiltBotStrategy } from './strategies/prebuiltBotStrategy'
import { PublishedBotStrategy } from './strategies/publishedBotStrategy'

const logger = debug('copilot-studio:power-platform')

/**
 * Generates the connection URL for Copilot Studio.
 * @param settings - The connection settings.
 * @param conversationId - Optional conversation ID.
 * @returns The connection URL.
 * @throws Will throw an error if required settings are missing or invalid.
 */
export function getCopilotStudioConnectionUrl (
  settings: ConnectionSettings,
  conversationId?: string
): string {
  if (settings.directConnectUrl?.trim()) {
    logger.debug(`Using direct connection: ${settings.directConnectUrl}`)
    if (!isValidUri(settings.directConnectUrl)) {
      throw new Error('directConnectUrl must be a valid URL')
    }

    // FIX for Missing Tenant ID
    if (settings.directConnectUrl.toLowerCase().includes('tenants/00000000-0000-0000-0000-000000000000')) {
      logger.debug(`Direct connection cannot be used, forcing default settings flow. Tenant ID is missing in the URL: ${settings.directConnectUrl}`)
      // Direct connection cannot be used, ejecting and forcing the normal settings flow:
      return getCopilotStudioConnectionUrl({ ...settings, directConnectUrl: '' }, conversationId)
    }

    return createURL(settings.directConnectUrl, conversationId).href
  }

  const cloudSetting = settings.cloud ?? PowerPlatformCloud.Prod
  const agentType = settings.copilotAgentType ?? AgentType.Published

  logger.debug(`Using cloud setting: ${cloudSetting}`)
  logger.debug(`Using agent type: ${agentType}`)

  if (!settings.environmentId?.trim()) {
    throw new Error('EnvironmentId must be provided')
  }

  if (!settings.agentIdentifier?.trim()) {
    throw new Error('AgentIdentifier must be provided')
  }

  if (cloudSetting === PowerPlatformCloud.Other) {
    if (!settings.customPowerPlatformCloud?.trim()) {
      throw new Error('customPowerPlatformCloud must be provided when PowerPlatformCloud is Other')
    } else if (isValidUri(settings.customPowerPlatformCloud)) {
      logger.debug(`Using custom Power Platform cloud: ${settings.customPowerPlatformCloud}`)
    } else {
      throw new Error(
        'customPowerPlatformCloud must be a valid URL'
      )
    }
  }

  const host = getEnvironmentEndpoint(cloudSetting, settings.environmentId, settings.customPowerPlatformCloud)

  const strategy = {
    [AgentType.Published]: () => new PublishedBotStrategy({
      host,
      schema: settings.agentIdentifier!,
    }),
    [AgentType.Prebuilt]: () => new PrebuiltBotStrategy({
      host,
      identifier: settings.agentIdentifier!,
    }),
  }[agentType]()

  const url = strategy.getConversationUrl(conversationId)
  logger.debug(`Generated Copilot Studio connection URL: ${url}`)
  return url
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
export function getTokenAudience (
  settings?: ConnectionSettings,
  cloud: PowerPlatformCloud = PowerPlatformCloud.Unknown,
  cloudBaseAddress: string = '',
  directConnectUrl: string = ''): string {
  if (!directConnectUrl && !settings?.directConnectUrl) {
    if (cloud === PowerPlatformCloud.Other && !cloudBaseAddress) {
      throw new Error('cloudBaseAddress must be provided when PowerPlatformCloudCategory is Other')
    }
    if (!settings && cloud === PowerPlatformCloud.Unknown) {
      throw new Error('Either settings or cloud must be provided')
    }
    if (settings && settings.cloud && settings.cloud !== PowerPlatformCloud.Unknown) {
      cloud = settings.cloud
    }
    if (cloud === PowerPlatformCloud.Other) {
      if (cloudBaseAddress && isValidUri(cloudBaseAddress)) {
        cloud = PowerPlatformCloud.Other
      } else if (settings?.customPowerPlatformCloud && isValidUri(settings!.customPowerPlatformCloud)) {
        cloud = PowerPlatformCloud.Other
        cloudBaseAddress = settings.customPowerPlatformCloud
      } else {
        throw new Error('Either CustomPowerPlatformCloud or cloudBaseAddress must be provided when PowerPlatformCloudCategory is Other')
      }
    }
    cloudBaseAddress ??= 'api.unknown.powerplatform.com'
    return `https://${getEndpointSuffix(cloud, cloudBaseAddress)}/.default`
  } else {
    if (!directConnectUrl) {
      directConnectUrl = settings?.directConnectUrl ?? ''
    }
    if (directConnectUrl && isValidUri(directConnectUrl)) {
      if (decodeCloudFromURI(new URL(directConnectUrl)) === PowerPlatformCloud.Unknown) {
        const cloudToTest: PowerPlatformCloud = settings?.cloud ?? cloud

        if (cloudToTest === PowerPlatformCloud.Other || cloudToTest === PowerPlatformCloud.Unknown) {
          throw new Error('Unable to resolve the PowerPlatform Cloud from DirectConnectUrl. The Token Audience resolver requires a specific PowerPlatformCloudCategory.')
        }
        if ((cloudToTest as PowerPlatformCloud) !== PowerPlatformCloud.Unknown) {
          return `https://${getEndpointSuffix(cloudToTest, '')}/.default`
        } else {
          throw new Error('Unable to resolve the PowerPlatform Cloud from DirectConnectUrl. The Token Audience resolver requires a specific PowerPlatformCloudCategory.')
        }
      }
      return `https://${getEndpointSuffix(decodeCloudFromURI(new URL(directConnectUrl)), '')}/.default`
    } else {
      throw new Error('DirectConnectUrl must be provided when DirectConnectUrl is set')
    }
  }
}
function isValidUri (uri: string): boolean {
  try {
    const absoluteUrl = uri.startsWith('http') ? uri : `https://${uri}`
    const newUri = new URL(absoluteUrl)
    return !!newUri
  } catch {
    return false
  }
}

function createURL (base: string, conversationId?: string): URL {
  const url = new URL(base)

  if (!url.searchParams.has('api-version')) {
    url.searchParams.append('api-version', '2022-03-01-preview')
  }

  if (url.pathname.endsWith('/')) {
    url.pathname = url.pathname.slice(0, -1)
  }

  if (url.pathname.includes('/conversations')) {
    url.pathname = url.pathname.substring(0, url.pathname.indexOf('/conversations'))
  }

  url.pathname = `${url.pathname}/conversations`
  if (conversationId) {
    url.pathname = `${url.pathname}/${conversationId}`
  }

  return url
}

function getEnvironmentEndpoint (
  cloud: PowerPlatformCloud,
  environmentId: string,
  cloudBaseAddress?: string
): URL {
  if (cloud === PowerPlatformCloud.Other && (!cloudBaseAddress || !cloudBaseAddress.trim())) {
    throw new Error('cloudBaseAddress must be provided when PowerPlatformCloud is Other')
  }

  cloudBaseAddress = cloudBaseAddress ?? 'api.unknown.powerplatform.com'

  const normalizedResourceId = environmentId.toLowerCase().replaceAll('-', '')
  const idSuffixLength = getIdSuffixLength(cloud)
  const hexPrefix = normalizedResourceId.substring(0, normalizedResourceId.length - idSuffixLength)
  const hexSuffix = normalizedResourceId.substring(normalizedResourceId.length - idSuffixLength)

  return new URL(`https://${hexPrefix}.${hexSuffix}.environment.${getEndpointSuffix(cloud, cloudBaseAddress)}`)
}

function getEndpointSuffix (
  category: PowerPlatformCloud,
  cloudBaseAddress: string
): string {
  switch (category) {
    case PowerPlatformCloud.Local:
      return 'api.powerplatform.localhost'
    case PowerPlatformCloud.Exp:
      return 'api.exp.powerplatform.com'
    case PowerPlatformCloud.Dev:
      return 'api.dev.powerplatform.com'
    case PowerPlatformCloud.Prv:
      return 'api.prv.powerplatform.com'
    case PowerPlatformCloud.Test:
      return 'api.test.powerplatform.com'
    case PowerPlatformCloud.Preprod:
      return 'api.preprod.powerplatform.com'
    case PowerPlatformCloud.FirstRelease:
    case PowerPlatformCloud.Prod:
      return 'api.powerplatform.com'
    case PowerPlatformCloud.GovFR:
      return 'api.gov.powerplatform.microsoft.us'
    case PowerPlatformCloud.Gov:
      return 'api.gov.powerplatform.microsoft.us'
    case PowerPlatformCloud.High:
      return 'api.high.powerplatform.microsoft.us'
    case PowerPlatformCloud.DoD:
      return 'api.appsplatform.us'
    case PowerPlatformCloud.Mooncake:
      return 'api.powerplatform.partner.microsoftonline.cn'
    case PowerPlatformCloud.Ex:
      return 'api.powerplatform.eaglex.ic.gov'
    case PowerPlatformCloud.Rx:
      return 'api.powerplatform.microsoft.scloud'
    case PowerPlatformCloud.Other:
      return cloudBaseAddress
    default:
      throw new Error(`Invalid cluster category value: ${category}`)
  }
}

function getIdSuffixLength (cloud: PowerPlatformCloud): number {
  switch (cloud) {
    case PowerPlatformCloud.FirstRelease:
    case PowerPlatformCloud.Prod:
      return 2
    default:
      return 1
  }
}

function decodeCloudFromURI (uri: URL): PowerPlatformCloud {
  const host = uri.host.toLowerCase()

  switch (host) {
    case 'api.powerplatform.localhost':
      return PowerPlatformCloud.Local
    case 'api.exp.powerplatform.com':
      return PowerPlatformCloud.Exp
    case 'api.dev.powerplatform.com':
      return PowerPlatformCloud.Dev
    case 'api.prv.powerplatform.com':
      return PowerPlatformCloud.Prv
    case 'api.test.powerplatform.com':
      return PowerPlatformCloud.Test
    case 'api.preprod.powerplatform.com':
      return PowerPlatformCloud.Preprod
    case 'api.powerplatform.com':
      return PowerPlatformCloud.Prod
    case 'api.gov.powerplatform.microsoft.us':
      return PowerPlatformCloud.GovFR
    case 'api.high.powerplatform.microsoft.us':
      return PowerPlatformCloud.High
    case 'api.appsplatform.us':
      return PowerPlatformCloud.DoD
    case 'api.powerplatform.partner.microsoftonline.cn':
      return PowerPlatformCloud.Mooncake
    default:
      return PowerPlatformCloud.Unknown
  }
}
