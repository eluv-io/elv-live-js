const GroupCommand = require("../lib/Group");

module.exports = {
  command:"group <command>",
  describe:"Group related commands",
  builder: (yargs) => {
    yargs
      .command(
        "create <name>",
        "Create a new access group",
        (yargs) => {
          yargs.positional("name", {
            describe: "The name of the access group",
            type: "string",
          });
        },
        (argv) => {
          GroupCommand.CmdGroupCreate({ argv });
        }
      )

      .command(
        "add <group_address> <account_address>",
        "Add account to access group",
        (yargs) => {
          yargs
            .positional("group_address", {
              describe: "The address of the access group (hex)",
              type: "string",
            })
            .positional("account_address", {
              describe: "The address to add as member (hex)",
              type: "string",
            })
            .option("is_manager", {
              describe: "Set new address as group manager",
              type: "boolean",
            });
        },
        (argv) => {
          GroupCommand.CmdGroupAdd({ argv });
        }
      )

      .command(
        "remove <group_address> <account_address>",
        "Remove account from access group",
        (yargs) => {
          yargs
            .positional("group_address", {
              describe: "The address of the access group (hex)",
              type: "string",
            })
            .positional("account_address", {
              describe: "The address to remove as member (hex)",
              type: "string",
            })
            .option("is_manager", {
              describe: "remove address as group manager",
              type: "boolean",
            });
        },
        (argv) => {
          GroupCommand.CmdGroupRemove({ argv });
        }
      )

      .command(
        "is_member <group> <addr>",
        "Checks if the user address is a member of the access group",
        (yargs) => {
          yargs
            .positional("group", {
              describe: "Access control group ID or address (igrp or hex format)",
              type: "string",
            })
            .positional("addr", {
              describe: "User address (hex format)",
              type: "string",
            });
        },
        (argv) => {
          GroupCommand.CmdAccessGroupMember({ argv });
        }
      )

      .command(
        "member_lists <group>",
        "Returns a list of group members",
        (yargs) => {
          yargs
            .positional("group", {
              describe: "Access control group ID or address (igrp or hex format)",
              type: "string",
            });
        },
        (argv) => {
          GroupCommand.CmdAccessGroupMembers({ argv });
        }
      );
  }
};