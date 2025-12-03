const ContentPolicyCommands  = require("../lib/ContentPolicy");

module.exports = {
  command: "content_policy <command>",
  describe: "Object related commands",
  builder: (yargs) => {
    return yargs
      .command(
        "set <object> <policy_path> [data]",
        "Set the policy on an existing content object. This also sets the delegate on the object contract to itself.",
        (yargs) => {
          yargs
            .positional("object", {
              describe: "ID of the content object",
              type: "string",
            })
            .positional("policy_path", {
              describe: "Path to the content object policy file (eg. policy.yaml)",
              type: "string",
            })
            .option("data", {
              describe: "Metadata path within the policy object to link to",
              type: "string",
            });
        },
        (argv) => {
          ContentPolicyCommands.CmdContentSetPolicy({ argv });
        })

      .command(
        "set_delegate <object> <delegate>",
        "Set the policy delegate on the object contract",
        (yargs) => {
          yargs
            .positional("object", {
              describe: "ID of the content object",
              type: "string",
            })
            .positional("delegate", {
              describe: "ID of the content object policy delegate",
              type: "string",
            });
        },
        (argv) => {
          ContentPolicyCommands.CmdContentSetPolicyDelegate({ argv });
        }
      )

      .command(
        "get <object>",
        "Get the content object policy from the object metadata and the delegate from the object's contract meta",
        (yargs) => {
          yargs
            .positional("object", {
              describe: "ID of the content object",
              type: "string",
            });
        },
        (argv) => {
          ContentPolicyCommands.CmdContentGetPolicy({ argv });
        }
      )

      .command(
        "clear <object>",
        "Remove content object policy from the object metadata and the delegate from the object's contract meta",
        (yargs) => {
          yargs
            .positional("object", {
              describe: "ID of the content object",
              type: "string",
            });
        },
        (argv) => {
          ContentPolicyCommands.CmdContentClearPolicy({ argv });
        }
      )
      .demandCommand() // since it is sub-command
      .strict();
  },
};