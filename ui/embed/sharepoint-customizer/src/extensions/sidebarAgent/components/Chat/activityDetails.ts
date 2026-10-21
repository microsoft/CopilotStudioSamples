export interface ActivityVisibility {
  showReasoning: boolean;
  showToolCalls: boolean;
}

export interface ActivityDetail {
  id: string;
  kind: 'reasoning' | 'tool';
  text: string;
  status?: 'running' | 'finished' | 'failed';
  sequence?: number;
}

export interface ActivityDetailsState {
  entries: ActivityDetail[];
  toolNames: Record<string, string>;
}

export function emptyActivityDetails(): ActivityDetailsState {
  return { entries: [], toolNames: {} };
}

export function record(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function text(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

function identifier(value: unknown): string {
  return typeof value === 'number' && Number.isFinite(value) ? String(value) : text(value);
}

export function isInformative(activity: unknown): boolean {
  const item = record(activity);
  return item.type === 'typing' && streamMetadata(item).streamType === 'informative';
}

function entities(activity: Record<string, unknown>): Record<string, unknown>[] {
  return Array.isArray(activity.entities) ? activity.entities.map(record) : [];
}

function streamMetadata(activity: Record<string, unknown>): Record<string, unknown> {
  return { ...entities(activity).find(entity => entity.type === 'streaminfo'), ...record(activity.channelData) };
}

export function hasDetailEntities(activity: unknown): boolean {
  return entities(record(activity)).some(entity => entity.type === 'thought' || entity.type === 'toolCall');
}

export function isToolEvent(activity: unknown): boolean {
  const item = record(activity);
  return item.type === 'event' && [
    'DynamicPlanReceived', 'DynamicPlanStepTriggered', 'DynamicPlanStepBindUpdate', 'DynamicPlanStepFinished'
  ].indexOf(text(item.valueType)) !== -1;
}

export function updateActivityDetails(
  state: ActivityDetailsState, activity: unknown, visibility: ActivityVisibility
): ActivityDetailsState {
  const item = record(activity);
  const stream = streamMetadata(item);
  const sequence = typeof stream.streamSequence === 'number' ? stream.streamSequence : undefined;
  if (hasDetailEntities(item)) {
    let next = state;
    for (const entity of entities(item)) {
      if (entity.type === 'thought' && visibility.showReasoning) {
        const content = text(entity.text);
        if (!content) continue;
        const chain = identifier(entity.chainOfThoughtId) || text(stream.streamId) || text(item.id) || 'current';
        const id = `reasoning:${chain}:${identifier(entity.sequenceNumber) || '0'}`;
        const previous = next.entries.find(entry => entry.id === id);
        if (previous?.sequence !== undefined && sequence !== undefined && sequence <= previous.sequence) continue;
        // The SDK accumulates activity.text, not thought.text; thought deltas still need assembly.
        const nextText = stream.chunkType === 'delta' ? (previous?.text || '') + content : content;
        const entry: ActivityDetail = { id, kind: 'reasoning', text: nextText, sequence };
        next = { ...next, entries: upsert(next.entries, entry) };
      } else if (entity.type === 'toolCall' && visibility.showToolCalls) {
        const callId = identifier(entity.toolCallId);
        const status = entity.status === 'completed' ? 'finished'
          : entity.status === 'started' ? 'running' : entity.status === 'failed' ? 'failed' : undefined;
        if (!callId || !status) continue;
        const id = `tool:${callId}`;
        const previous = next.entries.find(entry => entry.id === id);
        if (previous?.sequence !== undefined && sequence !== undefined && sequence <= previous.sequence) continue;
        if (previous?.status && previous.status !== 'running' && status === 'running') continue;
        const entry: ActivityDetail = {
          id, kind: 'tool', status, sequence,
          text: text(entity.toolDisplayName) || text(entity.toolName) || text(entity.operationId) || previous?.text || 'Agent action'
        };
        next = { ...next, entries: upsert(next.entries, entry) };
      }
    }
    return next;
  }
  if (!visibility.showToolCalls || !isToolEvent(item)) return state;
  const value = record(item.value);
  if (item.valueType === 'DynamicPlanReceived' && Array.isArray(value.toolDefinitions)) {
    const toolNames = { ...state.toolNames };
    value.toolDefinitions.forEach(definition => {
      const tool = record(definition);
      const schema = text(tool.schemaName);
      if (schema && text(tool.displayName)) toolNames[schema] = text(tool.displayName);
    });
    return { ...state, toolNames };
  }
  if (item.valueType !== 'DynamicPlanStepTriggered' && item.valueType !== 'DynamicPlanStepFinished') return state;
  const schema = text(value.taskDialogId);
  const step = identifier(value.stepId) || identifier(value.id) || schema;
  if (!step) return state;
  const id = `tool:${step}`;
  const previous = state.entries.find(entry => entry.id === id);
  if (previous?.status === 'finished' && item.valueType === 'DynamicPlanStepTriggered') return state;
  const entry: ActivityDetail = {
    id, kind: 'tool',
    text: text(state.toolNames[schema]) || schema || 'Agent action',
    status: item.valueType === 'DynamicPlanStepFinished' ? 'finished' : 'running'
  };
  return { ...state, entries: upsert(state.entries, entry) };
}

function upsert(entries: ActivityDetail[], entry: ActivityDetail): ActivityDetail[] {
  return entries.some(existing => existing.id === entry.id)
    ? entries.map(existing => existing.id === entry.id ? entry : existing)
    : [...entries, entry];
}
