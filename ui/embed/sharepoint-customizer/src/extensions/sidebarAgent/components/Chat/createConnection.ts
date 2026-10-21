import { CopilotStudioClient, CopilotStudioWebChat, CopilotStudioWebChatConnection } from '@microsoft/agents-copilotstudio-client';
import { Observable, ReplaySubject, share, Subscription } from 'rxjs';
import { Activity } from '@microsoft/agents-activity';
import { ChatConfiguration } from '../../configuration';
import { createPreChatActivity, NativeActivityAdapter } from './nativeActivities';
import { prepareAttachments } from './attachments';

export interface ConnectionCallbacks {
  onTurn: () => void;
  onTurnEnd: () => void;
  onError: (error: Error) => void;
}

export function createConnection(
  client: CopilotStudioClient, configuration: ChatConfiguration, callbacks: ConnectionCallbacks
): CopilotStudioWebChatConnection {
  const connection = CopilotStudioWebChat.createConnection(client, {
    showTyping: configuration.showTyping, startConversation: configuration.startConversation
  });
  let initialization: Promise<void> | undefined;
  const initializeConversation = (): Promise<void> => {
    if (!initialization) {
      initialization = (async () => {
        const activities = client.startConversationStreaming(false);
        while (!(await activities.next()).done) {
          // Drain startup without a greeting; the SDK retains the ID from response headers.
        }
      })().catch(error => {
        initialization = undefined;
        throw error;
      });
    }
    return initialization;
  };
  return wrapConnection(
    connection, configuration, callbacks, configuration.startConversation ? undefined : initializeConversation
  );
}

export function wrapConnection(
  connection: CopilotStudioWebChatConnection, configuration: ChatConfiguration, callbacks: ConnectionCallbacks,
  initializeConversation?: () => Promise<void>
): CopilotStudioWebChatConnection {
  let ended = false;
  let sequence = 0;
  const native = new NativeActivityAdapter(configuration);
  let emitUpdates: ((activities: Partial<Activity>[]) => void) | undefined;
  const requests = new Set<Subscription>();
  const report = (error: unknown): Error => {
    const failure = error instanceof Error ? error : new Error('The agent connection failed. Try reconnecting.');
    if (!ended) {
      emitUpdates?.(native.finishTurn(true));
      callbacks.onError(failure);
    }
    return failure;
  };
  // WebChat first subscribes to connect, then subscribes again to render the transcript.
  // Share the SDK's single subscriber and replay activities that arrived during startup.
  const activity$ = new Observable<Partial<Activity>>(subscriber => {
    const emit = (activities: Partial<Activity>[]): void => {
      activities.forEach(activity => {
        const incoming = { ...activity, id: activity.id || `sidepane-activity-${++sequence}` };
        if (incoming.type === 'typing' && !incoming.text && !configuration.showTyping) return;
        subscriber.next(incoming);
      });
    };
    emitUpdates = emit;
    if (!configuration.startConversation) emit([createPreChatActivity(configuration)]);
    const subscription = connection.activity$.subscribe({
      next: activity => {
        if (ended) return;
        emit(native.transform(activity));
      },
      error: error => {
        report(error);
        connection.connectionStatus$.next(4);
        subscriber.complete();
      },
      complete: () => subscriber.complete()
    });
    return () => {
      if (emitUpdates === emit) emitUpdates = undefined;
      subscription.unsubscribe();
    };
  }).pipe(share({
    connector: () => new ReplaySubject<Partial<Activity>>(),
    resetOnComplete: true,
    resetOnError: true,
    resetOnRefCountZero: true
  }));
  return {
    connectionStatus$: connection.connectionStatus$,
    get conversationId() { return connection.conversationId; },
    activity$,
    postActivity: activity => new Observable(subscriber => {
      let cancelled = false;
      let acknowledged = false;
      const subscription = new Subscription();
      const finish = (interrupted = false): void => {
        if (!requests.delete(subscription)) return;
        if (!ended && activity.type === 'message') {
          emitUpdates?.(native.finishTurn(interrupted));
          callbacks.onTurnEnd();
        }
      };
      const send = async (): Promise<void> => {
        try {
          if (ended || cancelled) return;
          requests.add(subscription);
          if (activity.type === 'message') {
            native.startTurn();
            callbacks.onTurn();
          }
          const attachments = await prepareAttachments(activity.attachments || [], configuration.enableFileUpload);
          if (ended || cancelled) return;
          if (activity.type === 'message') await initializeConversation?.();
          if (ended || cancelled) return;
          subscription.add(connection.postActivity(Activity.fromObject({ ...activity, attachments })).subscribe({
            next: id => { acknowledged = true; subscriber.next(id); },
            error: error => { finish(true); subscriber.error(report(error)); },
            complete: () => { finish(); subscriber.complete(); }
          }));
        } catch (error) {
          finish(true);
          if (!ended && !cancelled) subscriber.error(report(error));
        }
      };
      send().catch(error => subscriber.error(report(error)));
      return () => {
        cancelled = true;
        // WebChat unsubscribes after the send acknowledgement, before the response stream finishes.
        if (!acknowledged) {
          subscription.unsubscribe();
          finish(true);
        }
      };
    }),
    end: () => {
      ended = true;
      requests.forEach(subscription => subscription.unsubscribe());
      requests.clear();
      connection.end();
    }
  };
}
