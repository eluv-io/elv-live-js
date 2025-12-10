const ClaimerCommand = require("../lib/Claimer");

module.exports = {
  command:"claimer <command>",
  describe:"Claimer management commands",
  builder:(yargs) => {
    yargs
      .command(
        "allocate <address> <amount> <yyyy_mm_dd>",
        "Allocate an allocation to an user, an allocation contains an amount and an expiration date (in UTC)",
        (yargs) => {
          yargs
            .positional("address", {
              describe: "Address to allocate",
              type: "string",
            })
            .positional("amount", {
              describe: "Amount to allocate",
              type: "string",
            })
            .positional("expiration_date", {
              describe: "Expiration date of the allocation (in UTC)",
              type: "string",
            });
        },
        (argv) => {
          ClaimerCommand.CmdClaimerAllocate({ argv });
        }
      )

      .command(
        "claim <amount>",
        "Claim an amount of your allocations",
        (yargs) => {
          yargs
            .positional("amount", {
              describe: "Amount to claim",
              type: "string",
            });
        },
        (argv) => {
          ClaimerCommand.CmdClaimerClaim({ argv });
        }
      )
      .command(
        "burn <amount>",
        "Burn an amount of your allocations",
        (yargs) => {
          yargs
            .positional("amount", {
              describe: "Amount to burn",
              type: "string",
            });
        },
        (argv) => {
          ClaimerCommand.CmdClaimerBurn({ argv });
        }
      )
      .command(
        "list_allocations <address>",
        "List the allocations of an address",
        (yargs) => {
          yargs
            .positional("address", {
              describe: "the allocations of this address would be listed",
              type: "string",
            });
        },
        (argv) => {
          ClaimerCommand.CmdClaimerListAllocations({ argv });
        }
      )
      .command(
        "balance_of <address>",
        "Get the balance of an address",
        (yargs) => {
          yargs
            .positional("address", {
              describe: "the balance of this address would be given",
              type: "string",
            });
        },
        (argv) => {
          ClaimerCommand.CmdClaimerBalanceOf({ argv });
        }
      )
      .command(
        "burn_of <address>",
        "Get the burn of an address",
        (yargs) => {
          yargs
            .positional("address", {
              describe: "the burn of this address would be given",
              type: "string",
            });
        },
        (argv) => {
          ClaimerCommand.CmdClaimerBurnOf({ argv });
        }
      )
      .command(
        "auth_address <command>",
        "Auth address related commands",
        (yargs) => {
          yargs
            .command(
              "add <address>",
              "Add an address to the authorized address list",
              (yargs) => {
                yargs
                  .positional("address", {
                    describe: "this address would be added to the authorized address list",
                    type: "string",
                  });
              },
              (argv) => {
                ClaimerCommand.CmdClaimerAddAuthAddr({ argv });
              }
            )
            .command(
              "remove <address>",
              "Remove an address from the authorized address list",
              (yargs) => {
                yargs
                  .positional("address", {
                    describe: "this address would be remove from the authorized address list",
                    type: "string",
                  });
              },
              (argv) => {
                ClaimerCommand.CmdClaimerRmAuthAddr({ argv });
              }
            );
        }
      );
  }
};