const { ElvMediaWallet } = require("../../../src/ElvMediaWallet");
const { Config } = require("../../../src/Config");
const yaml = require("js-yaml");

const makeWallet = (argv) => {
  return new ElvMediaWallet({
    configUrl: Config.networks[Config.net],
    debugLogging: argv.verbose
  });
};

const CmdPropertySectionItemAdd = async({argv}) => {
  console.log("Property Section Item Add Command Invoked\n");

  try {
    const wallet = makeWallet(argv);
    await wallet.Init({ privateKey: process.env.PRIVATE_KEY });
    const res = await wallet.PropertySectionItemAdd({
      propertyObjectId: argv.property_object_id,
      sectionId: argv.section_id,
      mediaItemId: argv.media_item_id,
    });
    console.log(yaml.dump(res));
  } catch (error) {
    console.error("Error adding item to property section:", error);
    process.exit(1);
  }
};

module.exports = {
  CmdPropertySectionItemAdd,
};
