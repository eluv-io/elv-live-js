const NftCommands = require("../lib/Nft");

module.exports = {
  command : "nft <command>",
  describe: "NFT related commands",
  builder : (yargs) => {
    return yargs
      .command(
        "show <addr> [options]",
        "Show info on this NFT",
        (yargs) => {
          yargs
            .positional("addr", {
              describe: "NFT address (hex)",
              type: "string",
            })
            .option("check_minter", {
              describe: "Check that all NFTs use this mint helper",
            })
            .option("show_owners", {
              describe: "Show up to these many owners (default 0), loaded from an index. Only used when token_id is not specified.",
              type: "integer",
            })
            .option("show_owners_via_contract", {
              describe: "Show up to these many owners (default 0), parsed directly from the contract. Only used when token_id is not specified.",
              type: "integer",
            })
            .option("include_email", {
              describe: "Include owner(s) email(s) when available, as bound to the given tenant ID.",
              type: "string",
            })
            .option("token_id", {
              describe: "External token ID. This will take precedence over show_owners.",
              type: "string", // BigNumber as string
            });
        },
        (argv) => {
          NftCommands.CmdNftShow({ argv });
        }
      )

      .command(
        "balance_of <addr> <owner>",
        "Check ownership of an NFT for a given address",
        (yargs) => {
          yargs
            .positional("addr", {
              describe: "NFT address (hex)",
              type: "string",
            })
            .positional("owner", {
              describe: "Owner address to check (hex)",
              type: "string",
            });
        },
        (argv) => {
          NftCommands.CmdNftBalanceOf({ argv });
        }
      )

      .command(
        "refresh <tenant> <addr>",
        "Sync backend listings with tenant NFT metadata",
        (yargs) => {
          yargs
            .usage(
              `Usage: elv-live nft refresh <tenant> <addr>

Synchronize backend listings with Fabric metadata for a specific tenant's NFT. 
This operation requires tenant's Key to access and update the listings.`
            )
            .positional("tenant", {
              describe: "Tenant ID",
              type: "string",
            })
            .positional("addr", {
              describe: "NFT contract address",
              type: "string",
            });
        },
        (argv) => {
          NftCommands.CmdNFTRefresh({ argv });
        }
      )

      .command(
        "transfer <addr> <token_id> <to_addr> [options]",
        "Transfer the specified NFT as the token owner",
        (yargs) => {
          yargs
            .positional("addr", {
              describe: "Local NFT contract address",
              type: "string",
            })
            .positional("token_id", {
              describe: "External token ID",
              type: "string", // BigNumber as string
            })
            .positional("to_addr", {
              describe: "Address to transfer to (hex)",
              type: "string",
            })
            .option("auth_service", {
              describe: "Use the Authority Service to do the transfer"
            });
        },
        (argv) => {
          NftCommands.CmdNftTransfer({ argv });
        }
      )

      .command(
        "proxy_transfer <addr> <token_id> <from_addr> <to_addr>",
        "Tranfer NFT as a proxy owner",
        (yargs) => {
          yargs
            .positional("addr", {
              describe: "NFT address (hex)",
              type: "string",
            })
            .positional("token_id", {
              describe: "Token Id",
              type: "integer",
            })
            .positional("from_addr", {
              describe: "Address to transfer from (hex)",
              type: "string",
            })
            .positional("to_addr", {
              describe: "Address to transfer to (hex)",
              type: "string",
            });
        },
        (argv) => {
          NftCommands.CmdNftProxyTransfer({ argv });
        }
      )

      .command(
        "build <library> <object> [options]",
        "Build the public/nft section",
        (yargs) => {
          yargs
            .usage(
              `
Usage: elv-live nft build <library> <object>

Build the public/nft section based on asset metadata. 
If --nft_dir is specified, will build a generative nft based on *.json files inside the dir. 
See README.md for more details. `
            )
            .positional("library", {
              describe: "Content library",
              type: "string",
            })
            .positional("object", {
              describe: "Content object hash (hq__) or id (iq__)",
              type: "string",
            })
            .option("nft_dir", {
              describe:
                "Create a multi-media NFT (generative). " +
                "Directory contains json files describing the nft.  See documentation to see *.json structure.",
              type: "string",
            });
        },
        (argv) => {
          NftCommands.CmdNftBuild({ argv });
        }
      )

      .command(
        "proxy <command>",
        "NFT proxy commands",
        (yargs) => {
          return yargs
            .command(
              "set <addr> [proxy_addr]",
              "Set a proxy on an NFT contract",
              (yargs) => {
                yargs
                  .positional("addr", {
                    describe: "NFT address (hex)",
                    type: "string",
                  })
                  .option("proxy_addr", {
                    describe: "Proxy contract address (hex)",
                    type: "string",
                  });
              },
              (argv) => {
                NftCommands.CmfNftSetProxy({ argv });
              }
            );
        },
        () => {
          yargs.showHelp();
        }
      )


      .command(
        "pack <command>",
        "Pack related commands",
        (yargs) => {
          yargs
            .command(
              "dist <command>",
              "Pack distribution commands",
              (yargs) => {
                yargs
                  .command(
                    "get <hash>",
                    "Compute pack distribution",
                    (yargs) => {
                      yargs
                        .usage(
                          `Usage: elv-live nft pack dist get <hash>

Compute pack distribution based on NFT Template spec. Saves to file.
                            `
                        )
                        .positional("hash", {
                          describe: "NFT Template content hash (hq__)",
                          type: "string",
                        });
                    },
                    (argv) => {
                      NftCommands.CmdNftPackGetDist({ argv });
                    }
                  )

                  .command(
                    "set <hash>",
                    "Set the pack distribution for an NFT Template",
                    (yargs) => {
                      yargs
                        .usage(
                          `elv-live nft pack dist set <hash>

Set the pack distribution for an NFT Template. 
Reads distribution from file.                            `
                        )
                        .positional("hash", {
                          describe: "NFT Template content hash (hq__)",
                          type: "string",
                        });
                    },
                    (argv) => {
                      NftCommands.CmdNftPackSetDist({ argv });
                    }
                  );
              },
              () => {
                yargs.showHelp();
              }
            );
        },
        () => {
          yargs.showHelp();
        }
      )

      .command(
        "burn <addr> <token_id>",
        "Burn the specified NFT as the owner",
        (yargs) => {
          yargs
            .positional("addr", {
              describe: "Local NFT contract address",
              type: "string",
            })
            .positional("token_id", {
              describe: "External token ID",
              type: "string", // BigNumber as string
            });
        },
        (argv) => {
          NftCommands.CmdNftBurn({ argv });
        }
      )

      .command(
        "proxy_burn <addr> <token_id>",
        "Burn the specified NFT",
        (yargs) => {
          yargs
            .positional("addr", {
              describe: "Local NFT contract address",
              type: "string",
            })
            .positional("token_id", {
              describe: "External token ID",
              type: "string", // BigNumber as string
            });
        },
        (argv) => {
          NftCommands.CmdNftProxyBurn({ argv });
        }
      )

      .command(
        "transfer_fee <command>",
        "Transfer Fee related commands",
        (yargs) => {
          yargs
            .command(
              "set <addr> <fee>",
              "Set the transfer fee for an NFT contract",
              (yargs) => {
                yargs
                  .positional("addr", {
                    describe: "NFT contract address",
                    type: "string",
                  })
                  .positional("fee", {
                    describe: "Fee in ETH",
                    type: "string", // BigNumber as string
                  });
              },
              (argv) => {
                NftCommands.CmdNftSetTransferFee({ argv });
              }
            )

            .command(
              "get <addr>",
              "Get the transfer fee for an NFT contract",
              (yargs) => {
                yargs
                  .positional("addr", {
                    describe: "NFT contract address",
                    type: "string",
                  });
              },
              (argv) => {
                NftCommands.CmdNftGetTransferFee({ argv });
              }
            );
        },
        () => {
          yargs.showHelp();
        }
      )

      .command(
        "contract <command>",
        "NFT contract commands",
        (yargs) => {
          yargs
            .command(
              "add <tenant> <object> <cap> <name> <symbol> [options]",
              "Adds an NFT contract (new/existing) to an NFT Template",
              (yargs) => {
                yargs
                  .positional("tenant", {
                    describe: "Tenant ID",
                    type: "string",
                  })
                  .positional("object", {
                    describe: "NFT Template object ID",
                    type: "string",
                  })
                  .positional("cap", {
                    describe: "NFT total supply cap",
                    type: "number",
                  })
                  .positional("name", {
                    describe: "NFT collection name",
                    type: "string",
                  })
                  .positional("symbol", {
                    describe: "NFT collection symbol",
                    type: "string",
                  })
                  .option("hold", {
                    describe: "Hold period in seconds (default 7 days)",
                    type: "number",
                  });
              },
              (argv) => {
                NftCommands.CmdNftTemplateAddNftContract({ argv });
              }
            )

            .command(
              "offer <command>",
              "Offer related commands",
              (yargs) => {
                yargs
                  .command(
                    "add <addr>",
                    "Adds a redeemable offer to an NFT contract",
                    (yargs) => {
                      yargs
                        .usage(`Usage: elv-live nft contract offer add <addr> 

Add a redeemable offer to the NFT contract as the contract owner or minter.
`)
                        .positional("addr", {
                          describe: "NFT contract address",
                          type: "string",
                        });
                    },
                    (argv) => {
                      NftCommands.CmdNftAddRedeemableOffer({ argv });
                    }
                  )

                  .command(
                    "remove <addr> <offer_id>",
                    "Removes a redeemable offer from an NFT contract",
                    (yargs) => {
                      yargs
                        .usage(
                          `Usage: elv-live nft contract offer remove <addr> <offer_id>

Remove (disable) a redeemable offer from the NFT contract as the contract owner or minter.          
                            `
                        )
                        .positional("addr", {
                          describe: "NFT contract address",
                          type: "string",
                        })
                        .positional("offer_id", {
                          describe: "Offer ID",
                          type: "integer",
                        });
                    },
                    (argv) => {
                      NftCommands.CmdNftRemoveRedeemableOffer({ argv });
                    }
                  )

                  .command(
                    "is_redeemed <addr> <token_id> <offer_id>",
                    "Checks if an offer has been redeemed",
                    (yargs) => {
                      yargs
                        .positional("addr", {
                          describe: "NFT contract address",
                          type: "string",
                        })
                        .positional("token_id", {
                          describe: "Offer ID",
                          type: "integer",
                        })
                        .positional("offer_id", {
                          describe: "Offer ID",
                          type: "integer",
                        });
                    },
                    (argv) => {
                      NftCommands.CmdNftIsOfferRedeemed({ argv });
                    }
                  )

                  .command(
                    "is_active <addr> <offer_id>",
                    "Checks if offer is active",
                    (yargs) => {
                      yargs
                        .positional("addr", {
                          describe: "NFT contract address",
                          type: "string",
                        })
                        .positional("offer_id", {
                          describe: "Offer ID",
                          type: "integer",
                        });
                    },
                    (argv) => {
                      NftCommands.CmdNftIsOfferActive({ argv });
                    }
                  )

                  .command(
                    "redeem <addr> <redeemer> <token_id> <offer_id>",
                    "Redeem an nft offer",
                    (yargs) => {
                      yargs
                        .positional("addr", {
                          describe: "NFT contract address",
                          type: "string",
                        })
                        .positional("redeemer", {
                          describe: "Redeemer address",
                          type: "string",
                        })
                        .positional("token_id", {
                          describe: "Offer ID",
                          type: "integer",
                        })
                        .positional("offer_id", {
                          describe: "Offer ID",
                          type: "integer",
                        });
                    },
                    (argv) => {
                      NftCommands.CmdNftRedeemOffer({ argv });
                    }
                  )

                  .command(
                    "as_redeem <addr> <tenant> <mint_helper_addr> <token_id> <offer_id>",
                    "Redeem an nft offer using the authority service",
                    (yargs) => {
                      yargs
                        .positional("addr", {
                          describe: "NFT contract address",
                          type: "string",
                        })
                        .positional("tenant", {
                          describe: "Tenant ID",
                          type: "string",
                        })
                        .positional("mint_helper_addr", {
                          describe: "Address of the mint helper (hex), used with --auth_service",
                          type: "string",
                        })
                        .positional("token_id", {
                          describe: "Offer ID",
                          type: "integer",
                        })
                        .positional("offer_id", {
                          describe: "Offer ID",
                          type: "integer",
                        });
                    },
                    (argv) => {
                      NftCommands.CmdASNftRedeemOffer({ argv });
                    }
                  );
              },
              () => {
                yargs.showHelp();
              }
            );

        },
        () => {
          yargs.showHelp();
        }
      )

      .command(
        "policy <command>",
        "Policy related commands",
        (yargs) => {
          yargs
            .command(
              "contract <command>",
              "Contract related commands",
              (yargs) => {
                yargs
                  .command(
                    "get <object>",
                    "Gets the policy and permissions of a content object.",
                    (yargs) => {
                      yargs.positional("object", {
                        describe: "ID of the content fabric object",
                        type: "string",
                      });
                    },
                    (argv) => {
                      NftCommands.CmdNftGetPolicyPermissions({ argv });
                    }
                  )

                  .command(
                    "set <object> <policy_path> <addrs..>",
                    "Sets NFT access policy and permissions for a content object.",
                    (yargs) => {
                      yargs
                        .usage(`Usage: elv-live nft policy contract set <object> <policy_path> <addrs..>

Sets the policy and permissions granting NFT owners access to a content object. 
When no addresses are specified, only the policy is set.
                          `)
                        .positional("object", {
                          describe: "ID of the content object to grant access to",
                          type: "string",
                        })
                        .positional("policy_path", {
                          describe: "Path of policy object file",
                          type: "string",
                        })
                        .positional("addrs", {
                          describe:
                            "List of space separated NFT contract addresses to set. Calling multiple times with a new list will replace the existing.",
                          type: "string",
                        })
                        .option("clear", {
                          describe: "clear the nft owners",
                          type: "boolean",
                          default: false
                        });
                    },
                    (argv) => {
                      NftCommands.CmdNftSetPolicyPermissions({ argv });
                    }
                  );
              },
              () => {
                yargs.showHelp();
              }
            );
        },
        () => {
          yargs.showHelp();
        }
      );
  },
};

