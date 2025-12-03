const constants = require("../../../src/Constants");
const TenantCommand = require("../lib/Tenant");

module.exports = {
  command: "tenant <command>",
  describe: "Tenant related commands",
  handler: (yargs) => {
    yargs

      .command(
        "show <tenant> [options]",
        "Show info on this tenant",
        (yargs) => {
          yargs
            .positional("tenant", {
              describe: "Tenant ID",
              type: "string",
            })
            .option("as_url", {
              describe: "Alternate authority service URL (include '/as/' route if necessary)",
              type: "string",
            })
            .option("show_metadata", {
              describe: "Show the content fabric metadata associated to this tenant",
              type: "boolean",
            });
        },
        (argv) => {
          TenantCommand.CmdTenantShow({ argv });
        }
      )

      .command(
        "fix <tenant> [options]",
        "Fix tenant",
        (yargs) => {
          yargs
            .positional("tenant", {
              describe: "Tenant ID",
              type: "string",
            })
            .options("content_admin_address", {
              describe: "Address of the content admins groups",
              type: "string",
            });
        },
        (argv) => {
          TenantCommand.CmdTenantFix({ argv });
        }
      )

      .command(
        "fix_suite <tenant> <content_admin_address> [options]",
        "Fix old-gen tenant",
        (yargs) => {
          yargs
            .positional("tenant", {
              describe: "Tenant ID",
              type: "string",
            })
            .positional("content_admin_address", {
              describe: "Address of the content admins groups",
              type: "string",
            })
            .options("libraries", {
              describe: "List of libraries that belong to this tenant",
              type: "array",
            });
        },
        (argv) => {
          TenantCommand.CmdTenantFixSuite({ argv });
        }
      )

      .command(
        "content_admins <command>",
        "Content Admins group command",
        (yargs) => {
          yargs
            .command(
              "set <tenant> [options]",
              "Set new content admin",
              (yargs) => {
                yargs
                  .positional("tenant", {
                    describe: "Tenant ID",
                    type: "string",
                  })
                  .options("content_admin_address", {
                    describe: "Address of the content admins groups",
                    type: "string",
                  });
              },
              (argv) => {
                TenantCommand.CmdTenantSetContentAdmins({ argv });
              }
            )

            .command(
              "remove <tenant> <content_admin_address>",
              "Remove a content admin",
              (yargs) => {
                yargs
                  .positional("tenant", {
                    describe: "Tenant ID",
                    type: "string",
                  })
                  .positional("content_admin_address", {
                    describe: "Content Admin's address",
                    type: "string",
                  });
              },
              (argv) => {
                TenantCommand.CmdTenantRemoveContentAdmin({ argv });
              }
            );

        }
      )

      .command(
        "tenant_users <command>",
        "Tenant Users group related commands",
        (yargs) => {
          yargs
            .command(
              "set <tenant> [options]",
              "Set new tenant users",
              (yargs) => {
                yargs
                  .positional("tenant", {
                    describe: "Tenant ID",
                    type: "string",
                  })
                  .options("tenant_users_address", {
                    describe: "Address of the tenant users groups",
                    type: "string",
                  });
              },
              (argv) => {
                TenantCommand.CmdTenantSetTenantUsers({ argv });
              }
            )

            .command(
              "remove <tenant> <tenant_users_address>",
              "Remove a tenant users group",
              (yargs) => {
                yargs
                  .positional("tenant", {
                    describe: "Tenant ID",
                    type: "string",
                  })
                  .positional("tenant_users_address", {
                    describe: "Tenant users address",
                    type: "string",
                  });
              },
              (argv) => {
                TenantCommand.CmdTenantRemoveTenantUsers({ argv });
              }
            );
        }
      )



      .command(
        "faucet <command>",
        "Faucet related commands",
        (yargs) => {
          yargs
            .command(
              "create <tenant_id>",
              "Generate/get tenant funding address for given tenant and provide funds",
              (yargs) => {
                yargs
                  .positional("tenant_id", {
                    describe: "tenant id",
                    type: "string",
                  })
                  .option("funds", {
                    describe: "The amount to fund the faucet funding address, specified in Elv's",
                    type: "number",
                  })
                  .option("as_url", {
                    describe: "Alternate authority service URL (include '/as/' route if necessary)",
                    type: "string",
                  })
                  .option("no_funds", {
                    describe: "funds are not transferred to tenant funding address",
                    type: "boolean",
                  });
              },
              (argv) => {
                TenantCommand.CmdTenantCreateFaucetAndFund({ argv });
              }
            )

            .command(
              "delete <tenant_id>",
              "Delete faucet information for given tenant",
              (yargs) => {
                yargs
                  .positional("tenant_id", {
                    describe: "tenant id",
                    type: "string",
                  })
                  .option("as_url", {
                    describe: "Alternate authority service URL (include '/as/' route if necessary)",
                    type: "string",
                  });
              },
              (argv) => {
                TenantCommand.CmdTenantDeleteFaucet({ argv });
              }
            )

            .command(
              "fund_user <tenant_id> <user_address>",
              "Fund the user for given tenant_id",
              (yargs) => {
                yargs
                  .positional("tenant_id", {
                    describe: "tenant id",
                    type: "string",
                  })
                  .positional("user_address", {
                    describe: "user address",
                    type: "string",
                  })
                  .option("as_url", {
                    describe: "Alternate authority service URL (include '/as/' route if necessary)",
                    type: "string",
                  });
              },
              (argv) => {
                TenantCommand.CmdTenantFundUser({ argv });
              }
            );
        }
      )

      .command(
        "sharing_key <command>",
        "Sharing key related commands",
        (yargs) => {
          yargs
            .command(
              "create <tenant_id>",
              "Generate/get tenant sharing key for given tenant",
              (yargs) => {
                yargs
                  .positional("tenant_id", {
                    describe: "tenant id",
                    type: "string",
                  })
                  .option("as_url", {
                    describe: "Alternate authority service URL (include '/as/' route if necessary)",
                    type: "string",
                  });
              },
              (argv) => {
                TenantCommand.CmdTenantCreateSharingKey({ argv });
              }
            );
        }
      )

      .command(
        "status <command>",
        "Status related commands",
        (yargs) => {
          yargs
            .command(
              "set <tenant> <tenant_status>",
              "Set tenant status for given tenant",
              (yargs) => {
                yargs
                  .positional("tenant", {
                    describe: "Tenant ID",
                    type: "string",
                  })
                  .positional("tenant_status", {
                    describe: "Tenant Status",
                    choices: [constants.TENANT_STATE_ACTIVE, constants.TENANT_STATE_INACTIVE],
                    type: "string",
                  });
              },
              (argv) => {
                TenantCommand.CmdTenantSetStatus({argv});
              }
            );
        }
      )

      .command(
        "space <command>",
        "Space related commands",
        (yargs) => {
          yargs
            .command(
              "create <tenant_name>",
              `Creates a new tenant account including all supporting access groups and deployment of contracts. 
        PRIVATE_KEY must be set for the space owner.
        By default, 51 Elv is transferred to tenant root key`,
              (yargs) => {
                yargs
                  .positional("tenant_name", {
                    describe: "Tenant Name",
                    type: "string",
                  })
                  .option("funds", {
                    describe:
                      "funds transferred to tenant-admin key",
                    type: "integer",
                  });
              },
              (argv) => {
                TenantCommand.CmdSpaceTenantCreate({ argv });
              }
            )

            .command(
              "deploy <tenant_name> <owner_addr> <tenant_admin_addr> <content_admin_addr>",
              "Deploys a tenant contract",
              (yargs) => {
                yargs
                  .positional("tenant_name", {
                    describe: "Tenant Name",
                    type: "string",
                  })
                  .positional("owner_addr", {
                    describe: "Owner of the new contract",
                    type: "string",
                  })
                  .positional("tenant_admin_addr", {
                    describe: "Address of the tenant admins groups",
                    type: "string",
                  })
                  .positional("content_admin_addr", {
                    describe: "Address of the content admins groups",
                    type: "string",
                  })
                  .positional("tenant_users_addr", {
                    describe: "Address of the tenant users groups",
                    type: "string",
                  });

              },
              (argv) => {
                TenantCommand.CmdSpaceTenantDeploy({ argv });
              }
            )

            .command(
              "info <tenant>",
              "Short tenant information.",
              (yargs) => {
                yargs
                  .positional("tenant", {
                    describe: "Tenant ID (iten)",
                    type: "string",
                  });
              },
              (argv) => {
                TenantCommand.CmdSpaceTenantInfo({ argv });
              }
            )

            .command(
              "set_eluvio_live_id <tenant> <eluvio_live_id>",
              "Set the tenant-level Eluvio Live object ID in the tenant contract",
              (yargs) => {
                yargs
                  .positional("tenant", {
                    describe: "Tenant ID (iten)",
                    type: "string",
                  })
                  .positional("eluvio_live_id", {
                    describe: "Object ID of the tenant-leve Eluvio Live object (iq)",
                    type: "string",
                  });
              },
              (argv) => {
                TenantCommand.CmdSpaceTenantSetEluvioLiveId({ argv });
              }
            );
        }
      );
  }
};