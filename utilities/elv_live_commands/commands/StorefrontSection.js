const StoreFrontSectionCommand = require("../lib/StorefrontSection");

module.exports = {
  command: "storefront_section <command>",
  describe: "Storefront section related commands",
  builder : (yargs) => {
    yargs
      .command(
        "add_item <marketplace> <sku> [section]",
        "Adds an item to a marketplace storefront section",
        (yargs) => {
          yargs.positional("marketplace", {
            describe: "Marketplace object ID",
            type: "string",
          });
          yargs.positional("sku", {
            describe: "Marketplace item SKU",
            type: "string",
          });
          yargs.positional("section", {
            describe: "Storefront section name",
            type: "string",
            string: true,
          });
        },
        (argv) => {
          StoreFrontSectionCommand.CmdStorefrontSectionAddItem({ argv });
        }
      )

      .command(
        "remove_item <marketplace> <sku> [writeToken]",
        "Removes an item from a marketplace storefront section",
        (yargs) => {
          yargs.positional("marketplace", {
            describe: "Marketplace object ID",
            type: "string",
          });
          yargs.positional("sku", {
            describe: "Marketplace item SKU",
            type: "string",
          });
          yargs.positional("writeToken", {
            describe: "Write token (if not provided, object will be finalized)",
            type: "string",
          });
        },
        (argv) => {
          StoreFrontSectionCommand.CmdStorefrontSectionRemoveItem({ argv });
        }
      )

      .demandCommand()
      .strict();
  },
};