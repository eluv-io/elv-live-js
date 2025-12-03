const { ElvContracts } = require("../../../src/ElvContracts");
const { Config } = require("../../../src/Config");
const yaml = require("js-yaml");

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

module.exports = {
  CmdClaimerAllocate,
  CmdClaimerClaim,
  CmdClaimerBurn,
  CmdClaimerListAllocations,
  CmdClaimerBalanceOf,
  CmdClaimerBurnOf,
  CmdClaimerAddAuthAddr,
  CmdClaimerRmAuthAddr,
};