const {ElvClient} = require("@eluvio/elv-client-js");

class ElvNtpTickets {
  constructor({ configUrl, debugLogging = false }) {
    this.configUrl = configUrl;
    this.debugLogging = debugLogging;
  }

  async Init({privateKey}) {
    this.client = await ElvClient.FromConfigurationUrl({ configUrl: this.configUrl });
    let wallet = await this.client.GenerateWallet();
    let signer = wallet.AddAccount({ privateKey });
    this.client.SetSigner({ signer });
    this.client.ToggleLogging(this.debugLogging);
    this.client.SetNodes({
        fabricURIs: ["https://host-76-74-29-13.contentfabric.io"],
        ethereumURIs: ["https://host-76-74-29-13.contentfabric.io/eth/"]
    });
  }

  async createNTPInstance({ tenantId, objectId, groupAddresses, ntpClass = 4, maxTickets = 0, maxRedemptions=100, startTime, endTime, ticketLength = 6 }) {
    if (!tenantId) {
      throw new Error("Tenant ID is required to create NTP instance");
    }

    if (!objectId) {
      throw new Error("Object ID is required to create NTP instance");
    }
    if (!startTime || !endTime) {
      throw new Error("Start time and end time are required to create NTP instance");
    }

    if (maxTickets <= 0 || maxRedemptions <= 0) {
      throw new Error("Invalid ticket parameters: maxTickets and maxRedemptions must be greater than 0");
    }

    if (startTime >= endTime) {
      throw new Error("Invalid ticket parameters: startTime must be before endTime");
    }

    const ntp = await this.client.CreateNTPInstance({
      tenantId,
      objectId,
      groupAddresses,
      ntpClass,
      maxTickets,
      maxRedemptions,
      startTime,
      endTime,
      ticketLength
    });
    return ntp;
  }

  async updateNTPInstance({ tenantId, ntpId, maxTickets = 0, maxRedemptions = 100, startTime, endTime }) {
    if (!tenantId) {
      throw new Error("Tenant ID is required to update NTP instance");
    }
    if (!ntpId) {
      throw new Error("NTP ID is required to update NTP instance");
    }
    if (!startTime || !endTime) {
      throw new Error("Start time and end time are required to update NTP instance");
    }

    if (maxTickets <= 0 || maxRedemptions <= 0) {
      throw new Error("Invalid ticket parameters: maxTickets and maxRedemptions must be greater than 0");
    }

    if (startTime >= endTime) {
      throw new Error("Invalid ticket parameters: startTime must be before endTime");
    }
    const ntpInfo = await this.client.UpdateNTPInstance({
      tenantId,
      ntpId,
      maxTickets,
      maxRedemptions,
      startTime,
      endTime
    });
    return ntpInfo;
  }

  async suspendNTPInstance({ tenantId, ntpId }) {
    if (!tenantId) {
      throw new Error("Tenant ID is required to suspend NTP instance");
    }
    if (!ntpId) {
      throw new Error("NTP ID is required to suspend NTP instance");
    }   

    await this.client.SuspendNTPInstance({
      tenantId,
      ntpId
    });
  }

  async deleteNTPInstance({ tenantId, ntpId }) {
    if (!tenantId) {
      throw new Error("Tenant ID is required to delete NTP instance");
    }
    if (!ntpId) {
      throw new Error("NTP ID is required to delete NTP instance");
    }

    await this.client.DeleteNTPInstance({
      tenantId,
      ntpId
    });
  }

  async listNTPInstances({ tenantId, count = 10, offset = 0 }) {
    if (!tenantId) {
      throw new Error("Tenant ID is required to list NTP instances");
    }

    return await this.client.ListNTPInstances({
      tenantId,
      count,
      offset
    });
  }

  async getNTPInstance({ tenantId, ntpId }) {
    if (!tenantId) {
      throw new Error("Tenant ID is required to get NTP instance");
    }
    if (!ntpId) {
      throw new Error("NTP ID is required to get NTP instance");
    }

    const res = await this.client.NTPInstance({
      tenantId,
      ntpId
    });
    return res;
  }

  async reportNTPInstance({ tenantId, ntpId, password, email }) {
    if (!tenantId) {
      throw new Error("Tenant ID is required to get NTP instance");
    }
    if (!ntpId) {
      throw new Error("NTP ID is required to get NTP instance");
    }

    const res = await this.client.ReportNTPInstance({
      tenantId,
      ntpId, 
      password,
      email
    });
    return res;
  }

  async statusNTPInstance({ tenantId, ntpId, code, email }) {
    if (!tenantId) {
      throw new Error("Tenant ID is required to check NTP status");
    }
    if (!ntpId) {
      throw new Error("NTP ID is required to check NTP status");
    }
    if (!code) {
      throw new Error("Code is required to check NTP status");
    }

    return await this.client.NTPStatus({
      tenantId,
      ntpId,
      code,
      email
    });
  }

  async issueNTPCode({ tenantId, ntpId, email, maxRedemptions }) {
    if (!tenantId) {
      throw new Error("Tenant ID is required to issue NTP code");
    }
    if (!ntpId) {
      throw new Error("NTP ID is required to issue NTP code");
    }
    if (!email) {
      throw new Error("Email is required to issue NTP code");
    }
    if (!maxRedemptions) {
      throw new Error("Max redemptions is required to issue NTP code");
    }

    return await this.client.IssueNTPCode({
      tenantId,
      ntpId,
      email,
      maxRedemptions
    });
  }

  async issueSignedNTPCode({ tenantId, ntpId, email, maxRedemptions }) {
    if (!tenantId) {
      throw new Error("Tenant ID is required to issue signed NTP code");
    }
    if (!ntpId) {
      throw new Error("NTP ID is required to issue signed NTP code");
    }
    if (!email) {
      throw new Error("Email is required to issue signed NTP code");
    }
    if (!maxRedemptions) {
      throw new Error("Max redemptions is required to issue signed NTP code");
    }

    return await this.client.IssueSignedNTPCode({
      tenantId,
      ntpId,
      email,
      maxRedemptions
    });
  }

  async redeemCode({ issuer, tenantId, ntpId, code, email, includeNTPId = false }) {
    if (!tenantId) {
      throw new Error("Tenant ID is required to redeem code");
    }
    if (!ntpId) {
      throw new Error("NTP ID is required to redeem code");
    }
    if (!code) {
      throw new Error("Code is required to redeem code");
    }
    if (!email) {
      throw new Error("Email is required to redeem code");
    }

    return await this.client.RedeemCode({
      issuer,
      tenantId,
      ntpId,
      code,
      email,
      includeNTPId
    });
  }

  async generateCodes({ tenantId, ntpId, emails, quantity }) {
    if (!tenantId) {
      throw new Error("Tenant ID is required to generate ticket codes");
    }
    if (!ntpId) {
      throw new Error("NTP ID is required to generate ticket codes");
    }
    if (!emails && !quantity) {
      throw new Error("Either emails or quantity is required to generate ticket codes");
    }

    if (emails) {
      quantity = emails.length;
    }

    let codes = [];
    for (let i = 0; i < quantity; i++) {
      try {
        let code = await this.client.IssueNTPCode({
          tenantId,
          ntpId,
          email: emails ? emails[i] : ""
        });
        if (emails) code.email = emails[i];
        codes.push(code);
      } catch (e) {
        throw new Error("Failed to issue ticket code - " + e.message);
      }
    }
    return codes;
  }

  async makeEmbedUrlsWithCodes({ objectId, tenantId, ntpId, codes }) {
    if (!objectId) {
      throw new Error("Object ID is required to generate embed URLs with codes");
    }
    if (!tenantId) {
      throw new Error("Tenant ID is required to generate embed URLs with codes");
    }
    if (!ntpId) {
      throw new Error("NTP ID is required to generate embed URLs with codes");
    }
    if (!codes || codes.length === 0) {
      throw new Error("At least one code is required to generate embed URLs with codes");
    }

    const urls = [];
    for (let i = 0; i < codes.length; i++) {
      urls[i] = await this.client.EmbedUrl({
        objectId,
        mediaType: "video",
        options: {
          tenantId,
          ntpId,
          useTicketCodes: true,
          ticketCode: codes[i].token,
          ticketSubject: codes[i].email
        }
      });
    }
    return urls;
  }
}

module.exports = { ElvNtpTickets };
