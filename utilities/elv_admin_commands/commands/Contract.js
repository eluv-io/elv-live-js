const ContractCommand = require("../lib/Contract");

module.exports = {
  command: "contract <command>",
  describe: "Contract related commands",
  builder: (yargs) => {
    yargs
      .command(
        "meta <command>",
        "Contract meta related commands",
        (yargs) => {
          yargs
            .command(
              "get <addr> <key>",
              "Get contract metadata",
              (yargs) => {
                yargs
                  .positional("addr", {
                    describe: "Contract address. NFT object ID also accepted eg. iqxxx.",
                    type: "string",
                  })
                  .positional("key", {
                    describe: "Metadata key to retrieve.",
                    type: "string",
                  });
              },
              (argv) => {
                ContractCommand.CmdContractGetMeta({ argv });
              }
            )

            .command(
              "set <addr> <key> <value>",
              "Set contract metadata using key/value",
              (yargs) => {
                yargs
                  .positional("addr", {
                    describe: "Contract address. NFT object ID also accepted eg. iqxxx.",
                    type: "string",
                  })
                  .positional("key", {
                    describe: "Metadata key.",
                    type: "string",
                  })
                  .positional("value", {
                    describe: "Metadata value.",
                    type: "string",
                  });
              },
              (argv) => {
                ContractCommand.CmdContractSetMeta({ argv });
              }
            );
        }
      );
  }
};