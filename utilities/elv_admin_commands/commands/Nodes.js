const NodesCommand = require("../lib/Nodes");

module.exports = {
  command:"nodes",
  describe:"Retrieve all nodes in the content space, with optional filters",
  builder: (yargs) => {
    yargs
      .option("endpoint", {
        describe: "Match nodes with endpoints that contain this string.",
        type: "string",
      })
      .option("node_id", {
        describe: "Only match the node with this node ID",
        type: "string",
      });
  },
  handler: (argv) => {
    NodesCommand.CmdNodes({ argv });
  }
};