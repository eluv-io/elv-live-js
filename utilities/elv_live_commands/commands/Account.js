const AccountCommands = require("../lib/Account");

module.exports = {
  command:"account <command>",
  describe:"Account related commands",
  builder:(yargs) => {
    yargs
      .command(
        "create <funds> <account_name> <tenant_admins>",
        "Create a new account",
        (yargs) => {
          yargs
            .positional("funds", {
              describe:
                "How much to fund the new account from this private key in ETH.",
              type: "string",
            })
            .positional("account_name", {
              describe: "Account Name",
              type: "string",
            })
            .positional("tenant_admins", {
              describe: "Tenant Admins group ID",
              type: "string",
            });
        },
        (argv) => {
          AccountCommands.CmdAccountCreate({ argv });
        }
      )

      .command("show", "Shows current account information.", () => {
        AccountCommands.CmdAccountShow();
      })
      .demandCommand()
      .strict();
  },
};