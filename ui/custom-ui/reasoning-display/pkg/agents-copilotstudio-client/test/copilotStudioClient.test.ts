import { strict as assert } from 'assert'
import { describe, it } from 'node:test'
import { AgentType, ConnectionSettings, CopilotStudioClient, PowerPlatformCloud } from '../src'

describe('scopeFromSettings', function () {
  const testCases: Array<{
    label: string
    cloud: PowerPlatformCloud
    cloudBaseAddress: string
    expectedAuthority: string
    shouldthrow: boolean
  }> = [
    {
      label: 'Should return scope for PowerPlatformCloud.Prod environment',
      cloud: PowerPlatformCloud.Prod,
      cloudBaseAddress: '',
      expectedAuthority: 'https://api.powerplatform.com/.default',
      shouldthrow: false
    },
    {
      label: 'Should return scope for PowerPlatformCloud.Preprod environment',
      cloud: PowerPlatformCloud.Preprod,
      cloudBaseAddress: '',
      expectedAuthority: 'https://api.preprod.powerplatform.com/.default',
      shouldthrow: false
    },
    {
      label: 'Should return scope for PowerPlatformCloud.Mooncake environment',
      cloud: PowerPlatformCloud.Mooncake,
      cloudBaseAddress: '',
      expectedAuthority: 'https://api.powerplatform.partner.microsoftonline.cn/.default',
      shouldthrow: false
    },
    {
      label: 'Should return scope for PowerPlatformCloud.FirstRelease environment',
      cloud: PowerPlatformCloud.FirstRelease,
      cloudBaseAddress: '',
      expectedAuthority: 'https://api.powerplatform.com/.default',
      shouldthrow: false
    },
    {
      label: 'Should return scope for PowerPlatformCloud.Other environment',
      cloud: PowerPlatformCloud.Other,
      cloudBaseAddress: 'fido.com',
      expectedAuthority: 'https://fido.com/.default',
      shouldthrow: false
    },
    {
      label: 'Should throw when cloud is Unknown and no cloudBaseAddress is provided',
      cloud: PowerPlatformCloud.Unknown,
      cloudBaseAddress: '',
      expectedAuthority: '',
      shouldthrow: true
    }
  ]

  testCases.forEach((testCase) => {
    it(testCase.label, function () {
      const settings: ConnectionSettings = {
        appClientId: '123',
        tenantId: 'test-tenant',
        environmentId: 'A47151CF-4F34-488F-B377-EBE84E17B478',
        cloud: testCase.cloud,
        agentIdentifier: 'Bot01',
        copilotAgentType: AgentType.Published,
        customPowerPlatformCloud: testCase.cloudBaseAddress
      }

      if (testCase.shouldthrow) {
        assert.throws(() => {
          CopilotStudioClient.scopeFromSettings(settings)
        }, Error)
      } else {
        const scope = CopilotStudioClient.scopeFromSettings(settings)
        assert(scope === testCase.expectedAuthority)
      }
    })
  })
})
