const { ElvTenant } = require("../../../src/ElvTenant");
const { Config } = require("../../../src/Config");
const postgres = require("postgres");

const sql = postgres({
  host : "rep1.elv",
  port: 5432,
  database: "indexer",
  username: "",
  password: ""
});

const CmdQuery = async ({ argv }) => {
  REP1V_TENANT_ADDRESSES = [
    "0x2c07551A4496c3E27E0311F6eBeDdc15b32297F6",
    "0x714c4Be6bCa847005aBb1Cb7AB3e80e3aaa4B4c0",
    "0x3cC0c93915d812D4faf3A061886B0DdfDdC13D48",
    "0xf23197d15ABC1366C5153ffc0D17Ef07943C4A39",
    "0xa9bA823bb963D589E36C53e06136dE9660541155",
    "0x9Ebd35e2a036f40a76F9142b563f94b020F9D96C",
    "0x7aFC069c78f576099b0A818A1cf492Ed621e9782",
    "0xA179b345dB18e2a42F85DF3913B4a23A131919B6",
    "0x4ecE33d9822A9F46a21684deEa1D26eC6f37CdbD",
    "0x1E56dE48412d58f5e4613C7B5D309e4919b55150",
    "0x1eD884a289580EC10D4c4a8d7115229BBF4fb7fA",
    "0x75136c2a738aE3Aac5A92F49BFa3b5038b971D33",
    "0xdbFB2c45e9F9B9b3254B52ddfBc3180AF36E37bD",
    "0xaE34E8d680D8f3F9287d76F37D73d485430aBB49",
    "0x36A83153f0A55D4691FA77057170E09382318144",
    "0x71F0Cacd8F4d3b44722C11B11e59B19e7E87B0ee",
    "0x452b05C729b08568A2289447c3f1Fc722461cA6b",
    "0xE8e3eB4e204F75e94dB84D0f1Bf397c351b020CC",
    "0xa15b57d8A2662B7fe5a66C633B0b06aE1A2062b7",
    "0x3475e7f8b6D324b75bEFcCaD1933d84Ed3e0e8C0",
    "0x95222A22d64B90cbA72e63860E5D18D597FC460f",
    "0xc12c0F82E510CB388cF5371bf9F086183bD854B1",
    "0xf78eaee6C000BB1df9401D0694E91B5c5e0FE80B",
    "0xa0d066Ad1FF8c6A91e9f26dF24E7f4EF1f00C28d",
    "0xBe0b80A31bb254E77BBD79299d847D3849aD1216",
    "0xd8E69D47B1BD9cF3dBfce212ee8724E18F88EDdA",
    "0x3864d2a2B02403cBA81DFb73b3eFc64313f5A52f",
    "0xB266F13cF7ad298ca5eECbd11Dd532b93C0B792D",
    "0x81602F301924F17D86Cbf2BF2Cd37DD056F3Ef62",
    "0xF86C0D46f941433D345b8D6ed2999616FE2f97DD",
    "0xA1e0896445c5868407E02943b79C274911C56388",
    "0x5293A4615dD587B59842C134ECb6A801AE811d92",
    "0xF2bDb066ED30D8D5594Ef36B199ceAA6D5f57777",
    "0x9D7F2966F8B6bdE35f4090295b281e39caA90760",
    "0x5621c53138824c233a012Ca03A66b6fBB71abDAA",
    "0x69a245795292a3771665ac028c30e132c13433eB",
    "0x3D81c153B6f86cDe641F3cc9f84CE1DAB098AFbB",
    "0x55A9521E1829D82D6511fA2ce65De4Ec6EDE6D1B",
    "0x6fFEe5d2D398992b125B3871284Bd4af7248C2a1",
    "0xe25d688f86e96517e41AdA42aa174533a7eed94E",
    "0x2a4C258b352f224f217EF26B7Fb044e3FfD8821F",
    "0x46c4e0cE270675f85ebe641Fde30ef1EF3F94290",
    "0x18A48C2DB800cde99fe7346F79E1c059205Cd5c8",
    "0x171cB30b3db328e7272ee532FDe9aBb85D868657",
    "0x6BcBECF5D51c61B243b7095fC13b94b01A1734eC",
    "0xf4BcBb526d90a53D2bbB2EEc4Ded6A535475EDC5",
    "0x8A64942Df99613c0618C75B3C14a6cAfF1987670",
    "0xA2b0ACA9b30ddC1fa82495AFBC77BEcaDBd30eEa",
    "0x741515714446dB947aa5246E79aCE4F9542d5550",
    "0x50C5b54be8005A45f81B049700aE43aae234D8F6",
    "0xe1d75c8D99aa9a3819F8c1CDbA9c908BC2267F87",
    "0xd34e10385FeB8598CcAfE267E34C5774ABC3742D",
    "0xF432fd18eC218c1D6A310B9066CaB51AEb0c6c3f",
    "0xA5fad4738e65c309F0E5E88198fecCAdf28Cdc52",
    "0x56a4f256425224aeCE3152E3E2DE94a1fAcB391f",
    "0x7829c4Cf39F3d7aEA5678E6fEd6969A8efe26090",
    "0x74414E5F2E07c594a11cbF9E5B7761B0B107754B",
    "0xA77dd02453D82f7038bA144e1abd1450DA9046Fc",
    "0x8Acf64e19e7420c52636F526B2FB0bC2752D3351",
    "0x947cC80fCD9718E15d9737dFDa7Db4675AD423e2",
    "0xa9c2c40aa14fC4057628801EAab484C4E0e998Aa",
    "0x2ecAEc97FC88aA25987791ae38559E2F8175B3c8",
  ];
  REP1V_TENANT_ADMINS_GROUP_ADDRESSES = [
    "igrp3KyPXics86uRoEwgqUEcorw3tM4M",
    "igrp2SojFNfcR5UfXKC2ewDLdMC9copD",
    "igrp2dek8LKQfeMqL9g2aE4rXroHSApz",
    "",
    "igrp2EpWqyKbwPKKsKMJzdCjevwqp2BU",
    "igrp4LrvPrAuZBt44vexW38uwzMq6xH4",
    "igrp4RV4mUYGXaQWiZsLb3ZysWzGzs61",
    "igrp2MeSGHtEB9UM48TmikWTM6o5Dctb",
    "igrp3DqwCoerGck9FK2j6GCeMQpnW5Mm",
    "igrp2cCyXtpvbUtWsatx9mjMAQVfy5Nr",
    "igrp2PKzesRZiP2nuZMi8mgFvShE2PqM",
    "igrp2bdviny15TSCyU8ZZfaAJUNZ13P8",
    "",
    "igrp225tXhe49xzQCEfDeSYSHsC837tN",
    "igrp3SoMsdR3Q7NtiiaEzkFHYhGF7Eg",
    "igrpcHFPeTXByhFcH6NA4FDtR1RRMqw",
    "igrpXq8VtKe6CagDY4yvftVzZ45nVHQ",
    "igrpJALbSYiFJwsMWpnWNUxwrgsWu5V",
    "",
    "igrp3Vw6myR1oseSb2U9Va8L7ck2gT2e",
    "igrp2PFyWkMHuKpodEsykd1RXLLMhimc",
    "igrp4Dd2keZRUZW9iLAEsg2VJC9PZJwC",
    "igrp2MCxjcGEXbLiKLKuEV8cNvfynsuE",
    "igrp2CRa3A4SopDMr3QSxQNPMr1SdzSz",
    "igrp3wuCsdMvzVwTWN9MZ6BrhA7jXdJG",
    "igrpLVv2RUHtTQaU5QauUoGDVbbHep7",
    "",
    "",
    "igrpAWPkUuKWfBi1SfFVsGdNyaqHKY4",
    "igrp28CzvQWowqNdhCvW2iQ35VpapihX",
    "igrp3kMSymwHhioHCts6WkpaWrLRAev5",
    "igrpnZDzjnPkbC58j2N1YFw153o7gXb",
    "igrp41F4hEWUBY2J3iTNmw9tMgDaEv5s",
    "igrpoAHYmr1aw2DYZj7exvHXKVrnvt5",
    "igrp4QJ8YGLS9bJRstNmVipipCGjq4cc",
    "igrp2VDgcdrNHkpSjrcPeUit2rtWSQzS",
    "igrpYg4BwajufJVZCVunefYbZxr2KxR",
    "igrp3na2bhs59hbczNhK7yE62mBiVpbZ",
    "igrp2P3kWoEL6EA4uddWY2Mww3PXAE8D",
    "igrpJahtxAmyaivjes57y1zUE23E3Cs",
    "igrp2JU96Mapj2wWdj15ZKfBhzJmQeM1",
    "igrp3LKpRuDs7RoMipmW5QpQLCQRu8dP",
    "igrpwY48gXovj36TM7vJN6UyRNU8MqA",
    "igrp2UaEZjMqMfXqjp7W7KYYGQh5zRQ",
    "igrp3B2df4y647g2n1ibUpZXrP8dFaC5",
    "igrp3hrwPjzuPn66x3rivXgYpWvYco8A",
    "igrp3cxJ3YZXD9nkpxT4i8WC4oArr537",
    "igrp2oENEyu6b7tE294FNYJgrHsvWR7s",
    "igrp4MNJq3C2CRYFGBuS7K8V2a6NwBFP",
    "igrp3DdTmNkaYkSiYAchCBwHpKRCA8qu",
    "igrp3ZSPfSJTXwkJYAztUw5As4WYtUJ8",
    "igrp2q4XUiBZKZmbmU1nQfaefonBMES3",
    "igrp3iY6X82oaxZt6u7rRQzoafTiiaJ6",
    "igrp3f6eD5sUe9ULhq58cuCHZx3zTAAj",
    "igrpvaLrzbX8utzhFVe64TU5ZBvzx5m",
    "igrp4Lh9Eb6NCkSxiwQsVamevZn48oy",
    "igrp2ZEh3NVP7Nt6jQSswPMMxELKHs3v",
    "igrp47dtoWBupUbmJfQ97JdAbCLkHeZc",
    "igrp2URymAJBJFjFxgGJ59pxTHENbQbf",
    "igrpMN6YoB9fcy4rQuNSRp5NEQuQL4k",
    "igrp3gaJrceQ97V25JeH32unrh8XKqXR",
    "igrp4LrvPrAuZBt44vexW38uwzMq6xH4",
  ];
  ADMINS_SET = new Set(REP1V_TENANT_ADMINS_GROUP_ADDRESSES);


  without_admins = [];
  dict = {};

  for (let i = 0; i < REP1V_TENANT_ADMINS_GROUP_ADDRESSES.length; i++) {
    // Tenants without a tenant admin group are inserted to the without_admins list
    if (REP1V_TENANT_ADMINS_GROUP_ADDRESSES[i] === "") {
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
      configUrl: Config.networks[Config.net],
      debugLogging: argv.verbose
    });
    await t.Init({ privateKey: process.env.PRIVATE_KEY });

    let success_count = 0;
    let failure_count = 0;
    let need_further_check = 0;
    let failure_log = [];

    let bcindexer_tenant_count = await sql`
        SELECT COUNT(*) as count_tenant
        FROM tenants as t
        WHERE t.id != 'iten11111111111111111111' AND t.id != 'iten11111111111111111112'
    `;

    let bcindexer_library_count = await sql`
        SELECT COUNT(*) as count_library
        FROM libraries as l
        WHERE l.tenant_id != 'iten11111111111111111111' AND l.tenant_id != 'iten11111111111111111112'
    `;
    console.log("number of entries in rep1.elv indexer tenants: ", bcindexer_tenant_count[0].count_tenant);
    console.log("number of entries in rep1.elv indexer libraries: ", bcindexer_library_count[0].count_library);
    console.log("number of tenants found on chain: ", REP1V_TENANT_ADDRESSES.length);
    console.log("number of tenants on chain without tenant admins group: ", without_admins.length);

    let tenants = await sql`
        SELECT t.id,
               count(t.id),
               t.space_id,
               array_agg(l.id) as libraries
        FROM tenants as t,
             libraries as l
        WHERE t.id = l.tenant_id
          AND t.id != 'iten11111111111111111111' AND t.id != 'iten11111111111111111112'
        GROUP BY t.id, t.space_id
    `;

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

            res = await t.TenantShow({ tenantId: tenant_contract_id });
            if (!res.errors) {
              success_count += 1;
              continue;
            }
            failure_log.push({
              owner: owner,
              tenant_contract_id: tenant_contract_id,
              tenant_admins_id: tenant_admins_id,
              libraries: tenant.libraries,
              fix_required: res.errors.length
            });
            failure_count += 1;

          } catch (e) {
            failure_log.push({
              owner: owner,
              tenant_contract_id: tenant_contract_id,
              tenant_admins_id: tenant_admins_id,
              libraries: tenant.libraries,
              errors: e.message
            });
            if (e.message.includes("must be logged in with an account in the tenant admins group")) {
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

    require("fs").writeFile(
      "./tenant_contracts_fix_info.json",

      JSON.stringify(failure_log, null, 1),

      function(err) {
        if (err) {
          console.log("Failed to create a fix info file.");
        }
      }
    );

    sql.end();
  } catch (e) {
    throw e;
  }
};

module.exports = {
  CmdQuery,
};