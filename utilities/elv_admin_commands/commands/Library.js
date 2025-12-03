const LibraryCommand = require("../lib/Library");

module.exports = {
  command:"library <command>",
  describe:"Library related commands",
  handler:(yargs) => {
    yargs
      .command(
        "delete <library>",
        "delete library by the owner",
        (yargs) => {
          yargs
            .positional("library", {
              describe: "library id/address",
              type: "string",
            });
        },
        (argv) => {
          LibraryCommand.CmdDeleteLibrary({ argv });
        }
      );
  }
};