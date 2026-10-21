// Synthetic content using the entity/chunk shapes observed from the published SDK stream.
function thought(text, streamSequence = 1, chunkType = 'delta', properties = {}) {
  const stream = {
    streamType: 'streaming', streamSequence,
    ...(streamSequence === 1 ? {} : { streamId: 'answer-stream' })
  };
  return {
    type: 'typing', id: streamSequence === 1 ? 'answer-stream' : `answer-stream-${streamSequence - 1}`,
    from: { id: 'bot', role: 'bot' }, text: '',
    entities: [{
      type: 'thought', title: '', sequenceNumber: 0, status: 'complete', text,
      reasonedForSeconds: 0, chainOfThoughtId: '', ...properties
    }, { type: 'streaminfo', ...stream }],
    channelData: { ...stream, chunkType, 'webchat:sequence-id': streamSequence }
  };
}

function toolCall(status, { toolCallId = 'call', streamSequence = status === 'started' ? 12 : 13, ...properties } = {}) {
  const stream = { streamType: 'informative', streamId: 'answer-stream', streamSequence };
  return {
    type: 'typing', id: `answer-stream-${streamSequence - 1}`,
    from: { id: 'bot', role: 'bot' }, text: status === 'started' ? 'Calling Get items...' : 'Get items completed',
    entities: [{
      type: 'toolCall', toolCallId, toolName: 'get_items', toolDisplayName: 'Get items',
      operationId: 'GetItems', connectorId: '/providers/Microsoft.PowerApps/apis/shared_sharepointonline',
      componentSchemaName: 'sample.tool.GetItems', toolCategory: 'Connector', toolKind: 'tool', status,
      description: 'PRIVATE_DESCRIPTION',
      filledParameters: { value: 'PRIVATE_INPUT' }, hiddenFilledParameters: { value: 'PRIVATE_HIDDEN_INPUT' },
      result: { value: 'PRIVATE_RESULT' }, thought: 'PRIVATE_PLANNER_THOUGHT',
      ...properties
    }, { type: 'streaminfo', ...stream }],
    channelData: { ...stream, 'webchat:sequence-id': streamSequence }
  };
}

module.exports = { thought, toolCall };
