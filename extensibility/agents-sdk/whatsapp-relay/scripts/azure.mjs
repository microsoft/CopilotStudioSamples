import { ApiError, cliJson, guid, requestJson, required, resourceName, SetupError } from "./common.mjs";

export const azureOptions = {
  tenant: { type: "string" }, subscription: { type: "string" },
  group: { type: "string" }, location: { type: "string" },
};

export function target(options) {
  return {
    tenant: guid(options.tenant, "--tenant").toLowerCase(),
    subscription: guid(options.subscription, "--subscription").toLowerCase(),
    group: resourceName(options.group, "--group"),
    location: options.location ? required(options.location, "--location", /^[a-z0-9]+$/) : undefined,
  };
}

export class Azure {
  constructor(target, { command = cliJson, request = requestJson } = {}) {
    this.target = target;
    this.command = command;
    this.request = request;
    this.tokens = new Map();
    this.groupPath = `/subscriptions/${target.subscription}/resourceGroups/${target.group}`;
  }
  async connect() {
    const cloud = await this.command("az", ["cloud", "show", "--query", "name", "-o", "json", "--only-show-errors"]);
    if (cloud !== "AzureCloud") throw new SetupError("These setup helpers support commercial AzureCloud only. They do not switch your active cloud.");
    const account = await this.command("az", ["account", "show", "--subscription", this.target.subscription, "-o", "json", "--only-show-errors"]);
    if (account?.tenantId?.toLowerCase() !== this.target.tenant || account?.id?.toLowerCase() !== this.target.subscription) {
      throw new SetupError("The Azure subscription does not belong to the requested tenant. Run az login --tenant with the intended tenant and retry.");
    }
  }
  async token(resource) {
    const cached = this.tokens.get(resource);
    if (cached && cached.until > Date.now()) return cached.token;
    const value = await this.command("az", [
      "account", "get-access-token", "--resource", resource,
      "--subscription", this.target.subscription, "-o", "json", "--only-show-errors",
    ]);
    if (!value?.accessToken) throw new SetupError("Azure CLI did not return a management token.");
    if (value.tenant?.toLowerCase() !== this.target.tenant || value.subscription?.toLowerCase() !== this.target.subscription) {
      throw new SetupError("Azure CLI token metadata does not match the requested tenant/subscription.");
    }
    this.tokens.set(resource, { token: value.accessToken, until: Date.now() + 5 * 60_000 });
    return value.accessToken;
  }
  async arm(path, options = {}, version = "2022-09-15") {
    return this.request(`https://management.azure.com${path}?api-version=${version}`,
      await this.token("https://management.azure.com/"), { ...options, service: "Azure Resource Manager" });
  }
  async graph(path, options = {}) {
    return this.request(`https://graph.microsoft.com/v1.0/${path}`,
      await this.token("https://graph.microsoft.com/"), { ...options, service: "Microsoft Graph" });
  }
  async optional(path, version) {
    try { return await this.arm(path, {}, version); } catch (error) {
      if (error instanceof ApiError && error.status === 404) return undefined;
      throw error;
    }
  }
  async group(owner) {
    const existing = await this.optional(this.groupPath, "2024-03-01");
    if (existing) return;
    if (!this.target.location) throw new SetupError("Supply --location to create the resource group.");
    await this.arm(this.groupPath, { method: "PUT", body: {
      location: this.target.location, tags: { "whatsapp-relay-owner": owner },
    } }, "2024-03-01");
  }
}

export function assertOwned(resource, owner) {
  if (!owner || (resource && resource.tags?.["whatsapp-relay-owner"] !== owner)) {
    throw new SetupError("A resource with this name already exists and is not owned by this setup. Choose a new name; existing resources were not modified.");
  }
}
