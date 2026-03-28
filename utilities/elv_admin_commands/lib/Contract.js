const { ElvFabric } = require("../../../src/ElvFabric");
const { Config } = require("../../../src/Config");
const yaml = require("js-yaml");

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

module.exports = {
  CmdContractGetMeta,
  CmdContractSetMeta,
};