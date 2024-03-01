const { ElvClient } = require("@eluvio/elv-client-js");
const crypto = require("crypto");
const { ethers } = require('ethers');
const bs58 = require("bs58");

let client;

/* Sample configuration */
const tenant = "iten4TXq2en3qtu3JREnE5tSLRf9zLod"; // paladin
const marketplaceObjectId = "iq__2dXeKyUVhpcsd1RM6xaC1jdeZpyr"; // A Place for Goats
const sku = "C9Zct19CoEAZYWug9tyavX"; // Goat Pack One
const amount = 1;

const getNonce = () => {
  return "nonce_6f9f53ecc09a7e223cf7d47f";
  return "nonce_" + crypto.randomBytes(12).toString('hex');
};

const getPurchaseId = () => {
  return "pid_e852572c6e84626892da049a";
  return "pid_" + crypto.randomBytes(12).toString('hex');
};

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
const Entitlement = async({tenant, marketplaceObjectId, sku, amount}) => {
  const message = {
    tenant_id: tenant,
    marketplace_id: marketplaceObjectId,
    items: [ { sku: sku, amount: amount } ],
    nonce: getNonce(),
    purchase_id: getPurchaseId(),
  };

  const jsonString = JSON.stringify(message);
  const jsonStringManual = '{"tenant_id":"iten4TXq2en3qtu3JREnE5tSLRf9zLod","marketplace_id":"iq__2dXeKyUVhpcsd1RM6xaC1jdeZpyr","items":[{"sku":"C9Zct19CoEAZYWug9tyavX","amount":1}],"nonce":"nonce_e5b8a4b3f39e776a453d6f8a","purchase_id":"pid_7e72117c3f3d8e669bef50ba"}';
  console.log("jsonString    ", jsonString);
  console.log("jsonStringMan ", jsonStringManual);

  const sig = await client.Sign(jsonString);
  console.log("jsonString sig      ", sig);
  const sigMan = await client.Sign(jsonStringManual);
  console.log("jsonStringMan sigMan", sigMan);

  // console.log("ENTITLEMENT TO SIGN", jsonString);
  //
  // let sig, formattedSig;
  //
  // const hexPrivateKey = process.env.PRIVATE_KEY;
  // const signingKey = new ethers.utils.SigningKey(hexPrivateKey);
  //
  // const signature = signingKey.signDigest(ethers.utils.id("bou"));
  // sig = ethers.utils.joinSignature(signature);
  //
  // sig = await client.Sign(jsonString);
  // formattedSig = sig;
  //
  // //formattedSig = FormatSignature(sig);
  //console.log("SIG", sig, "formattedSign", formattedSig);

  return { entitlement_json: message, signature: sig };
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
    console.log("SIGNER", client.CurrentAccountAddress());
    //console.log("AUTH TOKEN", await client.CreateFabricToken({}));

    const { entitlement_json, signature } = await Entitlement({tenant, marketplaceObjectId, sku, amount});
    console.log("ENTITLEMENT", entitlement_json);
    console.log("ENTITLEMENT SIG", signature);
    //console.log("DECODED", DecodeSignedToken(signature));

    console.log("ALL DONE");
  } catch (e) {
    console.error("ERROR:", e);
  }
};

Run({});
