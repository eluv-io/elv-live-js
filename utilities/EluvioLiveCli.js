const { EluvioLive } = require("../src/EluvioLive.js");
const { ElvUtils } = require("../src/Utils");
const Utils = require("@eluvio/elv-client-js/src/Utils.js");
const { InitializeTenant, AddConsumerGroup } = require("../src/Provision");
const { Config } = require("../src/Config.js");
const { Shuffler } = require("../src/Shuffler");
const { Marketplace } = require("../src/Marketplace");
const { Notifier } = require ("../src/Notifier");
const { ElvToken } = require ("../src/ElvToken.js");
const { ElvContracts } = require ("../src/ElvContracts.js");

const yargs = require("yargs/yargs");
const { hideBin } = require("yargs/helpers");
const yaml = require("js-yaml");
const fs = require("fs");
const path = require("path");
const prompt = require("prompt-sync")({ sigint: true });
const exec = require("child_process").exec;

// hack that quiets this msg:
//  node:87980) ExperimentalWarning: The Fetch API is an experimental feature. This feature could change at any time
//  (Use `node --trace-warnings ...` to show where the warning was created)
const originalEmit = process.emit;
process.emit = function (name, data, ...args) {
  if (name === "warning" && typeof data === "object" && data.name === "ExperimentalWarning") {
    return false;
  }
  return originalEmit.apply(process, arguments);
};

let elvlv;
let marketplace;

const Init = async ({debugLogging = false, asUrl}={}) => {
  const config = {
    configUrl: Config.networks[Config.net],
    mainObjectId: Config.mainObjects[Config.net],
  };

  elvlv = new EluvioLive(config);
  await elvlv.Init({ debugLogging, asUrl });

  marketplace = new Marketplace(config);
  await marketplace.Init({ debugLogging, asUrl });
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

const CmfNftTemplateAddNftContract = async ({ argv }) => {
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

const CmdTokenAddMinter = async ({ argv }) => {
  try {
    await Init({ debugLogging: argv.verbose, asUrl: argv.as_url });

    res = await elvlv.AddMinter({
      addr: argv.addr,
      minterAddr: argv.minter,
    });
    console.log(yaml.dump(res));
  } catch (e) {
    console.error("ERROR:", e);
  }
};

const CmdTokenRenounceMinter= async ({ argv }) => {
  try {
    await Init({ debugLogging: argv.verbose, asUrl: argv.as_url });

    res = await elvlv.RenounceMinter({
      addr: argv.addr,
    });
    console.log(yaml.dump(res));
  } catch (e) {
    console.error("ERROR:", e);
  }
};

const CmdTokenIsMinter= async ({ argv }) => {
  try {
    await Init({ debugLogging: argv.verbose, asUrl: argv.as_url });

    res = await elvlv.IsMinter({
      addr: argv.addr,
      minterAddr: argv.minter,
    });
    console.log(yaml.dump(res));
  } catch (e) {
    console.error("ERROR:", e);
  }
};



const CmfNftSetProxy = async ({ argv }) => {
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


const CmdSiteShow = async ({ argv }) => {
  console.log("Site - show", argv.object);
  try {
    await Init({ debugLogging: argv.verbose, asUrl: argv.as_url });

    let res = await elvlv.SiteShow({
      libraryId: argv.library,
      objectId: argv.object,
    });

    console.log(yaml.dump(res));
  } catch (e) {
    console.error("ERROR:", e);
  }
};

const CmdSiteSetDrop = async ({ argv }) => {
  console.log("Site - set drop", argv.object, argv.uuid, "update", argv.update);

  try {
    await Init({ debugLogging: argv.verbose, asUrl: argv.as_url });

    let res = await elvlv.SiteSetDrop({
      libraryId: argv.library,
      objectId: argv.object,
      uuid: argv.uuid,
      start: argv.start_date,
      end: argv.end_date,
      endVote: argv.end_vote,
      startMint: argv.start_mint,
      newUuid: argv.new_uuid,
      update: argv.update,
    });

    console.log(yaml.dump(res));
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

const CmdShuffle = async ({ argv }) => {
  try {
    let files = [argv.file];
    let isDir = fs.lstatSync(argv.file).isDirectory();
    if (isDir) {
      files = fs.readdirSync(argv.file);
      files.forEach((f, i) => {
        files[i] = path.join(argv.file, f);
      });
    }

    for (let f of files) {
      console.log("\n" + Shuffler.shuffledPath(f) + ":");

      let a = await Shuffler.shuffleFile(f, true, argv.seed, argv.check_dupes);

      if (argv.print_js) {
        console.log(a);
      } else {
        a.forEach((line) => {
          console.log(line);
        });
      }
    }
    console.log("");
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

const CmdNFTRefresh = async ({ argv }) => {
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


const CmdList = async ({ argv }) => {
  console.log(`list tenant: ${argv.tenant} tenant_slug: ${argv.tenant_slug}`);
  try {
    await Init({ debugLogging: argv.verbose, asUrl: argv.as_url });

    let res = await elvlv.List({
      tenantId: argv.tenant,
      tenantSlug: argv.tenant_slug,
    });

    if (argv.tenant || argv.tenant_slug) {
      let { result, warns } = FilterListTenant({ tenant: res });
      let warnSaved = res.warns || [];
      res = result;
      res.warns = warnSaved.concat(warns);
    } else {
      let keys = Object.keys(res.tenants);
      for (const key of keys) {
        let { result, warns } = FilterListTenant({ tenant: res.tenants[key] });
        res.tenants[key] = result;
        res.warns = res.warns.concat(warns);
      }
    }

    console.log(yaml.dump(res));
  } catch (e) {
    console.error(e);
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

FilterListTenant = ({ tenant }) => {
  let res = {};
  res.result = {};
  res.warns = [];
  let tenantObject = elvlv.FilterTenant({ object: tenant });
  try {
    if (tenantObject.marketplaces) {
      let keys = Object.keys(tenantObject.marketplaces);
      for (const key of keys) {
        let { result, warns } = elvlv.FilterMarketplace({
          object: tenantObject.marketplaces[key],
        });
        let marketplace = result;
        res.warns = res.warns.concat(warns);
        let filteredItems = [];
        for (const item of marketplace.items) {
          let { result, warns } = elvlv.FilterNft({ object: item });
          let filteredItem = result;
          res.warns = res.warns.concat(warns);
          filteredItems.push(filteredItem);
        }
        marketplace.items = filteredItems;
        tenantObject.marketplaces[key] = marketplace;
      }
    }
  } catch (e) {
    res.warns.push(`${tenant.display_title} : ${e}`);
  }

  try {
    if (tenantObject.sites) {
      keys = Object.keys(tenantObject.sites);

      for (const key of keys) {
        let { result, warns } = elvlv.FilterSite({
          object: tenantObject.sites[key],
        });
        let site = result;
        tenantObject.sites[key] = site;
        res.warns = res.warns.concat(warns);
      }
    }
  } catch (e) {
    res.warns.push(`${tenant.display_title} : ${e}`);
  }

  res.result = tenantObject;

  return res;
};

const CmdAccountCreate = async ({ argv }) => {
  console.log("Account Create\n");
  console.log(`funds: ${argv.funds}`);
  console.log(`account_name: ${argv.account_name}`);
  console.log(`tenant_admins: ${argv.tenant_admins}`);

  try {
    await Init({ debugLogging: argv.verbose, asUrl: argv.as_url });
    let res = await elvlv.AccountCreate({
      funds: argv.funds,
      accountName: argv.account_name,
      tenantAdminsId: argv.tenant_admins,
    });
    console.log(yaml.dump(res));
  } catch (e) {
    console.error("ERROR:", e);
  }
};

const CmdAccountShow = async () => {
  console.log("Account Show\n");

  try {
    await Init({ debugLogging: false });
    let res = await elvlv.AccountShow();
    console.log(yaml.dump(res));
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

const CmdMarketplaceAddItem = async ({ argv }) => {
  console.log("Marketplace Add Item");
  console.log(`Marketplace Object ID: ${argv.marketplace}`);
  console.log(`NFT Template Object ID/Hash: ${argv.object}`);
  console.log(`NFT Template Name${argv.name}`);
  console.log(`NFT Template Price: ${argv.price}`);
  console.log(`NFT For Sale: ${argv.forSale}`);

  try {
    await Init({ debugLogging: argv.verbose, asUrl: argv.as_url });
    const res = await marketplace.MarketplaceAddItem({
      nftObjectId: argv.object.startsWith("iq__") ? argv.object : undefined,
      nftObjectHash: argv.object.startsWith("hq__") ? argv.object : undefined,
      marketplaceObjectId: argv.marketplace,
      name: argv.name,
      price: argv.price,
      currency: argv.currency,
      maxPerUser: argv.maxPerUser,
      forSale: argv.forSale
    });

    console.log(yaml.dump(res));
  } catch (e) {
    console.error("ERROR:", e);
  }
};

const CmdMarketplaceAddItemBatch = async ({ argv }) => {
  console.log("Marketplace Add Item Batch");
  console.log(`Marketplace Object ID: ${argv.marketplace}`);
  console.log(`CSV file containing Object Names and IDs: ${argv.csv}`);

  try {
    await Init({ debugLogging: argv.verbose, asUrl: argv.as_url });

    const res = await marketplace.MarketplaceAddItemBatch({
      marketplaceObjectId: argv.marketplace,
      csv: argv.csv
    });

    console.log(yaml.dump(res));
  } catch (e) {
    console.error("ERROR:", e);
  }
};

const CmdMarketplaceRemoveItem = async ({ argv }) => {
  console.log("Marketplace Remove Item");
  console.log(`Marketplace Object ID: ${argv.marketplace}`);
  console.log(`NFT Template Object ID: ${argv.object}`);

  try {
    await Init({ debugLogging: argv.verbose, asUrl: argv.as_url });
    const res = await marketplace.MarketplaceRemoveItem({
      nftObjectId: argv.object,
      marketplaceObjectId: argv.marketplace,
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

const CmdStorefrontSectionAddItem = async ({ argv }) => {
  console.log("Storefront Section Add Item");
  console.log(`Marketplace Object ID: ${argv.marketplace}`);
  console.log(`Marketplace Item SKU: ${argv.sku}`);
  console.log(`Marketplace Storefront Section: ${argv.section}`);

  try {
    await Init({ debugLogging: argv.verbose, asUrl: argv.as_url });
    const res = await marketplace.StorefrontSectionAddItem({
      objectId: argv.marketplace,
      sku: argv.sku,
      name: argv.section,
    });

    console.log(yaml.dump(res));
  } catch (e) {
    console.error("ERROR:", e);
  }
};

const CmdStorefrontSectionRemoveItem = async ({ argv }) => {
  console.log("Storefront Section Remove Item");
  console.log(`Marketplace Object ID: ${argv.marketplace}`);
  console.log(`Marketplace Item SKU: ${argv.sku}`);
  console.log(`Object Write Token: ${argv.writeToken}`);

  try {
    await Init({ debugLogging: argv.verbose, asUrl: argv.as_url });
    const res = await marketplace.StorefrontSectionRemoveItem({
      objectId: argv.marketplace,
      sku: argv.sku,
      writeToken: argv.writeToken,
    });

    console.log(yaml.dump(res));
  } catch (e) {
    console.error("ERROR:", e);
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

const CmdNFTGetPolicyPermissions = async ({ argv }) => {
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

const CmdNFTSetPolicyPermissions = async ({ argv }) => {
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

const CmdAdminHealth = async ({ argv }) => {
  console.log("Admin Health");
  console.log(`Host: ${argv.as_url}`);

  try {
    await Init({ debugLogging: argv.verbose, asUrl: argv.as_url });

    res = await elvlv.AdminHealth();

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

const CmdPaymentCreate = async ({ argv }) => {
  console.log("Deploy new payment contract");

  const addresses = argv.addresses.split(",");
  const shares = argv.shares.split(",");
  try {
    let elvContract = new ElvContracts({
      configUrl: Config.networks[Config.net],
      debugLogging: argv.verbose
    });

    await elvContract.Init({
      privateKey: process.env.PRIVATE_KEY,
    });

    res = await elvContract.PaymentDeploy({addresses, shares});

    console.log("\n" + yaml.dump(await res));
  } catch (e) {
    console.error("ERROR:", e);
  }
};

const CmdPaymentRelease = async ({ argv }) => {
  console.log("Payment release");

  try {
    let elvContract = new ElvContracts({
      configUrl: Config.networks[Config.net],
      debugLogging: argv.verbose
    });

    await elvContract.Init({
      privateKey: process.env.PRIVATE_KEY,
    });

    res = await elvContract.PaymentRelease({
      addr: argv.addr,
      tokenContractAddress: argv.token_addr,
      payeeAddress: argv.payee,
    });

    console.log("\n" + yaml.dump(await res));
    console.log("Payment release successful.");
  } catch (e) {
    console.error("ERROR:", argv.verbose ? e : e.message);
  }
};

const CmdPaymentShow = async ({ argv }) => {
  console.log("Show payment contract status");

  try {
    let elvContract = new ElvContracts({
      configUrl: Config.networks[Config.net],
      debugLogging: argv.verbose
    });

    await elvContract.Init({
      privateKey: process.env.PRIVATE_KEY,
    });

    res = await elvContract.PaymentShow({
      contractAddress: argv.addr,
      tokenContractAddress: argv.token_addr
    });

    console.log("\n" + yaml.dump(await res));
  } catch (e) {
    console.error("ERROR:", e);
  }
};

const CmdTokenCreate = async ({ argv }) => {
  console.log("Deploy ElvToken contract");
  try {
    let elvToken = new ElvToken({
      configUrl: Config.networks[Config.net],
      debugLogging: argv.verbose
    });

    await elvToken.Init({
      privateKey: process.env.PRIVATE_KEY,
    });

    res = await elvToken.ElvTokenDeploy({
      name: argv.name,
      symbol: argv.symbol,
      decimals: argv.decimals,
      amount: argv.amount,
    });

    console.log(yaml.dump(res));
  } catch (e) {
    console.error("ERROR:", e);
  }
};

const CmdTokenTransfer = async ({ argv }) => {
  console.log(`token transfer, 
    token_addr=${argv.token_addr}
    to_addr=${argv.to_addr}
    amount=${argv.amount}`);

  try {
    let elvToken = new ElvToken({
      configUrl: Config.networks[Config.net],
      debugLogging: argv.verbose
    });

    await elvToken.Init({
      privateKey: process.env.PRIVATE_KEY,
    });

    let res;
    res = await elvToken.ElvTokenTransfer({
      tokenAddr: argv.token_addr,
      toAddr: argv.to_addr,
      amount: argv.amount,
    });
    var status = await res.status;
    if (status === 1){
      console.log("status: transfer successful");
    } else {
      console.log("status: transfer failed");
    }
  } catch (e) {
    console.error("ERROR:", e);
  }
};

const CmdTokenBalanceOf = async ({ argv }) => {

  console.log(`token_addr: ${argv.token_addr}`);
  console.log(`user_addr: ${argv.user_addr}`);

  try {
    let elvToken = new ElvToken({
      configUrl: Config.networks[Config.net],
      debugLogging: argv.verbose
    });

    await elvToken.Init({
      privateKey: process.env.PRIVATE_KEY,
    });

    let res;
    res = await elvToken.ElvTokenBalance({
      tokenAddr: argv.token_addr,
      userAddr : argv.user_addr,
    });
    console.log("token_balance:",yaml.dump(await res));
  } catch (e) {
    console.error("ERROR:", e);
  }
};



const CmdContentSetPolicy  = async ({ argv }) => {
  console.log("Content Set Policy");
  console.log(`Object: ${argv.object}`);
  console.log(`Policy Path: ${argv.policy_path}`);
  console.log(`Data: ${argv.data}`);

  try {
    await Init({ debugLogging: argv.verbose, asUrl: argv.as_url });

    res = await elvlv.ContentSetPolicy({
      objectId: argv.object,
      policyPath: argv.policy_path,
      data: argv.data
    });

    if (ElvUtils.isTransactionSuccess(res)){
      console.log("Success!");
    } else {
      console.log("Transaction Error: ", yaml.dump(res));
    }

  } catch (e) {
    console.error("ERROR:", e);
  }
};

const CmdContentSetPolicyDelegate  = async ({ argv }) => {
  console.log("Content Set Policy Delegate");
  console.log(`Object: ${argv.object}`);
  console.log(`Policy Path: ${argv.delegate}`);
  console.log(`Data: ${argv.data}`);

  try {
    await Init({ debugLogging: argv.verbose, asUrl: argv.as_url });

    res = await elvlv.ContentSetPolicyDelegate({
      objectId: argv.object,
      delegateId: argv.delegate
    });

    if (ElvUtils.isTransactionSuccess(res)){
      console.log("Success!");
    } else {
      console.log("Transaction Error: ", yaml.dump(res));
    }
  } catch (e) {
    console.error("ERROR:", e);
  }
};

const CmdContentGetPolicy  = async ({ argv }) => {
  console.log("Content Get Policy");
  console.log(`Object: ${argv.object}`);

  try {
    await Init({ debugLogging: argv.verbose, asUrl: argv.as_url });

    res = await elvlv.ContentGetPolicy({
      objectId: argv.object
    });

    console.log("\n" + yaml.dump(res));
  } catch (e) {
    console.error("ERROR:", e);
  }
};

const CmdContentClearPolicy = async ({ argv }) => {
  console.log("Content Clear Policy");
  console.log(`Object: ${argv.object}`);

  try {
    await Init({ debugLogging: argv.verbose, asUrl: argv.as_url });

    res = await elvlv.ContentClearPolicy({
      objectId: argv.object
    });

    if (ElvUtils.isTransactionSuccess(res)){
      console.log("Success!");
    } else {
      console.log("Transaction Error: ", yaml.dump(res));
    }
  } catch (e) {
    console.error("ERROR:", e);
  }
};

yargs(hideBin(process.argv))
  .option("verbose", {
    describe: "Verbose mode",
    type: "boolean",
    alias: "v"
  })
  .option("as_url", {
    describe: "Alternate authority service URL (include '/as/' route if necessary)",
    type: "string"
  })

  .command(
    "nft_show <addr> [options]",
    "Show info on this NFT",
    (yargs) => {
      yargs
        .positional("addr", {
          describe: "NFT address (hex)",
          type: "string",
        })
        .option("check_minter", {
          describe: "Check that all NFTs use this mint helper",
        })
        .option("show_owners", {
          describe: "Show up to these many owners (default 0), loaded from an index. Only used when token_id is not specified.",
          type: "integer",
        })
        .option("show_owners_via_contract", {
          describe: "Show up to these many owners (default 0), parsed directly from the contract. Only used when token_id is not specified.",
          type: "integer",
        })
        .option("include_email", {
          describe: "Include owner(s) email(s) when available, as bound to the given tenant ID.",
          type: "string",
        })
        .option("token_id", {
          describe: "External token ID. This will take precedence over show_owners.",
          type: "string", // BigNumber as string
        });
    },
    (argv) => {
      CmdNftShow({ argv });
    }
  )

  .command(
    "nft_balance_of <addr> <owner>",
    "Call NFT ownerOf - determine if this is an owner",
    (yargs) => {
      yargs
        .positional("addr", {
          describe: "NFT address (hex)",
          type: "string",
        })
        .positional("owner", {
          describe: "Owner address to check (hex)",
          type: "string",
        });
    },
    (argv) => {
      CmdNftBalanceOf({ argv });
    }
  )

  .command(
    "nft_refresh <tenant> <addr>",
    "Synchronize backend listings with fabric metadata for a specific tenant's NFT. Requires tenant Key.",
    (yargs) => {
      yargs
        .positional("tenant", {
          describe: "Tenant ID",
          type: "string",
        })
        .positional("addr", {
          describe: "NFT contract address",
          type: "string",
        });
    },
    (argv) => {
      CmdNFTRefresh({ argv });
    }
  )

  .command(
    "nft_transfer <addr> <token_id> <to_addr> [options]",
    "Transfer the specified NFT as the token owner",
    (yargs) => {
      yargs
        .positional("addr", {
          describe: "Local NFT contract address",
          type: "string",
        })
        .positional("token_id", {
          describe: "External token ID",
          type: "string", // BigNumber as string
        })
        .positional("to_addr", {
          describe: "Address to transfer to (hex)",
          type: "string",
        })
        .option("auth_service", {
          describe: "Use the Authority Service to do the transfer"
        });
    },
    (argv) => {
      CmdNftTransfer({ argv });
    }
  )

  .command(
    "transfer_errors <tenant>",
    "Show tenant transfer failures. Used to identify payments collected on failed transfers.",
    (yargs) => {
      yargs
        .positional("tenant", {
          describe: "Tenant ID",
          type: "string",
        });
    },
    (argv) => {
      CmdTenantTransferFailures({ argv });
    }
  )

  .command(
    "nft_proxy_transfer <addr> <token_id> <from_addr> <to_addr>",
    "Tranfer NFT as a proxy owner",
    (yargs) => {
      yargs
        .positional("addr", {
          describe: "NFT address (hex)",
          type: "string",
        })
        .positional("token_id", {
          describe: "Token Id",
          type: "integer",
        })
        .positional("from_addr", {
          describe: "Address to transfer from (hex)",
          type: "string",
        })
        .positional("to_addr", {
          describe: "Address to transfer to (hex)",
          type: "string",
        });
    },
    (argv) => {
      CmdNftProxyTransfer({ argv });
    }
  )

  .command(
    "nft_build <library> <object> [options]",
    "Build the public/nft section based on asset metadata. If --nft_dir is specified, will build a generative nft based on *.json files inside the dir. See README.md for more details.",
    (yargs) => {
      yargs
        .positional("library", {
          describe: "Content library",
          type: "string",
        })
        .positional("object", {
          describe: "Content object hash (hq__) or id (iq__)",
          type: "string",
        })
        .option("nft_dir", {
          describe:
            "Create a multi-media NFT (generative). " +
            "Directory contains json files describing the nft.  See documentation to see *.json structure.",
          type: "string",
        });
    },
    (argv) => {
      CmdNftBuild({ argv });
    }
  )

  .command(
    "nft_set_proxy <addr> [proxy_addr]",
    "Set a proxy on an NFT contract",
    (yargs) => {
      yargs
        .positional("addr", {
          describe: "NFT address (hex)",
          type: "string",
        })
        .option("proxy_addr", {
          describe: "Proxy contract address (hex)",
          type: "string",
        });
    },
    (argv) => {
      CmfNftSetProxy({ argv });
    }
  )

  .command(
    "nft_pack_get_dist <hash>",
    "Compute pack distribution based on NFT Template spec. Saves to file.",
    (yargs) => {
      yargs
        .positional("hash", {
          describe: "NFT Template content hash (hq__)",
          type: "string",
        });
    },
    (argv) => {
      CmdNftPackGetDist({ argv });
    }
  )

  .command(
    "nft_pack_set_dist <hash>",
    "Set the pack distribution for an NFT Template. Reads distribution from file.",
    (yargs) => {
      yargs
        .positional("hash", {
          describe: "NFT Template content hash (hq__)",
          type: "string",
        });
    },
    (argv) => {
      CmdNftPackSetDist({ argv });
    }
  )

  .command(
    "nft_burn <addr> <token_id>",
    "Burn the specified NFT as the owner",
    (yargs) => {
      yargs
        .positional("addr", {
          describe: "Local NFT contract address",
          type: "string",
        })
        .positional("token_id", {
          describe: "External token ID",
          type: "string", // BigNumber as string
        });
    },
    (argv) => {
      CmdNftBurn({ argv });
    }
  )

  .command(
    "nft_proxy_burn <addr> <token_id>",
    "Burn the specified NFT",
    (yargs) => {
      yargs
        .positional("addr", {
          describe: "Local NFT contract address",
          type: "string",
        })
        .positional("token_id", {
          describe: "External token ID",
          type: "string", // BigNumber as string
        });
    },
    (argv) => {
      CmdNftProxyBurn({ argv });
    }
  )

  .command(
    "nft_set_transfer_fee <addr> <fee>",
    "Decode and look up a local NFT by external token ID",
    (yargs) => {
      yargs
        .positional("addr", {
          describe: "NFT contract address",
          type: "string",
        })
        .positional("fee", {
          describe: "Fee in ETH",
          type: "string", // BigNumber as string
        });
    },
    (argv) => {
      CmdNftSetTransferFee({ argv });
    }
  )

  .command(
    "nft_get_transfer_fee <addr>",
    "Decode and look up a local NFT by external token ID",
    (yargs) => {
      yargs
        .positional("addr", {
          describe: "NFT contract address",
          type: "string",
        });
    },
    (argv) => {
      CmdNftGetTransferFee({ argv });
    }
  )

  .command(
    "nft_add_contract <tenant> <object> <cap> <name> <symbol> [options]",
    "Add a new or existing NFT contract to an NFT Template object",
    (yargs) => {
      yargs
        .positional("tenant", {
          describe: "Tenant ID",
          type: "string",
        })
        .positional("object", {
          describe: "NFT Template object ID",
          type: "string",
        })
        .positional("cap", {
          describe: "NFT total supply cap",
          type: "number",
        })
        .positional("name", {
          describe: "NFT collection name",
          type: "string",
        })
        .positional("symbol", {
          describe: "NFT collection symbol",
          type: "string",
        })
        .option("hold", {
          describe: "Hold period in seconds (default 7 days)",
          type: "number",
        });
    },
    (argv) => {
      CmfNftTemplateAddNftContract({ argv });
    }
  )

  .command(
    "nft_add_offer <addr>",
    "Add a redeemable offer to the NFT contract as the contract owner or minter",
    (yargs) => {
      yargs
        .positional("addr", {
          describe: "NFT contract address",
          type: "string",
        });
    },
    (argv) => {
      CmdNftAddRedeemableOffer({ argv });
    }
  )

  .command(
    "nft_remove_offer <addr> <offer_id>",
    "Remove (disable) a redeemable offer from the NFT contract as the contract owner or minter",
    (yargs) => {
      yargs
        .positional("addr", {
          describe: "NFT contract address",
          type: "string",
        })
        .positional("offer_id", {
          describe: "Offer ID",
          type: "integer",
        });
    },
    (argv) => {
      CmdNftRemoveRedeemableOffer({ argv });
    }
  )

  .command(
    "nft_offer_redeemed <addr> <token_id> <offer_id>",
    "Returns true if offer is redeemed",
    (yargs) => {
      yargs
        .positional("addr", {
          describe: "NFT contract address",
          type: "string",
        })
        .positional("token_id", {
          describe: "Offer ID",
          type: "integer",
        })
        .positional("offer_id", {
          describe: "Offer ID",
          type: "integer",
        });
    },
    (argv) => {
      CmdNftIsOfferRedeemed({ argv });
    }
  )

  .command(
    "nft_offer_active <addr> <offer_id>",
    "Returns true if offer is active",
    (yargs) => {
      yargs
        .positional("addr", {
          describe: "NFT contract address",
          type: "string",
        })
        .positional("offer_id", {
          describe: "Offer ID",
          type: "integer",
        });
    },
    (argv) => {
      CmdNftIsOfferActive({ argv });
    }
  )

  .command(
    "nft_redeem_offer <addr> <redeemer> <token_id> <offer_id>",
    "Redeem an nft offer",
    (yargs) => {
      yargs
        .positional("addr", {
          describe: "NFT contract address",
          type: "string",
        })
        .positional("redeemer", {
          describe: "Redeemer address",
          type: "string",
        })
        .positional("token_id", {
          describe: "Offer ID",
          type: "integer",
        })
        .positional("offer_id", {
          describe: "Offer ID",
          type: "integer",
        });
    },
    (argv) => {
      CmdNftRedeemOffer({ argv });
    }
  )

  .command(
    "as_nft_redeem_offer <addr> <tenant> <mint_helper_addr> <token_id> <offer_id>",
    "Redeem an nft offer using the authority service",
    (yargs) => {
      yargs
        .positional("addr", {
          describe: "NFT contract address",
          type: "string",
        })
        .positional("tenant", {
          describe: "Tenant ID",
          type: "string",
        })
        .positional("mint_helper_addr", {
          describe: "Address of the mint helper (hex), used with --auth_service",
          type: "string",
        })
        .positional("token_id", {
          describe: "Offer ID",
          type: "integer",
        })
        .positional("offer_id", {
          describe: "Offer ID",
          type: "integer",
        });
    },
    (argv) => {
      CmdASNftRedeemOffer({ argv });
    }
  )

  .command(
    "nft_get_policy_permissions <object>",
    "Gets the policy and permissions of a content object.",
    (yargs) => {
      yargs.positional("object", {
        describe: "ID of the content fabric object",
        type: "string",
      });
    },
    (argv) => {
      CmdNFTGetPolicyPermissions({ argv });
    }
  )

  .command(
    "nft_set_policy_permissions <object> <policy_path> <addrs..>",
    "Sets the policy and permissions granting NFT owners access to a content object. When no addresses are specified, only the policy is set.",
    (yargs) => {
      yargs
        .positional("object", {
          describe: "ID of the content object to grant access to",
          type: "string",
        })
        .positional("policy_path", {
          describe: "Path of policy object file",
          type: "string",
        })
        .positional("addrs", {
          describe:
            "List of space separated NFT contract addresses to set. Calling multiple times with a new list will replace the existing.",
          type: "string",
        })
        .option("clear", {
          describe: "clear the nft owners",
          type: "boolean",
          default: false
        });
    },
    (argv) => {
      CmdNFTSetPolicyPermissions({ argv });
    }
  )

  .command(
    "tenant_show <tenant> [options]",
    "Show info on this tenant",
    (yargs) => {
      yargs
        .positional("tenant", {
          describe: "Tenant ID",
          type: "string",
        })
        .option("check_nfts", {
          describe:
            "Check that all NFTs are part of the tenant contract's tenant_nfts group",
          type: "boolean",
        });
    },
    (argv) => {
      CmdTenantShow({ argv });
    }
  )

  .command(
    "tenant_auth_token <path_or_body>",
    "Generate a tenant token",
    (yargs) => {
      yargs
        .positional("path_or_body", {
          describe: "URL path or request body",
          type: "string",
        });
    },
    (argv) => {
      CmdTenantAuthToken({argv}).then();
    }
  )

  .command(
    "tenant_auth_curl <url_path> [post_body]",
    "Generate a tenant token and use it to call a baseTenantAuth authd endpoint.",
    (yargs) => {
      yargs
        .positional("url_path", {
          describe: "URL path",
          type: "string",
        })
        .positional("post_body", {
          describe: "either json body for POST, or '' for GET",
          type: "string",
        });
    },
    (argv) => {
      CmdTenantAuthCurl({argv}).then();
    }
  )

  .command(
    "tenant_path_auth_curl <url_path> [post_body]",
    "Generate a tenant token and use it to call a tenantPathAuth authd endpoint.",
    (yargs) => {
      yargs
        .positional("url_path", {
          describe: "URL path",
          type: "string",
        })
        .positional("post_body", {
          describe: "either json body for POST, or '' for GET",
          type: "string",
        });
    },
    (argv) => {
      CmdTenantPathAuthCurl({argv}).then();
    }
  )

  .command(
    "tenant_set_token_uri <request_type> <tenant> <contract_address> <new_token_uri> [options]",
    "Reset the token URI(s) for tenant NFT contract(s)",
    (yargs) => {
      yargs
        .positional("request_type", {
          describe: "Request Type (single, batch, all)",
          type: "string",
        })
        .positional("tenant", {
          describe: "Tenant ID",
          type: "string",
        })
        .positional("contract_address", {
          describe: "NFT contract address",
          type: "string",
        })
        .positional("new_token_uri", {
          describe: "New token URI; ignored if CSV batch, use -",
          type: "string",
        })
        .option("token_id", {
          describe:
            "Optional Token ID; required for single request type",
          type: "number",
        })
        .option("csv", {
          describe: "CSV file for batch request type",
          type: "string",
        });


    },
    (argv) => {
      CmdTenantSetTokenURI({ argv });
    }
  )

  .command(
    "tenant_update_token_uri <tenant> <addr> <hash> [options]",
    "Reset the token URI(s) for tenant NFT contract(s)",
    (yargs) => {
      yargs
        .positional("tenant", {
          describe: "Tenant ID",
          type: "string",
        })
        .positional("addr", {
          describe: "NFT contract address",
          type: "string",
        })
        .positional("hash", {
          describe: "New NFT template object hash",
          type: "string",
        })
        .option("dry_run", {
          describe:
            "Default 'true'",
          type: "boolean",
        });
    },
    (argv) => {
      CmdTenantUpdateTokenURI({ argv });
    }
  )

  .command(
    "tenant_balance_of <tenant> <owner>",
    "Show NFTs owned by this owner in this tenant using contracts.",
    (yargs) => {
      yargs
        .positional("tenant", {
          describe: "Tenant ID",
          type: "string",
        })
        .positional("owner", {
          describe: "Owner address (hex)",
          type: "string",
        })
        .option("csv", {
          describe: "File path to output csv",
          type: "string",
        });
    },
    (argv) => {
      CmdTenantBalanceOf({ argv });
    }
  )

  .command(
    "fabric_tenant_balance_of <object> <owner> [options]",
    "Show NFTs owned by this owner in this tenant by using the Fabric EluvioLive object tree.",
    (yargs) => {
      yargs
        .positional("object", {
          describe: "Tenant-level EluvioLive object ID",
          type: "string",
        })
        .positional("owner", {
          describe: "Owner address (hex)",
          type: "string",
        })
        .option("max_results", {
          describe: "Show up to these many results (default 0 = unlimited)",
          type: "integer",
        });
    },
    (argv) => {
      CmdFabricTenantBalanceOf({ argv });
    }
  )

  .command(
    "site_show <library> <object>",
    "Show info on this site/event",
    (yargs) => {
      yargs
        .positional("library", {
          describe: "Site library",
          type: "string",
        })
        .positional("object", {
          describe: "Site object ID",
          type: "string",
        });
    },
    (argv) => {
      CmdSiteShow({ argv });
    }
  )

  .command(
    "site_set_drop <library> <object> <uuid> <start_date> [options]",
    "Set drop dates for a site/event",
    (yargs) => {
      yargs
        .positional("library", {
          describe: "Site library",
          type: "string",
        })
        .positional("object", {
          describe: "Site object ID",
          type: "string",
        })
        .positional("uuid", {
          describe: "Drop UUID",
          type: "string",
        })
        .positional("start_date", {
          describe: "Event start date (ISO format)",
          type: "string",
        })
        .option("end_date", {
          describe: "Event end date (ISO format)",
          type: "string",
        })
        .option("end_vote", {
          describe: "Event vote end date (ISO foramt)",
          type: "string",
        })
        .option("start_mint", {
          describe: "Event start mint date (ISO format)",
          type: "string",
        })
        .option("new_uuid", {
          describe: "Assign a new UUID",
          type: "boolean",
        })
        .option("update", {
          describe: "Tenant-level EluvioLive object to update",
          type: "string",
        });
    },
    (argv) => {
      CmdSiteSetDrop({ argv });
    }
  )

  .command(
    "tenant_tickets_generate <tenant> <otp>",
    "Generate tickets for a given tenant OTP ID",
    (yargs) => {
      yargs
        .positional("tenant", {
          describe: "Tenant ID",
          type: "string",
        })
        .positional("otp", {
          describe: "OTP ID (including prefix)",
          type: "string",
        })
        .option("quantity", {
          describe: "Specify how many to generate (default 1)",
          type: "integer",
        })
        .option("emails", {
          describe: "File containing one email per line (or any user identifier). Generate codes bound to these identifiers",
          type: "string",
        })
        .option("embed_url_base", {
          describe: "Generate embed URLs for each ticket based on this template",
          type: "string",
        })
        .option("otp_class", {
          describe: "Use authority services (class 5) or contract (class 4) (default 5)",
          type: "integer",
        });
    },
    (argv) => {
      CmdTenantTicketsGenerate({ argv });
    }
  )

  .command(
    "tenant_mint <tenant> <marketplace> <sku> <addr>",
    "Mint a marketplace NFT by SKU as tenant admin",
    (yargs) => {
      yargs
        .positional("tenant", {
          describe: "Tenant ID",
          type: "string",
        })
        .positional("marketplace", {
          describe: "Marketplace ID",
          type: "string",
        })
        .positional("sku", {
          describe: "NFT marketplace SKU",
          type: "string",
        })
        .positional("addr", {
          describe: "Target address to mint to",
          type: "string",
        })
        .option("quantity", {
          describe: "Specify how many to mint (default 1)",
          type: "integer",
        });
    },
    (argv) => {
      CmdTenantMint({ argv });
    }
  )

  .command(
    "tenant_primary_sales <tenant> <marketplace>",
    "Show tenant primary sales history",
    (yargs) => {
      yargs
        .positional("tenant", {
          describe: "Tenant ID",
          type: "string",
        })
        .positional("marketplace", {
          describe: "Marketplace ID",
          type: "string",
        })
        .option("processor", {
          describe: "Payment processor: eg. stripe, coinbase, eluvio. Omit for all.",
          type: "string",
          default: "",
        })
        .option("csv", {
          describe: "File path to output csv",
          type: "string",
        })
        .option("offset", {
          describe: "Offset in months to dump data where 0 is the current month",
          type: "number",
          default: 1,
        })
        .option("admin", {
          describe: "Use the Admin API endpoint to resolve this query instead of the tenant API. " +
            "This is required for inactive marketplaces.",
          type: "boolean",
          default: false,
        });
    },
    (argv) => {
      CmdTenantPrimarySales({ argv });
    }
  )

  .command(
    "tenant_secondary_sales <tenant>",
    "Show tenant secondary sales history",
    (yargs) => {
      yargs
        .positional("tenant", {
          describe: "Tenant ID",
          type: "string",
        })
        .option("processor", {
          describe: "Payment processor: eg. stripe, coinbase, eluvio. Omit for all.",
          type: "string",
          default: "",
        })
        .option("csv", {
          describe: "File path to output csv",
          type: "string",
        })
        .option("offset", {
          describe:
            "Offset in months to dump data where 0 is the current month",
          type: "number",
          default: 1,
        });
    },
    (argv) => {
      CmdTenantSecondarySales({ argv });
    }
  )

  .command(
    "tenant_sales <tenant>",
    "Show tenant sales history",
    (yargs) => {
      yargs
        .positional("tenant", {
          describe: "Tenant ID",
          type: "string",
        })
        .option("processor", {
          describe: "Payment processor: eg. stripe, coinbase, eluvio. Omit for all.",
          type: "string",
          default: "",
        })
        .option("csv", {
          describe: "File path to output csv",
          type: "string",
        })
        .option("offset", {
          describe:
            "Offset in months to dump data where 0 is the current month",
          type: "number",
          default: 1,
        });
    },
    (argv) => {
      CmdTenantUnifiedSales({ argv });
    }
  )

  .command(
    "tenant_wallets <tenant> [options]",
    "Show the wallets associated with this tenant",
    (yargs) => {
      yargs
        .positional("tenant", {
          describe: "Tenant ID",
          type: "string",
        })
        .option("csv", {
          describe: "File path to output csv",
          type: "string",
        })
        .option("max_results", {
          describe: "Show up to these many results (default 0 = unlimited)",
          type: "integer",
        });
    },
    (argv) => {
      CmdTenantWallets({ argv });
    }
  )

  .command(
    "tenant_nft_remove <tenant> <addr>",
    "Removes the nft address from the tenant contract",
    (yargs) => {
      yargs
        .positional("tenant", {
          describe: "Tenant ID",
          type: "string",
        })
        .positional("addr", {
          describe: "NFT Address",
          type: "string",
        });
    },
    (argv) => {
      CmdTenantNftRemove({ argv });
    }
  )

  .command(
    "tenant_nft_list <tenant>",
    "List all tenant_nfts within a tenant contract",
    (yargs) => {
      yargs.positional("tenant", {
        describe: "Tenant ID",
        type: "string",
      });
    },
    (argv) => {
      CmdTenantNftList({ argv });
    }
  )

  .command(
    "tenant_has_nft <tenant> <addr>",
    "Searches tenant_nfts list in tenant contract and returns true if exists",
    (yargs) => {
      yargs
        .positional("tenant", {
          describe: "Tenant ID",
          type: "string",
        })
        .positional("addr", {
          describe: "NFT Address",
          type: "string",
        });
    },
    (argv) => {
      CmdTenantHasNft({ argv });
    }
  )

  .command(
    "tenant_add_consumers <group_id> [addrs..]",
    "Adds address(es) to the tenant's consumer group",
    (yargs) => {
      yargs
        .positional("group_id", {
          describe: "Tenant consumer group ID",
          type: "string",
        })
        .option("addrs", {
          describe:
            "Addresses to add",
          type: "string",
        });
    },
    (argv) => {
      CmdTenantAddConsumers({ argv });
    }
  )

  .command(
    "tenant_remove_consumer <group_id> <addr>",
    "Removes consumer from tenant consumer group",
    (yargs) => {
      yargs
        .positional("group_id", {
          describe: "Tenant consumer group ID",
          type: "string",
        })
        .positional("addr", {
          describe:
            "Address the to add",
          type: "string",
        });
    },
    (argv) => {
      CmdTenantRemoveConsumer({ argv });
    }
  )

  .command(
    "tenant_has_consumer <group_id> <addr>",
    "Returns true or false if addr is in the tenant consumer group",
    (yargs) => {
      yargs
        .positional("group_id", {
          describe: "Tenant consumer group ID",
          type: "string",
        })
        .positional("addr", {
          describe:
            "Address the to add",
          type: "string",
        });
    },
    (argv) => {
      CmdTenantHasConsumer({ argv });
    }
  )

  .command(
    "marketplace_add_item <marketplace> <object> <name> [price] [forSale]",
    "Adds an item to a marketplace",
    (yargs) => {
      yargs.positional("marketplace", {
        describe: "Marketplace object ID",
        type: "string",
      });
      yargs.positional("object", {
        describe: "NFT Template object hash (hq__) or id (iq__)",
        type: "string",
      });
      yargs.positional("name", {
        describe: "Item name"
      });
      yargs.positional("price", {
        describe: "Price to list for",
        type: "number",
      });
      yargs.positional("forSale", {
        describe: "Whether to show for sale",
        type: "boolean",
        default: true,
      });
    },
    (argv) => {
      CmdMarketplaceAddItem({ argv });
    }
  )

  .command(
    "marketplace_add_item_batch <marketplace> <csv>",
    "Adds multiple items to a marketplace",
    (yargs) => {
      yargs.positional("marketplace", {
        describe: "Marketplace object ID",
        type: "string",
      });
      yargs.positional("csv", {
        describe: "CSV file containing object ID's and marketplace item name. Expects first row to be header row with columns ordered as object, name",
        type: "string",
      });
    },
    (argv) => {
      CmdMarketplaceAddItemBatch({ argv });
    }
  )

  .command(
    "marketplace_remove_item <marketplace> <object>",
    "Removes an item from a marketplace",
    (yargs) => {
      yargs.positional("marketplace", {
        describe: "Marketplace object ID",
        type: "string",
      });
      yargs.positional("object", {
        describe: "NFT Template object ID (iq__)",
        type: "string",
      });
    },
    (argv) => {
      CmdMarketplaceRemoveItem({ argv });
    }
  )

  .command(
    "storefront_section_add_item <marketplace> <sku> [section]",
    "Adds an item to a marketplace storefront section",
    (yargs) => {
      yargs.positional("marketplace", {
        describe: "Marketplace object ID",
        type: "string",
      });
      yargs.positional("sku", {
        describe: "Marketplace item SKU",
        type: "string",
      });
      yargs.positional("section", {
        describe: "Storefront section name",
        type: "string",
        string: true,
      });
    },
    (argv) => {
      CmdStorefrontSectionAddItem({ argv });
    }
  )

  .command(
    "storefront_section_remove_item <marketplace> <sku> [writeToken]",
    "Removes an item from a marketplace storefront section",
    (yargs) => {
      yargs.positional("marketplace", {
        describe: "Marketplace object ID",
        type: "string",
      });
      yargs.positional("sku", {
        describe: "Marketplace item SKU",
        type: "string",
      });
      yargs.positional("writeToken", {
        describe: "Write token (if not provided, object will be finalized)",
        type: "string",
      });
    },
    (argv) => {
      CmdStorefrontSectionRemoveItem({ argv });
    }
  )

  .command(
    "tenant_provision <tenant> <slug> [options]",
    `Provision a new tenancy with standard media libraries and content types.
    Run as the tenant root key, as created by space_tenant_create. This is a multi-step operation,
    and intermediate status is saved in the local directory in the file tenant_status.json using --status flag.
    The operation can be resumed by specifying a status file, which indicates the operations
    that have already been executed.
      Funds transferred (default):
      * tenant ops created: 10 elv
      * content ops created: 10 elv
      * faucet funding address: 20 elv`,
    (yargs) => {
      yargs.positional("tenant", {
        describe: "Tenant ID",
        type: "string",
      });
      yargs.positional("slug", {
        describe: "Tenant Slug",
        type: "string",
      });
      yargs.option("name", {
        describe: "Tenant name",
        type: "string"
      })
      yargs.option("status",{
        describe: "Path to the JSON File for existing tenant provision config",
        type: "string",
      });
      yargs.option("init_config",{
        describe: "Displays the initial provisioning config, which can be used to input existing objects",
        type: "boolean",
        default: false
      });
    },
    (argv) => {
      CmdTenantProvision({ argv });
    }
  )

  .command(
    "tenant_add_consumer_group <tenant>",
    "Deploys a BaseTenantConsumerGroup and adds it to this tenant's contract.",
    (yargs) => {
      yargs.positional("tenant", {
        describe: "Tenant ID",
        type: "string",
      });
    },
    (argv) => {
      CmdTenantAddConsumerGroup({ argv });
    }
  )

  .command(
    "tenant_get_minter_config <tenant> [options]",
    "Gets the minter configuration for this tenant key",
    (yargs) => {
      yargs
        .positional("tenant", {
          describe: "Tenant ID",
          type: "string",
        });
    },
    (argv) => {
      CmdTenantGetMinter({ argv });
    }
  )

  .command(
    "tenant_create_minter_config <tenant> [options]",
    "Creates the minter configuration for this tenant key",
    (yargs) => {
      yargs
        .positional("tenant", {
          describe: "Tenant ID",
          type: "string",
        })
        .option("funds", {
          describe: "How much to fund the minter and proxy addresses. Default: 0 (do not fund)",
          type: "integer",
        })
        .option("deploy", {
          describe: "Deploy a new minter helper contract as the minter using the Authority Service. Default: false",
          type: "boolean",
        });
    },
    (argv) => {
      CmdTenantCreateMinter({ argv });
    }
  )

  .command(
    "tenant_replace_minter_config <tenant> [options]",
    "Creates the minter configuration for this tenant key",
    (yargs) => {
      yargs
        .positional("tenant", {
          describe: "Tenant ID",
          type: "string",
        })
        .option("proxy_owner", {
          describe: "Replace proxy owner ID (eg. ikms..). Note that the key must already be stored in the Authority Service to use this.",
          type: "string",
        })
        .option("minter", {
          describe: "Replace minter ID (eg. ikms..). Note that the key must already be stored in the Authority Service to use this.",
          type: "string",
        })
        .option("mint_helper", {
          describe: "Replace minter helper address (hex). The minter must be the owner of this contract.",
          type: "string",
        })
        .option("proxy", {
          describe: "Replace the transfer proxy address (hex). The proxy owner must be the owner of this contract.",
          type: "string",
        })
        .option("mint_shuffle_key", {
          describe: "Replace the mint shuffle key (ikms).  The secret must be already stored in the Authority Service",
          type: "string",
        })
        .option("legacy_shuffle_seed", {
          describe: "Replace the legacy shuffle seed (use '0' to disable).",
          type: "string",
        })
        .option("purge", {
          describe: "Purge will delete the keys first before replacing",
          type: "bool",
        });
    },
    (argv) => {
      CmdTenantReplaceMinter({ argv });
    }
  )

  .command(
    "tenant_deploy_helper_contracts <tenant> [options]",
    "Deploys the minter helper and transfer proxy contracts using the authority service as the minter. Specify option proxy or minthelper to only deploy that specific contract.",
    (yargs) => {
      yargs
        .positional("tenant", {
          describe: "Tenant ID",
          type: "string",
        })
        .option("mint_helper", {
          describe: "Deploy mint helper contract.",
          type: "bool",
        })
        .option("proxy", {
          describe: "Deploy Proxy contract.",
          type: "bool",
        });
    },
    (argv) => {
      CmdTenantDeployHelpers({ argv });
    }
  )

  .command(
    "tenant_delete_minter_config <tenant> [options]",
    "Creates the minter configuration for this tenant key",
    (yargs) => {
      yargs
        .positional("tenant", {
          describe: "Tenant ID",
          type: "string",
        })
        .option("force", {
          describe: "Attempt to delete all keys even on error",
          type: "boolean",
        });
    },
    (argv) => {
      CmdTenantDeleteMinter({ argv });
    }
  )

  .command(
    "tenant_publish_data <tenant> <content_hash> [options]",
    "Submits the new version hash of the tenant Fabric object for validation. The top level Eluvio Live object link will be updated if there are no errors.",
    (yargs) => {
      yargs
        .positional("tenant", {
          describe: "Tenant ID",
          type: "string",
        })
        .positional("content_hash", {
          describe: "Version hash of the new tenant media-wallet settings object; ignored if --media-wallet=false",
          type: "string",
        })
        .option("media_wallet", {
          describe: "indicates if this is a media-wallet-enabled tenant; default: true",
          type: "boolean",
          default: true,
        })
        .option("update_links", {
          describe: "Update links on your tenant Fabric object",
          type: "boolean",
        })
        .option("env", {
          describe: "Environment to use, 'staging' or 'production' (default: production)",
          type: "string",
        });
    },
    (argv) => {
      CmdTenantPublishData({ argv });
    }
  )

  .command(
    "notif_send <user_addr> <tenant> <event>",
    "Sends a notification (using the notification service).",
    (yargs) => {
      yargs
        .positional("user_addr", {
          describe: "User address",
          type: "string",
        })
        .positional("tenant", {
          describe: "Tenant ID",
          type: "string",
        })
        .positional("event", {
          describe: "One of: TOKEN_UPDATED",
          type: "string",
        })
        .option("nft_addr", {
          describe: "NFT contract address (hex)",
          type: "string",
          default: ""
        })
        .option("token_id", {
          describe: "NFT token ID",
          type: "string",
          default: ""
        })
        .option("notif_url", {
          describe: "Notification service URL",
          type: "string",
          default: ""
        });
    },
    (argv) => {
      CmdNotifSend({ argv });
    }
  )

  .command(
    "notif_send_token_update <nft_addr> <tenant>",
    "Sends a TOKEN_UPDATED notification to all owners of this NFT.",
    (yargs) => {
      yargs
        .positional("nft_addr", {
          describe: "NFT contract address (hex)",
          type: "string",
        })
        .positional("tenant", {
          describe: "Tenant ID",
          type: "string",
        })
        .option("notif_url", {
          describe: "Notification service URL",
          type: "string",
          default: ""
        });
    },
    (argv) => {
      CmdNotifSendTokenUpdate({ argv });
    }
  )

  .command(
    "account_create <funds> <account_name> <tenant_admins>",
    "Create a new account -> mnemonic, address, private key",
    (yargs) => {
      yargs
        .positional("funds", {
          describe:
            "How much to fund the new account from this private key in ETH.",
          type: "string",
        })
        .positional("account_name", {
          describe: "Account Name",
          type: "string",
        })
        .positional("tenant_admins", {
          describe: "Tenant Admins group ID",
          type: "string",
        });
    },
    (argv) => {
      CmdAccountCreate({ argv });
    }
  )

  .command("account_show", "Shows current account information.", () => {
    CmdAccountShow();
  })

  .command(
    "payment_contract_create addresses shares",
    "Deploy a payment contract for revenue split.",
    (yargs) => {
      yargs
        .positional("addresses", {
          describe: "List of stake holder addresses (hex), comma separated",
          type: "string"
        })
        .positional("shares", {
          describe: "List of stake holder shares, comma separated (one for each address)",
          type: "string"
        });
    },
    (argv) => {
      CmdPaymentCreate({ argv });
    }
  )

  .command(
    "payment_contract_show addr token_addr",
    "Show status of payment contract stakeholders.",
    (yargs) => {
      yargs
        .positional("addr", {
          describe: "Address of the payment contract (hex)",
          type: "string"
        })
        .positional("token_addr", {
          describe: "Address of the ERC20 token contract (hex)",
          type: "string"
        });
    },
    (argv) => {
      CmdPaymentShow({ argv });
    }
  )

  .command(
    "payment_release addr token_addr",
    "Retrieve payment from payment splitter contract as a payee or for a payee using --payee flag",
    (yargs) => {
      yargs
        .positional("addr", {
          describe: "Address of the payment contract (hex)",
          type: "string"
        })
        .positional("token_addr", {
          describe: "Address of the ERC20 token contract (hex)",
          type: "string"
        })
        .option("payee", {
          describe: "payee address",
          type: "string",
          default: "",
        });
    },
    (argv) => {
      CmdPaymentRelease({ argv });
    }
  )

  .command(
    "token_contract_create <name> <symbol> <decimals> <amount> [options]",
    "Deploy elv token  contract",
    (yargs) => {
      yargs
        .positional("name", {
          describe: "elv_token name",
          type: "string",
        })
        .positional("symbol", {
          describe: "elv_token symbol",
          type: "string",
        })
        .positional("decimals", {
          describe: "elv_token decimals",
          type: "number",
        })
        .positional("amount", {
          describe: "elv_token premint amount",
          type: "number",
        });
    },
    (argv) => {
      CmdTokenCreate({ argv });
    }
  )

  .command(
    "token_transfer <token_addr> <to_addr> <amount> [options]",
    "Transfer given elv tokens to address provided",
    (yargs) => {
      yargs
        .positional("token_addr", {
          describe: "elv_token address",
          type: "string",
        })
        .positional("to_addr", {
          describe: "to address",
          type: "string",
        })
        .positional("amount", {
          describe: "transfer amount",
          type: "number",
        });
    },
    (argv) => {
      CmdTokenTransfer({ argv });
    }
  )


  .command(
    "token_balance_of <token_addr> <user_addr> [options]",
    "Get the token balance of a given user",
    (yargs) => {
      yargs
        .positional("token_addr", {
          describe: "elv_token address",
          type: "string",
        })
        .positional("user_addr", {
          describe: "user address",
          type: "string",
        });
    },
    (argv) => {
      CmdTokenBalanceOf({ argv });
    }
  )

  .command(
    "token_add_minter <addr> <minter>",
    "Add minter or mint helper address to NFT or Token",
    (yargs) => {
      yargs
        .positional("addr", {
          describe: "NFT or Token address (hex)",
          type: "string",
        })
        .option("minter", {
          describe: "Minter or mint helper address (hex)",
          type: "string",
        });
    },
    (argv) => {
      CmdTokenAddMinter({ argv });
    }
  )

  .command(
    "token_renounce_minter <addr>",
    "Renounce the minter(msg.sender) from NFT or Token",
    (yargs) => {
      yargs
        .positional("addr", {
          describe: "NFT or Token address (hex)",
          type: "string",
        });
    },
    (argv) => {
      CmdTokenRenounceMinter({ argv });
    }
  )

  .command(
    "token_is_minter <addr> <minter>",
    "check if minter to NFT or Token",
    (yargs) => {
      yargs
        .positional("addr", {
          describe: "NFT or Token address (hex)",
          type: "string",
        })
        .option("minter", {
          describe: "Minter address (hex)",
          type: "string",
        });
    },
    (argv) => {
      CmdTokenIsMinter({ argv });
    }
  )

  .command(
    "content_set_policy <object> <policy_path> [data]",
    "Set the policy on an existing content object. This also sets the delegate on the object contract to itself.",
    (yargs) => {
      yargs
        .positional("object", {
          describe: "ID of the content object",
          type: "string",
        })
        .positional("policy_path", {
          describe: "Path to the content object policy file (eg. policy.yaml)",
          type: "string",
        })
        .option("data", {
          describe: "Metadata path within the policy object to link to",
          type: "string",
        });
    },
    (argv) => {
      CmdContentSetPolicy({ argv });
    }
  )

  .command(
    "content_set_policy_delegate <object> <delegate>",
    "Set the policy delegate on the object contract.",
    (yargs) => {
      yargs
        .positional("object", {
          describe: "ID of the content object",
          type: "string",
        })
        .positional("delegate", {
          describe: "ID of the content object policy delegate",
          type: "string",
        });
    },
    (argv) => {
      CmdContentSetPolicyDelegate({ argv });
    }
  )

  .command(
    "content_get_policy <object>",
    "Get the content object policy from the object metadata and the delegate from the object's contract meta",
    (yargs) => {
      yargs
        .positional("object", {
          describe: "ID of the content object",
          type: "string",
        });
    },
    (argv) => {
      CmdContentGetPolicy({ argv });
    }
  )

  .command(
    "content_clear_policy <object>",
    "Remove content object policy from the object metadata and the delegate from the object's contract meta",
    (yargs) => {
      yargs
        .positional("object", {
          describe: "ID of the content object",
          type: "string",
        });
    },
    (argv) => {
      CmdContentClearPolicy({ argv });
    }
  )

  .command(
    "list [options]",
    "List the Eluvio Live Tenants",
    (yargs) => {
      yargs
        .option("tenant", {
          describe: "Show the tenant based on id. Eg. itenXXX...",
          type: "string",
        })
        .option("tenant_slug", {
          describe: "Show the tenant based on slug. Eg. elv-live",
          type: "string",
        });
    },
    (argv) => {
      CmdList({ argv });
    }
  )

  .command(
    "create_wallet_account <email> <tenant> <property_slug>",
    "create a wallet account and send tenant-branded email",
    (yargs) => {
      yargs
        .positional("email", {
          describe: "the email to create the account for, or @filename for list of emails",
          type: "string",
        })
        .positional("tenant", {
          describe: "the tenant in format iten...",
          type: "string",
        })
        .positional("property_slug", {
          describe: "the property slug. e.g., epcrtv",
          type: "string",
        })
        .option("only_create_account", {
          describe: "only create the account, don't send email",
          type: "boolean",
        })
        .option("only_send_email", {
          describe: "only send account-creation email, do not create the account",
          type: "boolean",
        })
        .option("schedule_at", {
          describe: "set future time for account-creation email (format is 2024-11-13T01:07:05Z)",
          type: "string",
        });
    },
    (argv) => {
      CmdCreateWalletAccount({ argv });
    }
  )

  .command(
    "shuffle <file> [options]",
    "Sort each line deterministically based on the seed",
    (yargs) => {
      yargs
        .positional("file", {
          describe: "File or directory path",
          type: "string",
        })
        .option("seed", {
          describe:
            "Determines the order. If no seed is provided, the shuffler uses a random one.",
          type: "string",
        })
        .option("check_dupes", {
          describe: "Abort if duplicate is found",
          type: "boolean",
        })
        .option("print_js", {
          describe: "Print result as an array in JavaScript",
          type: "boolean",
        });
    },
    (argv) => {
      CmdShuffle({ argv });
    }
  )

  .command(
    "admin_health [options]",
    "Checks the health of the Authority Service APIs. Note the current key must be a system admin configured in the AuthD servers.",
    (yargs) => {
      yargs;
    },
    (argv) => {
      CmdAdminHealth({ argv });
    }
  )

  .strict()
  .wrap(yargs().terminalWidth() != null ? Math.min(120, yargs().terminalWidth()) : 120)
  .help()
  .usage("EluvioLive CLI\n\nUsage: elv-live <command>")
  .scriptName("")
  .demandCommand(1).argv;

// For unit testing
exports.CmdShuffle = CmdShuffle;
