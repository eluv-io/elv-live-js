const { ElvClient } = require("elv-client-js");
const { EluvioLive } = require("../src/EluvioLive.js");
const { Config } = require("../src/Config.js");
const { Shuffler } = require("../src/Shuffler");

const yargs = require("yargs/yargs");
const { hideBin } = require("yargs/helpers");
const yaml = require("js-yaml");
const fs = require("fs");
const path = require("path");

let elvlv;

const Init = async () => {
  console.log("Network: " + Config.net);

  elvlv = new EluvioLive({
    configUrl: Config.networks[Config.net],
    mainObjectId: Config.mainObjects[Config.net],
  });
  await elvlv.Init();
};

const CmfNftTemplateAddNftContract = async ({ argv }) => {
  console.log(
    "NFT Template - set contract",
    argv.library,
    argv.object,
    argv.tenant,
    argv.minthelper,
    argv.minter,
    argv.cap,
    argv.name,
    argv.symbol,
    argv.nftAddress
  );
  await Init();

  let c = await elvlv.NftTemplateAddNftContract({
    libraryId: argv.library,
    objectId: argv.object,
    //nftAddr,
    tenantId: argv.tenant,
    mintHelperAddr: argv.minthelper, //"0x59e79eFE007F5208857a646Db5cBddA82261Ca81",
    minterAddr: argv.minter,
    totalSupply: argv.cap,
    collectionName: argv.name,
    collectionSymbol: argv.symbol,
    hold: argv.hold,
    contractUri: "",
    proxyAddress: "",
  });
};

const CmfNftAddMintHelper = async ({ argv }) => {
  console.log("NFT - add mint helper", argv.addr, argv.minter);
  await Init();

  let c = await elvlv.NftAddMinter({
    addr: argv.addr,
    minterAddr: argv.minter,
  });
};

const CmfNftSetProxy = async ({ argv }) => {
  console.log("NFT - set proxy", argv.addr, argv.proxy_addr);
  await Init();

  let p = await elvlv.NftSetTransferProxy({
    addr: argv.addr,
    proxyAddr: argv.proxy_addr,
  });
  console.log("Proxy: ", p);
};

const CmdNftBalanceOf = async ({ argv }) => {
  console.log("NFT - call", argv.addr, argv.owner);

  await Init();

  let res = await elvlv.NftBalanceOf({
    addr: argv.addr,
    ownerAddr: argv.owner,
  });

  console.log(yaml.dump(res));
};

const CmdNftShow = async ({ argv }) => {
  console.log("NFT - show", argv.addr, argv.show_owners);

  await Init();

  let res = await elvlv.NftShow({
    addr: argv.addr,
    mintHelper: argv.check_minter,
    showOwners: argv.show_owners,
  });

  console.log(yaml.dump(res));
};

const CmdNftBuild = async ({ argv }) => {
  console.log("NFT - build public/nft", argv.object);

  await Init();

  let res = await elvlv.NftBuild({
    libraryId: argv.library,
    objectId: argv.object,
  });

  console.log(yaml.dump(res));
};

const CmdNftLookup = async ({ argv }) => {
  console.log("NFT - lookup", argv.addr, argv.token_id);

  await Init();

  let res = await elvlv.NftLookup({
    addr: argv.addr,
    tokenId: argv.token_id,
  });

  console.log(yaml.dump(res));
};

const CmdNftProxyTransfer = async ({ argv }) => {
  console.log(
    "NFT - transer as proxy owner",
    argv.addr,
    argv.from_addr,
    argv.to_addr
  );

  await Init();

  let res = await elvlv.NftProxyTransferFrom({
    addr: argv.addr,
    tokenId: argv.token_id,
    fromAddr: argv.from_addr,
    toAddr: argv.to_addr,
  });

  console.log(yaml.dump(res));
};

const CmdTenantShow = async ({ argv }) => {
  console.log("Tenant - show", argv.tenant);

  await Init();

  let res = await elvlv.TenantShow({
    tenantId: argv.tenant,
    libraryId: argv.library,
    objectId: argv.object,
    marketplaceId: argv.marketplace,
    eventId: argv.event,
    cauth: argv.check_cauth,
    mintHelper: argv.check_minter,
  });

  console.log(yaml.dump(res));
};

const CmdSiteShow = async ({ argv }) => {
  console.log("Site - show", argv.object);

  await Init();

  let res = await elvlv.SiteShow({
    libraryId: argv.library,
    objectId: argv.object,
  });

  console.log(yaml.dump(res));
};

const CmdSiteSetDrop = async ({ argv }) => {
  console.log("Site - set drop", argv.object, argv.uuid, "update", argv.update);

  await Init();

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
};

const CmdTenantBalanceOf = async ({ argv }) => {
  console.log("Tenant - balance of", argv.tenant, argv.owner, argv.max_results);

  await Init();

  let res = await elvlv.TenantBalanceOf({
    tenantId: argv.tenant,
    ownerAddr: argv.owner,
    maxNumber: argv.max_results,
  });

  console.log(yaml.dump(res));
};

const CmdFabricTenantBalanceOf = async ({ argv }) => {
  console.log("Fabric Tenant - balance of", argv.object, argv.owner);

  await Init();

  let res = await elvlv.FabricTenantBalanceOf({
    objectId: argv.object,
    ownerAddr: argv.owner,
  });

  console.log(yaml.dump(res));
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
    await Init();

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
  console.log(
    `Tenant wallets tenant: ${argv.tenant} max_results: ${argv.max_results}`
  );
  try {
    await Init();

    let res = await elvlv.TenantWallets({
      tenant: argv.tenant,
      maxNumber: argv.max_results,
    });

    console.log(yaml.dump(res));
  } catch (e) {
    console.error("ERROR:", e);
  }
};

const CmdList = async ({ argv }) => {
  console.log(`list tenant: ${argv.tenant} tenant_slug: ${argv.tenant_slug}`);
  try {
    await Init();

    let res = await elvlv.List({
      tenantId: argv.tenant,
      tenantSlug: argv.tenant_slug,
    });

    if (argv.tenant) {
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

const CmdTenantPrimarySales = async ({ argv }) => {
  console.log(
    `Tenant Primary Sales: ${argv.tenant} ${argv.marketplace} ${argv.processor}`
  );
  console.log(`Offset: ${argv.offset}`);
  console.log(`CSV: ${argv.csv}`);

  try {
    await Init();

    let res = await elvlv.TenantPrimarySales({
      tenant: argv.tenant,
      marketplace: argv.marketplace,
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

const CmdTenantSecondarySales = async ({ argv }) => {
  console.log(`Tenant Secondary Sales: ${argv.tenant} ${argv.processor}`);
  console.log(`Offset: ${argv.offset}`);
  console.log(`CSV: ${argv.csv}`);

  try {
    await Init();

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

FilterListTenant = ({ tenant }) => {
  let res = {};
  res.result = {};
  res.warns = [];

  let tenantObject = elvlv.FilterTenant({ object: tenant });
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

  keys = Object.keys(tenantObject.sites);

  for (const key of keys) {
    let { result, warns } = elvlv.FilterSite({
      object: tenantObject.sites[key],
    });
    let site = result;
    tenantObject.sites[key] = site;
    res.warns = res.warns.concat(warns);
  }

  res.result = tenantObject;

  return res;
};

yargs(hideBin(process.argv))
  .command(
    "nft_add_contract <library> <object> <tenant> [minthelper] [cap] [name] [symbol] [nftaddr] [hold]",
    "Add a new or existing NFT contract to an NFT Template object",
    (yargs) => {
      yargs
        .positional("library", {
          describe: "NFT Template library ID",
          type: "string",
        })
        .positional("object", {
          describe: "NFT Template object ID",
          type: "string",
        })
        .positional("tenant", {
          describe: "Tenant ID",
          type: "string",
        })
        .option("minthelper", {
          describe: "Mint helper address (hex)",
          type: "string",
        })
        .option("minter", {
          describe: "Minter address (hex)",
          type: "string",
        })
        .option("cap", {
          describe: "NFT total supply cap",
          type: "number",
        })
        .option("name", {
          describe: "NFT collection name",
          type: "string",
        })
        .option("symbol", {
          describe: "NFT collection symbol",
          type: "string",
        })
        .option("nftaddr", {
          describe: "NFT contract address (will not create a new one)",
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
    "nft_add_minter <addr> <minter>",
    "Add a new or existing NFT contract to an NFT Template object",
    (yargs) => {
      yargs
        .positional("addr", {
          describe: "NFT address (hex)",
          type: "string",
        })
        .option("minter", {
          describe: "Minter or mint helper address (hex)",
          type: "string",
        });
    },
    (argv) => {
      CmfNftAddMintHelper({ argv });
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
    "nft_show <addr>",
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
          describe: "Show up to these many owners (default 0)",
          type: "integer",
        });
    },
    (argv) => {
      CmdNftShow({ argv });
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
          describe: "NFT address (hex)",
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
    "nft_build <library> <object>",
    "Build the public/nft section based on asset metadata",
    (yargs) => {
      yargs
        .positional("library", {
          describe: "Content library",
          type: "string",
        })
        .positional("object", {
          describe: "Content object hash (hq__) or id (iq__)",
          type: "string",
        });
    },
    (argv) => {
      CmdNftBuild({ argv });
    }
  )

  .command(
    "nft_lookup <addr> <token_id>",
    "Decode and look up a local NFT by external token ID",
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
      var x = CmdNftLookup({ argv });
      console.log(x);
    }
  )

  .command(
    "tenant_show <tenant> <library> <object> [event] [marketplace]",
    "Show info on this tenant",
    (yargs) => {
      yargs
        .positional("tenant", {
          describe: "Tenant ID",
          type: "string",
        })
        .positional("library", {
          describe: "Tenant-level EluvioLive library",
          type: "string",
        })
        .positional("object", {
          describe: "Tenant-level EluvioLive object ID",
          type: "string",
        })
        .option("event", {
          describe: "Event ID",
          type: "string",
        })
        .option("marketplace", {
          describe: "Marketplace ID",
          type: "string",
        })
        .option("check_cauth", {
          describe:
            "Check that all NFTs use this minter address in ikms format",
          type: "string",
        })
        .option("check_minter", {
          describe: "Check that all NFTs use this mint helper",
          type: "string",
        });
    },
    (argv) => {
      CmdTenantShow({ argv });
    }
  )

  .command(
    "tenant_balance_of <tenant> <owner>",
    "Show NFTs owned by this owner in this tenant",
    (yargs) => {
      yargs
        .positional("tenant", {
          describe: "Tenant ID",
          type: "string",
        })
        .positional("owner", {
          describe: "Owner address (hex)",
          type: "string",
        });
    },
    (argv) => {
      CmdTenantBalanceOf({ argv });
    }
  )

  .command(
    "fabric_tenant_balance_of <object> <owner> [options]",
    "Show NFTs owned by this owner in this tenant",
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
        .option("quanity", {
          describe: "Specify how many to mint (default 1)",
          type: "integer",
        });
    },
    (argv) => {
      CmdTenantMint({ argv });
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
    "tenant_primary_sales <tenant> <marketplace> <processor>",
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
        .positional("processor", {
          describe: "Payment processor: eg. stripe, coinbase, eluvio",
          type: "string",
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
      CmdTenantPrimarySales({ argv });
    }
  )

  .command(
    "tenant_secondary_sales <tenant> <processor>",
    "Show tenant secondary sales history",
    (yargs) => {
      yargs
        .positional("tenant", {
          describe: "Tenant ID",
          type: "string",
        })
        .positional("processor", {
          describe: "Payment processor: eg. stripe, coinbase, eluvio",
          type: "string",
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

  .help()
  .usage("EluvioLive CLI\n\nUsage: elv-live <command>")
  .scriptName("")
  .demandCommand(1).argv;

// For unit testing
exports.CmdShuffle = CmdShuffle;
