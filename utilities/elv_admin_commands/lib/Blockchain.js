const { ElvAccount } = require("../../../src/ElvAccount");
const { Config } = require("../../../src/Config");

const CmdReplaceStuckTx = async ({ argv }) => {
  console.log("Replace stuck transaction:\n");
  try {
    let elvAccount = new ElvAccount({
      configUrl: Config.networks[Config.net],
      debugLogging: argv.verbose
    });

    await elvAccount.Init({
      privateKey: process.env.PRIVATE_KEY,
    });

    await elvAccount.ReplaceStuckTx({
      nonce: argv.nonce,
    });
    console.log("Success!");
  } catch (e) {
    console.error("ERROR:", e);
  }
};

module.exports = {
  CmdReplaceStuckTx,
};