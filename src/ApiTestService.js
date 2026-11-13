const { ElvClient } = require("@eluvio/elv-client-js");
const crypto = require("crypto");
const fs = require("fs");

/*
 * API health checks for the Eluvio Media Wallet apps (tvOS, Android, web).
 *
 * Calls every backend endpoint the wallet apps depend on, with the same request
 * shapes they send, against each active media property. Meant to run after an
 * infrastructure redeploy.
 *
 * Auth (first one provided wins):
 *   token       - an existing fabric token / CSAT, used as-is
 *   jwt         - an OAuth ID token; runs the real app login (wlt/login/jwt -> wlt/sign/csat)
 *   privateKey  - signs a fabric token locally (same as the web wallet's external-wallet login)
 *   (none)      - anonymous, using the static qspace token the apps use when logged out
 */

const PASS = "PASS";
const WARN = "WARN";
const FAIL = "FAIL";
const SKIP = "SKIP";

const HLS_KEYS = ["hls-clear", "hls-aes128", "hls-fairplay", "hls-sample-aes"]; // app preference order
const USER_AGENT = "elv-mediawallet-api-test/1.0";
const SHORTENER_URL = "https://elv.lv/tiny/create";
const STATE_STORE_URL = "https://appsvc.svc.eluv.io";

class CheckError extends Error {}
class Skip extends Error {}

class HttpResponse {
  constructor({ status = null, body = Buffer.alloc(0), ms = 0, error = null }) {
    this.status = status;
    this.body = body;
    this.ms = ms;
    this.error = error;
    this.retried = false;
  }

  json() {
    return this.body.length ? JSON.parse(this.body.toString("utf-8")) : null;
  }

  snippet(n = 200) {
    if (this.error) return this.error;
    return this.body.subarray(0, n).toString("utf-8").replace(/\s+/g, " ");
  }
}

const withQuery = (url, params) => {
  const u = new URL(url);
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null) u.searchParams.set(k, v);
  }
  return u.toString();
};

const host = (url) => {
  try {
    return new URL(url).host;
  } catch (e) {
    return url;
  }
};

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

class ApiTestService {
  constructor({
    configUrl,
    network,
    walletUrl,
    env = "prod",
    timeoutMs = 30000,
    slowMs = 8000,
    readOnly = false,
    skipNodeSweep = false,
    mediaScan = 5,
    debugLogging = false
  }) {
    this.configUrl = /\/config(\?|$)/.test(configUrl) ? configUrl : configUrl.replace(/\/$/, "") + "/config";
    this.network = network;
    this.walletUrl = walletUrl;
    this.env = env;
    this.timeoutMs = timeoutMs;
    this.slowMs = slowMs;
    this.readOnly = readOnly;
    this.skipNodeSweep = skipNodeSweep;
    this.mediaScan = mediaScan;
    this.debugLogging = debugLogging;

    this.results = [];
    this.ctx = {};
  }

  /* ----------------------- HTTP ----------------------- */

  async http(url, { method = "GET", body, rawBody, token, accept = "application/json", retry = true } = {}) {
    const headers = { "User-Agent": USER_AGENT, Accept: accept };
    let payload;
    if (body !== undefined) {
      payload = JSON.stringify(body);
      headers["Content-Type"] = "application/json";
    } else if (rawBody !== undefined) {
      payload = rawBody;
      headers["Content-Type"] = "application/json";
    }
    if (token) headers.Authorization = `Bearer ${token}`;
    if (this.requests) this.requests.push(this.displayPath(method, url));

    const attempts = retry ? 2 : 1;
    let res;
    for (let attempt = 0; attempt < attempts; attempt++) {
      const start = Date.now();
      try {
        const r = await fetch(url, {
          method,
          headers,
          body: payload,
          signal: AbortSignal.timeout(this.timeoutMs)
        });
        const buf = Buffer.from(await r.arrayBuffer());
        res = new HttpResponse({ status: r.status, body: buf, ms: Date.now() - start });
      } catch (error) {
        const cause = error.cause ? ` (${error.cause.code || error.cause.message})` : "";
        res = new HttpResponse({ ms: Date.now() - start, error: `${error.name}: ${error.message}${cause}` });
      }
      res.retried = attempt > 0;
      if (this.debugLogging) console.log(`    ${method} ${url.split("?")[0]} -> ${res.status || res.error}`);
      // Retry once on transport errors and 5xx: one blip right after a redeploy
      // shouldn't page anyone, but a persistent one should.
      if (res.status !== null && res.status < 500) break;
      if (attempt + 1 < attempts) await sleep(2000);
    }
    return res;
  }

  expect(res, ok = [200], what = "") {
    if (!ok.includes(res.status)) {
      const got = res.status === null ? "no response" : res.status;
      const reason = res.status === null ? res.error : this.errorReason(res);
      throw new CheckError(`${what}HTTP ${got}, expected ${ok.join("/")}: ${reason}`);
    }
    return res;
  }

  asUrl(path, base) {
    const root = (base || this.ctx.asBase).replace(/\/$/, "") + "/";
    return withQuery(root + path.replace(/^\//, ""), { env: this.env === "staging" ? "staging" : undefined });
  }

  // Authority service request, authorized like the app: user token when logged in, static token otherwise.
  mw(path, { method = "GET", body, token, base } = {}) {
    return this.http(this.asUrl(path, base), { method, body, token: token || this.bestToken });
  }

  fabricUrl(path, base) {
    const root = (base || this.ctx.fabricBase).replace(/\/$/, "") + `/s/${this.ctx.qspaceName}/`;
    return withQuery(root + path.replace(/^\//, ""), {
      authorization: this.bestToken,
      env: this.env === "staging" ? "staging" : undefined
    });
  }

  get bestToken() {
    return this.ctx.userToken || this.ctx.staticToken;
  }

  /* ----------------------- Check runner ----------------------- */

  // "METHOD path?query" for display. Authority-service calls show just the path; other hosts
  // keep their origin. The authorization param is removed so tokens never reach the output.
  displayPath(method, url) {
    try {
      const u = new URL(url);
      u.searchParams.delete("authorization");
      const asOrigin = this.ctx.asBase ? new URL(this.ctx.asBase).origin : null;
      const where = u.origin === asOrigin ? u.pathname : u.origin + u.pathname;
      return `${method} ${where}${u.search ? decodeURIComponent(u.search) : ""}`;
    } catch (e) {
      return `${method} ${url.split("?")[0]}`;
    }
  }

  record(result) {
    // Real request when the check made one (the last, if it made several); else the endpoint template.
    result.path = result.path || result.endpoint || "-";
    this.results.push(result);
    const ms = result.ms !== undefined && result.ms !== null ? `${Math.round(result.ms)}ms` : "";
    let line = `  [${result.status.padEnd(4)}] ${result.path}`;
    line += `\n         ${ms.padStart(7)}  ${result.name}`;
    if (result.detail) line += `  — ${result.detail}`;
    console.log(line);
  }

  async check(name, { endpoint = "", usedBy = "", scope = "global", needs = [], ctx } = {}, fn) {
    const c = ctx || this.ctx;
    const base = { scope, name, endpoint, usedBy };
    const missing = needs.filter((k) => c[k] === undefined || c[k] === null);
    if (missing.length) {
      this.record({ ...base, status: SKIP, detail: `needs ${missing.join(", ")}` });
      return;
    }
    this.requests = [];
    try {
      const out = (await fn()) || {};
      base.path = this.requests[this.requests.length - 1];
      const res = out.res;
      let status = out.status || PASS;
      let detail = out.detail || "";
      if (status === PASS && res && res.ms > this.slowMs) {
        status = WARN;
        detail = `slow (${res.ms}ms > ${this.slowMs}ms) ${detail}`.trim();
      }
      if (status === PASS && res && res.retried) {
        status = WARN;
        detail = `passed on retry ${detail}`.trim();
      }
      this.record({ ...base, status, detail, ms: res ? res.ms : out.ms });
    } catch (error) {
      base.path = this.requests[this.requests.length - 1];
      if (error instanceof Skip) {
        this.record({ ...base, status: SKIP, detail: error.message });
      } else if (error instanceof CheckError) {
        this.record({ ...base, status: FAIL, detail: error.message });
      } else {
        this.record({ ...base, status: FAIL, detail: `${error.name || "Error"}: ${error.message || JSON.stringify(error)}` });
      }
    }
  }

  async timed(fn) {
    const start = Date.now();
    const value = await fn();
    return { value, ms: Date.now() - start };
  }

  /* ----------------------- Entry point ----------------------- */

  async Run({ privateKey, jwt, token, tenantId, propertyIds = [], maxProperties }) {
    this.ctx.requestedTenant = tenantId;
    console.log(`== Global checks (${this.network}, ${this.env}) ==`);
    await this.checkConfig();
    if (!this.ctx.asBase) return this.summary();

    await this.authenticate({ privateKey, jwt, token, tenantId });
    if (this.ctx.abort) return this.summary();

    await this.checkPropertyList();

    let properties = this.ctx.properties || [];
    if (propertyIds.length) {
      properties = propertyIds.map((id) => properties.find((p) => p.id === id) || { id });
    }
    properties = this.scopeProperties(properties, propertyIds);
    if (maxProperties) properties = properties.slice(0, maxProperties);
    // Node sweep and activation use the first property: make it one of the tested ones.
    if (properties.length) this.ctx.properties = properties;

    await this.checkNodeSweep();
    await this.checkLogin();
    await this.checkMisc();
    await this.checkAuthenticated({
      tenantId: this.ctx.tenantIten || this.ctx.scopeTenantIten || this.ctx.scopeTenant || tenantId
    });

    for (const p of properties) {
      console.log(`\n== Property ${p.name || p.title || ""} (${p.id}) ==`);
      await this.checkProperty(p.id);
    }

    await this.releaseSession();
    return this.summary();
  }

  /* ----------------------- Global checks ----------------------- */

  async checkConfig() {
    await this.check("Fabric config", { endpoint: `GET ${this.configUrl}`, usedBy: "FabricConfigStore.refreshConfig" }, async () => {
      const res = this.expect(await this.http(this.configUrl));
      const cfg = res.json();
      const services = (cfg.network || {}).services || {};
      for (const key of ["authority_service", "fabric_api"]) {
        if (!(services[key] || []).length) throw new CheckError(`config has no network.services.${key}`);
      }
      const qspace = cfg.qspace || {};
      if (!String(qspace.id || "").startsWith("ispc") || !(qspace.names || []).length) {
        throw new CheckError(`config has unexpected qspace: ${JSON.stringify(qspace)}`);
      }
      this.ctx.asHosts = services.authority_service;
      this.ctx.fabricHosts = services.fabric_api;
      // The apps always use the first entry of each list.
      this.ctx.asBase = services.authority_service[0];
      this.ctx.fabricBase = services.fabric_api[0];
      this.ctx.qspaceName = qspace.names[0];
      // Same anonymous token the apps build when logged out.
      this.ctx.staticToken = Buffer.from(JSON.stringify({ qspace_id: qspace.id })).toString("base64");
      return {
        res,
        detail: `${services.authority_service.length} AS nodes, ${services.fabric_api.length} fabric nodes`
      };
    });
  }

  async authenticate({ privateKey, jwt, token, tenantId }) {
    if (token) {
      this.ctx.userToken = token;
      this.ctx.authMode = "token";
      this.record({ scope: "global", name: "Auth: provided fabric token", status: PASS, detail: "using --token" });
      return;
    }

    if (jwt) {
      this.ctx.authMode = "jwt";
      const client = await ElvClient.FromConfigurationUrl({ configUrl: this.configUrl });
      client.ToggleLogging(this.debugLogging);
      this.client = client;

      await this.check("Auth: login with JWT", { endpoint: "POST wlt/login/jwt", usedBy: "Ory/Auth0 login" }, async () => {
        // Ory ID tokens live ~10 minutes; say so plainly instead of a bare 401.
        let claims = {};
        try {
          claims = JSON.parse(Buffer.from(jwt.split(".")[1], "base64url").toString("utf-8"));
        } catch (e) {
          throw new CheckError("--jwt / ELV_JWT is not a valid JWT");
        }
        if (claims.exp && claims.exp * 1000 < Date.now()) {
          const ago = Math.round((Date.now() - claims.exp * 1000) / 60000);
          throw new CheckError(
            `JWT expired at ${new Date(claims.exp * 1000).toISOString()} (${ago} min ago); get a fresh ID token`
          );
        }
        // Call the login ourselves (same body elv-client sends) so the response can be checked;
        // SetRemoteSigner only keeps addr/eth/token and drops the rest.
        const body = { ext: { share_email: false } };
        if (tenantId) body.tid = tenantId;
        const res = await this.mw("wlt/login/jwt", { method: "POST", body, token: jwt });
        if (res.status === 401 || res.status === 403) {
          throw new CheckError(`login rejected (HTTP ${res.status}): ${this.errorReason(res) || "unauthorized"}`);
        }
        this.expect(res);
        const login = res.json() || {};

        // Fields the apps need: a missing one breaks login outright.
        const missing = [];
        if (!/^0x[0-9a-fA-F]{40}$/.test(login.addr || "")) missing.push("addr");
        if (!login.eth) missing.push("eth");
        if (!login.token) missing.push("token");
        if (missing.length) throw new CheckError(`login response missing/invalid: ${missing.join(", ")}`);

        this.ctx.clusterToken = login.token;
        this.ctx.loginAddress = login.addr.toLowerCase();
        this.ctx.tenantBinding = login.tenant_binding;

        // Identity fields seen in a healthy response: losing one is worth a warning, not a failure.
        const absent = ["pubkey", "ident", "subject", "issuer_id"].filter((k) => !login[k]);
        const left = claims.exp ? `, JWT valid ${Math.round((claims.exp * 1000 - Date.now()) / 60000)} more min` : "";
        return {
          res,
          status: absent.length ? WARN : PASS,
          detail: `address ${login.addr}${left}${absent.length ? `; response lacks ${absent.join(", ")}` : ""}`
        };
      });
      // Without a session the rest would silently run logged out, which isn't what was asked for.
      if (!this.ctx.clusterToken) {
        this.ctx.abort = true;
        return;
      }

      // Hand the cluster token to elv-client: it loads the signing key from wlt/keys instead of logging in again.
      await this.check("Auth: load signer keys", { endpoint: "GET wlt/keys", usedBy: "remote signer" }, async () => {
        let result;
        try {
          result = await this.timed(() =>
            client.SetRemoteSigner({ authToken: this.ctx.clusterToken, tenantId, unsignedPublicAuth: true })
          );
        } catch (error) {
          throw new CheckError(`wlt/keys failed: ${error.message || error.status || error}`);
        }
        const address = (client.CurrentAccountAddress() || "").toLowerCase();
        if (address !== this.ctx.loginAddress) {
          throw new CheckError(`wlt/keys address ${address} doesn't match login address ${this.ctx.loginAddress}`);
        }
        return { ms: result.ms, detail: "address matches login" };
      });
      if (!client.signer || !client.signer.authToken) {
        this.ctx.abort = true;
        return;
      }

      await this.resolveJwtTenant({ tenantId });
      if (this.ctx.abort) return;
      // From here on, tenant-scoped calls use the bound tenant (iten form when known).
      const boundTenant = this.ctx.tenantIten || this.ctx.scopeTenant || tenantId;

      // Raw nonce, like the apps' install ID; the client sends its SHA-512 as install_id.
      this.ctx.nonce = crypto.randomUUID();
      await this.check(
        "Auth: issue CSAT",
        { endpoint: "POST wlt/sign/csat", usedBy: "login (fabric token)", needs: ["clusterToken"] },
        async () => {
          const { value, ms } = await this.timed(() =>
            client.signer.RetrieveCSAT({
              nonce: this.ctx.nonce,
              tenantId: boundTenant,
              duration: 1,
              appName: "elv-mediawallet api-test"
            })
          );
          if (!value || !value.token) throw new CheckError(`no token in response: ${JSON.stringify(value)}`);
          this.ctx.userToken = value.token;
          this.ctx.refreshToken = value.refresh_token;
          const tid = boundTenant ? `, tid ${boundTenant}` : ", no tid";
          return { ms, detail: `${value.refresh_token ? "token + refresh_token" : "token (no refresh_token)"}${tid}` };
        }
      );

      await this.check(
        "Auth: refresh CSAT",
        { endpoint: "POST wlt/refresh/csat", usedBy: "NetworkManager.refreshToken", needs: ["userToken", "refreshToken"] },
        async () => {
          // Uses this run's own fresh session, so rotating its refresh token is harmless.
          const { value, ms } = await this.timed(() =>
            client.signer.RefreshCSAT({
              accessToken: this.ctx.userToken,
              refreshToken: this.ctx.refreshToken,
              nonce: this.ctx.nonce
            })
          );
          if (!value || !value.token || !value.refresh_token) {
            throw new CheckError(`unexpected response: ${JSON.stringify(value)}`);
          }
          this.ctx.userToken = value.token;
          this.ctx.refreshToken = value.refresh_token;
          return { ms, detail: "new token issued" };
        }
      );
      return;
    }

    if (privateKey) {
      this.ctx.authMode = "private_key";
      await this.check("Auth: sign fabric token with private key", { usedBy: "external wallet login" }, async () => {
        const client = await ElvClient.FromConfigurationUrl({ configUrl: this.configUrl });
        client.ToggleLogging(this.debugLogging);
        const wallet = client.GenerateWallet();
        client.SetSigner({ signer: wallet.AddAccount({ privateKey }) });
        this.client = client;
        const { value, ms } = await this.timed(() => client.CreateFabricToken({ duration: 60 * 60 * 1000 }));
        this.ctx.userToken = value;
        return { ms, detail: `address ${client.CurrentAccountAddress()}` };
      });
      await this.resolveAccountTenant({ tenantId });
      return;
    }

    this.ctx.authMode = "anonymous";
    this.record({
      scope: "global",
      name: "Auth",
      status: SKIP,
      detail: "anonymous (pass --jwt, --token or set PRIVATE_KEY to test as a user)"
    });
  }

  /* A private key belongs to one tenant: read it from the account's wallet object
     so the run only covers that tenant's properties. */
  async resolveAccountTenant({ tenantId }) {
    await this.check(
      "Auth: account tenant",
      { endpoint: "user wallet tenant_contract_id", usedBy: "tenant scoping", needs: ["userToken"] },
      async () => {
        let accountTenant;
        let lookupError;
        const { ms } = await this.timed(async () => {
          try {
            accountTenant = await this.client.userProfileClient.TenantContractId();
          } catch (error) {
            lookupError = error.message || String(error);
          }
        });

        if (accountTenant && tenantId && accountTenant !== tenantId) {
          this.ctx.abort = true;
          throw new CheckError(`account belongs to ${accountTenant}, not --tenant_id ${tenantId}`);
        }
        if (accountTenant) {
          this.ctx.scopeTenant = accountTenant;
          return { ms, detail: accountTenant };
        }
        if (tenantId) {
          this.ctx.scopeTenant = tenantId;
          return {
            ms,
            status: WARN,
            detail: `couldn't read the account's tenant (${lookupError || "not set"}), using --tenant_id ${tenantId}`
          };
        }
        this.ctx.abort = true;
        throw new CheckError(
          `account has no tenant (${lookupError || "tenant_contract_id not set"}); ` +
            "use a key that belongs to a tenant, or pass --tenant_id"
        );
      }
    );
  }

  /* A JWT login reports the tenant the user is bound to (tenant_binding), so a JWT
     run covers that tenant's properties, like a private-key run does. */
  async resolveJwtTenant({ tenantId }) {
    const binding = this.ctx.tenantBinding;
    const bound = binding && typeof binding === "object" ? binding.tenant_id || binding.tenant_iten : binding;
    const base = { scope: "global", name: "Auth: tenant binding", endpoint: "POST wlt/login/jwt (tenant_binding)", usedBy: "tenant scoping" };

    if (!bound) {
      if (tenantId) {
        this.ctx.scopeTenant = tenantId;
        if (tenantId.startsWith("iten")) this.ctx.tenantIten = tenantId;
        this.record({ ...base, status: WARN, detail: `login has no tenant_binding, using --tenant_id ${tenantId}` });
      } else {
        this.record({ ...base, status: PASS, detail: "user has no tenant binding; testing all properties" });
      }
      return;
    }

    // Tenant-scoped APIs (wlt/sign/csat tid, wlt/status/act/{tenant}) take the iten form, like Android.
    let iten = (binding && binding.tenant_iten) || (String(bound).startsWith("iten") ? bound : undefined);
    let iqId = String(bound).startsWith("iq__") ? bound : undefined;
    if (!iten || !iqId) {
      // The two forms aren't derivable from each other; the property list carries both.
      const res = await this.http(this.asUrl("mw/properties?include_public=true"), { token: this.ctx.staticToken });
      const match = (((res.status === 200 && res.json()) || {}).contents || [])
        .map((p) => p.tenant || {})
        .find((t) => [t.tenant_id, t.tenant_iten].includes(bound));
      if (match) {
        iten = iten || match.tenant_iten;
        iqId = iqId || match.tenant_id;
      }
    }

    if (tenantId && ![bound, iten, iqId].includes(tenantId)) {
      this.ctx.abort = true;
      this.record({ ...base, status: FAIL, detail: `user is bound to ${iten || bound}, not --tenant_id ${tenantId}` });
      return;
    }

    this.ctx.scopeTenant = bound;
    this.ctx.tenantIten = iten;
    if (!iten) {
      this.record({
        ...base,
        status: WARN,
        detail: `bound to ${bound}, but no iten found for it; tenant-scoped calls will use ${bound}`
      });
      return;
    }
    const forms = iqId && iqId !== iten ? `${iten} (${iqId})` : iten;
    this.record({ ...base, status: PASS, detail: `${forms}; used for tid and tenant-scoped APIs` });
  }

  // Keep only the scoped tenant's properties, so a private-key or JWT run tests just the account's tenant.
  scopeProperties(properties, propertyIds) {
    const tenant = this.ctx.scopeTenant;
    if (!tenant) return properties;

    // Properties carry the tenant both as an iten and as its iq__ object ID: match either.
    const tenantOf = (p) => (p.tenant || {}).tenant_iten;
    const belongs = (p) => [(p.tenant || {}).tenant_iten, (p.tenant || {}).tenant_id].includes(tenant);
    const kept = [];
    for (const p of properties) {
      if (belongs(p)) {
        kept.push(p);
      } else if (propertyIds.length) {
        // Only report on the ones the caller asked for; silently drop the rest.
        this.record({
          scope: p.id,
          name: "Property tenant",
          status: SKIP,
          detail: `${p.name || p.id} belongs to ${tenantOf(p) || "an unknown tenant"}, not the account's tenant ${tenant}`
        });
      }
    }
    if (!kept.length) {
      this.record({
        scope: "global",
        name: "Tenant properties",
        status: FAIL,
        detail: `no active properties found for tenant ${tenant}`
      });
    } else {
      const t = kept[0].tenant || {};
      // Redemption status wants the iten form, whichever form the binding used.
      this.ctx.scopeTenantIten = t.tenant_iten || tenant;
      const requested = this.ctx.requestedTenant;
      if (requested && ![t.tenant_iten, t.tenant_id].includes(requested)) {
        this.record({
          scope: "global",
          name: "Tenant properties",
          status: FAIL,
          detail: `--tenant_id ${requested} is not the account's tenant (${t.tenant_iten} / ${t.tenant_id})`
        });
      }
      console.log(`\nScoped to tenant ${this.ctx.scopeTenantIten}${t.tenant_name ? ` (${t.tenant_name})` : ""}: ${kept.length} properties`);
    }
    return kept;
  }

  async checkPropertyList() {
    await this.check(
      "List properties",
      { endpoint: "GET mw/properties?include_public=true", usedBy: "PropertyStore.fetchProperties" },
      async () => {
        const res = this.expect(await this.mw("mw/properties?include_public=true"));
        const contents = (res.json() || {}).contents || [];
        if (!contents.length) throw new CheckError("no properties returned");
        this.ctx.properties = contents;
        return { res, detail: `${contents.length} properties` };
      }
    );

    await this.check("Discover", { endpoint: "GET mw/discover", usedBy: "DiscoverStore" }, async () => {
      const res = this.expect(await this.mw("mw/discover"));
      const body = res.json() || {};
      if (!("contents" in body)) throw new CheckError("response missing 'contents'");
      return { res, detail: `${(body.contents || []).length} entries` };
    });
  }

  /* The apps pin the first node of each list, but config rotation can put any
     of them first, so every listed node has to be serving. */
  async checkNodeSweep() {
    if (this.skipNodeSweep) return;
    const first = (this.ctx.properties || [])[0];
    for (const asHost of this.ctx.asHosts) {
      await this.check(`AS node ${host(asHost)}`, { endpoint: asHost, usedBy: "apiBaseUrl" }, async () => {
        const path = first ? `mw/properties/${first.id}/pages/main` : "mw/discover";
        return { res: this.expect(await this.mw(path, { base: asHost })) };
      });
    }

    const image = first && (first.image || first.header_logo);
    const container = image && image["."] && image["."].container;
    for (const fabricHost of this.ctx.fabricHosts) {
      await this.check(`Fabric node ${host(fabricHost)}`, { endpoint: fabricHost, usedBy: "fabricBaseUrl" }, async () => {
        if (!container) throw new Skip("no property image to read metadata from");
        return { res: this.expect(await this.http(this.fabricUrl(`q/${container}/meta/public/name`, fabricHost))) };
      });
    }
  }

  async checkLogin() {
    const names = ["Device activation: create code", "Device activation: poll", "URL shortener"];
    if (this.readOnly) {
      const endpoints = [
        "POST wlt/login/redirect/metamask",
        "GET wlt/login/redirect/metamask/{code}/{passcode}",
        `POST ${SHORTENER_URL}`
      ];
      names.forEach((name, i) =>
        this.record({ scope: "global", name, endpoint: endpoints[i], status: SKIP, detail: "--read_only" })
      );
      return;
    }
    const pid = ((this.ctx.properties || [])[0] || {}).id || "";

    await this.check(
      names[0],
      { endpoint: "POST wlt/login/redirect/metamask", usedBy: "DeviceActivationFlow.requestActivation" },
      async () => {
        const dest =
          `${this.walletUrl}/login?pid=${pid}&action=login&mode=login&response=code&source=code` +
          "&installId=elv-mediawallet-api-test&origin=elv-mediawallet-api-test";
        // Anonymous like the TV app, which requests the code before anyone logs in.
        const res = this.expect(
          await this.mw("wlt/login/redirect/metamask", {
            method: "POST",
            body: { op: "create", dest },
            token: this.ctx.staticToken
          })
        );
        const body = res.json() || {};
        for (const k of ["id", "passcode", "url", "expiration"]) {
          if (!body[k]) throw new CheckError(`response missing '${k}'`);
        }
        this.ctx.activation = body;
        return { res, detail: `code ${body.id}` };
      }
    );

    await this.check(
      names[1],
      { endpoint: "GET wlt/login/redirect/metamask/{code}/{passcode}", usedBy: "DeviceActivationFlow (poll)", needs: ["activation"] },
      async () => {
        const { id, passcode } = this.ctx.activation;
        const res = await this.mw(`wlt/login/redirect/metamask/${id}/${passcode}`, { token: this.ctx.staticToken });
        // Nobody approved the code, so "pending" is the healthy answer.
        if (res.status === 404 && res.body.includes("authorization_pending")) {
          return { res, detail: "authorization_pending (expected)" };
        }
        throw new CheckError(`expected 404 authorization_pending, got HTTP ${res.status}: ${res.snippet()}`);
      }
    );

    await this.check(names[2], { endpoint: `POST ${SHORTENER_URL}`, usedBy: "UrlShortener.shortenUrl" }, async () => {
      const longUrl = (this.ctx.activation || {}).url || `${this.walletUrl}/login?elv-mediawallet-api-test`;
      const res = this.expect(await this.http(SHORTENER_URL, { method: "POST", rawBody: longUrl }));
      const short = ((res.json() || {}).url_mapping || {}).shortened_url;
      if (!short) throw new CheckError(`no shortened_url: ${res.snippet()}`);
      return { res, detail: short };
    });
  }

  async checkMisc() {
    await this.check("Wallet web app", { endpoint: this.walletUrl, usedBy: "login URL / QR codes" }, async () => {
      return { res: this.expect(await this.http(this.walletUrl, { accept: "text/html" })) };
    });

    await this.check(
      "State store (code fulfillment)",
      { endpoint: "GET {state_store}/code-fulfillment/...", usedBy: "Fabric.redeemFulfillment" },
      async () => {
        const net = this.network === "main" ? "main" : "demov3";
        const res = await this.http(`${STATE_STORE_URL}/code-fulfillment/${net}/fulfill/0x00`);
        // Bogus transaction: the service must answer with a clean 4xx, not 5xx or a timeout.
        if (res.status === null || res.status >= 500) {
          throw new CheckError(`HTTP ${res.status || res.error}: ${res.snippet()}`);
        }
        return { res, detail: `reachable (HTTP ${res.status} for unknown transaction)` };
      }
    );
  }

  async checkAuthenticated({ tenantId }) {
    const names = [
      "Auth: session status",
      "Auth: user NFTs",
      "Auth: user properties",
      "Auth: NFT contract info",
      "Auth: NFT token info",
      "Auth: redemption status"
    ];
    if (!this.ctx.userToken) {
      const endpoints = [
        "POST wlt/login/status",
        "GET apigw/nfts",
        "GET mw/properties?include_public=false",
        "GET nft/info/{contract}",
        "GET nft/info/{contract}/{token}",
        "GET wlt/status/act/{tenant}"
      ];
      names.forEach((name, i) =>
        this.record({ scope: "global", name, endpoint: endpoints[i], status: SKIP, detail: "no user auth" })
      );
      return;
    }
    const token = this.ctx.userToken;

    await this.check(names[0], { endpoint: "POST wlt/login/status", usedBy: "session check" }, async () => {
      if (this.ctx.authMode === "private_key") throw new Skip("self-signed tokens have no server session");
      const res = this.expect(await this.mw("wlt/login/status", { method: "POST", token }));
      const body = res.json() || {};
      if (body.is_active === false) throw new CheckError("session reported inactive");
      return { res, detail: "active" };
    });

    await this.check(names[1], { endpoint: "GET apigw/nfts", usedBy: "Fabric.getNFTs" }, async () => {
      const res = this.expect(await this.mw("apigw/nfts?limit=10", { token }));
      const contents = (res.json() || {}).contents || [];
      this.ctx.nft = contents.find((n) => n.contract_addr && n.token_id_str);
      return { res, detail: `${contents.length} NFTs` };
    });

    await this.check(names[2], { endpoint: "GET mw/properties?include_public=false", usedBy: "PropertyStore.fetchProperties" }, async () => {
      const res = this.expect(await this.mw("mw/properties?include_public=false", { token }));
      return { res, detail: `${((res.json() || {}).contents || []).length} properties` };
    });

    await this.check(names[3], { endpoint: "GET nft/info/{contract}", usedBy: "RemoteSigner.getContractInfo" }, async () => {
      if (!this.ctx.nft) throw new Skip("user owns no NFTs");
      return { res: this.expect(await this.mw(`nft/info/${this.ctx.nft.contract_addr}`, { token })) };
    });

    await this.check(names[4], { endpoint: "GET nft/info/{contract}/{token}", usedBy: "RemoteSigner.getNftInfo" }, async () => {
      if (!this.ctx.nft) throw new Skip("user owns no NFTs");
      const { contract_addr: addr, token_id_str: id } = this.ctx.nft;
      return { res: this.expect(await this.mw(`nft/info/${addr}/${id}`, { token })) };
    });

    // Android's route. tvOS's Fabric.getWalletStatus calls "alt/status/act", which 404s.
    await this.check(names[5], { endpoint: "GET wlt/status/act/{tenant}", usedBy: "redemption status (Android)" }, async () => {
      if (!tenantId) throw new Skip("no tenant (no tenant_binding or account tenant; pass --tenant_id)");
      const res = this.expect(await this.mw(`wlt/status/act/${tenantId}`, { token }));
      return { res, detail: `${(res.json() || []).length} redemptions` };
    });
  }

  /* ----------------------- Per-property checks ----------------------- */

  async checkProperty(pid) {
    const scope = pid;
    const p = { pid };
    const opts = (extra) => ({ scope, ctx: p, ...extra });

    await this.check("Property detail", opts({ endpoint: "GET mw/properties/{id}", usedBy: "PropertyStore.fetchProperty" }), async () => {
      const res = this.expect(await this.mw(`mw/properties/${pid}`));
      const body = res.json() || {};
      if (body.id !== pid) throw new CheckError(`returned id ${JSON.stringify(body.id)}`);
      p.property = body;
      p.pageId = (body.main_page || {}).id || "main";
      return { res, detail: body.name || "" };
    });

    await this.check(
      "Property page",
      opts({ endpoint: "GET mw/properties/{id}/pages/{page}", usedBy: "PropertyStore.fetchPage", needs: ["pageId"] }),
      async () => {
        const res = this.expect(await this.mw(`mw/properties/${pid}/pages/${p.pageId}`));
        const ids = ((res.json() || {}).layout || {}).sections || [];
        if (!ids.length) throw new CheckError("page layout has no sections");
        p.sectionIds = ids;
        return { res, detail: `${ids.length} sections` };
      }
    );

    await this.check(
      "Property sections",
      opts({ endpoint: "POST mw/properties/{id}/sections", usedBy: "PropertyStore.fetchSections", needs: ["sectionIds"] }),
      async () => {
        const res = this.expect(
          await this.mw(`mw/properties/${pid}/sections?resolve_subsections=true`, { method: "POST", body: p.sectionIds })
        );
        const contents = (res.json() || {}).contents || [];
        if (!contents.length) throw new CheckError("no sections returned");
        p.sections = contents;
        return { res, detail: `${contents.length} sections resolved` };
      }
    );

    await this.check(
      "Search filters",
      opts({ endpoint: "GET mw/properties/{id}/filters", usedBy: "PropertySearchStore", needs: ["property"] }),
      async () => {
        const res = this.expect(await this.mw(`mw/properties/${pid}/filters`));
        res.json();
        return { res };
      }
    );

    await this.check(
      "Search",
      opts({ endpoint: "POST mw/properties/{id}/search", usedBy: "PropertySearchStore.search", needs: ["property"] }),
      async () => {
        const res = this.expect(
          await this.mw(`mw/properties/${pid}/search?limit=30`, { method: "POST", body: { search_term: "a" } })
        );
        const body = res.json() || {};
        if (!("contents" in body)) throw new CheckError("response missing 'contents'");
        return { res, detail: `${(body.contents || []).length} result sections` };
      }
    );

    await this.check(
      "Multiview live sidebar",
      opts({ endpoint: "POST mw/properties/{id}/sidebar/live", usedBy: "MultiviewFetcher", needs: ["property"] }),
      async () => {
        const res = this.expect(await this.mw(`mw/properties/${pid}/sidebar/live`, { method: "POST" }));
        if (!("contents" in (res.json() || {}))) throw new CheckError("response missing 'contents'");
        return { res };
      }
    );

    await this.checkPlayback(p, opts);

    await this.check("Fabric image", opts({ endpoint: "GET {fabric}/q/{hash}/files/...", usedBy: "image loading", needs: ["property"] }), async () => {
      const img = p.property.image_tv || p.property.image || p.property.header_logo || {};
      const container = (img["."] || {}).container;
      const file = (img["/"] || "").replace(/^\.?\//, "");
      if (!container || !file) throw new Skip("property has no fabric image link");
      const path = `q/${container}/${file.split("/").map(encodeURIComponent).join("/")}`;
      const res = this.expect(await this.http(withQuery(this.fabricUrl(path), { height: 100 }), { accept: "image/*" }));
      const head = res.body.subarray(0, 1).toString();
      if (head === "<" || head === "{") throw new CheckError(`not an image: ${res.snippet(80)}`);
      return { res, detail: `${res.body.length} bytes` };
    });
  }

  // Videos that should be playable: they have a media_link (upcoming live events
  // don't until the stream is attached). VoD first, since live windows come and go.
  videosIn(sections) {
    const out = [];
    const seen = new Set();
    for (const s of sections || []) {
      for (const item of s.content || []) {
        const media = item.media || {};
        if (media.media_type === "Video" && media.id && media.media_link && !seen.has(media.id)) {
          seen.add(media.id);
          out.push({ mediaId: media.id, sectionId: s.id, live: !!media.live_video });
        }
      }
    }
    return out.sort((a, b) => a.live - b.live);
  }

  // Short reason from a middleware error body, e.g. "media_link is not an object".
  errorReason(res) {
    try {
      // Walk the cause chain; the innermost entries say what actually went wrong.
      const parts = [];
      let node = (res.json() || {}).error;
      while (node && parts.length < 6) {
        if (typeof node === "string") {
          parts.push(node);
          break;
        }
        if (node.op) parts.push(node.op);
        node = node.cause;
      }
      return parts.length ? parts.slice(-2).join(": ") : res.snippet(120);
    } catch (e) {
      return res.snippet(120);
    }
  }

  async checkPlayback(p, opts) {
    const pid = p.pid;
    const videos = this.videosIn(p.sections);
    p.media = videos[0];

    await this.check(
      "Media items",
      opts({ endpoint: "POST mw/properties/{id}/media_items", usedBy: "MediaItemStore", needs: ["media"] }),
      async () => {
        const ids = videos.slice(0, 10).map((v) => v.mediaId);
        const res = this.expect(await this.mw(`mw/properties/${pid}/media_items`, { method: "POST", body: ids }));
        const contents = (res.json() || {}).contents || [];
        if (!contents.length) throw new CheckError("no media items returned");
        return { res, detail: `${contents.length}/${ids.length} items` };
      }
    );

    await this.check(
      "Autoplay next",
      opts({ endpoint: "POST mw/properties/{id}/autoplay/next", usedBy: "AutoplayStore", needs: ["media"] }),
      async () => {
        const res = this.expect(
          await this.mw(`mw/properties/${pid}/autoplay/next`, {
            method: "POST",
            body: { media_id: p.media.mediaId, section_id: p.media.sectionId }
          })
        );
        if (!("contents" in (res.json() || {}))) throw new CheckError("response missing 'contents'");
        return { res, detail: `${(res.json().contents || []).length} candidates` };
      }
    );

    await this.check(
      "Playout options",
      opts({
        endpoint: "GET mw/properties/{id}/media_items/{m}/offerings/any/playout_options",
        usedBy: "Fabric.getMediaPlayoutOptions",
        needs: ["media"]
      }),
      async () => {
        // Gated videos answer 403 for users without the entitlement, so look for
        // one this account can play before calling it unhealthy.
        // A single misconfigured item (4xx) is a content problem, not an outage:
        // note it and keep looking; 5xx or no response fails right away.
        let denied = 0;
        const broken = [];
        let last;
        for (const v of videos.slice(0, this.mediaScan)) {
          const res = await this.mw(`mw/properties/${pid}/media_items/${v.mediaId}/offerings/any/playout_options`);
          last = res;
          if (res.status === 403 && res.body.includes("permission denied")) {
            denied++;
            continue;
          }
          if (res.status !== null && res.status >= 400 && res.status < 500) {
            broken.push(`${v.mediaId} (HTTP ${res.status}: ${this.errorReason(res)})`);
            continue;
          }
          this.expect(res, [200], `media ${v.mediaId}: `);
          const options = res.json() || {};
          const key = HLS_KEYS.find((k) => k in options);
          if (!key) {
            broken.push(`${v.mediaId} (no HLS format in ${Object.keys(options).join(", ")})`);
            continue;
          }
          p.playout = options;
          p.hlsKey = key;
          p.playable = v;
          const notes = [denied && `${denied} gated skipped`, broken.length && `broken: ${broken.join("; ")}`].filter(Boolean);
          return {
            res,
            status: broken.length ? WARN : PASS,
            detail: `${v.mediaId}: ${key}${notes.length ? ` (${notes.join(", ")})` : ""}`
          };
        }
        if (broken.length) {
          throw new CheckError(`no playable video; broken: ${broken.join("; ")}${denied ? `; ${denied} gated` : ""}`);
        }
        return {
          res: last,
          status: WARN,
          detail: `none of ${denied} videos playable for ${this.ctx.authMode} user (403 permission denied)`
        };
      }
    );

    await this.check(
      "HLS master playlist",
      opts({ endpoint: "GET {fabric}/q/{hash}/rep/playout/.../playlist.m3u8", usedBy: "AVPlayer", needs: ["playout"] }),
      async () => {
        const uri = p.playout[p.hlsKey].uri;
        const url = uri.startsWith("q/") ? this.fabricUrl(uri) : withQuery(uri, { authorization: this.bestToken });
        const res = this.expect(await this.http(url, { accept: "*/*" }));
        if (!res.body.subarray(0, 7).equals(Buffer.from("#EXTM3U"))) {
          throw new CheckError(`not an HLS playlist: ${res.snippet(80)}`);
        }
        const hash = uri.startsWith("q/") ? uri.split("/")[1] : null;
        if (hash && hash.startsWith("hq__")) p.versionHash = hash;
        return { res, detail: "#EXTM3U" };
      }
    );

    await this.check(
      "Playout options by hash",
      opts({ endpoint: "GET mw/playout_options/{hash}", usedBy: "Fabric.getOptionsFromHash", needs: ["versionHash"] }),
      async () => {
        const res = this.expect(await this.mw(`mw/playout_options/${p.versionHash}`));
        if (!HLS_KEYS.some((k) => k in (res.json() || {}))) throw new CheckError("no HLS format returned");
        return { res };
      }
    );

    await this.check(
      "FairPlay license server",
      opts({ endpoint: "POST {license_server}", usedBy: "ContentKeyDelegate", needs: ["playout"] }),
      async () => {
        const servers = [];
        for (const key of ["hls-fairplay", "hls-sample-aes"]) {
          const props = (p.playout[key] || {}).properties || {};
          servers.push(...(props.license_servers || []));
        }
        if (!servers.length) throw new Skip("playable media has no FairPlay offering");
        // A bogus SPC must be rejected by the license server, not time out or 5xx.
        const res = await this.http(servers[0], {
          method: "POST",
          body: { spc: "", assetId: "" },
          token: this.bestToken,
          retry: false
        });
        if (res.status === null || res.status >= 500) {
          throw new CheckError(`license server unhealthy: ${res.status || res.error}`);
        }
        return { res, detail: `reachable (HTTP ${res.status} for bogus SPC)` };
      }
    );
  }

  /* ----------------------- Teardown & reporting ----------------------- */

  async releaseSession() {
    if (this.ctx.authMode !== "jwt" || !this.ctx.userToken) return;
    await this.check("Auth: release CSAT", { endpoint: "POST wlt/login/release", usedBy: "sign out" }, async () => {
      const { ms } = await this.timed(() => this.client.signer.ReleaseCSAT({ accessToken: this.ctx.userToken }));
      return { ms, detail: "session created by this run released" };
    });
  }

  summary() {
    const counts = { PASS: 0, WARN: 0, FAIL: 0, SKIP: 0 };
    this.results.forEach((r) => counts[r.status]++);
    console.log(
      `\n${counts.PASS} passed, ${counts.WARN} warnings, ${counts.FAIL} failed, ${counts.SKIP} skipped`
    );
    const failed = this.results.filter((r) => r.status === FAIL);
    if (failed.length) {
      console.log("\nFailures:");
      failed.forEach((r) => console.log(`  [FAIL] ${r.path}\n         ${r.scope}: ${r.name} — ${r.detail}`));
    }
    return { counts, results: this.results };
  }

  WriteJunit(filePath) {
    const esc = (s) =>
      String(s || "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;");
    const groups = {};
    this.results.forEach((r) => (groups[r.scope] = groups[r.scope] || []).push(r));
    const out = ["<?xml version=\"1.0\" encoding=\"UTF-8\"?>", "<testsuites>"];
    for (const [scope, rs] of Object.entries(groups)) {
      const fails = rs.filter((r) => r.status === FAIL).length;
      const skips = rs.filter((r) => r.status === SKIP).length;
      const name = `api-test.${this.network}.${scope}`;
      out.push(`  <testsuite name="${esc(name)}" tests="${rs.length}" failures="${fails}" skipped="${skips}">`);
      for (const r of rs) {
        out.push(`    <testcase classname="${esc(name)}" name="${esc(r.name)}" time="${((r.ms || 0) / 1000).toFixed(3)}">`);
        if (r.status === FAIL) out.push(`      <failure message="${esc(r.detail)}">${esc(r.path)}</failure>`);
        if (r.status === SKIP) out.push(`      <skipped message="${esc(r.detail)}"/>`);
        if (r.status === WARN) out.push(`      <system-out>WARN: ${esc(r.detail)}</system-out>`);
        out.push("    </testcase>");
      }
      out.push("  </testsuite>");
    }
    out.push("</testsuites>");
    fs.writeFileSync(filePath, out.join("\n") + "\n");
  }

  WriteJson(filePath) {
    fs.writeFileSync(filePath, JSON.stringify(this.results, null, 2));
  }
}

exports.ApiTestService = ApiTestService;
exports.ApiTestStatus = { PASS, WARN, FAIL, SKIP };
