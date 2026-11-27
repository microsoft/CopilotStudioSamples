---
title: WhatsApp Relay Enterprise Readiness
nav_exclude: true
search_exclude: false
---
# From a lightweight relay to an enterprise service

[Sample overview](../) | [Setup and deployment](deployment)

This is a **reference architecture, not an implemented deployment option**. The sample remains one Node process with volatile queues, authentication correlation, conversation mappings, deduplication, and media buffers. Its App Service template adds hosting convenience, not durability. Even a healthy, Always On instance can lose messages it has already acknowledged during deployment, maintenance, a crash, or restart.

## What is already protected

The sample verifies Meta's raw-body HMAC before admission, checks the receiving WABA/phone, bounds requests and work, serializes each sender, separates delegated identities, enforces authentication expiry, and cancels bounded operations. It avoids blind retries after uncertain agent or Meta outcomes. Downloaded files are bounded and checked; logs avoid conversation bodies and credentials.

Each sender has a separate SDK identity, SDK `MemoryStorage` instance, and GHCP conversation state, keyed by WABA, receiving number, and sender. To support restarts and multiple workers, persist these per-sender records in durable storage and enforce the same user isolation whenever a worker restores a session.

These controls do not provide durable acceptance, distributed ownership, replay recovery, comprehensive malware detection, a secret-management lifecycle, or a production operational model. `/health` reports process liveness, not downstream readiness or delivery success.

## An illustrative Azure architecture

1. **Public receiver:** Meta calls a small HTTPS ingress, optionally through Front Door/WAF or API Management. It preserves the signed request bytes, authenticates the signature, validates account/phone and limits, and admits events durably.
2. **Session-aware broker:** Service Bus routes a scoped sender/conversation to one active session owner. The receiver acknowledges Meta only after durable acceptance of all relevant events in the webhook.
3. **Workers:** Long-running workers restore auth/conversation state, use the Agents SDK for delegated authorization, invoke the published GHCP agent, and record outcomes. Their count can scale independently of the receiver.
4. **State and processing ledger:** A suitable store holds stable identities, lifecycle generations, deduplication, pending work and uncertain outcomes. A richer store such as Cosmos DB can also hold an outbound-intent ledger/outbox.
5. **Channel delivery:** A sender records and dispatches final replies/files through Meta, correlates provider message IDs and status callbacks, and distinguishes accepted, delivered, read, and failed outcomes.

These are logical responsibilities, not a requirement for five separately deployed services. App Service, Container Apps, or another worker host can be appropriate after its broker, cancellation, scaling, and shutdown behavior is designed. The sample's B1 web app is not the prescribed enterprise platform.

### Admission and message ordering

Use a stable session key scoped by deployment/tenant, WABA, receiving number, and sender. Avoid raw phone numbers in broker names/logs; a keyed identifier still requires privacy controls and a rotation plan.

**Service Bus sessions and duplicate detection require Standard or Premium, not Basic.** Sessions serialize broker delivery to an exclusive session owner; they do not establish the chronological order of messages delayed before enqueueing. Handle late arrivals, duplicates, resets, and status events deliberately.

For a batched webhook, either use an appropriate supported broker transaction or make partial admission safe with durable per-event IDs: acknowledge only after every relevant event is durably accepted. If admission is uncertain, return a retryable error and rely on durable deduplication to absorb Meta retries. A process-local enqueue followed by a background broker send is not durable admission.

Define capacity and backpressure for body size, batch size, queue age, tenant/sender quotas, media work, and downstream concurrency. Renew session/message locks for bounded work. If renewal or ownership fails, cancel local requests, stop committing as owner, and mark any in-flight external operation uncertain. Fencing/version checks can protect database updates, but cannot undo an already-running agent tool.

Do not hold a worker or broker lock while a person signs in. Save the pending-auth state and complete that queue step; the code arrives as another event for the same scoped session. A later worker restores the state and lets the SDK validate the code.

### Persistence must include more than a conversation ID

Persist an explicit, versioned state machine covering:

| State | Why it matters |
| --- | --- |
| Stable SDK user/conversation identity and SDK authorization state | A new random identity on each worker/restart cannot recover the existing OAuth correlation. Use reviewed durable SDK storage partitioned by scoped sender identity, not serialized in-process client objects. |
| Pending-auth correlation, original request metadata, and expiry | Successful code validation must resume the correct original request exactly once within the intended lifecycle, not treat the code as a new prompt. |
| GHCP conversation ID and turn/checkpoint status | Distinguish active, completed, failed, and uncertain remote turns after recovery. |
| Session generation, idle expiry, reset, and sign-out state | Prevent a delayed callback or old queue job from resurrecting a reset/signed-out session. Coordinate SDK token-service sign-out with durable state transitions and recover partial failures. |
| Deduplication and processing ledger | Cover the provider retry horizon, replay policy, and business recovery window across restarts and workers. |
| Outbound intents, attempts, provider IDs, and statuses | Recover partially delivered replies and distinguish an accepted send from actual delivery. |

Authentication correlation and the SDK's token-storage contract must be reviewed together. Azure Bot's managed OAuth token cache remains external. Do not put raw delegated tokens, sign-in URLs, six-digit codes, or message content in diagnostic logs. Define encryption, least-privilege access, retention, deletion, and reauthentication for phone reassignment/session expiry.

**Service Bus session state** can hold limited opaque per-session metadata and is useful when work and state naturally share a session owner. It has tier-dependent size/storage limits, needs explicit expiry/cleanup, and is not a general searchable ledger. Do not use it as an attachment store or assume updating it is atomic with an external service.

**Cosmos DB or another transactional state store** is useful for conditional updates, lifecycle versions, richer ledgers, queries, and outbox entries. Select partition keys so the necessary state transitions can use the store's actual transaction boundary. ETags/conditional writes provide optimistic concurrency; cross-partition writes, broker completion, and HTTP side effects do not become one transaction. Extra storage is worthwhile only with a defined consistency and recovery model.

### Retries, an outbox, and uncertain outcomes

Neither Service Bus duplicate detection nor an outbox makes agent tools or Meta sends **exactly-once**.

| Crash window | Required recovery policy |
| --- | --- |
| Broker accepted an event but ingress did not observe success | Retry admission using stable IDs; durable dedup prevents a second logical job. |
| Agent/tool executed but worker did not persist completion | Mark uncertain; reconcile using supported remote IDs/idempotency keys or require operator intervention. Do not blindly rerun a side-effecting prompt. |
| Outbound intent saved but send not started | A sender can safely pick up the unsent intent, subject to current authorization/window and lifecycle rules. |
| Meta accepted a send but its response was lost | The message may already exist. Retrying can duplicate it; retain an uncertain-send state, correlate available status evidence, and apply an explicit reconciliation/manual policy. |
| Some parts of a multipart reply were delivered | Track each intent independently; do not resend the entire response or claim earlier messages were rolled back. |

Classify retryable transport/throttling failures separately from authorization, policy, invalid payload, expired service-window, and uncertain-effect failures. Use bounded backoff, delivery-attempt limits, dead-letter reasons, and controlled replay tools. Do not auto-replay dead letters containing agent actions just because a dependency is healthy again. Apply idempotency keys at tools/business APIs wherever their contracts support them.

### Protecting the public webhook

The **GET verification token only verifies setup**; it does not authenticate webhook POSTs. Keep raw-body `X-Hub-Signature-256` verification and WABA/phone checks even behind an Azure edge. Meta must reach a public HTTPS endpoint. An interactive Entra login wall in front of that endpoint prevents delivery.

Front Door/WAF can add coarse request limits, bot/abuse controls, and an externally managed TLS edge. API Management can provide policy enforcement and tenant/API quotas where justified. Neither replaces Meta signature verification. Preserve raw signed bytes: body decompression, JSON normalization, encoding changes, or proxy transformations can invalidate a legitimate signature.

Prevent direct-origin bypass. For a public App Service origin behind Front Door, combine the appropriate `AzureFrontDoor.Backend` service-tag/IP restrictions **and validation of the intended `X-Azure-FDID`**, denying other origin traffic. Checking the header alone is insufficient because a direct caller can supply it. Alternatively, use a supported private-origin arrangement and appropriate private connectivity/tier. Plan the health-probe exceptions as part of the access policy, not as an unrestricted bypass.

Rate limits must tolerate legitimate Meta retries and bursts while bounding abuse; signature-valid messages can still consume excessive work. Do not assume an arbitrary Meta IP allowlist is a permanent authentication mechanism. Secure management/diagnostics separately from the public data path. Strip verification-token query parameters and sign-in/file URLs from edge, access, and tracing logs.

### Identity, secrets, media, and operations

Use managed identity for supported host-to-Azure dependencies, Key Vault or another approved secret manager, explicit access roles, and monitored rotation. This sample's bot authentication uses an Entra client secret; adding a managed identity to its host does not automatically replace that SDK authentication path or the user's delegated token. Review consent, agent sharing/allowlisting, offboarding, and tenant boundaries.

Production Meta onboarding, access tokens, phone/WABA ownership, API version lifecycle, opt-out/consent, approved templates outside the 24-hour service window, and applicable WhatsApp business/AI-use policies remain separate requirements.

Durable retries may require controlled media storage, unlike this memory-only sample. Decide whether to download at admission or later: a metadata-only queue can outlive a provider media URL's availability. Scan content, validate formats/codecs, enforce network/URL policies, encrypt temporary objects, and expire/delete them. Treat captions and documents as untrusted inputs to tools. **GHCP acceptance and understanding of incoming inline image/document/audio/video attachments remains unverified until tested per modality against the actual agent.**

Monitor durable queue age, admission failures, ownership loss, pending-auth expiry, sign-in failures, turn duration, throttling, uncertain outcomes, send-to-delivery latency, dead letters, and resource usage. Use opaque correlation identifiers and allowlisted error codes, not raw payload dumps. Define privacy-aware retention across Meta, the broker/store, Azure Bot OAuth, Entra, Copilot Studio, downstream tools, browsers, and telemetry. Memory-only application buffers do not mean end-to-end zero retention.

Before claiming enterprise readiness, exercise worker/ingress crashes at each ledger boundary, duplicate and delayed webhooks, session-lock loss, rolling deployment and scale-out, poison messages, credential rotation, rate limiting, storage/broker outages, and restore/replay procedures. Validate cross-user authorization isolation and every media modality end-to-end. Document who reconciles uncertain business actions and how users learn a request needs recovery.

## References

- [Service Bus sessions](https://learn.microsoft.com/en-us/azure/service-bus-messaging/message-sessions)
- [Service Bus duplicate detection](https://learn.microsoft.com/en-us/azure/service-bus-messaging/duplicate-detection)
- [Service Bus transactions](https://learn.microsoft.com/en-us/azure/service-bus-messaging/service-bus-transactions)
- [Front Door origin protection](https://learn.microsoft.com/en-us/azure/frontdoor/origin-security)
- [App Service access restrictions](https://learn.microsoft.com/en-us/azure/app-service/overview-access-restrictions)
- [Meta webhook endpoint setup](https://developers.facebook.com/documentation/business-messaging/whatsapp/webhooks/create-webhook-endpoint)
