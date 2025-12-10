const { Init, elvlv } = require("./Init");
const yaml = require("js-yaml");

const CmdNftShow = async ({ argv }) => {
  console.log("NFT - show");
  console.log("addr ", argv.addr);
  console.log("check_minter ", argv.check_minter);
  console.log("show_owners/show_owners_via_contract", argv.show_owners, argv.show_owners_via_contract);
  console.log("include_email ", argv.include_email);
  console.log("token_id ", argv.token_id);
  try {
    await Init({ debugLogging: argv.verbose, asUrl: argv.as_url });

    let res = await elvlv.NftShow({
      addr: argv.addr,
      mintHelper: argv.check_minter,
      showOwners: argv.show_owners,
      showOwnersViaContract: argv.show_owners_via_contract,
      includeEmail: argv.include_email,
      tokenId: argv.token_id
    });

    console.log(yaml.dump(res));
  } catch (e) {
    console.error("ERROR:", e);
  }
};

const CmdNftBalanceOf = async ({ argv }) => {
  console.log("NFT - call", argv.addr, argv.owner);
  try {
    await Init({ debugLogging: argv.verbose, asUrl: argv.as_url });

    let res = await elvlv.NftBalanceOf({
      addr: argv.addr,
      ownerAddr: argv.owner,
    });

    console.log(yaml.dump(res));
  } catch (e) {
    console.error("ERROR:", e);
  }
};

const CmdNftRefresh = async ({ argv }) => {
  console.log("NFT Refresh");
  console.log(`NFT Refresh\ntenant: ${argv.tenant}}`);
  console.log(`address: ${argv.addr}}`);

  try {
    await Init({ debugLogging: argv.verbose, asUrl: argv.as_url });

    let res = await elvlv.NFTRefresh({
      tenant: argv.tenant,
      address: argv.addr,
    });

    console.log(yaml.dump(res));
  } catch (e) {
    console.error("ERROR:", e);
  }
};

const CmdNftTransfer = async ({ argv }) => {
  console.log(
    "NFT - transer as token owner",
    argv.addr,
    argv.token_id,
    argv.to_addr,
    argv.auth_service
  );
  try {
    await Init({ debugLogging: argv.verbose, asUrl: argv.as_url });

    let res;
    if (argv.auth_service) {
      res = await elvlv.AsNftTransfer({
        addr: argv.addr,
        tokenId: argv.token_id,
        toAddr: argv.to_addr,
      });
    } else {
      res = await elvlv.NftTransfer({
        addr: argv.addr,
        tokenId: argv.token_id,
        toAddr: argv.to_addr,
      });
    }

    console.log(yaml.dump(res));
  } catch (e) {
    console.error("ERROR:", e);
  }
};

const CmdNftProxyTransfer = async ({ argv }) => {
  console.log(
    "NFT - transer as proxy owner",
    argv.addr,
    argv.from_addr,
    argv.to_addr
  );
  try {
    await Init({ debugLogging: argv.verbose, asUrl: argv.as_url });

    let res = await elvlv.NftProxyTransferFrom({
      addr: argv.addr,
      tokenId: argv.token_id,
      fromAddr: argv.from_addr,
      toAddr: argv.to_addr,
    });

    console.log(yaml.dump(res));
  } catch (e) {
    console.error("ERROR:", e);
  }
};

const CmdNftBuild = async ({ argv }) => {
  console.log("NFT - build ");
  console.log("NFT - libraryId ", argv.library);
  console.log("NFT - objectId ", argv.object);
  console.log("NFT - nftDir ", argv.nft_dir);
  try {
    await Init({ debugLogging: argv.verbose, asUrl: argv.as_url });

    let res = await elvlv.NftBuild({
      libraryId: argv.library,
      objectId: argv.object,
      nftDir: argv.nft_dir,
    });

    console.log(yaml.dump(res));
  } catch (e) {
    console.error("ERROR:", e);
  }
};

const CmdNftSetProxy = async ({ argv }) => {
  console.log("NFT - set proxy", argv.addr, argv.proxy_addr);
  try {
    await Init({ debugLogging: argv.verbose, asUrl: argv.as_url });

    let p = await elvlv.NftSetTransferProxy({
      addr: argv.addr,
      proxyAddr: argv.proxy_addr,
    });
    console.log("Proxy: ", p);
  } catch (e) {
    console.error("ERROR:", e);
  }
};

const CmdNftPackGetDist = async ({ argv }) => {
  console.log("NFT - pack get dist");
  console.log("NFT - hash ", argv.hash);
  try {
    await Init({ debugLogging: argv.verbose, asUrl: argv.as_url });

    let res = await elvlv.NftPackGetDist({
      versionHash: argv.hash,
    });

    console.log(yaml.dump(res));
  } catch (e) {
    console.error("ERROR:", e);
  }
};

const CmdNftPackSetDist = async ({ argv }) => {
  console.log("NFT - pack set dist");
  console.log("NFT - hash ", argv.hash);
  try {
    await Init({ debugLogging: argv.verbose, asUrl: argv.as_url });

    let res = await elvlv.NftPackSetDist({
      versionHash: argv.hash,
    });

    console.log(yaml.dump(res));
  } catch (e) {
    console.error("ERROR:", e);
  }
};


const CmdNftBurn = async ({ argv }) => {
  console.log("NFT burn ", argv.addr, argv.token_id);
  try {
    await Init({ debugLogging: argv.verbose, asUrl: argv.as_url });

    let res = await elvlv.NftBurn({
      addr: argv.addr,
      tokenId: argv.token_id,
    });

    console.log(yaml.dump(res));
  } catch (e) {
    console.error(`${e}`);
  }
};

const CmdNftProxyBurn = async ({ argv }) => {
  console.log("NFT Proxy burn ", argv.addr, argv.token_id);
  try {
    await Init({ debugLogging: argv.verbose, asUrl: argv.as_url });

    let res = await elvlv.NftProxyBurn({
      addr: argv.addr,
      tokenId: argv.token_id,
    });

    console.log(yaml.dump(res));
  } catch (e) {
    console.error(`${e}`);
  }
};

const CmdNftSetTransferFee = async ({ argv }) => {
  console.log("NFT Set Transfer Fee");
  console.log(`NFT Contract Address: ${argv.addr}`);
  console.log(`Fee: ${argv.fee}`);

  try {
    await Init({ debugLogging: argv.verbose, asUrl: argv.as_url });

    res = await elvlv.NftSetTransferFee({
      address: argv.addr,
      fee: argv.fee
    });

    console.log(yaml.dump(res));
  } catch (e) {
    console.error("ERROR:", e);
  }
};

const CmdNftGetTransferFee = async ({ argv }) => {
  console.log("NFT Get Transfer Fee");
  console.log(`NFT Contract Address: ${argv.addr}`);

  try {
    await Init({ debugLogging: argv.verbose, asUrl: argv.as_url });

    res = await elvlv.NftGetTransferFee({ address: argv.addr });

    console.log(yaml.dump(res));
  } catch (e) {
    console.error("ERROR:", e);
  }
};

const CmdNftTemplateAddNftContract = async ({ argv }) => {
  console.log(
    "\nNFT Template - set contract",
    "\nObject ID " + argv.object,
    "\nCollection Name " + argv.name,
    "\nCollection Symbol " + argv.symbol,
    "\nTenant ID " + argv.tenant,
    "\nCap " + argv.cap,
    "\nHold " + argv.hold,
    "\nVerbose ", argv.verbose
  );
  try {
    await Init({debugLogging: argv.verbose, asUrl: argv.as_url});

    await elvlv.NftTemplateAddNftContract({
      objectId: argv.object,
      tenantId: argv.tenant,
      totalSupply: argv.cap,
      collectionName: argv.name,
      collectionSymbol: argv.symbol,
      hold: argv.hold,
      contractUri: "",
    });
  } catch (e) {
    console.error("ERROR:", e);
  }
};

const CmdNftAddRedeemableOffer = async ({ argv }) => {
  console.log("NFT Add Redeemable Offer");
  console.log(`NFT Contract Address: ${argv.addr}`);

  try {
    await Init();

    res = await elvlv.NFTAddRedeemableOffer({ addr: argv.addr });

    console.log(yaml.dump(res));
    console.log("added offerId", res?.logs[0]?.args[0] ?? "unknown offerId");
  } catch (e) {
    console.error("ERROR:", e);
  }
};

const CmdNftRemoveRedeemableOffer = async ({ argv }) => {
  console.log("NFT Remove Redeemable Offer");
  console.log(`NFT Contract Address: ${argv.addr}`);
  console.log(`Offer ID: ${argv.id}`);

  try {
    await Init({ debugLogging: argv.verbose, asUrl: argv.as_url });

    res = await elvlv.NFTRemoveRedeemableOffer({ addr: argv.addr,
      offerId:argv.id });

    console.log(yaml.dump(res));
  } catch (e) {
    console.error("ERROR:", e);
  }
};

const CmdNftIsOfferRedeemed = async ({ argv }) => {
  console.log("NFT Is Offer Redeemed");
  console.log(`NFT Contract Address: ${argv.addr}`);
  console.log(`Token ID: ${argv.token_id}`);
  console.log(`Offer ID: ${argv.offer_id}`);

  try {
    await Init({ debugLogging: argv.verbose, asUrl: argv.as_url });

    res = await elvlv.NFTIsOfferRedeemed({ addr: argv.addr,
      tokenId: argv.token_id,
      offerId: argv.offer_id});

    console.log(yaml.dump(res));
  } catch (e) {
    console.error("ERROR:", e);
  }
};

const CmdNftIsOfferActive = async ({ argv }) => {
  console.log("NFT Is Offer Active");
  console.log(`NFT Contract Address: ${argv.addr}`);
  console.log(`Offer ID: ${argv.offer_id}`);

  try {
    await Init({ debugLogging: argv.verbose, asUrl: argv.as_url });

    res = await elvlv.NFTIsOfferActive({ addr: argv.addr,
      offerId:argv.offer_id });

    console.log(yaml.dump(res));
  } catch (e) {
    console.error("ERROR:", e);
  }
};

const CmdNftRedeemOffer = async ({ argv }) => {
  console.log("NFT Redeem Offer");
  console.log(`NFT Contract Address: ${argv.addr}`);
  console.log(`Redeemer Address: ${argv.redeemer}`);
  console.log(`Token ID: ${argv.token_id}`);
  console.log(`Offer ID: ${argv.offer_id}`);

  try {
    await Init({ debugLogging: argv.verbose, asUrl: argv.as_url });

    let res = await elvlv.NFTRedeemOffer({
      addr: argv.addr,
      redeemerAddr: argv.redeemer,
      tokenId: argv.token_id,
      offerId: argv.offer_id,
    });

    console.log(yaml.dump(res));
  } catch (e) {
    console.error("ERROR:", e);
  }
};

const CmdASNftRedeemOffer = async ({ argv }) => {
  console.log("AS NFT Redeem Offer");
  console.log(`NFT Contract Address: ${argv.addr}`);
  console.log(`Tenant ID: ${argv.tenant}`);
  console.log(`Mint Helper Address: ${argv.mint_helper_addr}`);
  console.log(`Token ID: ${argv.token_id}`);
  console.log(`Offer ID: ${argv.offer_id}`);


  try {
    await Init({ debugLogging: argv.verbose, asUrl: argv.as_url });

    let res = await elvlv.ASNFTRedeemOffer({
      addr: argv.addr,
      tenantId: argv.tenant,
      tokenId: argv.token_id,
      offerId: argv.offer_id,
      mintHelperAddr: argv.mint_helper_addr
    });

    console.log(yaml.dump(res));
  } catch (e) {
    console.error("ERROR:", e);
  }
};

const CmdNftGetPolicyPermissions = async ({ argv }) => {
  console.log("NFT Get Policy and Permissions");
  console.log(`Object ID: ${argv.object}`);
  console.log(`verbose: ${argv.verbose}`);

  try {
    await Init({ debugLogging: argv.verbose, asUrl: argv.as_url });

    res = await elvlv.NftGetPolicyAndPermissions({ address: argv.object });

    console.log("\n" + yaml.dump(res));
  } catch (e) {
    console.error("ERROR:", e);
  }
};

const CmdNftSetPolicyPermissions = async ({ argv }) => {
  console.log("NFT Set Policy and Permissions");
  console.log(`Object ID: ${argv.object}`);
  console.log(`Policy file path: ${argv.policy_path}`);
  console.log(`Addresses: ${argv.addrs}`);
  console.log(`verbose: ${argv.verbose}`);
  console.log(`clear: ${argv.clear}`);

  try {
    await Init({ debugLogging: argv.verbose, asUrl: argv.as_url });

    res = await elvlv.NftSetPolicyAndPermissions({
      objectId: argv.object,
      policyPath: argv.policy_path,
      addresses: argv.addrs,
      clearAddresses: argv.clear
    });

    console.log("Success!");
  } catch (e) {
    console.error("ERROR:", argv.verbose ? e : e.message);
  }
};

module.exports = {
  CmdNftShow,
  CmdNftBalanceOf,
  CmdNftRefresh,
  CmdNftTransfer,
  CmdNftProxyTransfer,
  CmdNftBuild,
  CmdNftSetProxy,
  CmdNftPackGetDist,
  CmdNftPackSetDist,
  CmdNftBurn,
  CmdNftProxyBurn,
  CmdNftSetTransferFee,
  CmdNftGetTransferFee,
  CmdNftTemplateAddNftContract,
  CmdNftAddRedeemableOffer,
  CmdNftRemoveRedeemableOffer,
  CmdNftIsOfferRedeemed,
  CmdNftIsOfferActive,
  CmdNftRedeemOffer,
  CmdASNftRedeemOffer,
  CmdNftGetPolicyPermissions,
  CmdNftSetPolicyPermissions
};