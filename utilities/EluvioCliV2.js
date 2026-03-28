const yargs = require("yargs/yargs");
const { hideBin } = require("yargs/helpers");

const AccountCommand = require("./elv_admin_commands/commands/Account");
const IndexerCommand = require("./elv_admin_commands/commands/Indexer");
const BlockchainCommand = require("./elv_admin_commands/commands/Blockchain");
const GroupCommand = require("./elv_admin_commands/commands/Group");
const TenantCommand = require("./elv_admin_commands/commands/Tenant");
const ContentCommand = require("./elv_admin_commands/commands/Content");
const ContractCommand = require("./elv_admin_commands/commands/Contract");
const LibraryCommand = require("./elv_admin_commands/commands/Library");
const NodesCommand = require("./elv_admin_commands/commands/Nodes");
const ClaimerCommand = require("./elv_admin_commands/commands/Claimer");

const yargsInstance = yargs(hideBin(process.argv))
  .option("verbose", {
    describe: "Verbose mode",
    type: "boolean",
    alias: "v"
  })
  .command(AccountCommand)
  .command(IndexerCommand)
  .command(BlockchainCommand)
  .command(GroupCommand)
  .command(TenantCommand)
  .command(ContentCommand)
  .command(ContractCommand)
  .command(LibraryCommand)
  .command(NodesCommand)
  .command(ClaimerCommand);

yargsInstance
  .strict()
  .help()
  .usage("EluvioLive Admin CLI\n\nUsage: elv-admin <command>")
  .scriptName("")
  .demandCommand(1).argv;