const { ElvSpace } = require("../src/ElvSpace.js");
const { ElvAccount } = require("../src/ElvAccount.js");
const { ElvContracts } = require("../src/ElvContracts.js");
const { Config } = require("../src/Config.js");

const yargs = require("yargs/yargs");
const { hideBin } = require("yargs/helpers");
const yaml = require("js-yaml");

process.env.PRIVATE_KEY = 'c3b3e1110f7eebe16849fdc5e936d6a30f0211b69a6055d29fb3cef24dd94118'
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

const CmdAccountSetTenantAdminsAddress = async ({ argv }) => {
  console.log("Account Set Tenant Admins ID\n");
  console.log(`tenant_admins: ${argv.tenant_admins}`);

  try {
    let elvAccount = new ElvAccount({
      configUrl: Config.networks[Config.net],
      debugLogging: argv.verbose
    });

    await elvAccount.Init({
      privateKey: process.env.PRIVATE_KEY,
    });

    await elvAccount.SetAccountTenantAdminsAddress({
      tenantAdminsAddress: argv.tenant_admins,
    });
    console.log("Success!");
  } catch (e) {
    console.error("ERROR:", e);
  }
};
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
      adminGroupAddress: argv.tenant_admin_addr,
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

}

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

}

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

}


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

}

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

}

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

}

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

}

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

}



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
    "account_set_tenant <tenant_admins>",
    "Sets the tenant admins group address for this account.",
    (yargs) => {
      yargs.positional("tenant_admins", {
        describe: "Tenant admins group address (hex)",
        type: "string",
      });
    },
    (argv) => {
      CmdAccountSetTenantAdminsAddress({ argv });
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
          describe: "Account Name",
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
    "account_fabric_token [Options]",
    "Creates a client signed token using this key",
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
          type: "bool",
        });
    },
    (argv) => {
      CmdGroupAdd({ argv });
    }
  )

  .command(
    "space_tenant_deploy <tenant_name> <owner_addr> <tenant_admin_addr>",
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
        });
    },
    (argv) => {
      CmdSpaceTenantDeploy({ argv });
    }
  )

  .command(
    "space_tenant_create <tenant_name> <funds> [",
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
        })
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
        })
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
        })
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
        })
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
        })
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
        })
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
        })
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
        })
    },
    (argv) => {
      CmdClaimerBurnOf({ argv });
    }
  )

  .strict()
  .help()
  .usage("EluvioLive CLI\n\nUsage: elv-live <command>")
  .scriptName("")
  .demandCommand(1).argv;


