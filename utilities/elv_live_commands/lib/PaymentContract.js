const { ElvContracts } = require("../../../src/ElvContracts");
const { Config } = require("../../../src/Config");
const yaml = require("js-yaml");

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

module.exports = {
  CmdPaymentCreate,
  CmdPaymentShow,
  CmdPaymentRelease,
};