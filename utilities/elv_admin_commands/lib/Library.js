const Utils = require("../../../../elv-client-js/src/Utils");
const { ElvContracts } = require("../../../src/ElvContracts");
const { Config } = require("../../../src/Config");
const yaml = require("js-yaml");

const CmdDeleteLibrary = async ({argv}) => {
  console.log("Parameters:");
  console.log("object", argv.library);

  try {
    const library = argv.library;
    let libraryAddr;
    if (library.startsWith("ilib")) {
      libraryAddr =  Utils.HashToAddress(library);
    } else if (library.startsWith("0x")) {
      libraryAddr = library;
    } else {
      throw new Error(`Invalid library provided: ${library}`);
    }

    let elvContract = new ElvContracts({
      configUrl: Config.networks[Config.net],
      debugLogging: argv.verbose
    });
    await elvContract.Init({
      privateKey: process.env.PRIVATE_KEY,
    });

    const res = await elvContract.DeleteLibrary({
      libraryAddr
    });
    console.log(yaml.dump(res));
  } catch (e) {
    console.error("ERROR:", argv.verbose ? e : e.message);
  }
};

module.exports = {
  CmdDeleteLibrary,
};