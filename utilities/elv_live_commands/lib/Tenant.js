const { Init, elvlv } = require("./Init");
const yaml = require("js-yaml");
const { exec } = require("child_process");
const { ElvUtils } = require("../../../src/Utils");
const fs = require("fs");
const { Config } = require("../../../src/Config");
const { InitializeTenant, AddConsumerGroup } = require("../../../src/Provision");
const Utils = require("../../../../elv-client-js/src/Utils");
const { Notifier } = require("../../../src/Notifier");

const CmdTenantShow = async ({ argv }) => {
  console.log("Tenant - show", argv.tenant);
  console.log("check_nfts", argv.check_nfts);
  try {
    await Init({ debugLogging: argv.verbose, asUrl: argv.as_url });

    let res = await elvlv.TenantShow({
      tenantId: argv.tenant,
      checkNft: argv.check_nfts,
    });

    console.log(yaml.dump(res));
  } catch (e) {
    console.error("ERROR:", e);
  }
};

const CmdTenantAuthToken = async ({ argv }) => {
  await Init({debugLogging: argv.verbose});

  let ts = Date.now();
  let message = argv.path_or_body + "?ts=" + ts;
  try {
    let j = JSON.parse(argv.path_or_body);
    j.ts = ts;
    message = JSON.stringify(j);
  } catch (e) {}

  const { multiSig } = await elvlv.TenantSign({
    message: message
  });
  console.log(`Timestamped path or body: ${message}`);
  console.log(`Token: Authorization: Bearer ${multiSig}`);
};

const CmdTenantAuthCurl = async ({ argv }) => {
  try {
    await Init({ debugLogging: argv.verbose, asUrl: argv.as_url });

    let res = "";
    if (argv.post_body === "") {
      res = await elvlv.GetServiceRequest({
        path: argv.url_path,
        host: argv.as_url,
      });
    } else {
      res = await elvlv.PostServiceRequest({
        path: argv.url_path,
        host: argv.as_url,
        body: JSON.parse(argv.post_body),
      });
    }
    console.log(await res.json());
  } catch (e) {
    console.error("ERROR:", JSON.stringify(e, null, 2));
  }
};

const CmdTenantPathAuthCurl = async ({ argv }) => {
  await Init({ debugLogging: argv.verbose, asUrl: argv.as_url });

  let ts = Date.now();

  let message = argv.url_path;
  let msgNoArgs = message.includes("?") ? message.split("?")[0] : message;
  let args = message.includes("?") ? ("&" + message.split("?")[1]) : "";
  message = msgNoArgs + "?ts=" + ts + args;

  try {
    let j = JSON.parse(message);
    j.ts = ts;
    message = JSON.stringify(j);
  } catch (e) {}

  const { multiSig } = await elvlv.TenantSign({
    message: message
  });

  let prefix = elvlv.client.authServiceURIs[0];
  if (argv.as_url) {
    prefix = argv.as_url;
  }

  let cmd = `curl -s -H "Authorization: Bearer ${multiSig}" "${prefix}${message}"`;
  if (argv.post_body) {
    cmd = cmd + ` -d '${argv.post_body}'`;
  }
  console.log(cmd);
  exec(cmd, (error, stdout, stderr) => {
    if (error) {
      console.error(`exec error: ${error}`);
      return;
    }
    console.log(stdout);
  });
};

const CmdTenantSetTokenURI = async ({ argv }) => {
  console.log("request_type ", argv.request_type);
  console.log("tenantId ", argv.tenant);
  console.log("contract_address ", argv.contract_address);
  console.log("token_uri ", argv.new_token_uri);
  if (argv?.token_id) {
    console.log("token_id ", argv?.token_id);
  }
  if (argv?.csv) {
    console.log("csv ", argv?.csv);
  }


  try {
    // Validate the token URI from the command line for single, all requests
    if ((argv.request_type != "batch") && (!(ElvUtils.IsValidURI(argv.new_token_uri)))) {
      console.log("Invalid token_uri: ", argv.new_token_uri);
      return;
    }

    await Init({debugLogging: argv.verbose, asUrl: argv.as_url});

    let res = await elvlv.TenantSetTokenURI({
      requestType: argv.request_type,
      tenantId: argv.tenant,
      contractAddress: argv.contract_address,
      tokenURI: argv.new_token_uri,
      tokenId: argv?.token_id,
      csv: argv?.csv,
    });

    if (res) {
      console.log("SUCCESS: ");
      console.log(res);
    } else {
      console.log("ERROR: no response");
    }

  } catch (e) {
    console.error("ERROR: ", e);
  }
};

const CmdTenantUpdateTokenURI = async ({ argv }) => {
  console.log("Contract address", argv.addr);
  console.log("Hash", argv.hash);
  console.log("Dry run", argv.dry_run);

  try {
    await Init({debugLogging: argv.verbose, asUrl: argv.as_url});

    let res = await elvlv.TenantUpdateTokenURI({
      tenantId: argv.tenant,
      contractAddress: argv.addr,
      hash: argv.hash,
      dryRun: argv.dry_run
    });

    console.log(res);

  } catch (e) {
    console.error("ERROR:", e);
  }
};

const CmdTenantBalanceOf = async ({ argv }) => {
  console.log("Tenant - balance of", argv.tenant, argv.owner, argv.max_results);
  try {
    await Init({ debugLogging: argv.verbose, asUrl: argv.as_url });

    let res = await elvlv.TenantBalanceOf({
      tenantId: argv.tenant,
      ownerAddr: argv.owner,
      maxNumber: argv.max_results,
    });

    if (argv.csv && argv.csv != "") {
      console.log(`CSV: ${argv.csv}`);
      let out = "contract,token,hold,name\n";
      let json = res.nfts;
      let contracts = Object.keys(json);
      for (let i = 0; i < contracts.length; i++) {
        let contract = contracts[i];
        let nft = json[contract];
        for (let j = 0; j < nft.tokens.length; j++) {
          let token = nft.tokens[j];
          out += `${contract},${token.tokenId},${token.hold},${nft.name}\n`;
        }
      }
      fs.writeFileSync(argv.csv, out);
    } else {
      console.log(yaml.dump(res));
    }

  } catch (e) {
    console.error("ERROR:", e);
  }
};

const CmdFabricTenantBalanceOf = async ({ argv }) => {
  console.log("Fabric Tenant - balance of", argv.object, argv.owner);
  try {
    await Init({ debugLogging: argv.verbose, asUrl: argv.as_url });

    let res = await elvlv.FabricTenantBalanceOf({
      objectId: argv.object,
      ownerAddr: argv.owner,
    });

    console.log(yaml.dump(res));
  } catch (e) {
    console.error("ERROR:", e);
  }
};

const CmdTenantTicketsGenerate = async ({ argv }) => {
  console.log(
    "Tenant tickets generation",
    argv.tenant,
    argv.otp,
    argv.quantity
  );

  try {
    await Init({debugLogging: argv.verbose, asUrl: argv.as_url});

    let res = await elvlv.TenantTicketsGenerate({
      tenant: argv.tenant,
      otp: argv.otp,
      otpClass: argv.otp_class,
      quantity: argv.quantity,
      emails: argv.emails,
      embedUrlBase: argv.embed_url_base
    });

    console.log("Tickets: ", res);
  } catch (e) {
    console.error("ERROR:", e);
  }
};

const CmdTenantMint = async ({ argv }) => {
  console.log(
    "Tenant mint",
    argv.tenant,
    argv.marketplace,
    argv.sku,
    argv.addr,
    argv.quantity
  );

  try {
    await Init({ debugLogging: argv.verbose, asUrl: argv.as_url });

    let res = await elvlv.TenantMint({
      tenant: argv.tenant,
      marketplace: argv.marketplace,
      sku: argv.sku,
      addr: argv.addr,
      quantity: argv.quantity,
    });

    console.log("Mint request submitted: ", res.statusText);
  } catch (e) {
    console.error("ERROR:", e);
  }
};

const CmdTenantPrimarySales = async ({ argv }) => {
  console.log(
    `Tenant Primary Sales: ${argv.tenant} ${argv.marketplace}`
  );
  console.log(`Processor: ${argv.processor}`);
  console.log(`Offset: ${argv.offset}`);
  console.log(`CSV: ${argv.csv}`);
  console.log(`admin: ${argv.admin}`);

  try {
    await Init({debugLogging: argv.verbose, asUrl: argv.as_url});

    let res = await elvlv.TenantPrimarySales({
      tenant: argv.tenant,
      marketplace: argv.marketplace,
      processor: argv.processor,
      csv: argv.csv,
      offset: argv.offset,
      admin: argv.admin,
    });

    if (argv.csv && argv.csv != "") {
      fs.writeFileSync(argv.csv, res);
    } else {
      console.log(yaml.dump(res));
    }
  } catch (e) {
    console.error("ERROR:", e);
  }
};

const CmdTenantSecondarySales = async ({ argv }) => {
  console.log(`Tenant Secondary Sales: ${argv.tenant}`);
  console.log(`Processor: ${argv.processor}`);
  console.log(`Offset: ${argv.offset}`);
  console.log(`CSV: ${argv.csv}`);

  try {
    await Init({debugLogging: argv.verbose, asUrl: argv.as_url});

    let res = await elvlv.TenantSecondarySales({
      tenant: argv.tenant,
      processor: argv.processor,
      csv: argv.csv,
      offset: argv.offset,
    });

    if (argv.csv && argv.csv != "") {
      fs.writeFileSync(argv.csv, res);
    } else {
      console.log(yaml.dump(res));
    }
  } catch (e) {
    console.error("ERROR:", e);
  }
};

const CmdTenantUnifiedSales = async ({ argv }) => {
  console.log(`Tenant Unified Sales: ${argv.tenant}`);
  console.log(`Processor: ${argv.processor}`);
  console.log(`Offset: ${argv.offset}`);
  console.log(`CSV: ${argv.csv}`);

  try {
    await Init({debugLogging: argv.verbose, asUrl: argv.as_url});

    let res = await elvlv.TenantUnifiedSales({
      tenant: argv.tenant,
      processor: argv.processor,
      csv: argv.csv,
      offset: argv.offset,
    });

    if (argv.csv && argv.csv != "") {
      fs.writeFileSync(argv.csv, res);
    } else {
      console.log(yaml.dump(res));
    }
  } catch (e) {
    console.error("ERROR:", e);
  }
};

const CmdTenantSessionsCsv = async ({ argv }) => {
  try {
    await Init({debugLogging: argv.verbose, asUrl: argv.as_url});

    let res = await elvlv.TenantSessionsCsv({
      tenant: argv.tenant,
      start_ts: argv.start_ts,
      end_ts: argv.end_ts,
    });

    fs.writeFileSync(argv.filename, res);
  } catch (e) {
    console.error("ERROR:", e);
  }
};

const CmdTenantWallets = async ({ argv }) => {
  const max = argv.max_results ? argv.max_results : "unlimited";
  try {
    await Init({debugLogging: argv.verbose, asUrl: argv.as_url});

    let res = await elvlv.TenantWallets({
      tenant: argv.tenant,
      maxNumber: argv.max_results,
    });

    res.tenant = argv.tenant;
    res.max_results = max;

    if (argv.csv && argv.csv != "") {
      console.log(`CSV: ${argv.csv}`);
      let out = "user_address,ident,created,extras\n";
      for (let i = 0; i < res.contents.length; i++) {
        const ident = res.contents[i].ident ? res.contents[i].ident : "";
        let json = res.contents[i].extra_json ? JSON.stringify(res.contents[i].extra_json) : "";
        json = json.replaceAll("\"", "\"\"");
        created = new Date(res.contents[i].created * 1000);
        out = out + res.contents[i].addr + "," + ident + "," + created.toISOString() + ",\"" +  json + "\"\n";
      }
      fs.writeFileSync(argv.csv, out);
    } else {
      console.log(yaml.dump(res));
    }
  } catch (e) {
    console.error("ERROR:", e);
  }
};

const CmdTenantNftRemove = async ({ argv }) => {
  console.log("Tenant NFT Remove");
  console.log(`Tenant ID: ${argv.tenant}`);
  console.log(`NFT Address: ${argv.addr}`);

  try {
    await Init({ debugLogging: argv.verbose, asUrl: argv.as_url });

    console.log("Searching for NFT address in tenant contract...");
    let res = await elvlv.TenantHasNft({
      tenantId: argv.tenant,
      nftAddr: argv.addr,
    });

    if (!res) {
      console.warn("The NFT is not part of the tenant contract.");
      return;
    }

    res = await elvlv.NftShow({ addr: argv.addr, showOwners: false });
    delete res.warns;
    delete res.tokens;

    console.log(yaml.dump(res));
    const ans = prompt("Do you want to remove the above contract? (y/n)");
    if (ans.toLowerCase() != "y") {
      console.log("Aborting...");
      return;
    }

    res = await elvlv.TenantRemoveNft({
      tenantId: argv.tenant,
      nftAddr: argv.addr,
    });

    console.log("Done.");
  } catch (e) {
    console.error("ERROR:", e);
  }
};

const CmdTenantNftList = async ({ argv }) => {
  console.log("Tenant NFT List");
  console.log(`Tenant ID: ${argv.tenant}`);

  try {
    await Init({ debugLogging: argv.verbose, asUrl: argv.as_url });
    res = await elvlv.TenantNftList({ tenantId: argv.tenant });

    console.log(yaml.dump(res));
  } catch (e) {
    console.error("ERROR:", e);
  }
};

const CmdTenantHasNft = async ({ argv }) => {
  console.log("Tenant Has NFT");
  console.log(`Tenant ID: ${argv.tenant}`);
  console.log(`NFT Address: ${argv.addr}`);

  try {
    await Init({ debugLogging: argv.verbose, asUrl: argv.as_url });
    res = await elvlv.TenantHasNft({
      tenantId: argv.tenant,
      nftAddr: argv.addr,
    });

    console.log(yaml.dump(res));
  } catch (e) {
    console.error("ERROR:", e);
  }
};

const CmdTenantAddConsumers = async ({ argv }) => {
  console.log("Tenant Add Consumer");
  console.log(`Group ID: ${argv.group_id}`);
  console.log(`Account Addresses: ${argv.addrs}`);

  try {
    await Init({ debugLogging: argv.verbose, asUrl: argv.as_url });
    let res = await elvlv.TenantAddConsumers({
      groupId: argv.group_id,
      accountAddresses: argv.addrs,
    });

    console.log(yaml.dump(res));
  } catch (e) {
    console.error("ERROR:", e);
  }
};

const CmdTenantRemoveConsumer = async ({ argv }) => {
  console.log("Tenant Remove Consumer");
  console.log(`Group ID: ${argv.group_id}`);
  console.log(`Account Address: ${argv.addr}`);

  try {
    await Init({ debugLogging: argv.verbose, asUrl: argv.as_url });
    let res = await elvlv.TenantRemoveConsumer({
      groupId: argv.group_id,
      accountAddress: argv.addr,
    });

    console.log(yaml.dump(res));
  } catch (e) {
    console.error("ERROR:", e);
  }
};

const CmdTenantHasConsumer = async ({ argv }) => {
  console.log("Tenant Has Consumer");
  console.log(`Group ID: ${argv.group_id}`);
  console.log(`Account Address: ${argv.addr}`);

  try {
    await Init({ debugLogging: argv.verbose, asUrl: argv.as_url });
    var res = await elvlv.TenantHasConsumer({
      groupId: argv.group_id,
      accountAddress: argv.addr,
    });

    console.log(yaml.dump(res));
  } catch (e) {
    console.error("ERROR:", e);
  }
};

const CmdTenantProvision = async ({ argv }) => {
  console.log("Tenant Provision");
  console.log(`Tenant ID: ${argv.tenant}`);
  console.log(`Tenant Slug: ${argv.slug}`);
  console.log(`verbose: ${argv.verbose}`);
  console.log(`status: ${argv.status}`);
  console.log(`init-config: ${argv.init_config}`);

  try {
    await Init({ debugLogging: argv.verbose, asUrl: argv.as_url });
    let client = elvlv.client;
    let kmsId = ElvUtils.AddressToId({
      prefix: "ikms",
      address: Config.consts[Config.net].kmsAddress
    });
    console.log(`kmsId: ${kmsId}`);

    res = await InitializeTenant({
      client,
      kmsId,
      tenantId: argv.tenant,
      tenantSlug: argv.slug,
      tenantName: argv.name,
      asUrl: argv.as_url,
      statusFile: argv.status,
      initConfig: argv.init_config,
      debug: argv.verbose,
    });

    if (argv.init_config){
      console.log(JSON.stringify(res,null,2));
    } else {
      console.log(yaml.dump(res));
    }
  } catch (e) {
    console.error("ERROR:", e);
  }
};

const CmdTenantAddConsumerGroup = async ({ argv }) => {
  console.log("Tenant Add Consumer Group");
  console.log(`TenantId: ${argv.tenant}`);
  console.log(`verbose: ${argv.verbose}`);

  try {
    await Init({ debugLogging: argv.verbose, asUrl: argv.as_url });
    let client = elvlv.client;
    let tenantAddress = Utils.HashToAddress(argv.tenant);
    console.log(`Tenant Contract Address: ${tenantAddress}`);

    res = await AddConsumerGroup({ client, tenantAddress, debug: argv.verbose });

    console.log(yaml.dump(res));
  } catch (e) {
    console.error("ERROR:", e);
  }
};

const CmdCreateWalletAccount = async ({ argv }) => {
  try {
    await Init({ debugLogging: argv.verbose, asUrl: argv.as_url });
    if (!argv.email || !argv.tenant || !argv.property_slug) {
      console.error("ERROR: must set email, tenant, property_slug");
      return;
    }
    const slug = argv.property_slug;

    let domain = Config.consts[Config.net].walletUrl;
    let domains = await elvlv.Domains();
    for (const domainObj of domains) {
      if (domainObj.property_slug === slug && domainObj.domain !== "") {
        domain = domainObj.domain;
      }
    }

    if (!domain.startsWith("https")) {
      domain = "https://" + domain;
    }
    if (!domain.endsWith("/")) {
      domain = domain + "/";
    }

    let callbackUrl = domain + "register?next=" + slug + "&pid=" + slug;

    let res = await elvlv.CreateWalletAccount({
      email: argv.email,
      tenant: argv.tenant,
      callbackUrl: callbackUrl,
      onlyCreateAccount: argv.only_create_account,
      onlySendEmail: argv.only_send_email,
      scheduleAt: argv.schedule_at,
    });

    console.log(res);
  } catch (e) {
    console.error(e);
  }
};

const CmdTenantTransferFailures = async ({ argv }) => {
  console.log(`Tenant Trasfer Failures: ${argv.tenant}`);

  try {
    await Init({debugLogging: argv.verbose, asUrl: argv.as_url});

    let res = await elvlv.TenantTransferFailures({
      tenant: argv.tenant,
    });
    console.log(yaml.dump(res));
  } catch (e) {
    console.error("ERROR:", e);
  }
};

const CmdTenantGetMinter = async ({ argv }) => {
  console.log("Tenant Minter Get Config");
  console.log(`TenantId: ${argv.tenant}`);
  console.log(`Host: ${argv.as_url}`);

  try {
    await Init({ debugLogging: argv.verbose, asUrl: argv.as_url });

    res = await elvlv.TenantGetMinterConfig({
      tenant: argv.tenant
    });

    console.log("\n" + yaml.dump(res));
  } catch (e) {
    console.error("ERROR:", e);
  }
};

const CmdTenantCreateMinter = async ({ argv }) => {
  console.log("Tenant Minter Create Config");
  console.log(`TenantId: ${argv.tenant}`);
  console.log(`Host: ${argv.as_url}`);
  console.log(`Funds: ${argv.funds}`);

  try {
    await Init({ debugLogging: argv.verbose, asUrl: argv.as_url });

    res = await elvlv.TenantCreateMinterConfig({
      tenant: argv.tenant,
      funds: argv.funds,
      deploy: argv.deploy
    });

    console.log("\n" + yaml.dump(res));
  } catch (e) {
    console.error("ERROR:", e);
  }
};

const CmdTenantReplaceMinter = async ({ argv }) => {
  console.log("Tenant Minter Replace Config");
  console.log(`TenantId: ${argv.tenant}`);
  console.log(`Host: ${argv.as_url}`);
  console.log(`Proxy Owner: ${argv.proxy_owner}`);
  console.log(`Minter: ${argv.minter}`);
  console.log(`Mint helper: ${argv.mint_helper}`);
  console.log(`Proxy: ${argv.proxy}`);
  console.log(`Purge: ${argv.purge}`);

  try {
    await Init({ debugLogging: argv.verbose, asUrl: argv.as_url});

    res = await elvlv.TenantReplaceMinterConfig({
      tenant: argv.tenant,
      proxyOwner: argv.proxy_owner,
      minter: argv.minter,
      mintHelper: argv.mint_helper,
      proxy: argv.proxy,
      mintShuffleKey: argv.mint_shuffle_key,
      legacyShuffleSeed: argv.legacy_shuffle_seed,
      purge: argv.purge
    });

    console.log("\n" + yaml.dump(res));
  } catch (e) {
    console.error("ERROR:", e);
  }
};

const CmdTenantDeleteMinter = async ({ argv }) => {
  console.log("Tenant Delete Minter");
  console.log(`TenantId: ${argv.tenant}`);
  console.log(`Host: ${argv.as_url}`);
  console.log(`Force: ${argv.force}`);

  try {
    await Init({ debugLogging: argv.verbose, asUrl: argv.as_url });

    res = await elvlv.TenantDeleteMinterConfig({
      tenant: argv.tenant,
      force: argv.force
    });

    console.log("\n" + res.statusText);
  } catch (e) {
    console.error("ERROR:", e);
  }
};

const CmdTenantDeployHelpers = async ({ argv }) => {
  console.log("Tenant Deploy Helper Contracts");
  console.log(`TenantId: ${argv.tenant}`);
  console.log(`Host: ${argv.as_url}`);
  console.log(`Proxy: ${argv.proxy}`);
  console.log(`Mint Helper: ${argv.mint_helper}`);

  try {
    await Init({ debugLogging: argv.verbose, asUrl: argv.as_url });

    res = await elvlv.TenantDeployHelperContracts({
      tenant: argv.tenant,
      proxy: argv.proxy,
      mintHelper: argv.mint_helper
    });

    console.log("\n" + res.statusText);
    console.log("\n" + yaml.dump(await res.json()));
  } catch (e) {
    console.error("ERROR:", e);
  }
};

const CmdTenantPublishData  = async ({ argv }) => {
  console.log("Tenant Config Update");
  console.log(`TenantId: ${argv.tenant}`);
  console.log(`Content Hash: ${argv.content_hash}`);
  console.log(`Update Links: ${argv.update_links}`);
  console.log(`Env: ${argv.env}`);
  console.log(`Host: ${argv.as_url}`);
  console.log(`media_wallet: ${argv.media_wallet}`);

  try {
    await Init({ debugLogging: argv.verbose, asUrl: argv.as_url });

    if (argv.media_wallet === false) {
      let res = await elvlv.TenantPublishPrivate({
        tenant: argv.tenant,
        env: argv.env,
      });
      console.log("\n" + yaml.dump(res));
      return;
    }

    let res = await elvlv.TenantPublishData({
      tenant: argv.tenant,
      contentHash: argv.content_hash,
      updateLinks: argv.update_links,
      env: argv.env,
    });

    console.log("\n" + yaml.dump(res));
  } catch (e) {
    console.error("ERROR:", JSON.stringify(e, null, 2));
  }
};

const CmdNotifSend = async ({ argv }) => {
  console.log("Send notification", argv.user_addr, argv.tenant, argv.event);

  try {
    let notifier = new Notifier({notifUrl: argv.notif_url});
    await notifier.Init();

    let res = await notifier.Send({
      userAddr: argv.user_addr,
      tenantId: argv.tenant,
      eventType: argv.event,
      nftAddr: argv.nft_addr,
      tokenId: argv.token_id
    });

    console.log("\n" + yaml.dump(res));
  } catch (e) {
    console.error("ERROR:", e);
  }
};

const CmdNotifSendTokenUpdate = async ({ argv }) => {
  console.log("Send token update notification to all owners", argv.nft_addr, argv.tenant);

  try {

    await Init({ debugLogging: argv.verbose, asUrl: argv.as_url });
    let nftInfo = await elvlv.NftShow({
      addr: argv.nft_addr,
      showOwners: 10000000 // 10 mil is code for 'unlimited'
    });

    let tokens = nftInfo.tokens;

    let notifier = new Notifier({notifUrl: argv.notif_url});
    await notifier.Init();

    for (let i = 0; i < tokens.length; i ++) {
      console.log("- token:", tokens[i].tokenId, "owner", tokens[i].owner, );
      let res = await notifier.Send({
        userAddr: tokens[i].owner,
        tenantId: argv.tenant,
        eventType: "TOKEN_UPDATED",
        nftAddr: argv.nft_addr,
        tokenId: tokens[i].tokenId
      });
      if (argv.verbose) {
        console.log(res);
      }
    }

  } catch (e) {
    console.error("ERROR:", e);
  }
};

module.exports = {
  CmdTenantShow,
  CmdTenantAuthToken,
  CmdTenantAuthCurl,
  CmdTenantPathAuthCurl,
  CmdTenantSetTokenURI,
  CmdTenantUpdateTokenURI,
  CmdTenantBalanceOf,
  CmdFabricTenantBalanceOf,
  CmdTenantTicketsGenerate,
  CmdTenantMint,
  CmdTenantPrimarySales,
  CmdTenantSecondarySales,
  CmdTenantUnifiedSales,
  CmdTenantSessionsCsv,
  CmdTenantWallets,
  CmdTenantNftRemove,
  CmdTenantNftList,
  CmdTenantHasNft,
  CmdTenantAddConsumers,
  CmdTenantRemoveConsumer,
  CmdTenantHasConsumer,
  CmdTenantProvision,
  CmdTenantAddConsumerGroup,
  CmdCreateWalletAccount,
  CmdTenantTransferFailures,
  CmdTenantGetMinter,
  CmdTenantCreateMinter,
  CmdTenantReplaceMinter,
  CmdTenantDeleteMinter,
  CmdTenantDeployHelpers,
  CmdTenantPublishData,
  CmdNotifSend,
  CmdNotifSendTokenUpdate,
};