import { randomUUID } from 'node:crypto';
import { strToU8, zipSync } from 'fflate';
import { deflateSync } from 'node:zlib';

export function connector(host, identity) {
  return {
    swagger: '2.0', info: {
      title: identity?.displayName ?? 'Handover escalation', version: '1.0',
      ...(identity?.ownership ? { description: `Sample ownership: ${identity.ownership}` } : {})
    },
    host, basePath: '/', schemes: ['https'], consumes: ['application/json'], produces: ['application/json'],
    security: [],
    paths: {
      '/api/escalate': {
        post: {
          operationId: 'Escalate',
          summary: 'Transfer this conversation to a support agent',
          description: 'Call when the customer requests human support. A scoped PreTool maker hook MUST override conversationId using metadata.conversationId. This demonstration has no webhook authentication; add connector and webhook authentication before production use.',
          parameters: [{
            name: 'body', in: 'body', required: true,
            schema: {
              type: 'object', required: ['reason', 'summary'],
              properties: {
                reason: { type: 'string', maxLength: 1000 }, summary: { type: 'string', maxLength: 4000 },
                conversationId: { type: 'string', description: 'Overwritten by the maker hook from metadata.conversationId. Never infer this value.' }
              }
            }
          }],
          responses: {
            200: {
              description: 'Accepted human queue',
              schema: { type: 'object', properties: { status: { type: 'string' }, handoverId: { type: 'string' } } }
            },
            default: { description: 'Explicit failure; do not claim handover succeeded', schema: { type: 'object', properties: { error: { type: 'string' } } } }
          }
        }
      }
    }
  };
}
export const connectorProperties = () => ({
  properties: {
    connectionParameters: {},
    iconBrandColor: '#175DAD', capabilities: [], policyTemplateInstances: []
  }
});

export function hookWorkflow() {
  const inputs = {
    type: 'object',
    properties: {
      event: { type: 'string', title: 'event' }, timestamp: { type: 'string', title: 'timestamp' },
      metadata: { type: 'object', title: 'metadata', properties: { conversationId: { type: 'string' } } },
      toolName: { type: 'string', title: 'toolName' },
      parameters: { type: 'object', title: 'parameters', additionalProperties: {} }
    }
  };
  const outputs = { type: 'object', properties: {
    modifiedParameters: { type: 'object', title: 'modifiedParameters', additionalProperties: {} },
    permissionDecision: { type: 'string', title: 'permissionDecision' },
    permissionDecisionReason: { type: 'string', title: 'permissionDecisionReason' },
    additionalContext: { type: 'string', title: 'additionalContext' },
    suppressOutput: { type: 'boolean', title: 'suppressOutput' }
  } };
  const responseId = 'builtinFunction-handover-response';
  const parameters = "triggerOutputs()?['body/parameters']";
  const idOverride = "json(concat('{\"conversationId\":\"', triggerOutputs()?['body/metadata/conversationId'], '\"}'))";
  const updatedBody = `union(triggerOutputs()?['body/parameters/body'], ${idOverride})`;
  const response = { statusCode: 200, schema: outputs, body: {
    modifiedParameters: `@if(contains(${parameters}, 'body'), union(${parameters}, json(concat('{"body":', string(${updatedBody}), '}'))), union(${parameters}, ${idOverride}))`,
    permissionDecision: '',
    permissionDecisionReason: '',
    additionalContext: '', suppressOutput: false
  } };
  const graph = {
    name: 'Supply the Studio conversation ID',
    nodes: [
      {
        id: 'start', name: 'When an agent calls the flow', type: 'start', version: 1,
        position: { x: 100, y: 200 },
        data: {
          config: { triggerType: 'connector', connector: {
            apiName: 'Skills', operationName: 'SkillsButton', kind: 'Skills',
            inputs: { schema: inputs }, displayName: 'When an agent calls the flow'
          } },
          outcomes: [{ id: 'default', label: 'Default' }]
        }
      },
      {
        id: responseId, name: 'Respond to the agent', type: 'builtinFunction', version: 1,
        position: { x: 500, y: 200 },
        data: {
          config: {
            operationId: 'response', operationName: 'response', kind: 'Skills',
            displayName: 'Respond to the agent', category: 'request', categoryDisplayName: 'Request',
            parameters: structuredClone(response)
          },
          outcomes: [{ id: 'default', label: 'Default', outcomeSchema: { type: 'object', description: 'Function output' } }],
          settings: { runAfter: {} }
        }
      }
    ],
    edges: [{ id: `edge-start-${responseId}`, source: 'start', target: responseId }],
    connectionReferences: {}
  };
  return { schemaVersion: '1.0.0.0', properties: { connectionReferences: {}, definition: {
    $schema: 'https://schema.management.azure.com/providers/Microsoft.Logic/schemas/2016-06-01/workflowdefinition.json#',
    contentVersion: '1.0.0.0',
    parameters: { $authentication: { defaultValue: {}, type: 'SecureObject' }, $connections: { defaultValue: {}, type: 'Object' } },
    triggers: { manual: {
      type: 'Request', kind: 'Skills', inputs: { schema: inputs },
      metadata: { associatedData: { graph, nodeActionMapping: { [responseId]: ['Respond_to_the_agent'] } } }
    } },
    actions: {
      Respond_to_the_agent: {
        type: 'Response', kind: 'Skills', runAfter: {},
        metadata: { nodeId: responseId },
        inputs: response
      }
    }, outputs: {}
  } } };
}
export function manifest(config, deployed) {
  return {
    $schema: 'https://developer.microsoft.com/json-schemas/teams/v1.22/MicrosoftTeams.schema.json',
    manifestVersion: '1.22', version: config.appVersion ?? '1.0.1', id: deployed.teamsAppId ?? deployed.botClientId,
    developer: { name: config.developerName, websiteUrl: config.websiteUrl, privacyUrl: config.privacyUrl, termsOfUseUrl: config.termsOfUseUrl },
    icons: { color: 'color.png', outline: 'outline.png' },
    name: {
      short: config.displayName ?? 'Contoso handover',
      full: config.displayName ? `${config.displayName} - Copilot Studio handover sample` : 'Copilot Studio handover sample'
    },
    description: { short: 'Support conversations with human handover.', full: 'Start with Copilot Studio, transfer to a mock support agent, and return to the same conversation with the human transcript.' },
    accentColor: '#175DAD',
    bots: [{ botId: deployed.botClientId, scopes: ['personal'], supportsFiles: false, isNotificationOnly: false }],
    copilotAgents: { customEngineAgents: [{ id: deployed.botClientId, type: 'bot' }] },
    permissions: ['identity'],
    validDomains: ['token.botframework.com', new URL(deployed.appUrl).hostname],
    webApplicationInfo: { id: config.oauthClientId, resource: `api://botid-${deployed.botClientId}` }
  };
}
function crc32(data) {
  let crc = -1;
  for (const byte of data) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit++) crc = (crc >>> 1) ^ ((crc & 1) ? 0xedb88320 : 0);
  }
  return (crc ^ -1) >>> 0;
}
function chunk(name, data) {
  const kind = Buffer.from(name), size = Buffer.alloc(4), crc = Buffer.alloc(4);
  size.writeUInt32BE(data.length); crc.writeUInt32BE(crc32(Buffer.concat([kind, data])));
  return Buffer.concat([size, kind, data, crc]);
}
export function icon(size, outline = false) {
  const rows = Buffer.alloc((size * 4 + 1) * size);
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const position = y * (size * 4 + 1) + 1 + x * 4;
    const symbol = (x > size * .2 && x < size * .8 && y > size * .25 && y < size * .65)
      || (x > size * .25 && x < size * .4 && y >= size * .65 && y < size * .8);
    rows.set(outline ? [255, 255, 255, symbol ? 255 : 0] : symbol ? [255, 255, 255, 255] : [23, 93, 173, 255], position);
  }
  const header = Buffer.alloc(13); header.writeUInt32BE(size, 0); header.writeUInt32BE(size, 4); header[8] = 8; header[9] = 6;
  return Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]), chunk('IHDR', header), chunk('IDAT', deflateSync(rows)), chunk('IEND', Buffer.alloc(0))]);
}
export function appPackage(config, deployed) {
  return zipSync({ 'manifest.json': strToU8(JSON.stringify(manifest(config, deployed), null, 2)), 'color.png': icon(192), 'outline.png': icon(32, true) });
}
