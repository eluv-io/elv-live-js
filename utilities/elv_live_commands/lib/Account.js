const { Init, elvlv } = require("./Init");
const yaml = require("js-yaml");

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

module.exports = {
  CmdAccountShow,
  CmdAccountCreate,
};