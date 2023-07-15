const { ElvSpace } = require("../src/ElvSpace.js");
const { ElvTenant } = require("../src/ElvTenant.js");
const { ElvAccount } = require("../src/ElvAccount.js");
const { ElvContracts } = require("../src/ElvContracts.js");
const { Config } = require("../src/Config.js");

const yargs = require("yargs/yargs");
const { hideBin } = require("yargs/helpers");
const yaml = require("js-yaml");

// hack that quiets this msg:
//  node:87980) ExperimentalWarning: The Fetch API is an experimental feature. This feature could change at any time
//  (Use `node --trace-warnings ...` to show where the warning was created)
const originalEmit = process.emit;
process.emit = function (name, data, ...args) {
  if(name === `warning` && typeof data === `object` && data.name === `ExperimentalWarning`) {
    return false;
  }
  return originalEmit.apply(process, arguments);
};

const CmdAccountCreate = async ({ argv }) => {
  console.log("Account Create\n");
  console.log(`funds: ${argv.funds}`);
  console.log(`account_name: ${argv.account_name}`);
  console.log(`tenant_admins: ${argv.tenant_admins}`);

  try {
    let elvAccount = new ElvAccount({
      configUrl: Config.networks[Config.net],
      debugLogging: argv.verbose
    });

    await elvAccount.Init({
      privateKey: process.env.PRIVATE_KEY,
    });

    let res = await elvAccount.Create({
      funds: argv.funds,
      accountName: argv.account_name,
      tenantAdminsAddress: argv.tenant_admins,
    });
    console.log(yaml.dump(res));
  } catch (e) {
    console.error("ERROR:", e);
  }
};

const CmdAccountSetTenantContractId = async ({ argv }) => {
  console.log("Account Set Tenant Contract ID\n");
  console.log(`tenant_contract_id: ${argv.tenant}`);

  try {
    let elvAccount = new ElvAccount({
      configUrl: Config.networks[Config.net],
      debugLogging: argv.verbose
    });
    await elvAccount.InitWithId({
      privateKey: process.env.PRIVATE_KEY,
      id: argv.tenant,
    })
    console.log("Success!");
  } catch (e) {
    console.error("ERROR:", e);
  }
}


const CmdAccountShow = async ({ argv }) => {
  console.log("Account Show\n");

  try {
    let elvAccount = new ElvAccount({
      configUrl: Config.networks[Config.net],
      debugLogging: argv.verbose
    });

    await elvAccount.Init({
      privateKey: process.env.PRIVATE_KEY,
    });
    let res = await elvAccount.Show();
    console.log(yaml.dump(res));
  } catch (e) {
    console.error("ERROR:", e);
  }
};

const CmdGroupCreate = async ({ argv }) => {
  console.log("Group Create\n");
  console.log(`name: ${argv.name}`);

  try {
    let elvAccount = new ElvAccount({
      configUrl: Config.networks[Config.net],
      debugLogging: argv.verbose
    });

    await elvAccount.Init({
      privateKey: process.env.PRIVATE_KEY,
    });

    let res = await elvAccount.CreateAccessGroup({
      name: argv.name,
    });
    console.log(yaml.dump(res));
  } catch (e) {
    console.error("ERROR:", e);
  }
};

const CmdAccountSend = async ({ argv }) => {
  console.log("Account Send\n");
  console.log(`address: ${argv.address}`);
  console.log(`funds: ${argv.funds}`);

  try {
    let elvAccount = new ElvAccount({
      configUrl: Config.networks[Config.net],
      debugLogging: argv.verbose
    });

    await elvAccount.Init({
      privateKey: process.env.PRIVATE_KEY,
    });

    await elvAccount.Send({
      address: argv.address,
      funds: argv.funds
    });
    console.log("Success!");
  } catch (e) {
    console.error("ERROR:", e);
  }
};

const CmdGroupAdd = async ({ argv }) => {
  console.log("Group Add\n");
  console.log(`Group address: ${argv.group_address}`);
  console.log(`Account address: ${argv.account_address}`);
  console.log(`Is Manager?: ${argv.is_manager}`);

  try {
    let elvAccount = new ElvAccount({
      configUrl: Config.networks[Config.net],
      debugLogging: argv.verbose
    });

    await elvAccount.Init({
      privateKey: process.env.PRIVATE_KEY,
    });

    let res = await elvAccount.AddToAccessGroup({
      groupAddress: argv.group_address,
      accountAddress: argv.account_address,
      isManager: argv.is_manager,
    });
    console.log(yaml.dump(res));
  } catch (e) {
    console.error("ERROR:", e);
  }
};

const CmdSpaceTenantCreate = async ({ argv }) => {
  console.log("Tenant Deploy");
  console.log(`Tenant name: ${argv.tenant_name}`);
  console.log(`Funds: ${argv.funds}`);
  console.log(`verbose: ${argv.verbose}`);

  try {
    let space = new ElvSpace({
      configUrl: Config.networks[Config.net],
      spaceAddress: Config.consts[Config.net].spaceAddress,
      kmsAddress: Config.consts[Config.net].kmsAddress,
      debugLogging: argv.verbose
    });
    await space.Init({ spaceOwnerKey: process.env.PRIVATE_KEY });

    res = await space.TenantCreate({
      tenantName: argv.tenant_name,
      funds: argv.funds,
    });

    console.log(yaml.dump(res));

  } catch (e) {
    console.error("ERROR:", e);
  }
};

const CmdSpaceTenantDeploy = async ({ argv }) => {
  console.log("Tenant Deploy");
  console.log(`Tenant name: ${argv.tenant_name}`);
  console.log(`Owner address: ${argv.owner_addr}`);
  console.log(`Tenant admin group address: ${argv.tenant_admin_addr}`);
  console.log(`Content admin group address: ${argv.content_admin_addr}`);

  try {
    let space = new ElvSpace({
      configUrl: Config.networks[Config.net],
      spaceAddress: Config.consts[Config.net].spaceAddress,
      kmsAddress: Config.consts[Config.net].kmsAddress,
      debugLogging: argv.verbose
    });
    await space.Init({ spaceOwnerKey: process.env.PRIVATE_KEY });

    res = await space.TenantDeploy({
      tenantName: argv.tenant_name,
      ownerAddress: argv.owner_addr,
      tenantAdminGroupAddress: argv.tenant_admin_addr,
      contentAdminGroupAddress: argv.content_admin_addr,
    });

    console.log(yaml.dump(res));
  } catch (e) {
    console.error("ERROR:", e);
  }
};

const CmdSpaceTenantInfo = async ({ argv }) => {
  console.log("Tenant info");
  console.log(`Tenant: ${argv.tenant}`);

  try {
    let t = new ElvTenant({
      configUrl: Config.networks[Config.net],
      debugLogging: argv.verbose
    });
    await t.Init({ privateKey: process.env.PRIVATE_KEY });

    res = await t.TenantInfo({
      tenantId: argv.tenant
    });

    console.log(yaml.dump(res));
  } catch (e) {
    console.error("ERROR:", e);
  }
};

const CmdTenantShow = async({ argv }) => {
  console.log("Tenant - show", argv.tenant);
  console.log("Network: " + Config.net);

  try {
    let t = new ElvTenant({
      configUrl: Config.networks[Config.net],
      debugLogging: argv.verbose
    });
    await t.Init({ privateKey: process.env.PRIVATE_KEY });

    let res = await t.TenantShow({
      tenantId: argv.tenant,
      show_metadata: argv.show_metadata
    });

    console.log(yaml.dump(res));
    if (res.errors) { 
      console.log(`ERROR: tenant_show detected ${res.errors.length} error(s), run ./elv-admin tenant_fix ${argv.tenant} to resolve them.`);
    }
  } catch (e) {
    console.error("ERROR:", e);
  }
};

const CmdTenantFix = async({ argv }) => {
  console.log("Tenant - fix", argv.tenant);
  console.log("Network: " + Config.net);

  try {
    let t = new ElvTenant({
      configUrl: Config.networks[Config.net],
      debugLogging: argv.verbose
    });
    await t.Init({ privateKey: process.env.PRIVATE_KEY });

    let res = await t.TenantShow({
      tenantId: argv.tenant
    });
    let errors = res.errors;
    let unresolved = [];

    if (!errors) {
      console.log(`No error found for tenant with tenant id: ${argv.tenant}!`);
      return;
    }

    for (let i = 0; i < errors.length; i++) {
      let error = errors[i];
      switch(error) {
        case 'missing content admins':
          await t.TenantSetContentAdmins({tenantId: argv.tenant});
          console.log(`Created new content admin group for tenant with tenantId ${argv.tenant}`);
          break;

        case 'tenant admin group is not associated with any tenant': 
          await t.TenantSetGroupContractId({tenantId: argv.tenant, groupAddress: res.tenant_admin_address});
          break;

        case 'content admin group is not associated with any tenant':
          await t.TenantSetGroupContractId({tenantId: argv.tenant, groupAddress: res.content_admin_address});
          break;

        default:
          console.log(`No fix actions available for error: ${error}.`)
          unresolved.push(error);
      }
    }

    console.log(`${errors.length - unresolved.length} errors fixed, ${unresolved.length} errors remaining.`)
  } catch (e) {
    console.error("ERROR:", e);
  }
}

const CmdTenantSetContentAdmins = async ({ argv }) => {
  console.log(`Setting a new content admin group for Tenant ${argv.tenant}`);
  console.log("Network: " + Config.net);

  try {
    let t = new ElvTenant({
      configUrl: Config.networks[Config.net],
      debugLogging: argv.verbose
    });
    await t.Init({ privateKey: process.env.PRIVATE_KEY });

    let res = await t.TenantSetContentAdmins({
      tenantId: argv.tenant,
    });

    console.log(yaml.dump(res));
  } catch (e) {
    console.error("ERROR:", e);
  }
};

const CmdTenantRemoveContentAdmin = async ({ argv }) => {
  console.log(`Removing a Content Admin from Tenant ${argv.tenant}`);
  console.log(`Removed Content Admin's Address: ${argv.content_admin_address}`);
  console.log("Network: " + Config.net);
  
  try {
    let t = new ElvTenant({
      configUrl: Config.networks[Config.net],
      debugLogging: argv.verbose
    });
    await t.Init({ privateKey: process.env.PRIVATE_KEY });

    let res = await t.TenantRemoveContentAdmin({
      tenantId: argv.tenant,
      contentAdminsAddress: argv.content_admin_address
    });

    console.log(yaml.dump(res));
  } catch (e) {
    console.error("ERROR:", e);
  }
};

const CmdSpaceTenantSetEluvioLiveId = async ({ argv }) => {
  console.log("Tenant set Eluvio Live ID");
  console.log(`Tenant: ${argv.tenant}`);
  console.log(`Eluvio Live ID: ${argv.eluvio_live_id}`);

  try {
    let t = new ElvTenant({
      configUrl: Config.networks[Config.net],
      debugLogging: argv.verbose
    });
    await t.Init({ privateKey: process.env.PRIVATE_KEY });

    res = await t.TenantSetEluvioLiveId({
      tenantId: argv.tenant,
      eluvioLiveId: argv.eluvio_live_id
    });

    console.log(yaml.dump(res));
  } catch (e) {
    console.error("ERROR:", e);
  }

};

const CmdAccountOfferSignature = async ({ argv }) => {
  console.log("Account Offer Signature\n");
  console.log("args", argv);

  try {
    let elvAccount = new ElvAccount({
      configUrl: Config.networks[Config.net],
      debugLogging: argv.verbose
    });

    await elvAccount.Init({
      privateKey: process.env.PRIVATE_KEY,
    });

    let res = await elvAccount.CreateOfferSignature({
      nftAddress: argv.nft_addr,
      mintHelperAddress: argv.mint_helper_addr,
      tokenId: argv.token_id,
      offerId: argv.offer_id
    });

    console.log(yaml.dump(res));
  } catch (e) {
    console.error("ERROR:", e);
  }
};

const CmdAccountFabricToken = async ({ argv }) => {
  console.log("Account Fabric Token\n");
  console.log("args", argv);

  try {
    let elvAccount = new ElvAccount({
      configUrl: Config.networks[Config.net],
      debugLogging: argv.verbose
    });

    await elvAccount.Init({
      privateKey: process.env.PRIVATE_KEY,
    });

    let res = await elvAccount.CreateFabricToken({
      duration: argv.duration
    });

    console.log(yaml.dump(res));
  } catch (e) {
    console.error("ERROR:", e);
  }
};

const CmdAccountSignedToken = async ({ argv }) => {
  console.log("Account Signed Token\n");
  console.log("args", argv);

  try {
    let elvAccount = new ElvAccount({
      configUrl: Config.networks[Config.net],
      debugLogging: argv.verbose
    });

    await elvAccount.Init({
      privateKey: process.env.PRIVATE_KEY,
    });

    let context;

    if (argv.context){
      context = JSON.parse(argv.context);
    }

    let res = await elvAccount.CreateSignedToken({
      libraryId:argv.library_id,
      objectid: argv.object_id,
      versionHash: argv.version_hash,
      policyId: argv.policy_id,
      subject: argv.subject,
      granttype: argv.grant_type,
      duration: argv.duration,
      allowDecryption: argv.allow_decryption,
      context
    });

    console.log(yaml.dump(res));
  } catch (e) {
    console.error("ERROR:", e);
  }
};

const CmdFabricGetMetaBatch = async ({ argv }) => {
  try {
    let elvFabric = new ElvFabric({
      configUrl: Config.networks[Config.net],
      debugLogging: argv.verbose
    });

    await elvFabric.Init({
      privateKey: process.env.PRIVATE_KEY,
    });

    let res = await elvFabric.GetMetaBatch({
      csvFile: argv.csv_file,
      libraryId: argv.library,
      limit: argv.limit
    });

    console.log(res); // CSV output
  } catch (e) {
    console.error("ERROR:", e);
  }
};

const CmdFabricSetMetaBatch = async ({ argv }) => {
  console.log("Set Meta Batch", "duplicate", argv.duplicate);

  try {
    let elvFabric = new ElvFabric({
      configUrl: Config.networks[Config.net],
      debugLogging: argv.verbose
    });

    await elvFabric.Init({
      privateKey: process.env.PRIVATE_KEY,
      update: true
    });

    let res = await elvFabric.SetMetaBatch({
      csvFile: argv.csv_file,
      duplicate: argv.duplicate
    });

    console.log(yaml.dump(res));
  } catch (e) {
    console.error("ERROR:", e);
  }
};

const CmdContractGetMeta = async ({ argv }) => {
  console.log("Get Contract Metadata", 
    `address: ${argv.addr}`,
    `key: ${argv.key}`,
    `verbose: ${argv.verbose}`);

  try {
    let elvFabric = new ElvFabric({
      configUrl: Config.networks[Config.net],
      debugLogging: argv.verbose
    });

    await elvFabric.Init({
      privateKey: process.env.PRIVATE_KEY
    });

    let res = await elvFabric.GetContractMeta({
      address: argv.addr,
      key: argv.key
    });

    console.log(yaml.dump(res));
  } catch (e) {
    console.error("ERROR:", e);
  }
};

const CmdContractSetMeta = async ({ argv }) => {
  console.log("Set Contract Metadata", 
    `address: ${argv.addr}`,
    `key: ${argv.key}`,
    `value: ${argv.value}`,
    `verbose: ${argv.verbose}`);

  try {
    let elvFabric = new ElvFabric({
      configUrl: Config.networks[Config.net],
      debugLogging: argv.verbose
    });

    await elvFabric.Init({
      privateKey: process.env.PRIVATE_KEY
    });

    let res = await elvFabric.SetContractMeta({
      address: argv.addr,
      key: argv.key,
      value: argv.value
    });

    console.log(yaml.dump(res));
  } catch (e) {
    console.error("ERROR:", e);
  }
};

const CmdAccessGroupMember = async ({ argv }) => {
  console.log("AccessGroupMember", 
    `group: ${argv.group}`,
    `addr: ${argv.addr}`);

  try {
    let elvFabric = new ElvFabric({
      configUrl: Config.networks[Config.net],
      debugLogging: argv.verbose
    });

    await elvFabric.Init({
      privateKey: process.env.PRIVATE_KEY
    });

    let res = await elvFabric.AccessGroupMember({
      group: argv.group,
      addr: argv.addr
    });

    console.log(yaml.dump(res));
  } catch (e) {
    console.error("ERROR:", e);
  }
};

const CmdAccessGroupMembers = async ({ argv }) => {
  console.log("AccessGroupMembers", 
    `group: ${argv.group}`);

  try {
    let elvFabric = new ElvFabric({
      configUrl: Config.networks[Config.net],
      debugLogging: argv.verbose
    });

    await elvFabric.Init({
      privateKey: process.env.PRIVATE_KEY
    });

    let res = await elvFabric.AccessGroupMembers({
      group: argv.group
    });

    console.log(yaml.dump(res));
  } catch (e) {
    console.error("ERROR:", e);
  }
};

const CmdClaimerAllocate = async ({ argv }) => {
  console.log("Claimer Allocate\n");
  console.log("args", argv);

  try {
    let elvContract = new ElvContracts({
      configUrl: Config.networks[Config.net],
      debugLogging: argv.verbose
    });

    await elvContract.Init({
      privateKey: process.env.PRIVATE_KEY,
    });

    let res = await elvContract.ClaimerAllocate({
      address: argv.address,
      amount: argv.amount,
      expirationDate: argv.yyyy_mm_dd
    });

    console.log(yaml.dump(res));
  } catch (e) {
    console.error("ERROR:", e);
  }
};

const CmdClaimerClaim = async ({ argv }) => {
  console.log("Claimer Claim\n");
  console.log("args", argv);

  try {
    let elvContract = new ElvContracts({
      configUrl: Config.networks[Config.net],
      debugLogging: argv.verbose
    });

    await elvContract.Init({
      privateKey: process.env.PRIVATE_KEY,
    });

    let res = await elvContract.ClaimerClaim({
      amount: argv.amount
    });

    console.log(yaml.dump(res));
  } catch (e) {
    console.error("ERROR:", e);
  }
};

const CmdClaimerBurn = async ({ argv }) => {
  console.log("Claimer Burn\n");
  console.log("args", argv);

  try {
    let elvContract = new ElvContracts({
      configUrl: Config.networks[Config.net],
      debugLogging: argv.verbose
    });

    await elvContract.Init({
      privateKey: process.env.PRIVATE_KEY,
    });

    let res = await elvContract.ClaimerBurn({
      amount: argv.amount
    });

    console.log(yaml.dump(res));
  } catch (e) {
    console.error("ERROR:", e);
  }
};


const CmdClaimerListAllocations = async ({ argv }) => {
  console.log("Claimer List Allocations\n");
  console.log("args", argv);

  try {
    let elvContract = new ElvContracts({
      configUrl: Config.networks[Config.net],
      debugLogging: argv.verbose
    });

    await elvContract.Init({
      privateKey: process.env.PRIVATE_KEY,
    });

    let res = await elvContract.ClaimerListAllocations({
      address: argv.address
    });

    console.log(yaml.dump(res));
  } catch (e) {
    console.error("ERROR:", e);
  }
};

const CmdClaimerAddAuthAddr = async ({ argv }) => {
  console.log("Claimer Add Authorized Address\n");
  console.log("args", argv);

  try {
    let elvContract = new ElvContracts({
      configUrl: Config.networks[Config.net],
      debugLogging: argv.verbose
    });

    await elvContract.Init({
      privateKey: process.env.PRIVATE_KEY,
    });

    let res = await elvContract.ClaimerAddAuthAddr({
      address: argv.address
    });

    console.log(yaml.dump(res));
  } catch (e) {
    console.error("ERROR:", e);
  }
};

const CmdClaimerRmAuthAddr = async ({ argv }) => {
  console.log("Claimer Remove Authorized Address\n");
  console.log("args", argv);

  try {
    let elvContract = new ElvContracts({
      configUrl: Config.networks[Config.net],
      debugLogging: argv.verbose
    });

    await elvContract.Init({
      privateKey: process.env.PRIVATE_KEY,
    });

    let res = await elvContract.ClaimerRmAuthAddr({
      address: argv.address
    });

    console.log(yaml.dump(res));
  } catch (e) {
    console.error("ERROR:", e);
  }
};

const CmdClaimerBalanceOf = async ({ argv }) => {
  console.log("Claimer Balance Of\n");
  console.log("args", argv);

  try {
    let elvContract = new ElvContracts({
      configUrl: Config.networks[Config.net],
      debugLogging: argv.verbose
    });

    await elvContract.Init({
      privateKey: process.env.PRIVATE_KEY,
    });

    let res = await elvContract.ClaimerBalanceOf({
      address: argv.address
    });

    console.log(yaml.dump(res));
  } catch (e) {
    console.error("ERROR:", e);
  }
};

const CmdClaimerBurnOf = async ({ argv }) => {
  console.log("Claimer Balance Of\n");
  console.log("args", argv);

  try {
    let elvContract = new ElvContracts({
      configUrl: Config.networks[Config.net],
      debugLogging: argv.verbose
    });

    await elvContract.Init({
      privateKey: process.env.PRIVATE_KEY,
    });

    let res = await elvContract.ClaimerBurnOf({
      address: argv.address
    });

    console.log(yaml.dump(res));
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
  .command(
    "account_create <funds> <account_name> [tenant_admins]",
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
          describe: "Tenant admins group address (hex)",
          type: "string",
        });
    },
    (argv) => {
      CmdAccountCreate({ argv });
    }
  )

  .command(
    "account_set_tenant <tenant>",
    "Sets the tenant contract to assoicate with this account - if an admin group id is used, it will be converted to the tenant contract id that belongs to the group.",
    (yargs) => {
      yargs.option("tenant", {
        describe: "Tenant contract ID (iten...)",
        type: "string",
      })
    },
    (argv) => {
      CmdAccountSetTenantContractId({ argv });
    }
  )

  .command("account_show", "Shows current account information.", (argv) => {
    CmdAccountShow({argv});
  })

  .command(
    "account_send <address> <funds>",
    "Send funds to a given address using this key",
    (yargs) => {
      yargs
        .positional("address", {
          describe: "Account address to send",
          type: "string",
        })
        .positional("funds", {
          describe:
            "How much to fund the new account from this private key in ETH.",
          type: "string",
        });
    },
    (argv) => {
      CmdAccountSend({ argv });
    }
  )

  .command(
    "account_offer_signature <nft_addr> <mint_helper_addr> <token_id> <offer_id>",
    "Creates an offer signature for use by the minter to redeem and nft offer. Note the current key must be a token owner of the nft.",
    (yargs) => {
      yargs
        .positional("nft_addr", {
          describe: "NFT contract address (hex)",
          type: "string",
        })
        .positional("mint_helper_addr", {
          describe: "Address of the mint helper (hex)",
          type: "string",
        })
        .positional("token_id", {
          describe: "Token ID of the offer",
          type: "integer",
        })
        .positional("offer_id", {
          describe: "Offer_id",
          type: "integer",
        });
    },
    (argv) => {
      CmdAccountOfferSignature({ argv });
    }
  )

  .command(
    "account_fabric_token [Options]",
    "Creates a fabric token using this key",
    (yargs) => {
      yargs
        .option("duration", {
          describe: "Library ID to authorize",
          type: "string",
        });
    },
    (argv) => {
      CmdAccountFabricToken({ argv });
    }
  )

  .command(
    "account_signed_token [Options]",
    "Creates a client signed token using this key",
    (yargs) => {
      yargs
        .option("library_id", {
          describe: "Library ID to authorize",
          type: "string",
        })
        .option("object_id", {
          describe: "Object ID to authorize",
          type: "string",
        })
        .option("version_hash", {
          describe: "Version hash to authorize",
          type: "string",
        })
        .option("policy_id", {
          describe: "The object ID of the policy for this token",
          type: "string",
        })
        .option("subject", {
          describe: "Subject of the token. Default is the current address",
          type: "string",
        })
        .option("grant_type", {
          describe: "Permissions to grant for this token. Options: 'access', 'read', 'create', 'update', 'read-crypt'. Default 'read'",
          type: "string",
        })
        .option("duration", {
          describe: "Time until the token expires, in milliseconds. Default 2 min = 2 * 60 * 1000 = 120000)",
          type: "integer",
        })
        .option("allow_decryption", {
          describe: "If specified, the re-encryption key will be included in the token, enabling the user of this token to download encrypted content from the specified object",
          type: "boolean",
        })
        .option("context", {
          describe: "Additional JSON context",
          type: "string",
        });
    },
    (argv) => {
      CmdAccountSignedToken({ argv });
    }
  )

  .command(
    "group_create <name>",
    "Create a new access group",
    (yargs) => {
      yargs.positional("name", {
        describe: "The name of the access group",
        type: "string",
      });
    },
    (argv) => {
      CmdGroupCreate({ argv });
    }
  )

  .command(
    "group_add <group_address> <account_address>",
    "Add account to access group",
    (yargs) => {
      yargs
        .positional("group_address", {
          describe: "The address of the access group (hex)",
          type: "string",
        })
        .positional("account_address", {
          describe: "The address to add as member (hex)",
          type: "string",
        })
        .option("is_manager", {
          describe: "Set new address as group manager",
          type: "boolean",
        });
    },
    (argv) => {
      CmdGroupAdd({ argv });
    }
  )

  .command(
    "space_tenant_info <tenant>",
    "Shot tenant information.",
    (yargs) => {
      yargs
        .positional("tenant", {
          describe: "Tenant ID (iten)",
          type: "string",
        });
    },
    (argv) => {
      CmdSpaceTenantInfo({ argv });
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
        .option("show_metadata", {
          describe: "Show the content fabric metadata associated to this tenant",
          type: "boolean",
        });
    },
    (argv) => {
      CmdTenantShow({ argv });
    }
  )

  .command(
    "tenant_fix <tenant> [options]",
    "Fix tenant",
    (yargs) => {
      yargs
        .positional("tenant", {
          describe: "Tenant ID",
          type: "string",
        });
    },
    (argv) => {
      CmdTenantFix({ argv });
    }
  )

  .command(
    "tenant_set_content_admins <tenant>",
    "Set new content admin",
    (yargs) => {
      yargs
        .positional("tenant", {
          describe: "Tenant ID",
          type: "string",
        });
    },
    (argv) => {
      CmdTenantSetContentAdmins({ argv });
    }
  )

  .command(
    "tenant_remove_content_admin <tenant> <content_admin_address>",
    "Remove a content admin",
    (yargs) => {
      yargs
        .positional("tenant", {
          describe: "Tenant ID",
          type: "string",
        })
        .positional("content_admin_address", {
          describe: "Content Admin's address",
          type: "string",
        });
    },
    (argv) => {
      CmdTenantRemoveContentAdmin({ argv });
    }
  )

  .command(
    "space_tenant_deploy <tenant_name> <owner_addr> <tenant_admin_addr> <content_admin_addr>",
    "Deploys a tenant contract",
    (yargs) => {
      yargs
        .positional("tenant_name", {
          describe: "Tenant Name",
          type: "string",
        })
        .positional("owner_addr", {
          describe: "Owner of the new contract",
          type: "string",
        })
        .positional("tenant_admin_addr", {
          describe: "Address of the tenant admins groups",
          type: "string",
        })
        .positional("content_admin_addr", {
          describe: "Address of the content admins groups",
          type: "string",
        });
    },
    (argv) => {
      CmdSpaceTenantDeploy({ argv });
    }
  )

  .command(
    "space_tenant_create <tenant_name> <funds>",
    "Creates a new tenant account including all supporting access groups and deployment of contracts. PRIVATE_KEY must be set for the space owner.",
    (yargs) => {
      yargs
        .positional("tenant_name", {
          describe: "Tenant Name",
          type: "string",
        })
        .positional("funds", {
          describe:
            "How much to fund the new tenant from this private key in ETH.",
          type: "string",
        });
    },
    (argv) => {
      CmdSpaceTenantCreate({ argv });
    }
  )

  .command(
    "space_tenant_set_eluvio_live_id <tenant> <eluvio_live_id>",
    "Set the tenant-leve Eluvio Live object ID in the tenant contract.",
    (yargs) => {
      yargs
        .positional("tenant", {
          describe: "Tenant ID (iten)",
          type: "string",
        })
        .positional("eluvio_live_id", {
          describe: "Object ID of the tenant-leve Eluvio Live object (iq)",
          type: "string",
        });
    },
    (argv) => {
      CmdSpaceTenantSetEluvioLiveId({ argv });
    }
  )

  .command(
    "content_meta_get_batch <csv_file> [options]",
    "Get metadata fields for the list of content object IDs in the CSV file or library.",
    (yargs) => {
      yargs
        .positional("csv_file", {
          describe: "CSV file",
          type: "string",
        })
        .option("library", {
          describe: "Libary ID",
          type: "string",
        })
        .option("limit", {
          describe: "Max number of objects",
          type: "integer",
        });
    },
    (argv) => {
      CmdFabricGetMetaBatch({ argv });
    }
  )

  .command(
    "content_meta_set_batch <csv_file>",
    "Set metadata fields for the list of content object IDs in the CSV fle.",
    (yargs) => {
      yargs
        .positional("csv_file", {
          describe: "CSV file",
          type: "string",
        })
        .option("duplicate", {
          describe:
            "Clone the content objects instead of editing them directly.",
          type: "boolean",
        })
        .option("dryrun", {
          describe:
            "Print resulting metadata but don't actually edit the objects.",
          type: "boolean",
        });
    },
    (argv) => {
      CmdFabricSetMetaBatch({ argv });
    }
  )

  .command(
    "contract_get_meta <addr> <key>",
    "Get contract metadata.",
    (yargs) => {
      yargs
        .positional("addr", {
          describe: "Contract address. NFT object ID also accepted eg. iqxxx.",
          type: "string",
        })
        .positional("key", {
          describe: "Metadata key to retrieve.",
          type: "string",
        });
    },
    (argv) => {
      CmdContractGetMeta({ argv });
    }
  )

  .command(
    "contract_set_meta <addr> <key> <value>",
    "Set contract metadata using key/value.",
    (yargs) => {
      yargs
        .positional("addr", {
          describe: "Contract address. NFT object ID also accepted eg. iqxxx.",
          type: "string",
        })
        .positional("key", {
          describe: "Metadata key.",
          type: "string",
        })
        .positional("value", {
          describe: "Metadata value.",
          type: "string",
        });
    },
    (argv) => {
      CmdContractSetMeta({ argv });
    }
  )

  .command(
    "access_group_member <group> <addr>",
    "Checks if the user address is a member of the access group.",
    (yargs) => {
      yargs
        .positional("group", {
          describe: "Access control group ID or address (igrp or hex format)",
          type: "string",
        })
        .positional("addr", {
          describe: "User address (hex format)",
          type: "string",
        });
    },
    (argv) => {
      CmdAccessGroupMember({ argv });
    }
  )

  .command(
    "access_group_members <group>",
    "Returns a list of group members.",
    (yargs) => {
      yargs
        .positional("group", {
          describe: "Access control group ID or address (igrp or hex format)",
          type: "string",
        });
    },
    (argv) => {
      CmdAccessGroupMembers({ argv });
    }
  )

  .command(
    "claimer_allocate <address> <amount> <yyyy_mm_dd>",
    "Allocate an allocation to an user, an allocation contains an amount and an expiration date (in UTC)",
    (yargs) => {
      yargs
        .positional("address", {
          describe: "Address to allocate",
          type: "string",
        })
        .positional("amount", {
          describe: "Amount to allocate",
          type: "string",
        })
        .positional("expiration_date", {
          describe: "Expiration date of the allocation (in UTC)",
          type: "string",
        });
    },
    (argv) => {
      CmdClaimerAllocate({ argv });
    }
  )

  .command(
    "claimer_claim <amount>",
    "Claim an amount of your allocations",
    (yargs) => {
      yargs
        .positional("amount", {
          describe: "Amount to claim",
          type: "string",
        });
    },
    (argv) => {
      CmdClaimerClaim({ argv });
    }
  )
  .command(
    "claimer_burn <amount>",
    "Burn an amount of your allocations",
    (yargs) => {
      yargs
        .positional("amount", {
          describe: "Amount to burn",
          type: "string",
        });
    },
    (argv) => {
      CmdClaimerBurn({ argv });
    }
  )
  .command(
    "claimer_list_allocations <address>",
    "List the allocations of an address",
    (yargs) => {
      yargs
        .positional("address", {
          describe: "the allocations of this address would be listed",
          type: "string",
        });
    },
    (argv) => {
      CmdClaimerListAllocations({ argv });
    }
  )
  .command(
    "claimer_add_auth_address <address>",
    "Add an address to the authorized address list",
    (yargs) => {
      yargs
        .positional("address", {
          describe: "this address would be added to the authorized address list",
          type: "string",
        });
    },
    (argv) => {
      CmdClaimerAddAuthAddr({ argv });
    }
  )
  .command(
    "claimer_rm_auth_address <address>",
    "Remove an address from the authorized address list",
    (yargs) => {
      yargs
        .positional("address", {
          describe: "this address would be remove from the authorized address list",
          type: "string",
        });
    },
    (argv) => {
      CmdClaimerRmAuthAddr({ argv });
    }
  )
  .command(
    "claimer_balance_of <address>",
    "Get the balance of an address",
    (yargs) => {
      yargs
        .positional("address", {
          describe: "the balance of this address would be given",
          type: "string",
        });
    },
    (argv) => {
      CmdClaimerBalanceOf({ argv });
    }
  )
  .command(
    "claimer_burn_of <address>",
    "Get the burn of an address",
    (yargs) => {
      yargs
        .positional("address", {
          describe: "the burn of this address would be given",
          type: "string",
        });
    },
    (argv) => {
      CmdClaimerBurnOf({ argv });
    }
  )

  .strict()
  .help()
  .usage("EluvioLive Admin CLI\n\nUsage: elv-admin <command>")
  .scriptName("")
  .demandCommand(1).argv;
