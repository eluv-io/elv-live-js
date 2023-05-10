const { EluvioLiveStream } = require("../src/LiveStream.js");
const { Config } = require("../src/Config.js");
const { LiveRecording } = require("../src/LiveRecordingGenerator.js");

const yargs = require("yargs/yargs");
const { hideBin } = require("yargs/helpers");
const yaml = require("js-yaml");
const fs = require("fs");

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

    let status = await elvStream.Initialize({
      name: argv.stream,
      drm: argv.drm,
      format: argv.formats
    });
    console.log(yaml.dump(status));
  } catch (e) {
    console.error("ERROR:", e);
  }
};

const CmdStreamCreate = async ({ argv }) => {
  try {
    let elvStream = new EluvioLiveStream({
      configUrl: Config.networks[Config.net],
      debugLogging: argv.verbose
    });

    await elvStream.Init({
      privateKey: process.env.PRIVATE_KEY,
    });

    let status = await elvStream.StreamCreate({
      name: argv.stream,
      start: argv.start,
      show_curl: argv.show_curl
    });
    console.log(yaml.dump(status));
  } catch (e) {
    console.error("ERROR:", e);
  }
};

const CmdStreamTerminate = async ({ argv }) => {
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

const CreateLiveRecording = async ({ argv }) => {
  try {
    let { probeFile, nodeUrl, nodeId, calcAvSegDurations, overwriteOriginUrl} = argv;
    let rawdata = fs.readFileSync(probeFile);
    let probe = JSON.parse(rawdata);
    lc = new LiveRecording(probe, nodeId, nodeUrl, calcAvSegDurations, overwriteOriginUrl);
    console.log(lc.generateLiveConf());
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
    "Initialize media and DRM configuration for the stream object.",
    (yargs) => {
      yargs
        .positional("stream", {
          describe:
            "Stream name or QID (content ID)",
          type: "string",
        })
        .option("drm", {
          describe:
            "Specify if playout should be DRM protected (default: false)",
          type: "boolean",
        })
        .option("formats", {
          describe:
            "Specify the list of playout formats and DRM to support, comma-separated (hls-clear, hls-aes128, hls-sample-aes, hls-fairplay)",
          type: "string",
        })

    },
    (argv) => {
      CmdInit({ argv });
    }
  )
  .command(
    "create <stream>",
    "Create a new live stream for this stream object.",
    (yargs) => {
      yargs
        .positional("stream", {
          describe:
            "Stream name or QID (content ID)",
          type: "string",
        })
        .option("start", {
          describe:
            "Optionally start the the new stream (equivalent to calling 'start')",
          type: "boolean",
        })
        .option("show_curl", {
          describe:
            "Show 'curl' commands for inspecting metadata, LRO status, etc.",
          type: "boolean",
        })
    },
    (argv) => {
      CmdStreamCreate({ argv });
    }
  )
  .command(
    "terminate <stream>",
    "End the current live stream for this object.",
    (yargs) => {
      yargs
        .positional("stream", {
          describe:
            "Stream name or QID (content ID)",
          type: "string",
        })
    },
    (argv) => {
      CmdStreamTerminate({ argv });
    }
  )
  .command(
    "start <stream>",
    "Start or resume current live stream if not running.",
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
    "Status of the currently active live stream.",
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
    "Reset the currently active live stream.",
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
    "Pauses the currently active live stream.",
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
  .command(
    "liverecording [args]",
    "Generates live recording object metadata using a source probe",
    (yargs) => {
      yargs
        .option("probeFile", {
          description: "Path to file containing ffprobe data in json format",
          alias: "p",
          type: "string",
          demand: true,
        })
        .option("nodeUrl", {
          description: "Optional node, example: https://host-76-74-34-195.contentfabric.io",
          alias: "n",
          type: "string",
          demand: false,
        })
        .option("nodeId", {
          description: "Optional node id, example: inod2dPELDTh44bbBDU7rdH7zGTThRKd",
          alias: "i",
          type: "string",
          demand: false,
        })
        .option("calcAvSegDurations", {
          description: "Have the tool automatically calculate and use audio_seg_duration_ts and video_seg_duration_ts",
          alias: "c",
          type: "boolean",
          default: false,
        })
        .option("overwriteOriginUrl", {
          description: "Manually provide rtmp or udp origin url rather than use the url provided in the probe",
          alias: "d",
          type: "string",
          default: null,
        });
    },
    (argv) => {
      CreateLiveRecording({argv});
    }
  )

  .strict()
  .help()
  .usage("Eluvio Live Stream CLI\n\nUsage: elv-stream <command>")
  .scriptName("")
  .demandCommand(1).argv;
