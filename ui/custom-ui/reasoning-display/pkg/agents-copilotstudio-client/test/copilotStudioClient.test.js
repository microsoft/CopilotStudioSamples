"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const assert_1 = require("assert");
const node_test_1 = require("node:test");
const src_1 = require("../src");
(0, node_test_1.describe)('scopeFromSettings', function () {
    const testCases = [
        {
            label: 'Should return scope for PowerPlatformCloud.Prod environment',
            cloud: src_1.PowerPlatformCloud.Prod,
            cloudBaseAddress: '',
            expectedAuthority: 'https://api.powerplatform.com/.default',
            shouldthrow: false
        },
        {
            label: 'Should return scope for PowerPlatformCloud.Preprod environment',
            cloud: src_1.PowerPlatformCloud.Preprod,
            cloudBaseAddress: '',
            expectedAuthority: 'https://api.preprod.powerplatform.com/.default',
            shouldthrow: false
        },
        {
            label: 'Should return scope for PowerPlatformCloud.Mooncake environment',
            cloud: src_1.PowerPlatformCloud.Mooncake,
            cloudBaseAddress: '',
            expectedAuthority: 'https://api.powerplatform.partner.microsoftonline.cn/.default',
            shouldthrow: false
        },
        {
            label: 'Should return scope for PowerPlatformCloud.FirstRelease environment',
            cloud: src_1.PowerPlatformCloud.FirstRelease,
            cloudBaseAddress: '',
            expectedAuthority: 'https://api.powerplatform.com/.default',
            shouldthrow: false
        },
        {
            label: 'Should return scope for PowerPlatformCloud.Other environment',
            cloud: src_1.PowerPlatformCloud.Other,
            cloudBaseAddress: 'fido.com',
            expectedAuthority: 'https://fido.com/.default',
            shouldthrow: false
        },
        {
            label: 'Should throw when cloud is Unknown and no cloudBaseAddress is provided',
            cloud: src_1.PowerPlatformCloud.Unknown,
            cloudBaseAddress: '',
            expectedAuthority: '',
            shouldthrow: true
        }
    ];
    testCases.forEach((testCase) => {
        (0, node_test_1.it)(testCase.label, function () {
            const settings = {
                appClientId: '123',
                tenantId: 'test-tenant',
                environmentId: 'A47151CF-4F34-488F-B377-EBE84E17B478',
                cloud: testCase.cloud,
                agentIdentifier: 'Bot01',
                copilotAgentType: src_1.AgentType.Published,
                customPowerPlatformCloud: testCase.cloudBaseAddress
            };
            if (testCase.shouldthrow) {
                assert_1.strict.throws(() => {
                    src_1.CopilotStudioClient.scopeFromSettings(settings);
                }, Error);
            }
            else {
                const scope = src_1.CopilotStudioClient.scopeFromSettings(settings);
                (0, assert_1.strict)(scope === testCase.expectedAuthority);
            }
        });
    });
});
//# sourceMappingURL=copilotStudioClient.test.js.map