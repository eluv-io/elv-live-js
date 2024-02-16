const { ElvClient } = require("@eluvio/elv-client-js");

var client;

/* Sample configuration */
const tenant = "iten4TXq2en3qtu3JREnE5tSLRf9zLod";
const playableObjectId = "iq__2dZdRdqPNQqd7TRuAMNVcTUQ9Mah";
const permissionsObjectId = "iq__2G8JtbyLVUQvG73LWWDMWgBDXvTs";

/**
 * Create NTP instance (class 4)
 *
 * @param {string} tenant - tenant ID in 'iten' format
 * @returns {Promise<Object>} - the NTP ID (string)
 */
const Ntp4Create = async({tenant}) => {

  const ntp = await client.CreateNTPInstance({
    tenantId: tenant,
    objectId: permissionsObjectId,
    ntpClass: 4,
    maxTickets: 0,
    maxRedemptions: 100,
    startTime: "2010-01-01",
    endTime: "2100-01-01",
    ticketLength: 6
  });

  return ntp;
}

/**
 * Update NTP instance parameters (such as start and end times)
 *
 * @param {string} tenant - tenant ID in 'iten' format
 * @param {string} ntp - NTP instance ID (eg. "QOTPGzYBjyWFMYa")
 * @returns {Promise<Object>} - updated NTP info
 */
const Ntp4Update = async({tenant, ntp}) => {
  const newStartTime = "2024-01-01";
  const newEndTime = "2024-12-31";
  const ntpInfo = await client.UpdateNTPInstance({
    tenantId: tenant,
    ntpId: ntp,
    maxTickets: 0,
    maxRedemptions: 100,
    startTime: newStartTime,
    endTime: newEndTime,
  });

  return ntpInfo;
}

/**
 * Generate ticket codes
 *
 * @param {string} tenant - tenant ID in 'iten' format
 * @param {string} ntp - NTP instance ID (eg. "QOTPGzYBjyWFMYa")
 * @param {Object} emails - optional list of emails (eg. ["v1@example.com", "v2@example.com"])
 * @param {number} quantity - number of codes to generate (if no emails specified)
 */
const Ntp4GenerateCodes = async({tenant, ntp, emails, quantity}) => {

  if (emails) {
    quantity = emails.length;
  }

  let codes = [];
  for (let i = 0; i < quantity; i ++) {
    try {
      let code = await client.IssueNTPCode({
        tenantId: tenant,
        ntpId: ntp,
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

/**
 * Generate embed URLs for a specified playable object (live or on-demand).
 *
 * @param {string} objectId - playable object ID (live or on-demand)
 * @param {string} tenant - tenant ID in 'iten' format
 * @param {string} ntp - NTP instance ID (eg. "QOTPGzYBjyWFMYa")
 * @param {Object} codes - codes array, as obtained through Ntp4Generatecodes
 */
const MakeEmbedUrlsWithCodes = async ({objectId, tenant, ntp, codes}) => {

  const urls = [];
  for (let i = 0; i < codes.length; i ++) {
    urls[i] = await client.EmbedUrl({
      objectId,
      mediaType: "video",
      options: {
        tenantId: tenant,
        ntpId: ntp,
        useTicketCodes: true,
        ticketCode: codes[i].token,
        ticketSubject: codes[i].email
      }
    });
  }
  return urls;
}

const Run = async ({}) => {
  try {

    // Initialize client using environment variable PRIVATE_KEY
    client = await ElvClient.FromNetworkName({networkName: "demov3"}); // "demov3" "main"

    let wallet = client.GenerateWallet();
    let signer = wallet.AddAccount({
      privateKey: process.env.PRIVATE_KEY
    });
    client.SetSigner({signer});
    client.ToggleLogging(false);

    // Create a new NTP instance
    const ntp = await Ntp4Create({tenant});
    console.log("NEW NTP", ntp);

    // Generate codes and embed URLs
    const codes = await Ntp4GenerateCodes({tenant, ntp, quantity: 2});
    console.log("CODES", codes);

    const urls = await MakeEmbedUrlsWithCodes({objectId: playableObjectId, tenant, ntp, codes});
    console.log("EMBED URLS", urls);

    // Generate codes that are email-bound and embed URLs
    const codes2 = await Ntp4GenerateCodes({tenant, ntp, emails: ["viewer1@example.com", "viewer2@example.com"]});
    console.log("CODES (EMAIL)", codes2);

    const urls2 = await MakeEmbedUrlsWithCodes({objectId: playableObjectId, tenant, ntp, codes: codes2});
    console.log("EMBED URLS (EMAIL)", urls2);

    const ntpInfo = await Ntp4Update({tenant, ntp});
    console.log("UPDATED NTP", ntpInfo);

    // Clean up - delete NTP instance
    await client.DeleteNTPInstance({
      tenantId: tenant,
      ntpId: ntp
    });

    console.log("ALL DONE");

  } catch (e) {
    console.error("ERROR:", e);
  }
};

Run({});
