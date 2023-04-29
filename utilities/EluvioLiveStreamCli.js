const { EluvioLiveStream } = require("../src/LiveStream.js");
const { Config } = require("../src/Config.js");

const yargs = require("yargs/yargs");
const { hideBin } = require("yargs/helpers");
const yaml = require("js-yaml");

// hack that quiets this msg:
//  node:87980) ExperimentalWarning: The Fetch API is an experimental feature. This feature could change at any time
//  (Use `node --trace-warnings ...` to show where the warning was created)
const originalEmit = process.emit;
process.emit = function (name, data, ...args) {
  if(name === `warning` && typeof data === `object` && data.name === `ExperimentalWarning`) {
    return false;
  }
  return originalEmit.apply(process, arguments);
};

const CmdInit = async ({ argv }) => {
  try {
    let elvStream = new EluvioLiveStream({
      configUrl: Config.networks[Config.net],
      debugLogging: argv.verbose
    });

    await elvStream.Init({
      privateKey: process.env.PRIVATE_KEY,
    });

    let status = await elvStream.SetOfferingAndDRM({name: argv.stream});
    console.log(yaml.dump(status));
  } catch (e) {
    console.error("ERROR:", e);
  }
};

const CmdSessionStart = async ({ argv }) => {
  try {
    let elvStream = new EluvioLiveStream({
      configUrl: Config.networks[Config.net],
      debugLogging: argv.verbose
    });

    await elvStream.Init({
      privateKey: process.env.PRIVATE_KEY,
    });

    let status = await elvStream.StartSession({name: argv.stream});
    console.log(yaml.dump(status));
  } catch (e) {
    console.error("ERROR:", e);
  }
};

const CmdSessionStop = async ({ argv }) => {
  try {
    let elvStream = new EluvioLiveStream({
      configUrl: Config.networks[Config.net],
      debugLogging: argv.verbose
    });

    await elvStream.Init({
      privateKey: process.env.PRIVATE_KEY,
    });

    let status = await elvStream.StopSession({name: argv.stream});
    console.log(yaml.dump(status));
  } catch (e) {
    console.error("ERROR:", e);
  }
};

const CmdStreamStatus = async ({ argv }) => {
  try {
    let elvStream = new EluvioLiveStream({
      configUrl: Config.networks[Config.net],
      debugLogging: argv.verbose
    });

    await elvStream.Init({
      privateKey: process.env.PRIVATE_KEY,
    });

    let status = await elvStream.Status({name: argv.stream, stopLro: false});
    console.log(yaml.dump(status));
  } catch (e) {
    console.error("ERROR:", e);
  }
};

// Executes stream start, stop or reset
const CmdStreamOp = async ({ argv, op }) => {
  try {
    let elvStream = new EluvioLiveStream({
      configUrl: Config.networks[Config.net],
      debugLogging: argv.verbose
    });

    await elvStream.Init({
      privateKey: process.env.PRIVATE_KEY,
    });

    let status = await elvStream.StartOrStopOrReset({name: argv.stream, op, stopLro: false});
    console.log(yaml.dump(status));
  } catch (e) {
    console.error("ERROR:", e);
  }
};

yargs(hideBin(process.argv))
  .option("verbose", {
    describe: "Verbose mode",
    type: "boolean",
    alias: "v"
  })
  .command(
    "init <stream>",
    "Initialize media and DRM configuration for the object.",
    (yargs) => {
      yargs
        .positional("stream", {
          describe:
            "Stream name or QID (content ID)",
          type: "string",
        })
    },
    (argv) => {
      CmdInit({ argv });
    }
  )
  .command(
    "session_start <stream>",
    "Create a new live stream session.",
    (yargs) => {
      yargs
        .positional("stream", {
          describe:
            "Stream name or QID (content ID)",
          type: "string",
        })
    },
    (argv) => {
      CmdSessionStart({ argv });
    }
  )
  .command(
    "session_stop <stream>",
    "End the current live stream session.",
    (yargs) => {
      yargs
        .positional("stream", {
          describe:
            "Stream name or QID (content ID)",
          type: "string",
        })
    },
    (argv) => {
      CmdSessionStop({ argv });
    }
  )
  .command(
    "start <stream>",
    "Start or resume current live stream session if not running.",
    (yargs) => {
      yargs
        .positional("stream", {
          describe:
            "Stream name or QID (content ID)",
          type: "string",
        })
    },
    (argv) => {
      CmdStreamOp({ argv, op: "start" });
    }
  )
  .command(
    "status <stream>",
    "Status of the currently active live stream session",
    (yargs) => {
      yargs
        .positional("stream", {
          describe:
            "Stream name or QID (content ID)",
          type: "string",
        })
    },
    (argv) => {
      CmdStreamStatus({ argv });
    }
  )
  .command(
    "reset <stream>",
    "Reset the currently active live stream session",
    (yargs) => {
      yargs
        .positional("stream", {
          describe:
            "Stream name or QID (content ID)",
          type: "string",
        })
    },
    (argv) => {
      CmdStreamOp({ argv, op: "reset" });
    }
  )
  .command(
    "stop <stream>",
    "Pauses the currently active live stream session",
    (yargs) => {
      yargs
        .positional("stream", {
          describe:
            "Stream name or QID (content ID)",
          type: "string",
        })
    },
    (argv) => {
      CmdStreamOp({ argv, op: "stop" });
    }
  )

  .strict()
  .help()
  .usage("Eluvio Live Stream CLI\n\nUsage: elv-stream <command>")
  .scriptName("")
  .demandCommand(1).argv;
