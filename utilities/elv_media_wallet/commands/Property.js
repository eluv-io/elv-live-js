const PropertyCommand = require("../lib/Property");

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
                      PropertyCommand.CmdPropertySectionItemAdd({argv});
                    }
                  );
              }
            );
        }
      );
  },
};
