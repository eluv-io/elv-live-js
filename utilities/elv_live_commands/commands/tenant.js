const TenantCommands = require("../lib/tenant");

module.exports = {
  command: "tenant <command>",
  describe: "Tenant related commands",
  builder: (yargs) => {
    return yargs
      .command(
        "show <tenant> [options]",
        "Show info on this tenant",
        (yargs) => {
          yargs
            .positional("tenant", {
              describe: "Tenant ID",
              type: "string",
            })
            .option("check_nfts", {
              describe:
                "Check that all NFTs are part of the tenant contract's tenant_nfts group",
              type: "boolean",
            });
        },
        (argv) => {
          TenantCommands.CmdTenantShow({ argv });
        }
      )

      .command(
        "auth_token <path_or_body>",
        "Generate a tenant token",
        (yargs) => {
          yargs
            .positional("path_or_body", {
              describe: "URL path or request body",
              type: "string",
            });
        },
        (argv) => {
          TenantCommands.CmdTenantAuthToken({argv}).then();
        }
      )

      .command(
        "auth_curl <url_path> [post_body]",
        "Generates a tenant token for calling a baseTenantAuth endpoint.",
        (yargs) => {
          yargs
            .positional("url_path", {
              describe: "URL path",
              type: "string",
            })
            .positional("post_body", {
              describe: "either json body for POST, or '' for GET",
              type: "string",
            });
        },
        (argv) => {
          TenantCommands.CmdTenantAuthCurl({argv}).then();
        }
      )

      .command(
        "path_auth_curl <url_path> [post_body]",
        "Generates a tenant token for calling a tenantPathAuth authd endpoint.",
        (yargs) => {
          yargs
            .positional("url_path", {
              describe: "URL path",
              type: "string",
            })
            .positional("post_body", {
              describe: "either json body for POST, or '' for GET",
              type: "string",
            });
        },
        (argv) => {
          TenantCommands.CmdTenantPathAuthCurl({argv}).then();
        }
      )

      .command(
        "token_uri <command>",
        "Tenant token URI commands",
        (yargs) => {
          yargs
            .command(
              "set <request_type> <tenant> <contract_address> <new_token_uri> [options]",
              "Reset the token URI(s) for tenant NFT contract(s)",
              (yargs) => {
                yargs
                  .positional("request_type", {
                    describe: "Request Type (single, batch, all)",
                    type: "string",
                  })
                  .positional("tenant", {
                    describe: "Tenant ID",
                    type: "string",
                  })
                  .positional("contract_address", {
                    describe: "NFT contract address",
                    type: "string",
                  })
                  .positional("new_token_uri", {
                    describe: "New token URI; ignored if CSV batch, use -",
                    type: "string",
                  })
                  .option("token_id", {
                    describe:
                      "Optional Token ID; required for single request type",
                    type: "number",
                  })
                  .option("csv", {
                    describe: "CSV file for batch request type",
                    type: "string",
                  });
              },
              (argv) => {
                TenantCommands.CmdTenantSetTokenURI({ argv });
              }
            )

            .command(
              "update <tenant> <addr> <hash> [options]",
              "Reset the token URI(s) for tenant NFT contract(s)",
              (yargs) => {
                yargs
                  .positional("tenant", {
                    describe: "Tenant ID",
                    type: "string",
                  })
                  .positional("addr", {
                    describe: "NFT contract address",
                    type: "string",
                  })
                  .positional("hash", {
                    describe: "New NFT template object hash",
                    type: "string",
                  })
                  .option("dry_run", {
                    describe:
                      "Default 'true'",
                    type: "boolean",
                  });
              },
              (argv) => {
                TenantCommands.CmdTenantUpdateTokenURI({ argv });
              }
            );
        },
        ()=>{
          yargs.showHelp();
        }
      )

      .command(
        "balance_of <tenant> <owner>",
        "Shows the NFT balance of an owner within a tenant",
        (yargs) => {
          yargs
            .positional("tenant", {
              describe: "Tenant ID",
              type: "string",
            })
            .positional("owner", {
              describe: "Owner address (hex)",
              type: "string",
            })
            .option("csv", {
              describe: "File path to output csv",
              type: "string",
            });
        },
        (argv) => {
          TenantCommands.CmdTenantBalanceOf({ argv });
        }
      )

      .command(
        "fabric_balance_of <object> <owner> [options]",
        "Shows an owner's NFT balance in a tenant via the EluvioLive object tree",
        (yargs) => {
          yargs
            .positional("object", {
              describe: "Tenant-level EluvioLive object ID",
              type: "string",
            })
            .positional("owner", {
              describe: "Owner address (hex)",
              type: "string",
            })
            .option("max_results", {
              describe: "Show up to these many results (default 0 = unlimited)",
              type: "integer",
            });
        },
        (argv) => {
          TenantCommands.CmdFabricTenantBalanceOf({ argv });
        }
      )

      .command(
        "tickets_generate <tenant> <otp>",
        "Generate tickets for a given tenant OTP ID",
        (yargs) => {
          yargs
            .positional("tenant", {
              describe: "Tenant ID",
              type: "string",
            })
            .positional("otp", {
              describe: "OTP ID (including prefix)",
              type: "string",
            })
            .option("quantity", {
              describe: "Specify how many to generate (default 1)",
              type: "integer",
            })
            .option("emails", {
              describe: "File containing one email per line (or any user identifier). Generate codes bound to these identifiers",
              type: "string",
            })
            .option("embed_url_base", {
              describe: "Generate embed URLs for each ticket based on this template",
              type: "string",
            })
            .option("otp_class", {
              describe: "Use authority services (class 5) or contract (class 4) (default 5)",
              type: "integer",
            });
        },
        (argv) => {
          TenantCommands.CmdTenantTicketsGenerate({ argv });
        }
      )

      .command(
        "mint <tenant> <marketplace> <sku> <addr>",
        "Mint a marketplace NFT by SKU as tenant admin",
        (yargs) => {
          yargs
            .positional("tenant", {
              describe: "Tenant ID",
              type: "string",
            })
            .positional("marketplace", {
              describe: "Marketplace ID",
              type: "string",
            })
            .positional("sku", {
              describe: "NFT marketplace SKU",
              type: "string",
            })
            .positional("addr", {
              describe: "Target address to mint to",
              type: "string",
            })
            .option("quantity", {
              describe: "Specify how many to mint (default 1)",
              type: "integer",
            });
        },
        (argv) => {
          TenantCommands.CmdTenantMint({ argv });
        }
      )

      .command(
        "primary_sales <tenant> <marketplace>",
        "Show tenant primary sales history",
        (yargs) => {
          yargs
            .positional("tenant", {
              describe: "Tenant ID",
              type: "string",
            })
            .positional("marketplace", {
              describe: "Marketplace ID",
              type: "string",
            })
            .option("processor", {
              describe: "Payment processor: eg. stripe, coinbase, eluvio. Omit for all.",
              type: "string",
              default: "",
            })
            .option("csv", {
              describe: "File path to output csv",
              type: "string",
            })
            .option("offset", {
              describe: "Offset in months to dump data where 0 is the current month",
              type: "number",
              default: 1,
            })
            .option("admin", {
              describe: "Use the Admin API endpoint to resolve this query instead of the tenant API. " +
                "This is required for inactive marketplaces.",
              type: "boolean",
              default: false,
            });
        },
        (argv) => {
          TenantCommands.CmdTenantPrimarySales({ argv });
        }
      )

      .command(
        "secondary_sales <tenant>",
        "Show tenant secondary sales history",
        (yargs) => {
          yargs
            .positional("tenant", {
              describe: "Tenant ID",
              type: "string",
            })
            .option("processor", {
              describe: "Payment processor: eg. stripe, coinbase, eluvio. Omit for all.",
              type: "string",
              default: "",
            })
            .option("csv", {
              describe: "File path to output csv",
              type: "string",
            })
            .option("offset", {
              describe:
                "Offset in months to dump data where 0 is the current month",
              type: "number",
              default: 1,
            });
        },
        (argv) => {
          TenantCommands.CmdTenantSecondarySales({ argv });
        }
      )

      .command(
        "sales <tenant>",
        "Show tenant sales history",
        (yargs) => {
          yargs
            .positional("tenant", {
              describe: "Tenant ID",
              type: "string",
            })
            .option("processor", {
              describe: "Payment processor: eg. stripe, coinbase, eluvio. Omit for all.",
              type: "string",
              default: "",
            })
            .option("csv", {
              describe: "File path to output csv",
              type: "string",
            })
            .option("offset", {
              describe:
                "Offset in months to dump data where 0 is the current month",
              type: "number",
              default: 1,
            });
        },
        (argv) => {
          TenantCommands.CmdTenantUnifiedSales({ argv });
        }
      )

      .command(
        "sessions <tenant> <start_ts> <end_ts> <filename>",
        "Exports session data for a tenant to CSV from the analytics API",
        (yargs) => {
          yargs
            .usage(`Usage: elv-live tenant sessions <tenant> <start_ts> <end_ts> <filename>

Export CSV file of session data from the analytics API for a given tenant and time range
              `)
            .positional("tenant", {
              describe: "Tenant ID",
              type: "string",
            })
            .positional("start_ts", {
              describe: "start timestamp (seconds since epoch)",
              type: "int",
            })
            .positional("end_ts", {
              describe: "end timestamp (seconds since epoch)",
              type: "int",
            })
            .positional("filename", {
              describe: "filename to output csv",
              type: "string",
            });
        },
        (argv) => {
          TenantCommands.CmdTenantSessionsCsv({ argv });
        }
      )

      .command(
        "wallets <tenant> [options]",
        "Show the wallets associated with this tenant",
        (yargs) => {
          yargs
            .positional("tenant", {
              describe: "Tenant ID",
              type: "string",
            })
            .option("csv", {
              describe: "File path to output csv",
              type: "string",
            })
            .option("max_results", {
              describe: "Show up to these many results (default 0 = unlimited)",
              type: "integer",
            });
        },
        (argv) => {
          TenantCommands.CmdTenantWallets({ argv });
        }
      )

      .command(
        "nft <command>",
        "Tenant NFT related commands",
        (yargs) => {
          yargs
            .command(
              "remove <tenant> <addr>",
              "Removes the nft address from the tenant contract",
              (yargs) => {
                yargs
                  .positional("tenant", {
                    describe: "Tenant ID",
                    type: "string",
                  })
                  .positional("addr", {
                    describe: "NFT Address",
                    type: "string",
                  });
              },
              (argv) => {
                TenantCommands.CmdTenantNftRemove({ argv });
              }
            )

            .command(
              "list <tenant>",
              "List all tenant_nfts within a tenant contract",
              (yargs) => {
                yargs.positional("tenant", {
                  describe: "Tenant ID",
                  type: "string",
                });
              },
              (argv) => {
                TenantCommands.CmdTenantNftList({ argv });
              }
            )

            .command(
              "exists <tenant> <addr>",
              "Searches tenant_nfts list in tenant contract and returns true if exists",
              (yargs) => {
                yargs
                  .positional("tenant", {
                    describe: "Tenant ID",
                    type: "string",
                  })
                  .positional("addr", {
                    describe: "NFT Address",
                    type: "string",
                  });
              },
              (argv) => {
                TenantCommands.CmdTenantHasNft({ argv });
              }
            );
        },
        ()=>{
          yargs.showHelp();
        }
      )

      .command(
        "consumers <command>",
        "Tenant consumers management commands",
        (yargs) => {
          yargs
            .command(
              "add <group_id> [addrs..]",
              "Adds address(es) to the tenant's consumer group",
              (yargs) => {
                yargs
                  .positional("group_id", {
                    describe: "Tenant consumer group ID",
                    type: "string",
                  })
                  .option("addrs", {
                    describe:
                      "Addresses to add",
                    type: "string",
                  });
              },
              (argv) => {
                TenantCommands.CmdTenantAddConsumers({ argv });
              }
            )

            .command(
              "remove <group_id> <addr>",
              "Removes consumer from tenant consumer group",
              (yargs) => {
                yargs
                  .positional("group_id", {
                    describe: "Tenant consumer group ID",
                    type: "string",
                  })
                  .positional("addr", {
                    describe:
                      "Address the to add",
                    type: "string",
                  });
              },
              (argv) => {
                TenantCommands.CmdTenantRemoveConsumer({ argv });
              }
            )

            .command(
              "exists <group_id> <addr>",
              "Checks if addr is in the tenant consumer group",
              (yargs) => {
                yargs
                  .positional("group_id", {
                    describe: "Tenant consumer group ID",
                    type: "string",
                  })
                  .positional("addr", {
                    describe:
                      "Address the to add",
                    type: "string",
                  });
              },
              (argv) => {
                TenantCommands.CmdTenantHasConsumer({ argv });
              }
            );
        },
        () => {
          yargs.showHelp();
        }
      )

      .command(
        "provision <tenant> <slug> [options]",
        "Provision tenant.",
        (yargs) => {
          yargs.usage(`elv-live tenant provision <tenant> <slug> [options]
            
Provision a new tenancy with standard media libraries and content types.
Run as the tenant root key, as created by space_tenant_create. This is a multi-step operation,
and intermediate status is saved in the local directory in the file tenant_status.json using --status flag.

The operation can be resumed by specifying a status file, which indicates the operations
that have already been executed.

Funds transferred (default):
  * tenant ops created: 10 elv
  * content ops created: 10 elv
  * faucet funding address: 20 elv`);
          yargs.positional("tenant", {
            describe: "Tenant ID",
            type: "string",
          });
          yargs.positional("slug", {
            describe: "Tenant Slug",
            type: "string",
          });
          yargs.option("name", {
            describe: "Tenant name",
            type: "string"
          });
          yargs.option("status",{
            describe: "Path to the JSON File for existing tenant provision config",
            type: "string",
          });
          yargs.option("init_config",{
            describe: "Displays the initial provisioning config, which can be used to input existing objects",
            type: "boolean",
            default: false
          });
        },
        (argv) => {
          TenantCommands.CmdTenantProvision({ argv });
        }
      )

      .command(
        "add_consumer_group <tenant>",
        "Deploys a BaseTenantConsumerGroup and links it to the tenant's contract",
        (yargs) => {
          yargs.positional("tenant", {
            describe: "Tenant ID",
            type: "string",
          });
        },
        (argv) => {
          TenantCommands.CmdTenantAddConsumerGroup({ argv });
        }
      )

      .command(
        "create_wallet_account <email> <tenant> <property_slug>",
        "Create a wallet account and sends a tenant-branded email",
        (yargs) => {
          yargs
            .positional("email", {
              describe: "the email to create the account for, or @filename for list of emails",
              type: "string",
            })
            .positional("tenant", {
              describe: "the tenant in format iten...",
              type: "string",
            })
            .positional("property_slug", {
              describe: "the property slug. e.g., epcrtv",
              type: "string",
            })
            .option("only_create_account", {
              describe: "only create the account, don't send email",
              type: "boolean",
            })
            .option("only_send_email", {
              describe: "only send account-creation email, do not create the account",
              type: "boolean",
            })
            .option("schedule_at", {
              describe: "set future time for account-creation email (format is 2024-11-13T01:07:05Z)",
              type: "string",
            });
        },
        (argv) => {
          TenantCommands.CmdCreateWalletAccount({ argv });
        }
      )

      .command(
        "transfer_errors <tenant>",
        "Tenant transfer failures to track uncollected payments",
        (yargs) => {
          yargs
            .usage(`Usage: elv-live tenant transfer_errors <tenant>

Show tenant transfer failures. Used to identify payments collected on failed transfers.
`)
            .positional("tenant", {
              describe: "Tenant ID",
              type: "string",
            });
        },
        (argv) => {
          TenantCommands.CmdTenantTransferFailures({ argv });
        }
      )

      .command(
        "minter_config <command>",
        "Tenant minter_config related commands",
        (yargs) => {
          yargs
            .command(
              "get <tenant> [options]",
              "Gets the minter configuration for this tenant key",
              (yargs) => {
                yargs
                  .positional("tenant", {
                    describe: "Tenant ID",
                    type: "string",
                  });
              },
              (argv) => {
                TenantCommands.CmdTenantGetMinter({ argv });
              }
            )

            .command(
              "create <tenant> [options]",
              "Creates the minter configuration for this tenant key",
              (yargs) => {
                yargs
                  .positional("tenant", {
                    describe: "Tenant ID",
                    type: "string",
                  })
                  .option("funds", {
                    describe: "How much to fund the minter and proxy addresses. Default: 0 (do not fund)",
                    type: "integer",
                  })
                  .option("deploy", {
                    describe: "Deploy a new minter helper contract as the minter using the Authority Service. Default: false",
                    type: "boolean",
                  });
              },
              (argv) => {
                TenantCommands.CmdTenantCreateMinter({ argv });
              }
            )

            .command(
              "replace <tenant> [options]",
              "Creates the minter configuration for this tenant key",
              (yargs) => {
                yargs
                  .positional("tenant", {
                    describe: "Tenant ID",
                    type: "string",
                  })
                  .option("proxy_owner", {
                    describe: "Replace proxy owner ID (eg. ikms..). Note that the key must already be stored in the Authority Service to use this.",
                    type: "string",
                  })
                  .option("minter", {
                    describe: "Replace minter ID (eg. ikms..). Note that the key must already be stored in the Authority Service to use this.",
                    type: "string",
                  })
                  .option("mint_helper", {
                    describe: "Replace minter helper address (hex). The minter must be the owner of this contract.",
                    type: "string",
                  })
                  .option("proxy", {
                    describe: "Replace the transfer proxy address (hex). The proxy owner must be the owner of this contract.",
                    type: "string",
                  })
                  .option("mint_shuffle_key", {
                    describe: "Replace the mint shuffle key (ikms).  The secret must be already stored in the Authority Service",
                    type: "string",
                  })
                  .option("legacy_shuffle_seed", {
                    describe: "Replace the legacy shuffle seed (use '0' to disable).",
                    type: "string",
                  })
                  .option("purge", {
                    describe: "Purge will delete the keys first before replacing",
                    type: "bool",
                  });
              },
              (argv) => {
                TenantCommands.CmdTenantReplaceMinter({ argv });
              }
            )

            .command(
              "delete <tenant> [options]",
              "Delete the minter configuration for this tenant key",
              (yargs) => {
                yargs
                  .positional("tenant", {
                    describe: "Tenant ID",
                    type: "string",
                  })
                  .option("force", {
                    describe: "Attempt to delete all keys even on error",
                    type: "boolean",
                  });
              },
              (argv) => {
                TenantCommands.CmdTenantDeleteMinter({ argv });
              }
            );
        },
        ()=>{
          yargs.showHelp();
        }
      )

      .command(
        "deploy_helper_contracts <tenant> [options]",
        "Deploys minter helper and transfer proxy contracts via the authority service",
        (yargs) => {
          yargs
            .usage(`Usage: elv-live tenant deploy_helper_contracts <tenant> [options]
              
Deploys minter helper and transfer proxy contracts via the authority service as the minter. 
Specify option proxy or mint helper to only deploy that specific contract.              `)
            .positional("tenant", {
              describe: "Tenant ID",
              type: "string",
            })
            .option("mint_helper", {
              describe: "Deploy mint helper contract.",
              type: "bool",
            })
            .option("proxy", {
              describe: "Deploy Proxy contract.",
              type: "bool",
            });
        },
        (argv) => {
          TenantCommands.CmdTenantDeployHelpers({ argv });
        }
      )

      .command(
        "publish_data <tenant> <content_hash> [options]",
        "Submits a tenant Fabric object version for validation and updates the top-level link if valid",
        (yargs) => {
          yargs
            .usage(`Usage: elv-live tenant publish_data <tenant> <content_hash>

Submits the new version hash of the tenant Fabric object for validation. 
The top level Eluvio Live object link will be updated if there are no errors.
              `)
            .positional("tenant", {
              describe: "Tenant ID",
              type: "string",
            })
            .positional("content_hash", {
              describe: "Version hash of the new tenant media-wallet settings object; ignored if --media-wallet=false",
              type: "string",
            })
            .option("media_wallet", {
              describe: "indicates if this is a media-wallet-enabled tenant; default: true",
              type: "boolean",
              default: true,
            })
            .option("update_links", {
              describe: "Update links on your tenant Fabric object",
              type: "boolean",
            })
            .option("env", {
              describe: "Environment to use, 'staging' or 'production' (default: production)",
              type: "string",
            });
        },
        (argv) => {
          TenantCommands.CmdTenantPublishData({ argv });
        }
      )

      .command(
        "notif_send <user_addr> <tenant> <event>",
        "Sends a notification (using the notification service)",
        (yargs) => {
          yargs
            .positional("user_addr", {
              describe: "User address",
              type: "string",
            })
            .positional("tenant", {
              describe: "Tenant ID",
              type: "string",
            })
            .positional("event", {
              describe: "One of: TOKEN_UPDATED",
              type: "string",
            })
            .option("nft_addr", {
              describe: "NFT contract address (hex)",
              type: "string",
              default: ""
            })
            .option("token_id", {
              describe: "NFT token ID",
              type: "string",
              default: ""
            })
            .option("notif_url", {
              describe: "Notification service URL",
              type: "string",
              default: ""
            });
        },
        (argv) => {
          TenantCommands.CmdNotifSend({ argv });
        }
      )

      .command(
        "notif_send_token_update <nft_addr> <tenant>",
        "Sends a TOKEN_UPDATED notification to all owners of this NFT",
        (yargs) => {
          yargs
            .positional("nft_addr", {
              describe: "NFT contract address (hex)",
              type: "string",
            })
            .positional("tenant", {
              describe: "Tenant ID",
              type: "string",
            })
            .option("notif_url", {
              describe: "Notification service URL",
              type: "string",
              default: ""
            });
        },
        (argv) => {
          TenantCommands.CmdNotifSendTokenUpdate({ argv });
        }
      );
  }
};