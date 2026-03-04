const { CmdPropertySectionItemAdd, CmdPropertySectionItemBulkAdd, CmdPropertySectionItemDelete } = require("../lib/Property");

module.exports = {
  command: "property <command>",
  describe: "Media property related commands",
  builder: (yargs) => {
    yargs
      .command(
        "section <command>",
        "Property section related commands",
        (yargs) => {
          yargs
            .command(
              "item <command>",
              "Property section item related commands",
              (yargs) => {
                yargs
                  .command(
                    "add <property_object_id> <section_id> <media_item_id>",
                    "Add a catalog media item to a property page section",
                    (yargs) => {
                      yargs
                        .positional("property_object_id", {
                          describe: "Media Property Object ID",
                          type: "string",
                        })
                        .positional("section_id", {
                          describe: "Section ID (e.g. pscm...)",
                          type: "string",
                        })
                        .positional("media_item_id", {
                          describe: "Media Item ID (e.g. mvid...)",
                          type: "string",
                        });
                    },
                    (argv) => {
                      CmdPropertySectionItemAdd({argv});
                    }
                  )
                  .command(
                    "delete <property_object_id> <section_id> <section_item_id>",
                    "Delete an item from a property page section",
                    (yargs) => {
                      yargs
                        .positional("property_object_id", {
                          describe: "Media Property Object ID",
                          type: "string",
                        })
                        .positional("section_id", {
                          describe: "Section ID (e.g. pscm...)",
                          type: "string",
                        })
                        .positional("section_item_id", {
                          describe: "Section Item ID (e.g. psci...)",
                          type: "string",
                        });
                    },
                    (argv) => {
                      CmdPropertySectionItemDelete({argv});
                    }
                  )
                  .command(
                    "bulk-add <property_object_id> <section_id>",
                    "Add multiple media items to a property page section from a JSON or YAML file",
                    (yargs) => {
                      yargs
                        .positional("property_object_id", {
                          describe: "Media Property Object ID",
                          type: "string",
                        })
                        .positional("section_id", {
                          describe: "Section ID (e.g. pscm...)",
                          type: "string",
                        })
                        .option("file", {
                          alias: "f",
                          describe: "Path to JSON or YAML file containing an array of media item IDs",
                          type: "string",
                          demandOption: true
                        });
                    },
                    (argv) => {
                      CmdPropertySectionItemBulkAdd({argv});
                    }
                  );
              }
            );
        }
      );
  },
};
