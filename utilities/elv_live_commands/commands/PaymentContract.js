const PaymentContractCommand = require("../lib/PaymentContract");

module.exports = {
  command: "payment_contract <command>",
  describe: "Payment contract related commands",
  builder: (yargs) => {
    yargs
      .command(
        "create <addresses> <shares>",
        "Deploy a payment contract for revenue split.",
        (yargs) => {
          yargs
            .positional("addresses", {
              describe: "List of stake holder addresses (hex), comma separated",
              type: "string"
            })
            .positional("shares", {
              describe: "List of stake holder shares, comma separated (one for each address)",
              type: "string"
            });
        },
        (argv) => {
          PaymentContractCommand.CmdPaymentCreate({ argv });
        }
      )

      .command(
        "show <addr> <token_addr>",
        "Show status of payment contract stakeholders",
        (yargs) => {
          yargs
            .positional("addr", {
              describe: "Address of the payment contract (hex)",
              type: "string"
            })
            .positional("token_addr", {
              describe: "Address of the ERC20 token contract (hex)",
              type: "string"
            });
        },
        (argv) => {
          PaymentContractCommand.CmdPaymentShow({ argv });
        }
      )

      .command(
        "release <addr> <token_addr>",
        "Retrieves payments from a payment splitter contract for a specified payee",
        (yargs) => {
          yargs
            .usage(`Usage: elv-live payment_contract release <addr> <token_addr>

Retrieve payment from payment splitter contract as a payee or for a payee using --payee flag
              `)
            .positional("addr", {
              describe: "Address of the payment contract (hex)",
              type: "string"
            })
            .positional("token_addr", {
              describe: "Address of the ERC20 token contract (hex)",
              type: "string"
            })
            .option("payee", {
              describe: "payee address",
              type: "string",
              default: "",
            });
        },
        (argv) => {
          PaymentContractCommand.CmdPaymentRelease({ argv });
        }
      )
      .demandCommand()
      .strict();
  },
};