const { ElvSpace } = require("../../../src/ElvSpace");
const { Config } = require("../../../src/Config");
const yaml = require("js-yaml");

const CmdNodes = async ({ argv }) => {
  try {
    let space = new ElvSpace({
      configUrl: Config.networks[Config.net],
      spaceAddress: Config.consts[Config.net].spaceAddress,
      kmsAddress: Config.consts[Config.net].kmsAddress,
      debugLogging: argv.verbose
    });
    await space.Init({ spaceOwnerKey: process.env.PRIVATE_KEY });

    let res = await space.SpaceNodes({
      matchEndpoint: argv.endpoint,
      matchNodeId: argv.node_id
    });

    console.log(yaml.dump(res));
  } catch (e) {
    console.error("ERROR:", e);
  }
};

module.exports = {
  CmdNodes,
};