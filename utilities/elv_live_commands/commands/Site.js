const SiteCommand = require("../lib/Site");

module.exports = {
  command: "site <command>",
  describe: "Site related commands",
  builder: (yargs) => {
    yargs
      .command(
        "show <library> <object>",
        "Show info on this site/event",
        (yargs) => {
          yargs
            .positional("library", {
              describe: "Site library",
              type: "string",
            })
            .positional("object", {
              describe: "Site object ID",
              type: "string",
            });
        },
        (argv) => {
          SiteCommand.CmdSiteShow({ argv });
        }
      )

      .command(
        "set_drop <library> <object> <uuid> <start_date> [options]",
        "Set drop dates for a site/event",
        (yargs) => {
          yargs
            .positional("library", {
              describe: "Site library",
              type: "string",
            })
            .positional("object", {
              describe: "Site object ID",
              type: "string",
            })
            .positional("uuid", {
              describe: "Drop UUID",
              type: "string",
            })
            .positional("start_date", {
              describe: "Event start date (ISO format)",
              type: "string",
            })
            .option("end_date", {
              describe: "Event end date (ISO format)",
              type: "string",
            })
            .option("end_vote", {
              describe: "Event vote end date (ISO foramt)",
              type: "string",
            })
            .option("start_mint", {
              describe: "Event start mint date (ISO format)",
              type: "string",
            })
            .option("new_uuid", {
              describe: "Assign a new UUID",
              type: "boolean",
            })
            .option("update", {
              describe: "Tenant-level EluvioLive object to update",
              type: "string",
            });
        },
        (argv) => {
          SiteCommand.CmdSiteSetDrop({ argv });
        }
      )
      .demandCommand()
      .strict();
  },
};