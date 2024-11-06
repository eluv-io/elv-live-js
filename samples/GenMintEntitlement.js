const { ElvClient, Utils} = require("@eluvio/elv-client-js");
const crypto = require("crypto");
const { ethers } = require('ethers');
const bs58 = require("bs58");

let client;

/* Sample configuration */
let tenant = "iten4TXq2en3qtu3JREnE5tSLRf9zLod";
let marketplaceObjectId = "iq__2dXeKyUVhpcsd1RM6xaC1jdeZpyr";
let sku = "C9Zct19CoEAZYWug9tyavX";
let amount = 1;
let user = "sample.user@example.com";
let purchaseId = "pid_e852572c6e84626892da049a";

/**
 * Generate a mint entitlement
 *
 * @param {string} tenant - tenant ID in 'iten' format
 * @param {string} marketplaceObjectId - marketplace object ID in 'iq__' format
 * @param {string} sku - SKU of the item
 * @param {number} amount - number of items of that SKU
 * @param {string} user - user ID in any format, usually the 'sub' of the id/access token; an email, username,  address, etc.
 * @returns {Promise<Object>} - the entitlement JSON and signature
 */
const Entitlement = async({tenant, marketplaceObjectId, sku, amount, user, purchaseId}) => {
  const message = {
    tenant_id: tenant,
    marketplace_id: marketplaceObjectId,
    items: [ { sku: sku, amount: amount } ],
    user: user,
    purchase_id: purchaseId,
  };
  const sig = await CreateSignedMessageJSON({client, obj: message});

  return { entitlement_json: message, signature: sig };
};


// Create a signed JSON message
const CreateSignedMessageJSON = async ({
    client,
    obj,
}) => {
    // Only one kind of signature supported currently
    const type = `mje_` // JSON message, EIP192 signature
    const msg = JSON.stringify(obj);

    const signature = await client.PersonalSign({message: msg, addEthereumPrefix: true});
    return `${type}${Utils.B58(
      Buffer.concat([
        Buffer.from(signature.replace(/^0x/, ""), "hex"),
        Buffer.from(msg)
      ])
    )}`;
};

/**
 * run this as `node GenMintEntitlement.js <tenant> <marketplaceObjectId> <sku> <amount> <user> <purchaseId>`
 */
const Run = async ({}) => {
  try {
    // Initialize client using environment variable PRIVATE_KEY
    client = await ElvClient.FromNetworkName({networkName: "demov3"});
    let wallet = client.GenerateWallet();
    let signer = wallet.AddAccount({
      privateKey: process.env.PRIVATE_KEY
    });
    client.SetSigner({signer});
    client.ToggleLogging(false);
    console.log("SIGNER", client.CurrentAccountAddress());

    tenant = process.argv[2] ?? tenant;
    marketplaceObjectId = process.argv[3] ?? marketplaceObjectId;
    sku = process.argv[4] ?? sku;
    if (process.argv[5]) { amount = parseInt(process.argv[5]); };
    user = process.argv[6] ?? user;
    purchaseId = process.argv[7] ?? purchaseId;

    const { entitlement_json, signature } =
      await Entitlement({tenant, marketplaceObjectId, sku, amount, user, purchaseId});
    console.log("ENTITLEMENT", entitlement_json);
    console.log("ENTITLEMENT_SIGNATURE", signature);

    console.log("ALL DONE");
  } catch (e) {
    console.error("ERROR:", e);
  }
};

Run({});
