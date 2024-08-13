const { ElvSpace } = require("../src/ElvSpace.js");
const { ElvTenant } = require("../src/ElvTenant.js");
const { ElvAccount } = require("../src/ElvAccount.js");
const { ElvContracts } = require("../src/ElvContracts.js");
const { Config } = require("../src/Config.js");
const Ethers = require("ethers");

const yargs = require("yargs/yargs");
const { hideBin } = require("yargs/helpers");
const yaml = require("js-yaml");
const fs = require('node:fs');

const postgres = require('postgres');
const sql = postgres({
  host : 'rep1.elv',
  port: 5432,
  database: 'indexer',
  username: '',
  password: ''
});

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

// Dumps the result as YAML to the console
// If a file is provided from the CLI, then write the YAML to this file
const doDump = (res, argv) => {
  const d = yaml.dump(res);
  console.log(d);
  if (argv.file) {
    fs.appendFile(argv.file, d, err => {
      if (err) {
        console.error(err);
      }
    });
  }
};

const CmdAccountCreate = async ({ argv }) => {
  console.log("Account Create\n");
  console.log(`funds: ${argv.funds}`);
  console.log(`account_name: ${argv.account_name}`);
  console.log(`tenant: ${argv.tenant}`);

  try {
    let elvAccount = new ElvAccount({
      configUrl: Config.networks[argv.network],
      debugLogging: argv.verbose
    });

    await elvAccount.Init({
      privateKey: process.env.PRIVATE_KEY,
    });

    let res = await elvAccount.Create({
      funds: argv.funds,
      accountName: argv.account_name,
      tenantId: argv.tenant,
    });
    doDump(res, argv);
  } catch (e) {
    console.error("ERROR:", e);
  }
};

const CmdAccountSetTenantContractId = async ({ argv }) => {
  console.log("Account Set Tenant Contract ID\n");
  console.log(`tenant_contract_id: ${argv.tenant}`);

  try {
    let elvAccount = new ElvAccount({
      configUrl: Config.networks[argv.network],
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
      configUrl: Config.networks[argv.network],
      debugLogging: argv.verbose
    });

    await elvAccount.Init({
      privateKey: process.env.PRIVATE_KEY,
    });
    let res = await elvAccount.Show();
    doDump(res, argv);
  } catch (e) {
    console.error("ERROR:", e);
  }
};

const CmdGroupCreate = async ({ argv }) => {
  console.log("Group Create\n");
  console.log(`name: ${argv.name}`);

  try {
    let elvAccount = new ElvAccount({
      configUrl: Config.networks[argv.network],
      debugLogging: argv.verbose
    });

    await elvAccount.Init({
      privateKey: process.env.PRIVATE_KEY,
    });

    let res = await elvAccount.CreateAccessGroup({
      name: argv.name,
    });
    doDump(res, argv);
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
      configUrl: Config.networks[argv.network],
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
      configUrl: Config.networks[argv.network],
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
    doDump(res, argv);
  } catch (e) {
    console.error("ERROR:", e);
  }
};

const CmdSpaceTenantCreate = async ({ argv }) => {
  console.log("Tenant Create");
  console.log(`Tenant name: ${argv.tenant_name}`);
  console.log(`Funds: ${argv.funds}`);
  console.log(`verbose: ${argv.verbose}`);

  try {
    let space = new ElvSpace({
      configUrl: Config.networks[argv.network],
      spaceAddress: Config.consts[argv.network].spaceAddress,
      kmsAddress: Config.consts[argv.network].kmsAddress,
      debugLogging: argv.verbose
    });
    await space.Init({ spaceOwnerKey: process.env.PRIVATE_KEY });

    res = await space.TenantCreate({
      tenantName: argv.tenant_name,
      funds: argv.funds,
    });

    doDump(res, argv);
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
      configUrl: Config.networks[argv.network],
      spaceAddress: Config.consts[argv.network].spaceAddress,
      kmsAddress: Config.consts[argv.network].kmsAddress,
      debugLogging: argv.verbose
    });
    await space.Init({ spaceOwnerKey: process.env.PRIVATE_KEY });

    res = await space.TenantDeploy({
      tenantName: argv.tenant_name,
      ownerAddress: argv.owner_addr,
      tenantAdminGroupAddress: argv.tenant_admin_addr,
      contentAdminGroupAddress: argv.content_admin_addr,
    });

    doDump(res, argv);
  } catch (e) {
    console.error("ERROR:", e);
  }
};

const CmdSpaceTenantInfo = async ({ argv }) => {
  console.log("Tenant info");
  console.log(`Tenant: ${argv.tenant}`);

  try {
    let t = new ElvTenant({
      configUrl: Config.networks[argv.network],
      debugLogging: argv.verbose
    });
    await t.Init({ privateKey: process.env.PRIVATE_KEY });

    res = await t.TenantInfo({
      tenantId: argv.tenant
    });

    doDump(res, argv);
  } catch (e) {
    console.error("ERROR:", e);
  }
};

const CmdTenantShow = async({ argv }) => {
  console.log("Tenant - show", argv.tenant);
  console.log(`Network: ${argv.network}`);

  try {
    let t = new ElvTenant({
      configUrl: Config.networks[argv.network],
      debugLogging: argv.verbose
    });
    await t.Init({ privateKey: process.env.PRIVATE_KEY });

    let res = await t.TenantShow({
      tenantId: argv.tenant,
      show_metadata: argv.show_metadata
    });

    doDump(res, argv);

    if (res.errors) { 
      console.log(`ERROR: tenant_show detected ${res.errors.length} error(s), run ./elv-admin tenant_fix ${argv.tenant} to resolve them.`);
    }
  } catch (e) {
    console.error("ERROR:", e);
  }
};

const CmdTenantFix = async({ argv }) => {
  console.log("Tenant - fix", argv.tenant);
  console.log(`Network: ${argv.network}`);

  try {
    let t = new ElvTenant({
      configUrl: Config.networks[argv.network],
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
      switch(error) {
        case 'missing content admins':
          let addr = await t.TenantSetContentAdmins({tenantId: argv.tenant, contentAdminAddr: argv.content_admin_address});
          console.log(`Set content admin group for tenant with tenantId ${argv.tenant} to ${addr}`);
          break;

        case `tenant admin group can't be verified or is not associated with any tenant`: 
          await t.TenantSetGroupConfig({tenantId: argv.tenant, groupAddress: res.tenant_admin_address});
          break;

        case `content admin group can't be verified or is not associated with any tenant`:
          await t.TenantSetGroupConfig({tenantId: argv.tenant, groupAddress: res.content_admin_address});
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
}

const CmdTenantFixSuite = async({ argv }) => {
  try {
    //Add tenantContractId to the account's metadata if not already exists
    let elvAccount = new ElvAccount({
      configUrl: Config.networks[argv.network],
      debugLogging: argv.verbose
    });
    await elvAccount.Init({
      privateKey: process.env.PRIVATE_KEY,
    });

    let tenantContractId;
    try {
      tenantContractId  = await elvAccount.client.userProfileClient.TenantContractId();
    } catch (e) {
      throw Error(`Can't find an account with private key ${process.env.PRIVATE_KEY} on the ${argv.network} network, aborting...`);
    }
    if (tenantContractId) {
      if (!elvAccount.client.utils.EqualHash(tenantContractId, argv.tenant)) {
        throw Error(`The account with private key ${process.env.PRIVATE_KEY} is already associated with tenant ${tenantContractId}`);
      }
    } else {
      elvAccount.SetAccountTenantContractId({ tenantId: argv.tenant });
    }

    //Set content admins group ID and fix problems related to the tenant and its admin groups
    await CmdTenantFix({argv})

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
        console.log('Tenant successfully fixed!');
      } else {
        console.log(`_ELV_ACCOUNT_ID couldn't be added to the following libraries:`);
        console.log(failedLibraries);
      }
    }
  } catch (e) {
    throw(e);
  }
}

const CmdQuery = async ({ argv }) => {
  REP1V_TENANT_ADDRESSES = [
    "0x2c07551A4496c3E27E0311F6eBeDdc15b32297F6", "0x714c4Be6bCa847005aBb1Cb7AB3e80e3aaa4B4c0", "0x3cC0c93915d812D4faf3A061886B0DdfDdC13D48", "0xf23197d15ABC1366C5153ffc0D17Ef07943C4A39", "0xa9bA823bb963D589E36C53e06136dE9660541155", "0x9Ebd35e2a036f40a76F9142b563f94b020F9D96C", "0x7aFC069c78f576099b0A818A1cf492Ed621e9782", "0xA179b345dB18e2a42F85DF3913B4a23A131919B6", "0x4ecE33d9822A9F46a21684deEa1D26eC6f37CdbD", "0x1E56dE48412d58f5e4613C7B5D309e4919b55150", "0x1eD884a289580EC10D4c4a8d7115229BBF4fb7fA", "0x75136c2a738aE3Aac5A92F49BFa3b5038b971D33", "0xdbFB2c45e9F9B9b3254B52ddfBc3180AF36E37bD", "0xaE34E8d680D8f3F9287d76F37D73d485430aBB49", "0x36A83153f0A55D4691FA77057170E09382318144", "0x71F0Cacd8F4d3b44722C11B11e59B19e7E87B0ee", "0x452b05C729b08568A2289447c3f1Fc722461cA6b", "0xE8e3eB4e204F75e94dB84D0f1Bf397c351b020CC", "0xa15b57d8A2662B7fe5a66C633B0b06aE1A2062b7", "0x3475e7f8b6D324b75bEFcCaD1933d84Ed3e0e8C0", "0x95222A22d64B90cbA72e63860E5D18D597FC460f", "0xc12c0F82E510CB388cF5371bf9F086183bD854B1", "0xf78eaee6C000BB1df9401D0694E91B5c5e0FE80B", "0xa0d066Ad1FF8c6A91e9f26dF24E7f4EF1f00C28d", "0xBe0b80A31bb254E77BBD79299d847D3849aD1216", "0xd8E69D47B1BD9cF3dBfce212ee8724E18F88EDdA", "0x3864d2a2B02403cBA81DFb73b3eFc64313f5A52f", "0xB266F13cF7ad298ca5eECbd11Dd532b93C0B792D", "0x81602F301924F17D86Cbf2BF2Cd37DD056F3Ef62", "0xF86C0D46f941433D345b8D6ed2999616FE2f97DD", "0xA1e0896445c5868407E02943b79C274911C56388", "0x5293A4615dD587B59842C134ECb6A801AE811d92", "0xF2bDb066ED30D8D5594Ef36B199ceAA6D5f57777", "0x9D7F2966F8B6bdE35f4090295b281e39caA90760", "0x5621c53138824c233a012Ca03A66b6fBB71abDAA", "0x69a245795292a3771665ac028c30e132c13433eB", "0x3D81c153B6f86cDe641F3cc9f84CE1DAB098AFbB", "0x55A9521E1829D82D6511fA2ce65De4Ec6EDE6D1B", "0x6fFEe5d2D398992b125B3871284Bd4af7248C2a1", "0xe25d688f86e96517e41AdA42aa174533a7eed94E", "0x2a4C258b352f224f217EF26B7Fb044e3FfD8821F", "0x46c4e0cE270675f85ebe641Fde30ef1EF3F94290", "0x18A48C2DB800cde99fe7346F79E1c059205Cd5c8", "0x171cB30b3db328e7272ee532FDe9aBb85D868657", "0x6BcBECF5D51c61B243b7095fC13b94b01A1734eC", "0xf4BcBb526d90a53D2bbB2EEc4Ded6A535475EDC5", "0x8A64942Df99613c0618C75B3C14a6cAfF1987670", "0xA2b0ACA9b30ddC1fa82495AFBC77BEcaDBd30eEa", "0x741515714446dB947aa5246E79aCE4F9542d5550", "0x50C5b54be8005A45f81B049700aE43aae234D8F6", "0xe1d75c8D99aa9a3819F8c1CDbA9c908BC2267F87", "0xd34e10385FeB8598CcAfE267E34C5774ABC3742D", "0xF432fd18eC218c1D6A310B9066CaB51AEb0c6c3f", "0xA5fad4738e65c309F0E5E88198fecCAdf28Cdc52", "0x56a4f256425224aeCE3152E3E2DE94a1fAcB391f", "0x7829c4Cf39F3d7aEA5678E6fEd6969A8efe26090", "0x74414E5F2E07c594a11cbF9E5B7761B0B107754B", "0xA77dd02453D82f7038bA144e1abd1450DA9046Fc", "0x8Acf64e19e7420c52636F526B2FB0bC2752D3351", "0x947cC80fCD9718E15d9737dFDa7Db4675AD423e2", "0xa9c2c40aa14fC4057628801EAab484C4E0e998Aa", "0x2ecAEc97FC88aA25987791ae38559E2F8175B3c8"
  ]
  REP1V_TENANT_ADMINS_GROUP_ADDRESSES = [
    "igrp3KyPXics86uRoEwgqUEcorw3tM4M", "igrp2SojFNfcR5UfXKC2ewDLdMC9copD", "igrp2dek8LKQfeMqL9g2aE4rXroHSApz", "", "igrp2EpWqyKbwPKKsKMJzdCjevwqp2BU", "igrp4LrvPrAuZBt44vexW38uwzMq6xH4", "igrp4RV4mUYGXaQWiZsLb3ZysWzGzs61", "igrp2MeSGHtEB9UM48TmikWTM6o5Dctb", "igrp3DqwCoerGck9FK2j6GCeMQpnW5Mm", "igrp2cCyXtpvbUtWsatx9mjMAQVfy5Nr", "igrp2PKzesRZiP2nuZMi8mgFvShE2PqM", "igrp2bdviny15TSCyU8ZZfaAJUNZ13P8", "", "igrp225tXhe49xzQCEfDeSYSHsC837tN", "igrp3SoMsdR3Q7NtiiaEzkFHYhGF7Eg", "igrpcHFPeTXByhFcH6NA4FDtR1RRMqw", "igrpXq8VtKe6CagDY4yvftVzZ45nVHQ", "igrpJALbSYiFJwsMWpnWNUxwrgsWu5V", "", "igrp3Vw6myR1oseSb2U9Va8L7ck2gT2e", "igrp2PFyWkMHuKpodEsykd1RXLLMhimc", "igrp4Dd2keZRUZW9iLAEsg2VJC9PZJwC", "igrp2MCxjcGEXbLiKLKuEV8cNvfynsuE", "igrp2CRa3A4SopDMr3QSxQNPMr1SdzSz", "igrp3wuCsdMvzVwTWN9MZ6BrhA7jXdJG", "igrpLVv2RUHtTQaU5QauUoGDVbbHep7", "", "", "igrpAWPkUuKWfBi1SfFVsGdNyaqHKY4", "igrp28CzvQWowqNdhCvW2iQ35VpapihX", "igrp3kMSymwHhioHCts6WkpaWrLRAev5", "igrpnZDzjnPkbC58j2N1YFw153o7gXb", "igrp41F4hEWUBY2J3iTNmw9tMgDaEv5s", "igrpoAHYmr1aw2DYZj7exvHXKVrnvt5", "igrp4QJ8YGLS9bJRstNmVipipCGjq4cc", "igrp2VDgcdrNHkpSjrcPeUit2rtWSQzS", "igrpYg4BwajufJVZCVunefYbZxr2KxR", "igrp3na2bhs59hbczNhK7yE62mBiVpbZ", "igrp2P3kWoEL6EA4uddWY2Mww3PXAE8D", "igrpJahtxAmyaivjes57y1zUE23E3Cs", "igrp2JU96Mapj2wWdj15ZKfBhzJmQeM1", "igrp3LKpRuDs7RoMipmW5QpQLCQRu8dP", "igrpwY48gXovj36TM7vJN6UyRNU8MqA", "igrp2UaEZjMqMfXqjp7W7KYYGQh5zRQ", "igrp3B2df4y647g2n1ibUpZXrP8dFaC5", "igrp3hrwPjzuPn66x3rivXgYpWvYco8A", "igrp3cxJ3YZXD9nkpxT4i8WC4oArr537", "igrp2oENEyu6b7tE294FNYJgrHsvWR7s", "igrp4MNJq3C2CRYFGBuS7K8V2a6NwBFP", "igrp3DdTmNkaYkSiYAchCBwHpKRCA8qu", "igrp3ZSPfSJTXwkJYAztUw5As4WYtUJ8", "igrp2q4XUiBZKZmbmU1nQfaefonBMES3", "igrp3iY6X82oaxZt6u7rRQzoafTiiaJ6", "igrp3f6eD5sUe9ULhq58cuCHZx3zTAAj", "igrpvaLrzbX8utzhFVe64TU5ZBvzx5m", "igrp4Lh9Eb6NCkSxiwQsVamevZn48oy", "igrp2ZEh3NVP7Nt6jQSswPMMxELKHs3v", "igrp47dtoWBupUbmJfQ97JdAbCLkHeZc", "igrp2URymAJBJFjFxgGJ59pxTHENbQbf", "igrpMN6YoB9fcy4rQuNSRp5NEQuQL4k", "igrp3gaJrceQ97V25JeH32unrh8XKqXR", "igrp4LrvPrAuZBt44vexW38uwzMq6xH4"
  ]
  ADMINS_SET = new Set(REP1V_TENANT_ADMINS_GROUP_ADDRESSES)


  without_admins = []
  dict = {}

  for (let i = 0; i < REP1V_TENANT_ADMINS_GROUP_ADDRESSES.length; i ++) {
    // Tenants without a tenant admin group are inserted to the without_admins list
    if (REP1V_TENANT_ADMINS_GROUP_ADDRESSES[i] == "") {
      without_admins.push(REP1V_TENANT_ADDRESSES[i]);
    } else {
      if (!dict[REP1V_TENANT_ADMINS_GROUP_ADDRESSES[i]]) {
        dict[REP1V_TENANT_ADMINS_GROUP_ADDRESSES[i]] = [];
      } else {
        console.log(`warnings: ${REP1V_TENANT_ADMINS_GROUP_ADDRESSES[i]} belongs to multiple tenants`);
      }
      dict[REP1V_TENANT_ADMINS_GROUP_ADDRESSES[i]].push(REP1V_TENANT_ADDRESSES[i]);
    }
  }

  try {
    let t = new ElvTenant({
      configUrl: Config.networks[argv.network],
      debugLogging: argv.verbose
    });
    await t.Init({ privateKey: process.env.PRIVATE_KEY });

    let success_count = 0
    let failure_count = 0
    let need_further_check = 0
    let failure_log = []

    let bcindexer_tenant_count = await sql`
      SELECT COUNT(*) as count_tenant
      FROM tenants as t
      WHERE t.id != 'iten11111111111111111111' AND t.id != 'iten11111111111111111112'
    `

    let bcindexer_library_count = await sql`
      SELECT COUNT(*) as count_library
      FROM libraries as l
      WHERE l.tenant_id != 'iten11111111111111111111' AND l.tenant_id != 'iten11111111111111111112'
    `
    console.log("number of entries in rep1.elv indexer tenants: ", bcindexer_tenant_count[0].count_tenant);
    console.log("number of entries in rep1.elv indexer libraries: ", bcindexer_library_count[0].count_library);
    console.log("number of tenants found on chain: ", REP1V_TENANT_ADDRESSES.length);
    console.log("number of tenants on chain without tenant admins group: ", without_admins.length);

    let tenants = await sql`
      SELECT
        t.id, count(t.id), t.space_id, array_agg(l.id) as libraries
      FROM tenants as t, libraries as l
      WHERE t.id = l.tenant_id AND t.id != 'iten11111111111111111111' AND t.id != 'iten11111111111111111112'
      GROUP BY t.id, t.space_id
    `

    for (const tenant of tenants) {
      //These id(s) belong to spaces and nodes
      let tenant_admins_id = "igrp" + tenant.id.slice(4);

      if (Object.keys(dict).includes(tenant_admins_id)) {
        ADMINS_SET.delete(tenant_admins_id);
        for (const tenant_contract_address of dict[tenant_admins_id]) {
          let tenant_contract_id = "iten" + t.client.utils.AddressToHash(tenant_contract_address);

          let res;
          let owner;
          try {
            owner = await t.client.CallContractMethod({
              contractAddress: tenant_contract_address,
              methodName: "owner",
              methodArgs: [],
              formatArguments: true
            });

            res = await t.TenantShow({tenantId: tenant_contract_id});
            if (!res.errors) {
              success_count += 1
              continue;
            }
            failure_log.push({
              owner: owner, 
              tenant_contract_id: tenant_contract_id, 
              tenant_admins_id: tenant_admins_id, 
              libraries: tenant.libraries,
              fix_required: res.errors.length});
            failure_count += 1;

          } catch (e) {
            failure_log.push({
              owner: owner, 
              tenant_contract_id: tenant_contract_id, 
              tenant_admins_id: tenant_admins_id,
              libraries: tenant.libraries,
              errors: e.message});
            if (e.message.includes('must be logged in with an account in the tenant admins group')) {
              need_further_check += 1;
            } else {
              failure_count += 1;
            }
          }
        }
      } else {
        // The tenant admins in bc indexer doesn't have a corresponding on chain tenant.
        continue;
      }
    }

    for (const admin of ADMINS_SET) {
      if (admin != "") {
        console.log(`The tenant with address ${dict[admin]} doesn't have a corresponding match in bcindexer.tenants`);
      }
    }
    console.log("Number of tenants that support the new tenant system: ", success_count);
    console.log("Number of tenants that need to be fixed: ", failure_count);
    console.log("Number of tenants that the check needed access to their content fabric metadata: ", need_further_check);

    require('fs').appendFile(
      './tenant_contracts_fix_info.json',

      JSON.stringify(failure_log, null, 1),

      function (err) {
        if (err) {
          console.log("Failed to create a fix info file.");
        }
      }
    )

    sql.end();
  } catch (e) {
    throw e;
  }

  return;
}

const CmdTenantSetContentAdmins = async ({ argv }) => {
  console.log(`Setting a new content admin group for Tenant ${argv.tenant}`);
  console.log(`Network: ${argv.network}`);

  try {
    let t = new ElvTenant({
      configUrl: Config.networks[argv.network],
      debugLogging: argv.verbose
    });
    await t.Init({ privateKey: process.env.PRIVATE_KEY });

    let res = await t.TenantSetContentAdmins({
      tenantId: argv.tenant,
      contentAdminAddr: argv.content_admin_address,
    });

    doDump(res, argv);
  } catch (e) {
    console.error("ERROR:", e);
  }
};

const CmdTenantRemoveContentAdmin = async ({ argv }) => {
  console.log(`Removing a Content Admin from Tenant ${argv.tenant}`);
  console.log(`Removed Content Admin's Address: ${argv.content_admin_address}`);
  console.log(`Network: ${argv.network}`);
  
  try {
    let t = new ElvTenant({
      configUrl: Config.networks[argv.network],
      debugLogging: argv.verbose
    });
    await t.Init({ privateKey: process.env.PRIVATE_KEY });

    let res = await t.TenantRemoveContentAdmin({
      tenantId: argv.tenant,
      contentAdminsAddress: argv.content_admin_address
    });

    doDump(res, argv);
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
      configUrl: Config.networks[argv.network],
      debugLogging: argv.verbose
    });
    await t.Init({ privateKey: process.env.PRIVATE_KEY });

    res = await t.TenantSetEluvioLiveId({
      tenantId: argv.tenant,
      eluvioLiveId: argv.eluvio_live_id
    });

    doDump(res, argv);
  } catch (e) {
    console.error("ERROR:", e);
  }

};

const CmdAccountOfferSignature = async ({ argv }) => {
  console.log("Account Offer Signature\n");
  console.log("args", argv);

  try {
    let elvAccount = new ElvAccount({
      configUrl: Config.networks[argv.network],
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

    doDump(res, argv);
  } catch (e) {
    console.error("ERROR:", e);
  }
};

const CmdAccountFabricToken = async ({ argv }) => {
  console.log("Account Fabric Token\n");
  console.log("args", argv);

  try {
    let elvAccount = new ElvAccount({
      configUrl: Config.networks[argv.network],
      debugLogging: argv.verbose
    });

    await elvAccount.Init({
      privateKey: process.env.PRIVATE_KEY,
    });

    let res = await elvAccount.CreateFabricToken({
      duration: argv.duration
    });

    doDump(res, argv);
  } catch (e) {
    console.error("ERROR:", e);
  }
};

const CmdAccountSignedToken = async ({ argv }) => {
  console.log("Account Signed Token\n");
  console.log("args", argv);

  try {
    let elvAccount = new ElvAccount({
      configUrl: Config.networks[argv.network],
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

    doDump(res, argv);
  } catch (e) {
    console.error("ERROR:", e);
  }
};

const CmdFabricGetMetaBatch = async ({ argv }) => {
  try {
    let elvFabric = new ElvFabric({
      configUrl: Config.networks[argv.network],
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
      configUrl: Config.networks[argv.network],
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

    doDump(res, argv);
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
      configUrl: Config.networks[argv.network],
      debugLogging: argv.verbose
    });

    await elvFabric.Init({
      privateKey: process.env.PRIVATE_KEY
    });

    let res = await elvFabric.GetContractMeta({
      address: argv.addr,
      key: argv.key
    });

    doDump(res, argv);
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
      configUrl: Config.networks[argv.network],
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

    doDump(res, argv);
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
      configUrl: Config.networks[argv.network],
      debugLogging: argv.verbose
    });

    await elvFabric.Init({
      privateKey: process.env.PRIVATE_KEY
    });

    let res = await elvFabric.AccessGroupMember({
      group: argv.group,
      addr: argv.addr
    });

    doDump(res, argv);
  } catch (e) {
    console.error("ERROR:", e);
  }
};

const CmdAccessGroupMembers = async ({ argv }) => {
  console.log("AccessGroupMembers", 
    `group: ${argv.group}`);

  try {
    let elvFabric = new ElvFabric({
      configUrl: Config.networks[argv.network],
      debugLogging: argv.verbose
    });

    await elvFabric.Init({
      privateKey: process.env.PRIVATE_KEY
    });

    let res = await elvFabric.AccessGroupMembers({
      group: argv.group
    });

    doDump(res, argv);
  } catch (e) {
    console.error("ERROR:", e);
  }
};

const CmdClaimerAllocate = async ({ argv }) => {
  console.log("Claimer Allocate\n");
  console.log("args", argv);

  try {
    let elvContract = new ElvContracts({
      configUrl: Config.networks[argv.network],
      debugLogging: argv.verbose,
      netName: argv.network
    });

    await elvContract.Init({
      privateKey: process.env.PRIVATE_KEY,
    });

    let res = await elvContract.ClaimerAllocate({
      address: argv.address,
      amount: argv.amount,
      expirationDate: argv.yyyy_mm_dd
    });

    doDump(res, argv);
  } catch (e) {
    console.error("ERROR:", e);
  }
};

const CmdClaimerClaim = async ({ argv }) => {
  console.log("Claimer Claim\n");
  console.log("args", argv);

  try {
    let elvContract = new ElvContracts({
      configUrl: Config.networks[argv.network],
      debugLogging: argv.verbose
    });

    await elvContract.Init({
      privateKey: process.env.PRIVATE_KEY,
    });

    let res = await elvContract.ClaimerClaim({
      amount: argv.amount
    });

    doDump(res, argv);
  } catch (e) {
    console.error("ERROR:", e);
  }
};

const CmdClaimerBurn = async ({ argv }) => {
  console.log("Claimer Burn\n");
  console.log("args", argv);

  try {
    let elvContract = new ElvContracts({
      configUrl: Config.networks[argv.network],
      debugLogging: argv.verbose,
      netName: argv.network
    });

    await elvContract.Init({
      privateKey: process.env.PRIVATE_KEY,
    });

    let res = await elvContract.ClaimerBurn({
      amount: argv.amount
    });

    doDump(res, argv);
  } catch (e) {
    console.error("ERROR:", e);
  }
};


const CmdClaimerListAllocations = async ({ argv }) => {
  console.log("Claimer List Allocations\n");
  console.log("args", argv);

  try {
    let elvContract = new ElvContracts({
      configUrl: Config.networks[argv.network],
      debugLogging: argv.verbose
    });

    await elvContract.Init({
      privateKey: process.env.PRIVATE_KEY,
    });

    let res = await elvContract.ClaimerListAllocations({
      address: argv.address
    });

    doDump(res, argv);
  } catch (e) {
    console.error("ERROR:", e);
  }
};

const CmdClaimerAddAuthAddr = async ({ argv }) => {
  console.log("Claimer Add Authorized Address\n");
  console.log("args", argv);

  try {
    let elvContract = new ElvContracts({
      configUrl: Config.networks[argv.network],
      debugLogging: argv.verbose,
      netName: argv.network
    });

    await elvContract.Init({
      privateKey: process.env.PRIVATE_KEY,
    });

    let res = await elvContract.ClaimerAddAuthAddr({
      address: argv.address
    });

    doDump(res, argv);
  } catch (e) {
    console.error("ERROR:", e);
  }
};

const CmdClaimerRmAuthAddr = async ({ argv }) => {
  console.log("Claimer Remove Authorized Address\n");
  console.log("args", argv);

  try {
    let elvContract = new ElvContracts({
      configUrl: Config.networks[argv.network],
      debugLogging: argv.verbose,
      netName: argv.network
    });

    await elvContract.Init({
      privateKey: process.env.PRIVATE_KEY,
    });

    let res = await elvContract.ClaimerRmAuthAddr({
      address: argv.address
    });

    doDump(res, argv);
  } catch (e) {
    console.error("ERROR:", e);
  }
};

const CmdClaimerBalanceOf = async ({ argv }) => {
  console.log("Claimer Balance Of\n");
  console.log("args", argv);

  try {
    let elvContract = new ElvContracts({
      configUrl: Config.networks[argv.network],
      debugLogging: argv.verbose,
      netName: argv.network
    });

    await elvContract.Init({
      privateKey: process.env.PRIVATE_KEY,
    });

    let res = await elvContract.ClaimerBalanceOf({
      address: argv.address
    });

    doDump(res, argv);
  } catch (e) {
    console.error("ERROR:", e);
  }
};

const CmdClaimerBurnOf = async ({ argv }) => {
  console.log("Claimer Balance Of\n");
  console.log("args", argv);

  try {
    let elvContract = new ElvContracts({
      configUrl: Config.networks[argv.network],
      debugLogging: argv.verbose,
      netName: argv.network
    });

    await elvContract.Init({
      privateKey: process.env.PRIVATE_KEY,
    });

    let res = await elvContract.ClaimerBurnOf({
      address: argv.address
    });

    doDump(res, argv);
  } catch (e) {
    console.error("ERROR:", e);
  }
};

const CmdNodes = async ({ argv }) => {
  try {
    let space = new ElvSpace({
      configUrl: Config.networks[argv.network],
      spaceAddress: Config.consts[argv.network].spaceAddress,
      kmsAddress: Config.consts[argv.network].kmsAddress,
      debugLogging: argv.verbose
    });
    await space.Init({ spaceOwnerKey: process.env.PRIVATE_KEY });

    let res = await space.SpaceNodes({
      matchEndpoint: argv.endpoint,
      matchNodeId: argv.node_id
    });

    doDump(res, argv);
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
  .default("network", 'main')
  .option("network", {
    describe: "Network to use",
    choices: ('n', ['main', 'demo', 'demov3', 'test', 'dev']),
    alias: "n"
  })
  .option("file", {
    describe: "YAML file to write output to",
    type: "string",
    alias: "f"
  })
  .command(
    "account_create <funds> <account_name> <tenant>",
    "Create a new account -> mnemonic, address, private key",
    (yargs) => {
      yargs
        .positional("funds", {
          describe:
            "How much to fund the new account from this private key (ELV).",
          type: "string",
        })
        .positional("account_name", {
          describe: "Account Name",
          type: "string",
        })
        .positional("tenant", {
          describe: "Tenant ID (iten)",
          type: "string",
        });
    },
    (argv) => {
      CmdAccountCreate({ argv });
    }
  )

  .command(
    "query",
    "Query the indexer",
    (argv) => {
      CmdQuery({ argv });
    }
  )

  .command(
    "account_set_tenant <tenant>",
    "Associate this account to the tenant - if an admins group ID is used, it will be converted to the tenant ID.",
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
        })
        .options("content_admin_address", {
          describe: "Address of the content admins groups",
          type: "string",
        });
    },
    (argv) => {
      CmdTenantFix({ argv });
    }
  )

  .command(
    "tenant_fix_suite <tenant> <content_admin_address> [options]",
    "Fix old-gen tenant",
    (yargs) => {
      yargs 
        .positional("tenant", {
          describe: "Tenant ID",
          type: "string",
        })
        .positional("content_admin_address", {
          describe: "Address of the content admins groups",
          type: "string",
        })
        .options("libraries", {
          describe: "List of libraries that belong to this tenant",
          type: "array",
        });
      },
      (argv) => {
        CmdTenantFixSuite({ argv });
      }
  )

  .command(
    "tenant_set_content_admins <tenant> [options]",
    "Set new content admin",
    (yargs) => {
      yargs
        .positional("tenant", {
          describe: "Tenant ID",
          type: "string",
        })
        .options("content_admin_address", {
          describe: "Address of the content admins groups",
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

  .command(
    "nodes",
    "Retrieve all nodes in the content space, with optional filters.",
    (yargs) => {
      yargs
        .option("endpoint", {
          describe: "Match nodes with endpoints that contain this string.",
          type: "string",
        })
        .option("node_id", {
          describe: "Only match the node with this node ID",
          type: "string",
        });
    },
    (argv) => {
      CmdNodes({ argv });
    }
  )

  .strict()
  .help()
  .usage("EluvioLive Admin CLI\n\nUsage: elv-admin <command>")
  .scriptName("")
  .demandCommand(1).argv;
