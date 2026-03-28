const AccountCommand = require("../lib/Account");

module.exports = {
  command: "account <command>",
  describe: "Account related commands",
  builder: (yargs) => {
    yargs
      .command(
        "create <funds> <account_name> <tenant>",
        "Create a new account",
        (yargs) => {
          yargs
            .positional("funds", {
              describe:
                "How much to fund the new account from this private key (ELV)",
              type: "string",
            })
            .positional("account_name", {
              describe: "Account Name",
              type: "string",
            })
            .positional("tenant", {
              describe: "Tenant ID (iten)",
              type: "string",
            })

            .options("group_roles", {
              describe: "group and role pairs in JSON format, Eg: {\"grp1\":\"member\"}",
              type: "string",
            });
        },
        (argv) => {
          AccountCommand.CmdAccountCreate({ argv });
        }
      )

      .command(
        "set_tenant <tenant>",
        "Associates the account with a tenant",
        (yargs) => {
          yargs
            .usage(`Usage: elv-admin account set_tenant <tenant>
                
  Associate this account to the tenant.
  If an admins group ID is used, it will be converted to the tenant ID.`)
            .option("tenant", {
              describe: "Tenant contract ID (iten...)",
              type: "string",
            });
        },
        (argv) => {
          AccountCommand.CmdAccountSetTenantContractId({ argv });
        }
      )

      .command("show",
        "Shows current account information",
        (argv) => {
          AccountCommand.CmdAccountShow({ argv });
        }
      )

      .command("balance <address>",
        "Shows account balance for provided address",
        (yargs) => {
          yargs
            .positional("address", {
              describe: "user address",
              type: "string",
            });
        },
        (argv) => {
          AccountCommand.CmdAccountBalance({ argv });
        }
      )

      .command(
        "send <address> <funds>",
        "Send funds to a given address using this key",
        (yargs) => {
          yargs
            .positional("address", {
              describe: "Account address to send",
              type: "string",
            })
            .positional("funds", {
              describe:
                "How much to fund the new account from this private key in ETH.",
              type: "string",
            });
        },
        (argv) => {
          AccountCommand.CmdAccountSend({ argv });
        }
      )

      .command(
        "offer_signature <nft_addr> <mint_helper_addr> <token_id> <offer_id>",
        "Creates an offer signature for the minter to redeem an NFT offer",
        (yargs) => {
          yargs
            .usage(`Usage: elv-admin account offer_signature <nft_addr> <mint_helper_addr> <token_id> <offer_id>
                
  Creates an offer signature for use by the minter to redeem and nft offer. 
  Note the current key must be a token owner of the nft.              `)
            .positional("nft_addr", {
              describe: "NFT contract address (hex)",
              type: "string",
            })
            .positional("mint_helper_addr", {
              describe: "Address of the mint helper (hex)",
              type: "string",
            })
            .positional("token_id", {
              describe: "Token ID of the offer",
              type: "integer",
            })
            .positional("offer_id", {
              describe: "Offer_id",
              type: "integer",
            });
        },
        (argv) => {
          AccountCommand.CmdAccountOfferSignature({ argv });
        }
      )

      .command(
        "token <command>",
        "Token related commands",
        (yargs) => {
          yargs
            .command(
              "fabric [Options]",
              "Creates a fabric token using this key",
              (yargs) => {
                yargs
                  .option("duration", {
                    describe: "Library ID to authorize",
                    type: "string",
                  });
              },
              (argv) => {
                AccountCommand.CmdAccountFabricToken({ argv });
              }
            )

            .command(
              "signed [Options]",
              "Creates a client signed token using this key",
              (yargs) => {
                yargs
                  .option("library_id", {
                    describe: "Library ID to authorize",
                    type: "string",
                  })
                  .option("object_id", {
                    describe: "Object ID to authorize",
                    type: "string",
                  })
                  .option("version_hash", {
                    describe: "Version hash to authorize",
                    type: "string",
                  })
                  .option("policy_id", {
                    describe: "The object ID of the policy for this token",
                    type: "string",
                  })
                  .option("subject", {
                    describe: "Subject of the token. Default is the current address",
                    type: "string",
                  })
                  .option("grant_type", {
                    describe: "Permissions to grant for this token. Options: 'access', 'read', 'create', 'update', 'read-crypt'. Default 'read'",
                    type: "string",
                  })
                  .option("duration", {
                    describe: "Time until the token expires, in milliseconds. Default 2 min = 2 * 60 * 1000 = 120000)",
                    type: "integer",
                  })
                  .option("allow_decryption", {
                    describe: "If specified, the re-encryption key will be included in the token, enabling the user of this token to download encrypted content from the specified object",
                    type: "boolean",
                  })
                  .option("context", {
                    describe: "Additional JSON context",
                    type: "string",
                  });
              },
              (argv) => {
                AccountCommand.CmdAccountSignedToken({ argv });
              }
            );
        }
      );
  }
};