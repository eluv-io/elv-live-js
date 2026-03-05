const yargs = require("yargs/yargs");
const { hideBin } = require("yargs/helpers");
const CatalogCommand = require("./elv_media_wallet/commands/Catalog");
const PropertyCommand = require("./elv_media_wallet/commands/Property");

const yargsInstance = yargs(hideBin(process.argv))
  .option("verbose", {
    alias: "v",
    describe: "Verbose mode",
    type: "boolean",
    default: false,
  })
  .command(CatalogCommand)
  .command(PropertyCommand);


yargsInstance
  .strict()
  .help()
  .usage("Eluvio Media Wallet CLI\n\nUsage: elv-mediawallet <command> [options]")
  .alias("help", "h")
  .scriptName("")
  .demandCommand(1, "You need at least one command before moving on").argv;