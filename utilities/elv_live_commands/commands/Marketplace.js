const MarketplaceCommand = require("../lib/Marketplace");

module.exports = {
  command: "marketplace <command>",
  describe: "Marketplace related commands",
  builder: (yargs) => {
    yargs
      .command(
        "item <command>",
        "Marketplace Item commands",
        (yargs) => {
          yargs
            .command(
              "add <marketplace> <object> <name> [price] [forSale]",
              "Adds an item to a marketplace",
              (yargs) => {
                yargs.positional("marketplace", {
                  describe: "Marketplace object ID",
                  type: "string",
                });
                yargs.positional("object", {
                  describe: "NFT Template object hash (hq__) or id (iq__)",
                  type: "string",
                });
                yargs.positional("name", {
                  describe: "Item name"
                });
                yargs.positional("price", {
                  describe: "Price to list for",
                  type: "number",
                });
                yargs.positional("forSale", {
                  describe: "Whether to show for sale",
                  type: "boolean",
                  default: true,
                });
              },
              (argv) => {
                MarketplaceCommand.CmdMarketplaceAddItem({ argv });
              }
            )

            .command(
              "add_batch <marketplace> <csv>",
              "Adds multiple items to a marketplace",
              (yargs) => {
                yargs.positional("marketplace", {
                  describe: "Marketplace object ID",
                  type: "string",
                });
                yargs.positional("csv", {
                  describe: "CSV file containing object ID's and marketplace item name. Expects first row to be header row with columns ordered as object, name",
                  type: "string",
                });
              },
              (argv) => {
                MarketplaceCommand.CmdMarketplaceAddItemBatch({ argv });
              }
            )

            .command(
              "remove <marketplace> <object>",
              "Removes an item from a marketplace",
              (yargs) => {
                yargs.positional("marketplace", {
                  describe: "Marketplace object ID",
                  type: "string",
                });
                yargs.positional("object", {
                  describe: "NFT Template object ID (iq__)",
                  type: "string",
                });
              },
              (argv) => {
                MarketplaceCommand.CmdMarketplaceRemoveItem({ argv });
              }
            );
        },
        () => {
          yargs.showHelp();
        }
      )
      .demandCommand()
      .strict();
  },
};