const BlockchainCommand = require("../lib/Blockchain");

module.exports = {
  command: "blockchain <command>",
  describe: "Blockchain related commands",
  handler: (yargs) => {
    yargs
      .command(
        "replace_stuck_transaction",
        "replace stuck transaction at given nonce using this key with higher gas-price",
        (yargs) => {
          yargs
            .option("nonce", {
              describe: "Nonce of the transaction to be replaced",
              type: "integer",
            });
        },
        (argv) => {
          BlockchainCommand.CmdReplaceStuckTx({ argv });
        }
      );
  }
}