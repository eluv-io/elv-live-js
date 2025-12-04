const IndexerCommand = require("../lib/Indexer");

module.exports = {
  command: "indexer <command>",
  describe: "Indexer related commands",
  builder: (yargs) => {
    yargs
      .command(
        "query",
        "Query the indexer",
        (argv) => {
          IndexerCommand.CmdQuery({ argv });
        }
      );
  }
};