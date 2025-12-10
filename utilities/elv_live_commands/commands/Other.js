const OtherCommand = require("../lib/Other");

module.exports = [
  {
    command: "shuffle <file> [options]",
    describe: "Sort each line deterministically based on the seed",

    builder: (yargs) => {
      return yargs
        .positional("file", {
          describe: "File or directory path",
          type: "string",
        })
        .option("seed", {
          describe:
            "Determines the order. If no seed is provided, the shuffler uses a random one.",
          type: "string",
        })
        .option("check_dupes", {
          describe: "Abort if duplicate is found",
          type: "boolean",
        })
        .option("print_js", {
          describe: "Print result as an array in JavaScript",
          type: "boolean",
        });
    },

    handler: (argv) => {
      OtherCommand.CmdShuffle({ argv });
    },
  },
  {
    command: "admin_health [options]",
    describe: "Checks the health of Authority Service APIs",
    builder: (yargs) => {
      yargs
        .usage(`Usage: elv-live admin_health [options]
            
    Checks the health of the Authority Service APIs. 
    Note the current key must be a system admin configured in the AuthD servers.`);
    },
    handler: (argv) => {
      OtherCommand.CmdAdminHealth({ argv });
    }
  },
  {
    command:"list <tenant>",
    describe:"List all tenant_nfts within a tenant contract",
    builder:(yargs) => {
      yargs.positional("tenant", {
        describe: "Tenant ID",
        type: "string",
      });
    },
    handler: (argv) => {
      OtherCommand.CmdTenantNftList({ argv });
    }
  }
];

