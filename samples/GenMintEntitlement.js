const { ElvClient } = require("@eluvio/elv-client-js");
const crypto = require("crypto");

let client;

/* Sample configuration */
const tenant = "iten4TXq2en3qtu3JREnE5tSLRf9zLod"; // paladin
const marketplaceObjectId = "iq__2dXeKyUVhpcsd1RM6xaC1jdeZpyr"; // A Place for Goats
const sku = "C9Zct19CoEAZYWug9tyavX"; // Goat Pack One
const amount = 1;

const getNonce = () => {
  return "nonce_" + crypto.randomBytes(12).toString('hex');
};

const getPurchaseId = () => {
  return "pid_" + crypto.randomBytes(12).toString('hex');
};

/**
 * Generate a mint entitlement
 *
 * @param {string} tenant - tenant ID in 'iten' format
 * @param {string} marketplaceObjectId - marketplace object ID in 'iq__' format
 * @param {string} sku - SKU of the item
 * @param {number} amount - number of items of that SKU
 * @returns {Promise<Object>} - the entitlement JSON and signature
 */
const Entitlement = async({tenant, marketplaceObjectId, sku, amount}) => {
  const json = {
    tenantId: tenant,
    marketplaceId: marketplaceObjectId,
    items: [ { sku: sku, amount: amount } ],
    nonce: getNonce(),
    purchaseId: getPurchaseId(),
  };
  const sig = await client.Sign(json);

  return { entitlement_json: json, signature: sig };
};

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

    const { entitlement_json, signature } = await Entitlement({tenant, marketplaceObjectId, sku, amount});
    console.log("ENTITLEMENT", entitlement_json);
    console.log("ENTITLEMENT SIG", signature);

    console.log("ALL DONE");
  } catch (e) {
    console.error("ERROR:", e);
  }
};

Run({});
