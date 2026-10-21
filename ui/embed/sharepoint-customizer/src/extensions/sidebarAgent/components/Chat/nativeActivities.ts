import { Activity } from '@microsoft/agents-activity';
import { ChatConfiguration } from '../../configuration';
import { ActivityDetail, emptyActivityDetails, hasDetailEntities, isInformative, isToolEvent, record, updateActivityDetails } from './activityDetails';

export function createPreChatActivity(configuration: ChatConfiguration): Partial<Activity> {
  return {
    type: 'message',
    id: 'sidepane:welcome',
    from: { id: 'agent', role: 'bot' },
    timestamp: new Date().toISOString(),
    channelData: { 'webchat:sequence-id': -1 },
    text: '',
    entities: [{
      type: 'https://schema.org/Message', '@context': 'https://schema.org', '@id': '', '@type': 'Message',
      keywords: ['PreChatMessage'],
      author: {
        '@type': 'Person',
        name: 'How can I help?',
        // Fluent 4.19 renders an avatar even when no author image is provided.
        image: `data:image/svg+xml,${encodeURIComponent(
          '<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 48 48" fill="none" stroke="#605e5c" stroke-width="2"><path d="M12 8h24a4 4 0 0 1 4 4v20a4 4 0 0 1-4 4H22l-10 6v-6a4 4 0 0 1-4-4V12a4 4 0 0 1 4-4Z"/><path d="M16 18h16M16 26h11"/></svg>'
        )}`,
        description: configuration.enableFileUpload
          ? 'Ask a question or attach a document to get started.'
          : 'Ask a question to get started.'
      }
    }],
    suggestedActions: {
      to: [],
      actions: configuration.starterPrompts.map(prompt => ({
        type: 'messageBack', title: prompt.title, text: prompt.text
      }))
    }
  };
}

function isNativeAnalysis(activity: Partial<Activity>): boolean {
  return !!activity.entities?.some(entity => {
    const message = record(entity);
    return message.type === 'https://schema.org/Message' &&
      Array.isArray(message.keywords) && message.keywords.indexOf('AnalysisMessage') !== -1;
  });
}

export class NativeActivityAdapter {
  private state = emptyActivityDetails();
  private turn = 0;
  private outcome: 'finished' | 'interrupted' | undefined;
  private sequenceIds = new Map<string, number>();
  private timestamp = new Date().toISOString();
  private author = { id: 'agent', role: 'bot' };

  constructor(private readonly configuration: ChatConfiguration) {}

  startTurn(): void {
    this.state = emptyActivityDetails();
    this.sequenceIds.clear();
    this.timestamp = new Date().toISOString();
    this.outcome = undefined;
    this.turn++;
  }

  transform(activity: Partial<Activity>): Partial<Activity>[] {
    if (activity.type === 'event' && activity.name === 'turn.complete') return this.finishTurn();
    if (hasDetailEntities(activity) || isInformative(activity) || isToolEvent(activity)) {
      const previous = this.state;
      this.state = updateActivityDetails(previous, activity, this.configuration);
      if (typeof activity.from?.id === 'string') this.author = { id: activity.from.id, role: 'bot' };
      return this.state.entries
        .filter(entry => previous.entries.find(candidate => candidate.id === entry.id) !== entry)
        .map(entry => {
          const sequenceId = record(activity.channelData)['webchat:sequence-id'];
          if (!this.sequenceIds.has(entry.id) && typeof sequenceId === 'number') {
            this.sequenceIds.set(entry.id, sequenceId);
          }
          return this.render(entry);
        });
    }
    if (isNativeAnalysis(activity) && !this.configuration.showReasoning) return [];
    return [activity];
  }

  finishTurn(interrupted = false): Partial<Activity>[] {
    if (this.outcome) return [];
    this.outcome = interrupted ? 'interrupted' : 'finished';
    return this.state.entries.map(entry => this.render(entry));
  }

  private render(entry: ActivityDetail): Partial<Activity> {
    const finished = entry.kind === 'tool' ? entry.status === 'finished' : this.outcome === 'finished';
    const failed = entry.status === 'failed';
    return {
      type: 'message',
      id: `sidepane:turn:${this.turn}:${entry.id}`,
      from: this.author,
      timestamp: this.timestamp,
      // Keep the SDK's sequence scale and the step's original position on updates.
      channelData: { 'webchat:sequence-id': this.sequenceIds.get(entry.id) },
      textFormat: 'plain',
      text: entry.kind === 'reasoning' ? entry.text : failed ? 'Failed' : finished ? 'Finished' : this.outcome ? 'No finish event received.' : 'Started',
      entities: [{
        type: 'https://schema.org/Message', '@context': 'https://schema.org', '@id': '', '@type': 'Message',
        abstract: entry.kind === 'reasoning' ? 'Reasoning' : entry.text,
        keywords: ['AnalysisMessage', 'Collapsible'],
        position: this.state.entries.indexOf(entry) + 1,
        creativeWorkStatus: failed ? 'Failed' : finished ? 'Published' : this.outcome ? undefined : 'Incomplete',
        isPartOf: {
          '@id': `sidepane:turn:${this.turn}`,
          '@type': 'HowTo',
          abstract: this.outcome === 'interrupted' ? 'Agent activity interrupted' : 'Agent activity',
          creativeWorkStatus: this.outcome === 'interrupted' ? 'Failed' : this.outcome === 'finished' ? 'Published' : 'Incomplete'
        }
      }]
    };
  }
}
