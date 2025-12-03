const yargs = require("yargs/yargs");
const { hideBin } = require("yargs/helpers");

const nftCommand = require("./elv_live_commands/commands/nft");
const contentPolicyCommand = require("./elv_live_commands/commands/content_policy");

yargs(hideBin(process.argv))
  .option("verbose",{
    describe: "Verbose mode",
    type: "boolean",
    alias: "v"
  })
  .option("as_url", {
    describe: "Alternate authority service URL (include '/as/' route if necessary)",
    type: "string"
  })
  .command(nftCommand)
  .command(contentPolicyCommand)
  .strict()
  .wrap(yargs().terminalWidth() != null ? Math.min(120, yargs().terminalWidth()) : 120)
  .help()
  .usage("EluvioLive CLI\n\nUsage: elv-live <command>")
  .scriptName("")
  .demandCommand(1).argv;