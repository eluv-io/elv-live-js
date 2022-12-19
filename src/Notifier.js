const { ElvClient } = require("@eluvio/elv-client-js");
const HttpClient = require("@eluvio/elv-client-js/src/HttpClient");
const { Config } = require("./Config.js");
const { ElvAccount } = require("./ElvAccount");
var urljoin = require("url-join");

/**
 * Notifier is a basic SDK for accessing the Eluvio Notification Service
 */
class Notifier {

  /**
   * Instantiate the notifier SDK
   *
   * @namedParams
   * @param {string} notifUrl - The notification service endpoint (optional)
   * @return {EluvioLive} - New ElvNotif object connected to the specified endpoint
   */
  constructor({ notifUrl }) {
    this.notifUrl = notifUrl || Config.consts[Config.net].notificationService;
    this.configUrl = Config.networks[Config.net];
    this.debug = false;
  }

  async Init() {

    // Split the notification service URL into the base URL and path
    // This is needed because HttpClient requires a base URLs
    const url = new URL(this.notifUrl);
    this.notifUrlPath = url.pathname;

    this.HttpClient = new HttpClient({uris: [this.notifUrl], debug: this.debug});

    this.client = await ElvClient.FromConfigurationUrl({
      configUrl: this.configUrl,
    });
    let wallet = this.client.GenerateWallet();
    let signer = wallet.AddAccount({
      privateKey: process.env.PRIVATE_KEY,
    });
    this.client.SetSigner({ signer });
    this.client.ToggleLogging(this.debug);
  }

  async Send({userAddr, tenantId, eventType, nftAddr, tokenId}) {

    const userAddrLC = userAddr.toLowerCase();
    const nftAddrLC = nftAddr.toLowerCase();

    let body = {
      contract: nftAddrLC,
      token: tokenId
    };
    let path = urljoin("/notify_user/", userAddrLC, tenantId, eventType);
    let res = this.Post({path, body});
    return res;
  }

  /**
   * Post a notification
   * @param {*} param0
   * @returns
   */
  async Post({ path, body }) {
    if (!body) {
      body = {};
    }

    let token = await this.client.CreateFabricToken({duration:ElvAccount.TOKEN_DURATION});

    // Temporary - to figure out how to store full endpoint in HttpClient
    path = urljoin(this.notifUrlPath, path);

    let res = await this.HttpClient.Request({
      method: "POST",
      path,
      body,
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    return await res.json();
  }

}

exports.Notifier = Notifier;
