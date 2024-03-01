const { ElvClient } = require("@eluvio/elv-client-js");
const crypto = require("crypto");
const { ethers } = require('ethers');
const bs58 = require("bs58");

let client;

/* Sample configuration */
let tenant = "iten4TXq2en3qtu3JREnE5tSLRf9zLod"; // paladin
let marketplaceObjectId = "iq__2dXeKyUVhpcsd1RM6xaC1jdeZpyr"; // A Place for Goats
let sku = "C9Zct19CoEAZYWug9tyavX"; // Goat Pack One
let amount = 1;
let nonce = "nonce_6f9f53ecc09a7e223cf7d47f";
let purchaseId = "pid_e852572c6e84626892da049a";

const FormatSignature = (sig) => {
  sig = sig.replace("0x", "");
  return "ES256K_" + bs58.encode(Buffer.from(sig, "hex"));
};

// /**
//  * Decode the specified signed token into its component parts
//  * @param {string} token - The token to decode
//  * @return {Object} - Components of the signed token
//  */
// const DecodeSignedToken = (token) => {
//   const decodedToken = Utils.FromB58(token.slice(6));
//   const signature = `0x${decodedToken.slice(0, 65).toString("hex")}`;
//
//   let payload = JSON.parse(Buffer.from(Pako.inflateRaw(decodedToken.slice(65))).toString("utf-8"));
//   payload.adr = Utils.FormatAddress(`0x${Buffer.from(payload.adr, "base64").toString("hex")}`);
//
//   return {
//     payload,
//     signature
//   };
// };


/**
 * Generate a mint entitlement
 *
 * @param {string} tenant - tenant ID in 'iten' format
 * @param {string} marketplaceObjectId - marketplace object ID in 'iq__' format
 * @param {string} sku - SKU of the item
 * @param {number} amount - number of items of that SKU
 * @returns {Promise<Object>} - the entitlement JSON and signature
 */
const Entitlement = async({tenant, marketplaceObjectId, sku, amount, nonce, purchaseId}) => {
  const message = {
    tenant_id: tenant,
    marketplace_id: marketplaceObjectId,
    items: [ { sku: sku, amount: amount } ],
    nonce: nonce,
    purchase_id: purchaseId,
  };

  const jsonString = JSON.stringify(message);
  console.log("ENTITLEMENT TO SIGN", jsonString);
  const sig = await client.Sign(jsonString);

  return { entitlement_json: message, signature: sig };
};

/**
 * run this as `node GenMintEntitlement.js <tenant> <marketplaceObjectId> <sku> <amount> <nonce> <purchaseId>`
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
    //console.log("AUTH TOKEN", await client.CreateFabricToken({}));

    tenant = process.argv[2] ?? tenant;
    marketplaceObjectId = process.argv[3] ?? marketplaceObjectId;
    sku = process.argv[4] ?? sku;
    if (process.argv[5]) { amount = parseInt(process.argv[5]); };
    nonce = process.argv[6] ?? nonce;
    purchaseId = process.argv[7] ?? purchaseId;

    const { entitlement_json, signature } =
      await Entitlement({tenant, marketplaceObjectId, sku, amount, nonce, purchaseId});
    console.log("ENTITLEMENT", entitlement_json);
    console.log("ENTITLEMENT_SIGNATURE", signature);
    //console.log("DECODED", DecodeSignedToken(signature));

    console.log("ALL DONE");
  } catch (e) {
    console.error("ERROR:", e);
  }
};

Run({});
