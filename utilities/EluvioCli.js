const { ElvSpace } = require("../src/ElvSpace.js");
const { ElvAccount } = require("../src/ElvAccount.js");
const { Config } = require("../src/Config.js");

const yargs = require("yargs/yargs");
const { hideBin } = require("yargs/helpers");
const yaml = require("js-yaml");
const prompt = require("prompt-sync")({ sigint: true });

const CmdAccountCreate = async ({ argv }) => {
  console.log("Account Create\n");
  console.log(`funds: ${argv.funds}`);
  console.log(`account_name: ${argv.account_name}`);
  console.log(`tenant_admins: ${argv.tenant_admins}`);

  try {
    let elvAccount = new ElvAccount({
      configUrl: Config.networks[Config.net],
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
const CmdAccountShow = async () => {
  console.log("Account Show\n");

  try {
    let elvAccount = new ElvAccount({
      configUrl: Config.networks[Config.net],
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

  try {
    let space = new ElvSpace({
      configUrl: Config.networks[Config.net],
      spaceAddress: Config.consts[Config.net].spaceAddress,
      kmsAddress: Config.consts[Config.net].kmsAddress,
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

yargs(hideBin(process.argv))
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
          describe: "Tenant admins group address",
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
        describe: "Tenant admins group address",
        type: "string",
      });
    },
    (argv) => {
      CmdAccountSetTenantAdminsAddress({ argv });
    }
  )

  .command("account_show", "Shows current account information.", () => {
    CmdAccountShow();
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
    "group_add <group_address> <account_address> <is_manager>",
    "Add account to access group",
    (yargs) => {
      yargs.positional("name", {
        describe: "The name of the access group",
        type: "string",
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

  .strict()
  .help()
  .usage("EluvioLive CLI\n\nUsage: elv-live <command>")
  .scriptName("")
  .demandCommand(1).argv;
