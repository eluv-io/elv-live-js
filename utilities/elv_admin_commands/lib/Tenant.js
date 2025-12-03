const { Config } = require("../../../src/Config");
const { ElvTenant } = require("../../../src/ElvTenant");
const yaml = require("js-yaml");
const { ElvAccount } = require("../../../src/ElvAccount");
const { ElvSpace } = require("../../../src/ElvSpace");

const CmdTenantShow = async ({ argv }) => {
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
      asUrl: argv.as_url,
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

const CmdTenantFix = async ({ argv }) => {
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

    if (argv.content_admin_address && res.content_admin_address && !t.client.utils.EqualAddress(res.content_admin_address, argv.content_admin_address)) {
      throw Error(`Tenant ${argv.tenant} already has a content admin group: ${res.content_admin_address}, aborting...`);
    }

    if (!errors) {
      console.log(`No error found for tenant with tenant id: ${argv.tenant}!`);
      return;
    }

    for (let i = 0; i < errors.length; i++) {
      let error = errors[i];
      switch (error) {
        case "missing content admins":
          let addr = await t.TenantSetContentAdmins({
            tenantId: argv.tenant,
            contentAdminAddr: argv.content_admin_address
          });
          console.log(`Set content admin group for tenant with tenantId ${argv.tenant} to ${addr}`);
          break;

        case "tenant admin group can't be verified or is not associated with any tenant":
          await t.TenantSetGroupConfig({ tenantId: argv.tenant, groupAddress: res.tenant_admin_address });
          break;

        case "content admin group can't be verified or is not associated with any tenant":
          await t.TenantSetGroupConfig({ tenantId: argv.tenant, groupAddress: res.content_admin_address });
          break;

        default:
          console.log(`No fix actions available for error: ${error}.`);
          unresolved.push(error);
      }
    }

    console.log(`${errors.length - unresolved.length} errors fixed, ${unresolved.length} errors remaining.`);
    return unresolved;
  } catch (e) {
    console.log(e);
    return;
  }
};

const CmdTenantFixSuite = async ({ argv }) => {
  try {
    //Add tenantContractId to the account's metadata if not already exists
    let elvAccount = new ElvAccount({
      configUrl: Config.networks[Config.net],
      debugLogging: argv.verbose
    });
    await elvAccount.Init({
      privateKey: process.env.PRIVATE_KEY,
    });

    let tenantContractId;
    try {
      tenantContractId = await elvAccount.client.userProfileClient.TenantContractId();
    } catch (e) {
      throw Error(`Can't find an account with private key ${process.env.PRIVATE_KEY} on the ${Config.net} network, aborting...`);
    }
    if (tenantContractId) {
      if (!elvAccount.client.utils.EqualHash(tenantContractId, argv.tenant)) {
        throw Error(`The account with private key ${process.env.PRIVATE_KEY} is already associated with tenant ${tenantContractId}`);
      }
    } else {
      elvAccount.SetAccountTenantContractId({ tenantId: argv.tenant });
    }

    //Set content admins group ID and fix problems related to the tenant and its admin groups
    await CmdTenantFix({ argv });

    //Set _ELV_TENANT_ID metadata for the libraries if they are owned by the account
    if (argv.libraries) {
      let failedLibraries = [];
      for (let i = 0; i < argv.libraries.length; i++) {
        let lib = argv.libraries[i];
        let libAddr = elvAccount.client.utils.HashToAddress(lib);

        try {
          await elvAccount.client.CallContractMethod({
            contractAddress: libAddr,
            methodName: "putMeta",
            methodArgs: [
              "_ELV_TENANT_ID",
              argv.tenant,
            ],
            formatArguments: true
          });
        } catch (e) {
          let libOwner = await elvAccount.client.CallContractMethod({
            contractAddress: libAddr,
            methodName: "owner",
            methodArgs: [],
            formatArguments: true
          });
          console.log(`Failed to set _ELV_TENANT_ID of ${lib} - doesn't belong to this account and can only be set by the account with address ${libOwner}`);
          failedLibraries.push(lib);
        }
      }
      if (failedLibraries.length == 0) {
        console.log("Tenant successfully fixed!");
      } else {
        console.log("_ELV_ACCOUNT_ID couldn't be added to the following libraries:");
        console.log(failedLibraries);
      }
    }
  } catch (e) {
    throw (e);
  }
};

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
      contentAdminAddr: argv.content_admin_address,
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

const CmdTenantSetTenantUsers = async ({ argv }) => {
  console.log(`Setting a new tenant users group for Tenant ${argv.tenant}`);
  console.log("Network: " + Config.net);

  try {
    let t = new ElvTenant({
      configUrl: Config.networks[Config.net],
      debugLogging: argv.verbose
    });
    await t.Init({ privateKey: process.env.PRIVATE_KEY });

    let tenantUsersAddr = argv.tenant_users_address;
    let res = await t.TenantSetTenantUsers({
      tenantId: argv.tenant,
      tenantUsersAddr,
    });

    console.log(res);
  } catch (e) {
    console.error("ERROR:", e);
  }
};

const CmdTenantRemoveTenantUsers = async ({ argv }) => {
  console.log(`Removing a tenant users group from Tenant ${argv.tenant}`);
  console.log(`Removed tenant users group Address: ${argv.tenant_users_addr}`);
  console.log("Network: " + Config.net);

  try {
    let t = new ElvTenant({
      configUrl: Config.networks[Config.net],
      debugLogging: argv.verbose
    });
    await t.Init({ privateKey: process.env.PRIVATE_KEY });

    let res = await t.TenantRemoveTenantUsers({
      tenantId: argv.tenant,
      tenantUsersAddr: argv.tenant_users_address
    });

    console.log(yaml.dump(res));
  } catch (e) {
    console.error("ERROR:", e);
  }
};

const CmdTenantCreateFaucetAndFund = async ({ argv }) => {
  try {
    const { as_url: asUrl, tenant_id: tenantId, funds, no_funds: noFunds } = argv;

    let t = new ElvTenant({
      configUrl: Config.networks[Config.net],
      debugLogging: argv.verbose
    });
    await t.Init({ privateKey: process.env.PRIVATE_KEY });

    const res = await t.TenantCreateFaucetAndFund({
      asUrl,
      tenantId,
      amount: funds,
      noFunds,
    });
    console.log(yaml.dump(res));
  } catch (error) {
    console.error("ERROR:", error.message);
  }
};

const CmdTenantDeleteFaucet = async ({ argv }) => {
  try {
    const { as_url: asUrl, tenant_id: tenantId } = argv;

    let t = new ElvTenant({
      configUrl: Config.networks[Config.net],
      debugLogging: argv.verbose
    });
    await t.Init({ privateKey: process.env.PRIVATE_KEY });

    await t.TenantDeleteFaucet({
      asUrl,
      tenantId,
    });
    console.log(`Deleted tenant faucet for ${tenantId} successfully`);
  } catch (error) {
    console.error("ERROR:", error.message);
  }
};

const CmdTenantFundUser = async ({ argv }) => {
  try {
    const { as_url: asUrl, tenant_id: tenantId, user_address: userAddress } = argv;

    let t = new ElvTenant({
      configUrl: Config.networks[Config.net],
      debugLogging: argv.verbose
    });
    await t.Init({ privateKey: process.env.PRIVATE_KEY });

    const res = await t.TenantFundUser({
      asUrl,
      tenantId,
      userAddress,
    });
    console.log(yaml.dump(res));
  } catch (e) {
    console.error("ERROR:", e.message);
  }
};

const CmdTenantCreateSharingKey = async ({ argv }) => {
  try {
    const { as_url: asUrl, tenant_id: tenantId } = argv;

    let t = new ElvTenant({
      configUrl: Config.networks[Config.net],
      debugLogging: argv.verbose
    });
    await t.Init({ privateKey: process.env.PRIVATE_KEY });

    const res = await t.TenantCreateSharingKey({
      asUrl,
      tenantId,
    });
    console.log(yaml.dump(res));
  } catch (error) {
    console.error("ERROR:", error.message);
  }
};

const CmdTenantSetStatus = async ({argv}) => {
  try {
    const tenantContractId =  argv.tenant;
    const tenantStatus =  argv.tenant_status;
    let t = new ElvTenant({
      configUrl: Config.networks[Config.net],
      debugLogging: argv.verbose
    });
    await t.Init({ privateKey: process.env.PRIVATE_KEY });

    let res = await t.TenantSetStatus({
      tenantContractId: tenantContractId,
      tenantStatus: tenantStatus,
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
      ...(argv.funds != null && {funds : argv.funds})
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
  console.log(`Tenant users group address: ${argv.tenant_users_addr}`);

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
      tenantUsersGroupAddress: argv.tenant_users_addr,
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

module.exports = {
  CmdTenantShow,
  CmdTenantFix,
  CmdTenantFixSuite,
  CmdTenantSetContentAdmins,
  CmdTenantRemoveContentAdmin,
  CmdTenantSetTenantUsers,
  CmdTenantRemoveTenantUsers,
  CmdTenantCreateFaucetAndFund,
  CmdTenantDeleteFaucet,
  CmdTenantFundUser,
  CmdTenantCreateSharingKey,
  CmdTenantSetStatus,
  CmdSpaceTenantCreate,
  CmdSpaceTenantDeploy,
  CmdSpaceTenantInfo,
  CmdSpaceTenantSetEluvioLiveId,
};