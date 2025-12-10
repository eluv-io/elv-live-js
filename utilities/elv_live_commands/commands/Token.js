const TokenCommand = require("../lib/Token");

module.exports = {
  command: "token <command>",
  describe: "Token related commands",
  builder: (yargs) => {
    yargs
      .command(
        "create <name> <symbol> <decimals> <amount> [options]",
        "Deploy elv token  contract",
        (yargs) => {
          yargs
            .positional("name", {
              describe: "elv_token name",
              type: "string",
            })
            .positional("symbol", {
              describe: "elv_token symbol",
              type: "string",
            })
            .positional("decimals", {
              describe: "elv_token decimals",
              type: "number",
            })
            .positional("amount", {
              describe: "elv_token premint amount",
              type: "number",
            });
        },
        (argv) => {
          TokenCommand.CmdTokenCreate({ argv });
        }
      )

      .command(
        "transfer <token_addr> <to_addr> <amount> [options]",
        "Transfer given elv tokens to address provided",
        (yargs) => {
          yargs
            .positional("token_addr", {
              describe: "elv_token address",
              type: "string",
            })
            .positional("to_addr", {
              describe: "to address",
              type: "string",
            })
            .positional("amount", {
              describe: "transfer amount",
              type: "number",
            });
        },
        (argv) => {
          TokenCommand.CmdTokenTransfer({ argv });
        }
      )

      .command(
        "balance_of <token_addr> <user_addr> [options]",
        "Get the token balance of a given user",
        (yargs) => {
          yargs
            .positional("token_addr", {
              describe: "elv_token address",
              type: "string",
            })
            .positional("user_addr", {
              describe: "user address",
              type: "string",
            });
        },
        (argv) => {
          TokenCommand.CmdTokenBalanceOf({ argv });
        }
      )

      .command(
        "minter <command>",
        "Token Minter related commands",
        (yargs) => {
          yargs
            .command(
              "add <addr> <minter>",
              "Add minter or mint helper address to NFT or Token",
              (yargs) => {
                yargs
                  .positional("addr", {
                    describe: "NFT or Token address (hex)",
                    type: "string",
                  })
                  .option("minter", {
                    describe: "Minter or mint helper address (hex)",
                    type: "string",
                  });
              },
              (argv) => {
                TokenCommand.CmdTokenAddMinter({ argv });
              }
            )

            .command(
              "renounce <addr>",
              "Renounce the minter(msg.sender) from NFT or Token",
              (yargs) => {
                yargs
                  .positional("addr", {
                    describe: "NFT or Token address (hex)",
                    type: "string",
                  });
              },
              (argv) => {
                TokenCommand.CmdTokenRenounceMinter({ argv });
              }
            )

            .command(
              "is_minter <addr> <minter>",
              "Check if minter to NFT or Token",
              (yargs) => {
                yargs
                  .positional("addr", {
                    describe: "NFT or Token address (hex)",
                    type: "string",
                  })
                  .option("minter", {
                    describe: "Minter address (hex)",
                    type: "string",
                  });
              },
              (argv) => {
                TokenCommand.CmdTokenIsMinter({ argv });
              }
            );
        },

      )
      .demandCommand()
      .strict();
  },
};