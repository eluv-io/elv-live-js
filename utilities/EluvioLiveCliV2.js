const yargs = require("yargs/yargs");
const { hideBin } = require("yargs/helpers");

const NftCommand = require("./elv_live_commands/commands/Nft");
const ContentPolicyCommand = require("./elv_live_commands/commands/ContentPolicy");
const TenantCommand = require("./elv_live_commands/commands/Tenant");
const AccountCommand = require("./elv_live_commands/commands/Account");
const PaymentContractCommand = require("./elv_live_commands/commands/PaymentContract");
const TokenCommand = require("./elv_live_commands/commands/Token");
const MarketplaceCommand = require("./elv_live_commands/commands/Marketplace");
const SiteCommand = require("./elv_live_commands/commands/Site");
const StoreFrontSectionCommand = require("./elv_live_commands/commands/StorefrontSection");
const OtherCommands = require("./elv_live_commands/commands/Other");

const yargsInstance = yargs(hideBin(process.argv))
  .option("verbose",{
    describe: "Verbose mode",
    type: "boolean",
    alias: "v"
  })
  .option("as_url", {
    describe: "Alternate authority service URL (include '/as/' route if necessary)",
    type: "string"
  })
  .command(NftCommand)
  .command(ContentPolicyCommand)
  .command(TenantCommand)
  .command(AccountCommand)
  .command(PaymentContractCommand)
  .command(TokenCommand)
  .command(MarketplaceCommand)
  .command(SiteCommand)
  .command(StoreFrontSectionCommand);

// command list
OtherCommands.forEach((cmd) => {
  yargsInstance.command(cmd);
});

yargsInstance
  .strict()
  .wrap(yargs().terminalWidth() != null ? Math.min(120, yargs().terminalWidth()) : 120)
  .help()
  .usage("EluvioLive CLI\n\nUsage: elv-live <command>")
  .scriptName("")
  .demandCommand(1).argv;
