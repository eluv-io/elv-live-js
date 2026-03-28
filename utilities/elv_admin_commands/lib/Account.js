const { ElvAccount } = require("../../../src/ElvAccount");
const { Config } = require("../../../src/Config");
const yaml = require("js-yaml");

const CmdAccountCreate = async ({ argv }) => {
  console.log("Account Create\n");
  console.log(`funds: ${argv.funds}`);
  console.log(`account_name: ${argv.account_name}`);
  console.log(`tenant: ${argv.tenant}`);
  console.log(`group-roles: ${argv.group_roles}`);

  try {
    let elvAccount = new ElvAccount({
      configUrl: Config.networks[Config.net],
      debugLogging: argv.verbose
    });

    await elvAccount.Init({
      privateKey: process.env.PRIVATE_KEY,
    });

    const groupToRoles = argv.group_roles ? JSON.parse(argv.group_roles) : {};

    let res = await elvAccount.Create({
      funds: argv.funds,
      accountName: argv.account_name,
      tenantId: argv.tenant,
      groupToRoles,
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

const CmdAccountBalance = async ({ argv }) => {

  try {
    let elvAccount = new ElvAccount({
      configUrl: Config.networks[Config.net],
      debugLogging: argv.verbose
    });

    await elvAccount.Init({
      privateKey: process.env.PRIVATE_KEY,
    });
    let res = await elvAccount.Balance({address: argv.address});
    console.log(res);
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

    if (argv.context) {
      context = JSON.parse(argv.context);
    }

    let res = await elvAccount.CreateSignedToken({
      libraryId: argv.library_id,
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

module.exports = {
  CmdAccountCreate,
  CmdAccountSetTenantContractId,
  CmdAccountShow,
  CmdAccountBalance,
  CmdAccountSend,
  CmdAccountOfferSignature,
  CmdAccountFabricToken,
  CmdAccountSignedToken,
};