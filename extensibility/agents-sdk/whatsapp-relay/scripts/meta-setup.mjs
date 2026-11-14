import { randomUUID } from "node:crypto";
import { ApiError, boundedText, confirm, requestJson, SetupError } from "./common.mjs";

export class MetaSetup {
  constructor(env, { request = requestJson, confirmation = confirm, fetcher = fetch } = {}) {
    this.env = env;
    this.request = request;
    this.confirmation = confirmation;
    this.fetcher = fetcher;
  }

  graph(path, token, options = {}) {
    return this.request(`https://graph.facebook.com/${this.env.META_GRAPH_VERSION}/${path}`, token, { ...options, service: "Meta" });
  }

  async validate() {
    const env = this.env;
    let debug;
    try {
      debug = await this.graph(`debug_token?${new URLSearchParams({ input_token: env.META_ACCESS_TOKEN })}`, env.META_ACCESS_TOKEN);
    } catch (error) {
      if (error instanceof ApiError && Number(error.code) === 190) {
        throw new SetupError("Meta rejected the access token. Replace META_ACCESS_TOKEN privately before retrying.");
      }
      throw error;
    }
    if (!debug?.data?.is_valid || (debug.data.expires_at && debug.data.expires_at * 1000 <= Date.now())) {
      throw new SetupError("The Meta access token is invalid or expired. Replace META_ACCESS_TOKEN privately before retrying.");
    }
    this.appId = debug.data.app_id;
    if (!/^\d+$/.test(this.appId ?? "")) throw new SetupError("Meta did not identify the token's app.");
    this.appToken = `${this.appId}|${env.META_APP_SECRET}`;
    await this.subscriptions();
    const phone = await this.phone();
    const membership = await this.pages(`${env.META_WABA_ID}/phone_numbers`, "id");
    if (!membership.some(item => item.id === phone.id)) {
      throw new SetupError("The configured phone is not in the configured WABA. Check the configuration.");
    }
  }

  async phone(options = {}) {
    const phone = await this.graph(`${this.env.META_PHONE_NUMBER_ID}?fields=id,webhook_configuration`, this.env.META_ACCESS_TOKEN, options);
    if (phone?.id !== this.env.META_PHONE_NUMBER_ID) throw new SetupError("Meta did not confirm the configured phone number.");
    if (phone?.webhook_configuration?.phone_number) {
      throw new SetupError("This phone-number has a webhook override. Remove/manage it manually before using app-level webhook setup.");
    }
    return phone;
  }

  async pages(path, fields, options = {}) {
    const items = [];
    let after;
    for (let i = 0; i < 100; i++) {
      const query = new URLSearchParams({ limit: "100", ...(fields ? { fields } : {}), ...(after ? { after } : {}) });
      const response = await this.graph(`${path}?${query}`, this.env.META_ACCESS_TOKEN, options);
      if (!Array.isArray(response?.data)) throw new SetupError("Meta returned invalid subscription/phone metadata.");
      items.push(...response.data);
      if (!response.paging?.next) return items;
      const cursor = response.paging.cursors?.after;
      if (typeof cursor !== "string" || cursor === after || cursor.length > 4096) break;
      after = cursor;
    }
    throw new SetupError("Meta pagination could not be completed safely; no configuration was changed.");
  }

  async subscriptions(options = {}) {
    const response = await this.graph(`${this.appId}/subscriptions`, this.appToken, options);
    if (!Array.isArray(response?.data)) throw new SetupError("Meta returned invalid webhook subscription metadata.");
    return response.data;
  }

  async configure(callback, { replace = false, signal } = {}) {
    signal?.throwIfAborted();
    const url = new URL(callback);
    if (url.protocol !== "https:" || url.username || url.password || url.search || url.hash || url.pathname !== "/webhook") {
      throw new SetupError("The callback must be an absolute HTTPS /webhook URL without credentials or query parameters.");
    }
    await this.phone({ signal });
    const current = (await this.subscriptions({ signal })).filter(item => item.object === "whatsapp_business_account");
    if (current.length > 1) throw new SetupError("Multiple WhatsApp subscriptions were returned; inspect them before making changes.");
    const existing = current[0];
    const appsBefore = await this.pages(`${this.env.META_WABA_ID}/subscribed_apps`, undefined, { signal });
    const installed = appsBefore.find(item => item.whatsapp_business_api_data?.id === this.appId);
    if (installed?.override_callback_uri) {
      throw new SetupError("This WABA has a callback override. Remove/manage that override manually before using app-level webhook setup.");
    }
    if ((existing?.fields ?? []).some(field => field.version && field.version !== this.env.META_GRAPH_VERSION)) {
      throw new SetupError("Existing webhook fields use a different Graph version. Align versions manually before running setup; field versions were not overwritten.");
    }
    if (existing && existing.callback_url !== callback) {
      // Display destinations only; never echo credentials/query strings from remote metadata.
      const old = new URL(existing.callback_url);
      console.log(`Existing callback: ${old.origin}${old.pathname}\nProposed callback: ${callback}`);
      await this.confirmation("Replace the existing WhatsApp callback? This changes where real messages are delivered.", { approved: replace, signal });
    }
    const challenge = randomUUID();
    const check = new URL(callback);
    check.search = new URLSearchParams({ "hub.mode": "subscribe", "hub.verify_token": this.env.META_VERIFY_TOKEN, "hub.challenge": challenge });
    const response = await this.fetcher(check, { redirect: "error", signal: AbortSignal.any([AbortSignal.timeout(15_000), ...(signal ? [signal] : [])]) });
    if (!response.ok || await boundedText(response) !== challenge) throw new SetupError("Public webhook verification failed; Meta configuration was not changed.");
    const fields = new Set(["messages"]);
    for (const field of existing?.fields ?? []) {
      if (typeof field.name !== "string" || !/^[a-z_]+$/.test(field.name)) throw new SetupError("An existing webhook field cannot be safely preserved.");
      fields.add(field.name);
    }
    signal?.throwIfAborted();
    const result = await this.graph(`${this.appId}/subscriptions`, this.appToken, { method: "POST", signal, body: {
      object: "whatsapp_business_account", callback_url: callback,
      verify_token: this.env.META_VERIFY_TOKEN, fields: [...fields].join(","),
      ...(existing?.include_values === undefined ? {} : { include_values: existing.include_values }),
    } });
    if (result?.success !== true) throw new SetupError("Meta did not confirm webhook configuration.");
    if (!installed) {
      const subscribed = await this.graph(`${this.env.META_WABA_ID}/subscribed_apps`, this.env.META_ACCESS_TOKEN, { method: "POST", signal, body: {} });
      if (subscribed?.success !== true) throw new SetupError("The callback was updated, but WABA subscription was not confirmed.");
    }
    const saved = (await this.subscriptions({ signal })).find(item => item.object === "whatsapp_business_account");
    const apps = await this.pages(`${this.env.META_WABA_ID}/subscribed_apps`, undefined, { signal });
    await this.phone({ signal });
    if (!saved?.active || saved.callback_url !== callback || !saved.fields?.some(field => field.name === "messages") ||
        !apps.some(item => item.whatsapp_business_api_data?.id === this.appId && !item.override_callback_uri)) {
      throw new SetupError("Meta configuration was submitted but could not be verified; inspect it before retrying.");
    }
    console.log(`Meta messages webhook verified: ${callback}`);
  }
}
