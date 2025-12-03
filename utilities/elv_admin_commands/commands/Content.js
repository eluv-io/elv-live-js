const ContentCommand = require("../lib/Content");

module.exports = {
  command:"content <command>",
  describe:"Content management commands",
  handler: (yargs) => {
    yargs
      .command(
        "tenant_contract_id <command>",
        "Tenant contract id commands",
        (yargs) => {
          yargs
            .command(
              "set <object> <tenantContractId>",
              "set tenant contract id for the given object: wallet|content-type|tenant|group|library",
              (yargs) => {
                yargs
                  .positional("object", {
                    describe: "object Id | version hash | contract address",
                    type: "string",
                  })
                  .positional("tenantContractId", {
                    describe: "tenant contract id",
                    type: "string",
                  });
              },
              (argv) => {
                ContentCommand.CmdSetTenantContractId({ argv });
              }
            )

            .command(
              "get <object>",
              "Get tenant contract id and tenant id for the given object",
              (yargs) => {
                yargs
                  .usage(`Usage: elv-admin content tenant_contract_id get <object>
  
  Get tenant contract id and tenant id for the 
  given object: wallet|content-type|tenant|group|library`)
                  .positional("object", {
                    describe: "object Id | version hash | contract address",
                    type: "string",
                  });
              },
              (argv) => {
                ContentCommand.CmdGetTenantInfo({ argv });
              }
            );
        }

      )

      .command(
        "group_permission <command>",
        "Group permission related commands",
        (yargs) => {
          yargs
            .command(
              "set <object> <group> <permission> [options]",
              "Add a permission on the specified group for the specified object",
              (yargs) => {
                yargs.positional("object", {
                  describe: "object ID or address",
                  type: "string",
                });
                yargs.positional("group",{
                  describe: "group ID or address",
                  type: "string",
                });
                yargs.positional("permission",{
                  describe: "type of permission to add (see, access, manage)",
                  type: "string",
                });
              },
              (argv) => {
                ContentCommand.CmdSetObjectGroupPermission({ argv });
              }
            );
        }
      )

      .command(
        "batch_helper <command>",
        "Batch Helper commands",
        (yargs) => {
          return yargs
            .command(
              "delete_versions <target> <start_index> <end_index>",
              "Delete version hashes from object address provided",
              (yargs) => {
                yargs
                  .positional("target", {
                    describe: "Address/Id of the object",
                    type: "string",
                  })
                  .positional("start_index", {
                    describe: "Starting index for version hash deletion",
                    type: "number",
                  })
                  .positional("end_index", {
                    describe: "Ending index for version hash deletion",
                    type: "number",
                  });
              },
              (argv) => {
                ContentCommand.CmdDeleteVersionsBatch({ argv });
              }
            )
            .command(
              "delete_contents <content_objects>",
              "Delete content objects provided",
              (yargs) => {
                yargs.positional("content_objects", {
                  describe: "comma separated list of content objects",
                  type: "string",
                  coerce: (arg) => arg.split(",").map((s) => s.trim()),
                });
              },
              (argv) => {
                ContentCommand.CmdDeleteContentsBatch({ argv });
              }
            );
        }
      )

      .command(
        "cleanup <object> <object_type>",
        "Cleanup given object access to dead objects like libraries, groups",
        (yargs) => {
          yargs
            .positional("object", {
              describe: "object to be cleaned",
              type: "string",
            })
            .positional("object_type", {
              describe: "object type: library | content_object | group | content_type",
              type: "string",
            });
        },
        (argv) => {
          ContentCommand.CmdCleanupObject({ argv });
        }
      )

      .command(
        "list <object>",
        "List the content objects the given user or group has access to",
        (yargs) => {
          yargs
            .positional("object", {
              describe: "user or group id/address",
              type: "string",
            });
        },
        (argv) => {
          ContentCommand.CmdListObjects({ argv });
        }
      )

      .command(
        "meta <command>",
        "Meta related commands",
        (yargs) => {
          yargs
            .command(
              "batch <command>",
              "Meta batch related commands",
              (yargs) => {
                yargs
                  .command(
                    "get <csv_file> [options]",
                    "Get metadata fields for the list of content object IDs in the CSV file or library",
                    (yargs) => {
                      yargs
                        .positional("csv_file", {
                          describe: "CSV file",
                          type: "string",
                        })
                        .option("library", {
                          describe: "Libary ID",
                          type: "string",
                        })
                        .option("limit", {
                          describe: "Max number of objects",
                          type: "integer",
                        });
                    },
                    (argv) => {
                      ContentCommand.CmdFabricGetMetaBatch({ argv });
                    }
                  )

                  .command(
                    "set <csv_file>",
                    "Set metadata fields for the list of content object IDs in the CSV fle",
                    (yargs) => {
                      yargs
                        .positional("csv_file", {
                          describe: "CSV file",
                          type: "string",
                        })
                        .option("duplicate", {
                          describe:
                            "Clone the content objects instead of editing them directly.",
                          type: "boolean",
                        })
                        .option("dryrun", {
                          describe:
                            "Print resulting metadata but don't actually edit the objects.",
                          type: "boolean",
                        });
                    },
                    (argv) => {
                      ContentCommand.CmdFabricSetMetaBatch({ argv });
                    }
                  );
              }
            );
        }
      );
  }
};