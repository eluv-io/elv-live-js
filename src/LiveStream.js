/*
 * Content Fabric live stream management
 */

const { ElvClient } = require("@eluvio/elv-client-js");
const Utils = require("@eluvio/elv-client-js/src/Utils.js");
const { execSync } = require("child_process");
const { Config } = require("./Config.js");

const fs = require("fs");
const got = require("got");
const https = require("https");
const yaml = require("js-yaml");

const MakeTxLessToken = async({client, libraryId, objectId, versionHash}) => {
  const tok = await client.authClient.AuthorizationToken({libraryId, objectId,
						    versionHash, channelAuth: false, noCache: true,
						    noAuth: true});
  return tok;
};

/**
 * Provides live stream management operations on the Eluvio Content Fabric:
 * creating and configuring streams, controlling recording sessions, copying
 * live recordings to VoD objects, and measuring ingest/egress latency.
 */
class EluvioLiveStream {

  /**
   * Instantiate the EluvioLiveStream
   *
   * @namedParams
   * @param {string} url - Optional node endpoint URL (overwrites config URL)
   * @param {boolean} debugLogging - Optional debug logging flag
   * @param {string} token - Optional static authorization token
   * @return {EluvioLiveStream} - New EluvioLiveStream object connected to the specified content fabric
   */
  constructor({ url, debugLogging = false, token }) {

    if (url) {
      this.configUrl = url+"/config?self&qspace="+Config.net;
    } else {
      this.configUrl = Config.networks[Config.net];
    }
    this.debug = debugLogging;
    this.staticToken = token;
  }

  /**
   * Initialize the EluvioLiveStream SDK, connecting to the Content Fabric
   * using the PRIVATE_KEY environment variable.
   */
  async Init() {
    this.client = await ElvClient.FromConfigurationUrl({
      configUrl: this.configUrl,
    });

    let wallet = this.client.GenerateWallet();
    let signer = wallet.AddAccount({
      privateKey: process.env.PRIVATE_KEY,
    });
    this.client.SetSigner({ signer });
    this.client.ToggleLogging(this.debug);

    if (this.staticToken) {
      console.log("Use static token");
      this.client.SetStaticToken({token: this.staticToken});
    }
  }

  /**
   * Prepare a stream for status retrieval by setting a transaction-less static token,
   * reducing auth overhead when polling multiple streams.
   *
   * @namedParams
   * @param {string} name - The object ID of the live stream
   */
  async StatusPrep({name}) {

    const objectId = name;
    const libraryId = await this.client.ContentObjectLibraryId({objectId});

    try {

      // Set static token - avoid individual auth for separate channels/streams
      let token = await MakeTxLessToken({client: this.client, libraryId});
      this.client.SetStaticToken({token});

    } catch (error) {
      console.log("StatusPrep failed: ", error);
      return null;
    }
  }

  /**
   * Retrieve the status of the current live stream session.
   *
   * Stream states:
   * - `unconfigured`  — no live_recording_config
   * - `uninitialized` — no live_recording config generated
   * - `inactive`      — live_recording config initialized but no edge write token
   * - `stopped`       — edge write token exists but recording not started
   * - `starting`      — LRO running but no source data yet
   * - `running`       — stream is running and producing output
   * - `stalled`       — LRO running but no source data (not producing output)
   *
   * @namedParams
   * @param {string} name - The object ID of the live stream
   * @param {boolean} [stopLro=false] - Stop the LRO if the stream is stalled
   * @param {boolean} [showParams=false] - Include recording parameters in the response
   * @param {boolean} [saveMeta=true] - Write edge metadata to a local JSON file
   * @returns {Promise<Object>} Stream status object
   */
  async Status({ name, stopLro = false, showParams = false, saveMeta = true }) {
    let status = await this.client.StreamStatus({name, stopLro, showParams});

    if (saveMeta) {
      let edgeMeta = await this.client.ContentObjectMetadata({
        libraryId: status.libraryId,
        objectId: status.objectId,
        writeToken: status.edgeWriteToken
      });
      fs.writeFileSync("meta-" + status.name + ".json", JSON.stringify(edgeMeta, null, 2));
    }

    return status;

  }

  /**
   * Create a live stream object on the Content Fabric.
   * The recording configuration may be either a named profile or a path to a
   * local YAML/JSON file.
   *
   * @namedParams
   * @param {string} [objectId] - Existing content object ID to use as the stream object
   * @param {string} [libraryId] - Library in which to create a new stream object
   * @param {string} url - Ingest URL for the live source
   * @param {boolean} [finalize] - Finalize the object after creation
   * @param {string} liveRecordingConfigArg - Named profile or path to a YAML/JSON config file
   * @param {string} [name] - Display name for the stream object
   * @param {string} [permission] - Permission level (e.g. "editable")
   * @param {boolean} [linkToSite] - Link the stream to its site object
   * @returns {Promise<Object>} Result from StreamCreate
   */
  async streamCreate({ objectId, libraryId, url, finalize, liveRecordingConfigArg, name, permission, linkToSite }) {
    let liveRecordingConfig;
    if (fs.existsSync(liveRecordingConfigArg)) {
      // Although its yaml.load it still works with JSON sources!
      liveRecordingConfig = yaml.load(fs.readFileSync(liveRecordingConfigArg, "utf8"));
    } else {
      liveRecordingConfig = await this.client.StreamConfigProfile({profileName: liveRecordingConfigArg});
    }

    const options = {};
    if (name !== undefined) options.name = name;
    if (permission !== undefined) options.permission = permission;
    if (linkToSite !== undefined) options.linkToSite = linkToSite;

    return await this.client.StreamCreate({
      objectId,
      libraryId,
      url,
      finalize,
      options,
      liveRecordingConfig
    });
  }

  /**
   * Create multiple live stream objects in bulk from a YAML or JSON batch file.
   * The file must define `library`, `streams[]`, and either `profile_name` or
   * `profile_data` at the top level.
   *
   * @param {string} batch_file - Path to the YAML/JSON batch configuration file
   * @returns {Promise<boolean>} true on success
   */
  async CreateStreamObjectBatch(batch_file){
    let bulkFileContents = {};
    try {
      const fileContents = fs.readFileSync(batch_file, "utf8");
      // Although its yaml.load it still works with JSON sources!
      bulkFileContents = yaml.load(fileContents);
    } catch (e) {
      console.error(`Error: Could not read or parse file. ${e.message}`);
      process.exit(1);
    }

    // check if we will use a saved profile or one defined in the file
    let liveRecordingConfig;
    if (bulkFileContents.profile_name !== undefined) {
      liveRecordingConfig = await this.client.StreamConfigProfile({profileName: bulkFileContents.profile_name});
    } else if (bulkFileContents.profile_data !== undefined) {
      liveRecordingConfig = bulkFileContents.profile_data;
    } else {
      console.log("ERROR: profile_name or profile_data not defined in batch file");
      process.exit(1);
    }

    // iterate through all the streams and create them
    const libraryId = bulkFileContents.library;
    const streams = bulkFileContents.streams;
    for (const stream of streams) {
      try {
        console.log(`CREATING ${stream.name}`);
        const url = stream.url;
        const options = {
          name: stream.name,
          displayTitle: stream.name,
          linkToSite: stream.link_to_site ?? true,
          permission: stream.permission ?? "editable"
        };
        await this.client.StreamCreate({
          libraryId,
          url,
          options,
          liveRecordingConfig
        });
      } catch (e) {
        console.error(`Error: Could not create stream: ${e.message}`);
        process.exit(1);
      }
    }
    return true;
  }

  /**
   * Start a new recording session by creating a new edge write token.
   * Optionally prints the curl commands needed to manually control the stream.
   *
   * @namedParams
   * @param {string} name - The object ID of the live stream
   * @param {boolean} [start=false] - Immediately start the LRO after creating the token
   * @param {boolean} [show_curl=false] - Print curl commands for manual stream control
   * @returns {Promise<Object>} Recording session status
   */
  async StreamStartRecording ({name, start = false, show_curl = false}) {
    const status = await this.client.StreamStartRecording({name, start});

    if (show_curl) {
      const objectId = status.object_id;
      const libraryId = status.library_id;
      const edgeToken = status.edge_write_token;
      const objectHash = status.hash;
      const fabURI = status.fabric_api;

      const response = await this.client.authClient.AuthorizationToken({
        libraryId: libraryId,
        objectId: objectId,
        versionHash: "",
        channelAuth: false,
        noCache: true,
        update: true,
      });

      const curlCmd = "curl -s -H \"$AUTH_HEADER\" ";
      const fabLibHashURI = fabURI + "/qlibs/" + libraryId + "/q/" + objectHash;
      const fabLibTokenURI = fabURI + "/qlibs/" + libraryId + "/q/" + edgeToken;

      console.log("\nSet Authorization header:\nexport AUTH_HEADER=\"" +
        "Authorization: Bearer " + response + "\"");

      console.log("\nInspect metadata:\n" +
        curlCmd + fabLibHashURI + "/meta | jq");

      console.log("\nInspect edge metadata:\n" +
        curlCmd + fabLibTokenURI + "/meta | jq");

      console.log("\nStart recording (returns HANDLE):\n" +
        curlCmd + fabLibTokenURI + "/call/live/start | jq");

      console.log("\nStop recording (use HANDLE from start):\n" +
        curlCmd + fabLibTokenURI + "/call/live/stop/HANDLE");

      console.log("\nPlayout options:\n" +
        curlCmd + fabLibHashURI + "/rep/live/default/options.json | jq");

      console.log("\nHLS playlist:\n" +
        fabLibHashURI + "/rep/live/default/hls-sample-aes/playlist.m3u8?authorization=" + response);
    }

    return status;
  }


  /**
   * Start, stop, or reset a stream within the current recording session
   * (current edge write token).
   *
   * Operations:
   * - `start` — begin the LRO
   * - `reset` — stop the current LRO and start a new one; creates a new recording
   *             period inside the existing edge write token (does NOT create a new token)
   * - `stop`  — stop the LRO
   *
   * @namedParams
   * @param {string} name - The object ID of the live stream
   * @param {string} op - Operation: "start" | "reset" | "stop"
   * @returns {Promise<Object>} Stream status
   */
  async StartOrStopOrReset({name, op}) {
    return this.client.StreamStartOrStopOrReset({name, op});
  }

  /**
   * Stop the live stream session and close the edge write token.
   *
   * @namedParams
   * @param {string} name - The object ID of the live stream
   * @returns {Promise<Object>} Result from StreamStopRecording
   */
  async StopSession({name}) {
    return this.client.StreamStopRecording({name});
  }

  /**
   * Initialize a live stream, generating the live_recording configuration from
   * the user-supplied live_recording_config metadata.
   *
   * @namedParams
   * @param {string} name - The object ID of the live stream
   * @param {boolean} [drm=false] - Enable DRM for the stream output
   * @param {string} [format] - Output format override
   * @returns {Promise<Object>} Initialization result
   */
  async Initialize({name, drm=false, format}) {
    return this.client.StreamInitialize({name, drm, format});
  }

  /**
   * Add or remove a content insertion entry in the live stream.
   *
   * @namedParams
   * @param {string} name - The object ID of the live stream
   * @param {number} insertionTime - Insertion time in seconds (float)
   * @param {boolean} sinceStart - true if time is relative to stream start, false if Unix epoch seconds
   * @param {number} [duration=20.0] - Insertion duration in seconds (float)
   * @param {string} targetHash - Content hash of the playable insertion content
   * @param {boolean} [remove=false] - Remove the insertion at the given time instead of adding it
   * @returns {Promise<Object>} Result from StreamInsertion
   */
  async Insertion({name, insertionTime, sinceStart, duration, targetHash, remove}) {
    return this.client.StreamInsertion({name, insertionTime, sinceStart, duration, targetHash, remove});
  }

  /**
   * Download the raw parts of a live stream recording period and reassemble
   * them into an MP4 (or MPEG-TS) file using ffmpeg.
   *
   * @namedParams
   * @param {string} name - The object ID of the live stream
   * @param {number} [period] - Recording period index; defaults to the latest period
   * @param {number} [offset=0] - Skip parts before this many seconds from the start
   * @param {boolean} [makeFrame=false] - Extract a JPEG thumbnail from each video part
   * @param {boolean} [mpegtsCopy=false] - Output as a concatenated MPEG-TS file instead of MP4
   * @returns {Promise<Object>} Status object with `file` path and `state`
   */
  async StreamDownload({name, period, offset, makeFrame, mpegtsCopy}) {

    let objectId = name;
    let status = {name};

    try {

      const libraryId = await this.client.ContentObjectLibraryId({objectId: objectId});
      status.library_id = libraryId;
      status.object_id = objectId;

      let mainMeta = await this.client.ContentObjectMetadata({
        libraryId: libraryId,
        objectId: objectId
      });

      let fabURI = mainMeta.live_recording.fabric_config.ingress_node_api;
      if (fabURI == undefined) {
        console.log("bad fabric config - missing ingress node API");
      }

      // Support both hostname and URL ingress_node_api
      if (!fabURI.startsWith("http")) {
        // Assume https
        fabURI = "https://" + fabURI;
      }
      this.client.SetNodes({fabricURIs: [fabURI]});

      let edgeWriteToken = mainMeta.live_recording.fabric_config.edge_write_token;
      let edgeMeta = await this.client.ContentObjectMetadata({
        libraryId: libraryId,
        objectId: objectId,
        writeToken: edgeWriteToken
      });

      // If a stream has never been started return state 'inactive'
      if (edgeMeta.live_recording == undefined ||
        edgeMeta.live_recording.recordings == undefined ||
        edgeMeta.live_recording.recordings.recording_sequence == undefined) {
        status.state = "no recordings";
        return status;
      }

      let recordings = edgeMeta.live_recording.recordings;
      status.recording_period_sequence = recordings.recording_sequence;

      let sequence = recordings.recording_sequence;
      if (period == undefined || period < 0 || period > sequence - 1) {
        period = sequence - 1;
      }

      console.log("Downloading stream", name, " period", period, " latest", sequence - 1);

      let recording = recordings.live_offering[period];
      if (recording == undefined || recording.sources == undefined) {
        console.log("ERROR - recording period not found: ", period);
      }

      let streams = Object.keys(recording.sources);
      console.log("Streams", streams);

      let dpath = "DOWNLOAD/" + edgeWriteToken + "." + period;
      !fs.existsSync(dpath) && fs.mkdirSync(dpath, {recursive: true});

      // Reorder streams list so it starts with video
      let mts = [];
      if (mpegtsCopy) {
        mts.push("mpegts");
      } else {
        mts.push("video");
        for (let mi = 0; mi < streams.length; mi ++) {
          if (streams[mi].includes("video"))
            continue;
          mts.push(streams[mi]);
        }
      }

      let inputs = "";
      let inputs_map = "";
      let makeFrameCmds = [];

      for (let mi = 0; mi < mts.length; mi ++) {
        let mt = mts[mi];

        if (mt.includes("video")) {
          inputs = inputs + " -i " + dpath + "/" + mt + ".mp4";
          inputs_map = inputs_map + ` -map ${mi}:v:0`;
        } else if (mt.includes("audio")) {
          inputs = inputs + " -i " + dpath + "/" + mt + ".mp4";
          inputs_map = inputs_map + ` -map ${mi}:a:0`;
        }

        console.log("Downloading ", mt);
        let mtpath = dpath + "/" + mt;
        let partsfile = dpath + "/parts_" + mt + ".txt";
        !fs.existsSync(mtpath) && fs.mkdirSync(mtpath);

        var sources = recording.sources[mt].parts;
        for (let i = 0; i < sources.length - 1; i++) {

          if (i * 30 <= offset) {
            console.log(sources[i].hash, "skipped");
            continue;
          }

          console.log(sources[i].hash);

          let partHash = sources[i].hash;
          let buf = await this.client.DownloadPart({
            libraryId,
            objectId: objectId,
            partHash,
            format: "buffer",
            chunked: false,
            callback: ({bytesFinished, bytesTotal}) => {
              console.log("  progress: ", bytesFinished + "/" + bytesTotal);
            }
          });

          let partfile = mtpath + "/" + partHash + ".mp4";
          fs.appendFile(partfile, buf, (err) => {
            if (err)
              console.log(err);
          });
          fs.appendFile(partsfile, "file '" + mt + "/" + partHash + ".mp4'\n", (err) => {
            if (err)
              console.log(err);
          });

          if (makeFrame && mt.includes("video")) {
            const makeFrameCmd = "ffmpeg -i " + partfile+ " -vframes 1 -update 1 -q:v 1 " + mtpath + "/" + partHash + ".jpg";
            makeFrameCmds.push(makeFrameCmd);
          }
        }

        // Make frames from parts
        if (makeFrame && mt.includes("video")) {
          for (let i = 0; i < makeFrameCmds.length; i++) {
            console.log("Frame cmd", makeFrameCmds[i]);
            execSync(makeFrameCmds[i]);
          }
        }

        if (mpegtsCopy) {
          // Concatenate parts into one ts file
          status.file = dpath + "/" + mt + ".ts";
          let cmd = "ffmpeg -f concat -safe 0 -i " + partsfile + " -map 0 -c copy " + status.file;
          console.log("Running", cmd);
          execSync(cmd);
          status.state = "completed";
          return status;
        }

        // Concatenate parts into one mp4
        let cmd = "ffmpeg -f concat -safe 0 -i " + partsfile + " -c copy " + dpath + "/" + mt + ".mp4";
        console.log("Running", cmd);
        execSync(cmd);
      }

      // Create final mp4 file
      let f = dpath + "/download.mp4";
      let cmd = "ffmpeg  " + inputs + " " + inputs_map + "  -c copy  -shortest " + f;
      console.log("Running", cmd);
      execSync(cmd);

      status.file = f;
      status.state = "completed";
    } catch (e) {
      console.log("Download failed", e);
      throw e;
    }

    return status;
  }


  /**
   * Copy a portion of a live stream recording into a standard VoD object using
   * the zero-copy Content Fabric API.  If no target object is supplied one is
   * created automatically in the specified library.
   *
   * Limitations:
   * - the target object must have content encryption keys (CAPS) set
   * - audio and video sync requires the recording period to start from the
   *   very beginning of the desired segment; for event streams ensure the TTL
   *   is long enough; for 24/7 streams reset the stream first
   * - `startTime` / `endTime` trimming requires the fabric node to support it
   *
   * @namedParams
   * @param {string} stream - Object ID of the source live stream
   * @param {string} [object] - Object ID of the existing target VoD object; a new object is created if omitted
   * @param {string} [library] - Library ID for the new VoD object (required when `object` is omitted)
   * @param {string} [name] - Name for the new VoD object
   * @param {string} [title] - Title for the new VoD object's asset metadata
   * @param {boolean} [drm=true] - Enable DRM on the VoD mezzanine
   * @param {boolean} [includeTags=false] - Copy video tags from the live stream
   * @param {boolean} [defaultDash=false] - Add a `default_dash` (Chromecast-friendly) offering
   * @param {boolean} [keepExistingStreams=false] - Preserve existing stream info (e.g. thumbnails) in the target
   * @param {string} [eventId] - SCTE-35 event ID used to look up start/end times automatically
   * @param {string} [startTime] - ISO-8601 start time for the clip (e.g. "2023-10-03T02:09:02.00Z")
   * @param {string} [endTime] - ISO-8601 end time for the clip
   * @param {number} [recordingPeriod] - Recording period index to copy (-1 for latest)
   * @param {string[]} [streams] - Stream tracks to include (e.g. ["video", "audio"])
   * @returns {Promise<Object>} Status object including `target_hash` of the finalized VoD object
   */

  /*
    Example fabric API flow:

      https://host-76-74-34-194.contentfabric.io/qlibs/ilib24CtWSJeVt9DiAzym8jB6THE9e7H/q/$QWT/call/media/live_to_vod/init -d @r1 -H "Authorization: Bearer $TOK"

      {
        "live_qhash": "hq__5Zk1jSN8vNLUAXjQwMJV8F8J8ESXNvmVKkhaXySmGc1BXnJPG2FvvaXee4CXqvFHuGuU3fqLJc",
        "start_time": "",
        "end_time": "",
        "recording_period": -1,
        "streams": ["video", "audio"],
        "variant_key": "default"
      }

      https://host-76-74-34-194.contentfabric.io/qlibs/ilib24CtWSJeVt9DiAzym8jB6THE9e7H/q/$QWT/call/media/abr_mezzanine/init  -H "Authorization: Bearer $TOK" -d @r2

      {

        "abr_profile": { ...  },
        "offering_key": "default",
        "prod_master_hash": "tqw__HSQHBt7vYxWfCMPH5yXwKTfhdPcQ4Lcs9WUMUbTtnMbTZPTLo4BfJWPMGpoy1Dpv1wWQVtUtAtAr429TnVs",
        "variant_key": "default",
        "keep_other_streams": false
      }

      https://host-76-74-34-194.contentfabric.io/qlibs/ilib24CtWSJeVt9DiAzym8jB6THE9e7H/q/$QWT/call/media/live_to_vod/copy -d '{"variant_key":"","offering_key":""}' -H "Authorization: Bearer $TOK"


      https://host-76-74-34-194.contentfabric.io/qlibs/ilib24CtWSJeVt9DiAzym8jB6THE9e7H/q/$QWT/call/media/abr_mezzanine/offerings/default/finalize -d '{}' -H "Authorization: Bearer $TOK"

  */
  async StreamCopyToVod({stream, object, library, name, title, drm = true, includeTags = false, defaultDash = false, keepExistingStreams = false, eventId, startTime, endTime, recordingPeriod, streams}) {

    const objectId = stream;
    let abrProfileLiveToVod;

    if (drm) {
      console.log("DRM");
      abrProfileLiveToVod = require("./abr_profile_live_to_vod_drm.json");
    } else {
      console.log("NO DRM");
      abrProfileLiveToVod = require("./abr_profile_live_to_vod.json");
    }

    let status = await this.Status({name: stream});
    let libraryId = status.libraryId;

    let targetLibraryId;
    let targetWriteToken;

    // If a target object is not specified, create it here
    if (object == undefined) {
      if (library == undefined) {
        throw "one of object or library must be specified";
      }
      const typeId = await this.FindContentType({label: "title"});
      if (typeId == undefined) {
        throw "content type not found: title";
      }
      console.log("Creating new object in library " + library);

      if (!name) {
        name = "VOD - Live Stream " + stream + " - " + new Date().toISOString();
      }
      if (!title) {
        title = "Live Stream " + stream + " - " + new Date().toISOString();
      }
      const newObject = await this.client.CreateContentObject({libraryId: library, options: {
        type: typeId,
        meta: {
          public: {
            name: name,
            asset_metadata: {
              title: title
            }
          }
        }
      }});
      await this.client.SetPermission({objectId: newObject.objectId, writeToken: newObject.writeToken, permission: "editable"});

      object = newObject.objectId;
      targetWriteToken = newObject.writeToken;
      targetLibraryId = library;
    } else {
      targetLibraryId = await this.client.ContentObjectLibraryId({objectId: object});
    }

    // If updating an existing object, capture entry/exit rat from existing
    // offerings so we can restore them after live-to-vod overwrites them.
    let preservedOfferingPoints = {};
    if (object && targetWriteToken == undefined) {
      for (const offeringKey of ["default", "default_dash"]) {
        const existing = await this.client.ContentObjectMetadata({
          libraryId: targetLibraryId,
          objectId: object,
          metadataSubtree: `offerings/${offeringKey}`
        });
        if (existing && (existing.entry_point_rat || existing.exit_point_rat)) {
          preservedOfferingPoints[offeringKey] = {
            entry_point_rat: existing.entry_point_rat,
            exit_point_rat: existing.exit_point_rat
          };
          console.log(
            `Preserving offerings/${offeringKey} entry_point_rat=${existing.entry_point_rat} exit_point_rat=${existing.exit_point_rat}`
          );
        }
      }
    }

    console.log("Copying stream", stream, "object", object, "drm", drm);

    // Validation - require target object
    if (!object) {
      throw "Must specify a target object ID";
    }

    // Validation - ensure target object has content encryption keys
    const kmsAddress = await this.client.authClient.KMSAddress({objectId: object});
    const kmsCapId = `eluv.caps.ikms${Utils.AddressToHash(kmsAddress)}`;
    const kmsCap = await this.client.ContentObjectMetadata({
      libraryId: targetLibraryId,
      objectId: object,
      writeToken: targetWriteToken,
      metadataSubtree: kmsCapId
    });
    if (!kmsCap) {
      throw Error("No content encryption key set for this object");
    }

    try {

      status.live_object_id = objectId;

      let liveHash = await this.client.LatestVersionHash({objectId: objectId, libraryId});
      status.live_hash = liveHash;

      if (eventId) {
        // Retrieve start and end times for the event
        let event = await this.CueInfo({eventId, status});
        if (event.eventStart && event.eventEnd) {
          console.log("Event", event);
          startTime = event.eventStart;
          endTime = event.eventEnd;
        }
      }

      if (targetWriteToken == undefined) {
        let edt = await this.client.EditContentObject({
          objectId: object,
          libraryId: targetLibraryId
        });
        targetWriteToken = edt.writeToken;
      }
      console.log("Target write token", targetWriteToken);
      status.target_object_id = object;
      status.target_library_id = targetLibraryId;
      status.target_write_token = targetWriteToken;

      console.log("Process live source (takes around 30 sec per hour of content)");
      await this.client.CallBitcodeMethod({
        libraryId: targetLibraryId,
        objectId: object,
        writeToken: targetWriteToken,
        method: "/media/live_to_vod/init",
        body: {
          "live_qhash": liveHash,
          "start_time": startTime, // eg. "2023-10-03T02:09:02.00Z",
          "end_time": endTime, // eg. "2023-10-03T02:15:00.00Z",
          "streams": streams,
          "recording_period": recordingPeriod,
          "variant_key": "default",
          "include_tags": includeTags   // true to copy video tags from live stream
        },
        constant: false,
        format: "text"
      });

      console.log("Initialize VoD mezzanine");
      let abrMezInitBody = {
        abr_profile: abrProfileLiveToVod,
        "offering_key": "default",
        "prod_master_hash": targetWriteToken,
        "variant_key": "default",
        "keep_other_streams": keepExistingStreams, // true to keep existing stream info including thumbnails

        ...(defaultDash && {
          "additional_offering_specs": {
            "default_dash": [       // creates an offering for chromecasting
              {
                "op": "replace",
                "path": "/playout/playout_formats",
                "value": {
                  "dash-clear": {
                    "drm": null,
                    "protocol": {
                      "min_buffer_length": 2,
                      "type": "ProtoDash"
                    }
                  }
                }
              }
            ]
          }
        })
      };

      await this.client.CallBitcodeMethod({
        libraryId: targetLibraryId,
        objectId: object,
        writeToken: targetWriteToken,
        method: "/media/abr_mezzanine/init",
        body: abrMezInitBody,
        constant: false,
        format: "text"
      });

      console.log("Populate live parts");
      await this.client.CallBitcodeMethod({
        libraryId: targetLibraryId,
        objectId: object,
        writeToken: targetWriteToken,
        method: "/media/live_to_vod/copy",   // Takes about 20 sec per "hour" of live
        body: {
          "variant_key": "default",
          "offering_key": "default",
        },
        constant: false,
        format: "text"
      });

      console.log("Finalize VoD mezzanine");

      await this.client.CallBitcodeMethod({
        libraryId: targetLibraryId,
        objectId: object,
        writeToken: targetWriteToken,
        method: "/media/abr_mezzanine/offerings/default/finalize",
        body: abrMezInitBody,
        constant: false,
        format: "text"
      });

      // Restore previously captured entry/exit rat values onto the offerings
      for (const [offeringKey, points] of Object.entries(preservedOfferingPoints)) {
        const offering = await this.client.ContentObjectMetadata({
          libraryId: targetLibraryId,
          objectId: object,
          writeToken: targetWriteToken,
          metadataSubtree: `offerings/${offeringKey}`
        });
        if (!offering) {
          console.log(`Skipping restore for offerings/${offeringKey} (not present after copy)`);
          continue;
        }
        if (points.entry_point_rat !== undefined) {
          offering.entry_point_rat = points.entry_point_rat;
        }
        if (points.exit_point_rat !== undefined) {
          offering.exit_point_rat = points.exit_point_rat;
        }
        await this.client.ReplaceMetadata({
          libraryId: targetLibraryId,
          objectId: object,
          writeToken: targetWriteToken,
          metadataSubtree: `offerings/${offeringKey}`,
          metadata: offering
        });
        console.log(
          `Restored offerings/${offeringKey} entry_point_rat=${points.entry_point_rat} exit_point_rat=${points.exit_point_rat}`
        );
      }

      let finalize = true;
      if (finalize) {
        console.log("Finalize target object");
        let fin = await this.client.FinalizeContentObject({
          libraryId: targetLibraryId,
          objectId: object,
          writeToken: targetWriteToken,
          commitMessage: "Live Stream to VoD"
        });
        status.target_hash = fin.hash;
      }

      // Clean up status items we don't need
      delete status.playout_urls;
      delete status.lro_status_url;
      delete status.recording_period;
      delete status.recording_period_sequence;
      delete status.edge_meta_size;
      delete status.insertions;

      return status;

    } catch (e) {
      console.log("FAILED", JSON.stringify(e));
    }
  }

  /**
   * Set or remove a simple watermark on a live stream object.
   *
   * @namedParams
   * @param {string} op - Operation: "set" to apply a watermark, "rm" to remove it
   * @param {string} objectId - Object ID of the live stream
   * @param {string} [fileName] - Path to a JSON file containing the watermark definition (required for "set")
   * @returns {Promise<Object>} Object with `watermark` and finalized `hash`
   */
  async Watermark({op, objectId, fileName}) {

    const libraryId = await this.client.ContentObjectLibraryId({objectId});
    const edt = await this.client.EditContentObject({
      objectId,
      libraryId
    });

    const recordingParamsPath = "live_recording/recording_config/recording_params";

    let m = await this.client.ContentObjectMetadata({
      libraryId,
      objectId,
      writeToken: edt.write_token,
      metadataSubtree: recordingParamsPath,
      resolveLinks: false
    });
    if (!m) {
      throw "stream object must be configured";
    }

    switch (op) {
      case "set":
        const wmBuf = fs.readFileSync(fileName);
        const wm = JSON.parse(wmBuf);
        m.simple_watermark = wm;
        break;
      case "rm":
        delete m.simple_watermark;
        break;
      default:
        throw "watermark operation must be 'set' or 'rm'";
    }

    await this.client.ReplaceMetadata({
      libraryId,
      objectId,
      writeToken: edt.write_token,
      metadataSubtree: recordingParamsPath,
      metadata: m
    });

    let res = {
      "watermark": m.simple_watermark
    };

    let finalize = true;
    if (finalize) {
      let fin = await this.client.FinalizeContentObject({
        libraryId,
        objectId,
        writeToken: edt.write_token,
        commitMessage: "Watermark " + op
      });
      res.hash = fin.hash;
    }

    return res;
  }

  /**
   * Retrieve the resolved recording configuration for a live stream, merging
   * the user-supplied `live_recording_config` metadata with the base profile.
   *
   * @namedParams
   * @param {string} name - The object ID of the live stream
   * @returns {Promise<Object>} Resolved stream configuration
   */
  async StreamConfig({name}) {

    const objectId = name;
    // Read user config (meta /live_recording_config)
    const libraryId = await this.client.ContentObjectLibraryId({objectId});
    let userConfig = await this.client.ContentObjectMetadata({
      libraryId,
      objectId,
      metadataSubtree: "live_recording_config",
      resolveLinks: false
    });
    return this.client.StreamConfig({name, customSettings: userConfig});
  }

  /**
   * List all playout URLs for streams associated with a site object.
   *
   * @namedParams
   * @param {string} siteId - Object ID of the site
   * @returns {Promise<Object>} Map of stream names to playout URLs
   */
  async StreamListUrls({siteId}) {
    return this.client.StreamListUrls({siteId});
  }

  async ReadEdgeMeta() {

  }

  /**
   * Calculate live streaming latency across three dimensions: part ingest delay,
   * segment egress delay, and metadata retrieval time.
   *
   * Probes segments at positions 1, 8, and 15 within the current mezzanine part
   * and aggregates min/max/avg egress delay.
   *
   * @namedParams
   * @param {Object} status - Stream status object (from {@link Status})
   * @returns {Promise<Object>} Latency stats including `part_ingest`, `egress`, and `meta_delay`
   */
  async LatencyCalculator({status}) {

    const debug = this.debug;
    let stats = {};

    if (debug) console.log("Latency calculator ", status.object_id);

    const getMetaStart = process.hrtime();
    let edgeMeta = await this.client.ContentObjectMetadata({
      libraryId: status.library_id,
      objectId: status.object_id,
      writeToken: status.edge_write_token
    });
    const getMetaElapsed = process.hrtime(getMetaStart);
    stats.meta_delay = (getMetaElapsed[0] * 1000000000 + getMetaElapsed[1]) / 1000000;

    let recordings = edgeMeta.live_recording.recordings;
    let sequence = recordings.recording_sequence;
    let period = recordings.live_offering[sequence - 1];

    let params = edgeMeta.live_recording.recording_config.recording_params;
    let sourceTimescale = params.source_timescale;
    let videoSegDurationTs = params.xc_params.video_seg_duration_ts;
    let mezDurationMillis = videoSegDurationTs * 1000 / sourceTimescale;
    let segDurationMillis = mezDurationMillis / 15;
    let startTimeMillis = period.start_time_epoch_sec * 1000;

    let reps = [];
    for (let i = 0; i < params.ladder_specs.length; i ++) {
      reps[i] = params.ladder_specs[i].representation;
    }

    // Using the top rep
    stats.rep = reps[0];

    stats.start_time = startTimeMillis;
    stats.seg_duration = segDurationMillis;
    stats.mez_duration = mezDurationMillis;

    // Ingest latency
    let videoSources = period.sources.video;
    let videoSourcesTrimmed = Number(period.sources.video_trimmed);
    let min = Number.MAX_SAFE_INTEGER, max = 0, sum = 0, cnt =0;
    for (let i = 0; i < videoSources.length; i ++) {
      let finalized = videoSources[i].finalization_time / 1000;
      if (finalized <= 0) {
        continue;
      }
      let partDelay = finalized - startTimeMillis - (1 + i + videoSourcesTrimmed) * mezDurationMillis;
      if (partDelay < min) {
        min = partDelay;
      }
      if (partDelay > max) {
        max = partDelay;
      }
      sum += partDelay;
      cnt ++;
    }
    stats.part_ingest = {
      delay_min: min,
      delay_max: max,
      delay_avg: sum / cnt
    };

    // Segment delivery latency
    stats.egress = {
      seg_delay_min: Number.MAX_SAFE_INTEGER,
      seg_delay_max: 0,
      seg_delay_sum: 0,
      seg_delay_cnt: 0,
    };
    let details = {};

    // Find first seg in part in the future
    let nowMillis = new Date().getTime();
    let segNum = Math.floor((35000 + nowMillis - startTimeMillis) / segDurationMillis);
    segNum = Math.floor(segNum / 15) * 15;

    details.segOne = await this.LatencySegment({status, stats, sequence, period, segNum});
    details.segOne2 = await this.LatencySegment({status, stats, sequence, period, segNum: segNum + 1});
    details.segOne3 = await this.LatencySegment({status, stats, sequence, period, segNum: segNum + 2});
    details.segOne4 = await this.LatencySegment({status, stats, sequence, period, segNum: segNum + 3});

    // Segment 8 in the part (in the future)
    nowMillis = new Date().getTime();
    segNum = Math.floor((35000 + nowMillis - startTimeMillis) / segDurationMillis);
    segNum = Math.floor(segNum / 15) * 15 + 8;

    details.segEight = await this.LatencySegment({status,  stats, sequence, period, segNum});
    details.segEight2 = await this.LatencySegment({status, stats, sequence, period, segNum: segNum + 1});
    details.segEight3 = await this.LatencySegment({status, stats, sequence, period, segNum: segNum + 2});
    details.segEight4 = await this.LatencySegment({status, stats, sequence, period, segNum: segNum + 3});

    // Seg 15 in the part (in the future)
    nowMillis = new Date().getTime();
    segNum = Math.floor((35000 + nowMillis - startTimeMillis) / segDurationMillis);
    segNum = Math.floor(segNum / 15) * 15 - 1;

    details.segFifteen = await this.LatencySegment({status, stats, sequence, period, segNum});
    details.segFifteen2 = await this.LatencySegment({status, stats, sequence, period, segNum: segNum + 1});
    details.segFifteen3 = await this.LatencySegment({status, stats, sequence, period, segNum: segNum + 2});
    details.segFifteen4 = await this.LatencySegment({status, stats, sequence, period, segNum: segNum + 3});

    stats.egress.seg_delay_avg = stats.egress.seg_delay_sum / stats.egress.seg_delay_cnt;
    delete stats.egress.seg_delay_sum;
    delete stats.egress.seg_delay_cnt;

    if (debug) stats.details = details;
    return stats;
  }

  /**
   * Measure the egress latency for a single HLS segment by timing an HTTP GET
   * from its scheduled availability to first byte and full download.
   *
   * @namedParams
   * @param {number} segNum - Segment index within the recording period
   * @param {Object} stats - Cumulative stats object; egress fields are updated in place
   * @param {number} sequence - Current recording sequence number
   * @param {Object} period - Recording period metadata object
   * @param {Object} status - Stream status object (provides library/object IDs)
   * @returns {Promise<Object>} Per-segment result: segNum, segDelay, segDelayFirstByte, segSize, downloadMbps
   */
  async LatencySegment({segNum, stats, sequence, period, status}) {

    const debug = this.debug;

    let startTimeMillis = period.start_time_epoch_sec * 1000;
    let segDurationMillis = stats.seg_duration;
    let nowMillis = new Date().getTime();

    let targetMillis = startTimeMillis + segNum * segDurationMillis;
    if (debug) console.log("Segment target", segNum, targetMillis, "from_now", targetMillis - nowMillis);

    let segURL = await this.client.FabricUrl({
      libraryId: status.library_id,
      objectId: status.object_id,
      queryParams: {rec_seq: sequence},
      rep: "playout/default/hls-clear/video/" + stats.rep + "/00" + segNum + ".m4s",
    });

    if (debug) console.log(segURL);

    let segSize = 0;
    let segDelayFirstByte;
    let segDelay;
    let downloadMbps;
    await new Promise((resolve) => {
      https.get(segURL, (res) => {
        res.once("readable", () => {
          segDelayFirstByte = new Date().getTime() - targetMillis;
        });
        res.on("data", (chunk) => {
          segSize += chunk.length;
        });
        res.on("end", () => {
          segDelay = new Date().getTime() - targetMillis;
          downloadMbps = segSize * 8 / (segDelay - segDelayFirstByte) / 1024;
          resolve();
        });
        res.on("error", err => {
          console.log("Error: " + err.message);
        });
      });
    });

    if (segDelay < stats.egress.seg_delay_min) {
      stats.egress.seg_delay_min = segDelay;
    }
    if (segDelay > stats.egress.seg_delay_max) {
      stats.egress.seg_delay_max = segDelay;
    }
    stats.egress.seg_delay_cnt ++;
    stats.egress.seg_delay_sum += segDelay;

    return {
      segNum, segDelay, segDelayFirstByte, segSize, downloadMbps
    };
  }

  /**
   * Look up the start and end times for a SCTE-35 event by its ID,
   * using the LRO status URL from the stream status object.
   *
   * @namedParams
   * @param {string} eventId - SCTE-35 event ID to search for
   * @param {Object} status - Stream status object (must include `lro_status_url`)
   * @returns {Promise<Object>} Object with `eventStart`, `eventEnd`, and `eventId`
   */
  async CueInfo({eventId, status}) {
    let cues;
    try {
      let lroStatus = await got(status.lro_status_url);
      cues = JSON.parse(lroStatus.body).custom.cues;
    } catch (error) {
      console.log("LRO status failed", error);
      return {error: "failed to retrieve status", eventId};
    }

    let eventStart, eventEnd;
    for (const value of Object.values(cues)) {
      for (const event of Object.values(value.descriptors)) {
        if (event.id == eventId) {
          switch (event.type_id) {
            case 32:
            case 16:
              eventStart = value.insertion_time;
              break;
            case 33:
            case 17:
              eventEnd = value.insertion_time;
              break;

          }
        }
      }
    }

    return {eventStart, eventEnd, eventId};
  }

  /**
   * Switch a stream's playout source between its primary live feed and a
   * backup content hash (e.g. a pre-recorded fallback).
   *
   * @namedParams
   * @param {string} name - Object ID of the stream (site) object
   * @param {string} source - "primary" to use the live feed, "backup" to use the backup hash
   * @param {string} [backupHash] - Content hash of the backup object (required when source is "backup")
   * @returns {Promise<Object>} Finalize result with `source` and resolved `link`
   */
  async StreamSwitch({name, source, backupHash}) {

    console.log("Switch", name, source, backupHash);
    const objectId = name;
    const libraryId = await this.client.ContentObjectLibraryId({objectId});

    const edt = await this.client.EditContentObject({
      libraryId,
      objectId
    });

    const writeToken = edt.write_token;

    let sources = await this.client.ContentObjectMetadata({
      libraryId,
      objectId,
      writeToken,
      metadataSubtree: "public/asset_metadata/sources",
      resolveLinks: false
    });

    var rep = "/rep/playout/default/options.json";
    var lk = "." + rep;
    if (source == "backup") {
      if (!backupHash) {
        throw "Bad backup hash";
      }
      lk = "/qfab/" + backupHash + rep;
    }
    sources.default["/"] = lk;

    await this.client.ReplaceMetadata({
      libraryId,
      objectId,
      writeToken,
      metadataSubtree: "public/asset_metadata/sources",
      metadata: sources
    });

    const fin = await this.client.FinalizeContentObject({
      libraryId,
      objectId,
      writeToken
    });
    return {
      ...fin,
      source,
      link: lk
    };
  }

  /**
   * Find a content type object ID by its label, looking up the types registered
   * in the tenant's top-level object (`public/content_types`).
   *
   * @namedParams
   * @param {string} label - Content type label (e.g. "live-stream", "title")
   * @returns {Promise<string|undefined>} Content type object ID, or undefined if not found
   */
  async FindContentType({label}) {
    const tenantId = await this.client.userProfileClient.TenantContractId();
    const objectId = "iq__" + tenantId.substring(4);
    const libraryId = await this.client.ContentObjectLibraryId({objectId});
    const m = await this.client.ContentObjectMetadata({objectId, libraryId, metadataSubtree: "/public/content_types"});
    return m[label];
  }
} // End class

// TODO fix and add as CLI command
/*
const ConfigStreamRebroadcast = async () => {

  const t = 1619850660;

  try {
    let client;
    if (conf.clientConf.configUrl) {
      client = await ElvClient.FromConfigurationUrl({
        configUrl: conf.clientConf.configUrl
      });
    } else {
      client = new ElvClient(conf.clientConf);
    }
    const wallet = client.GenerateWallet();
    const signer = wallet.AddAccount({ privateKey: conf.signerPrivateKey });
    client.SetSigner({ signer });
    const fabURI = client.fabricURIs[0];
    console.log("Fabric URI: " + fabURI);
    const ethURI = client.ethereumURIs[0];
    console.log("Ethereum URI: " + ethURI);

    client.ToggleLogging(false);

    let mainMeta = await client.ContentObjectMetadata({
      libraryId: conf.libraryId,
      objectId: conf.objectId
    });
    console.log("Main meta:", mainMeta);

    edgeWriteToken = mainMeta.edge_write_token;
    console.log("Edge: ", edgeWriteToken);

    let edgeMeta = await client.ContentObjectMetadata({
      libraryId: conf.libraryId,
      objectId: conf.objectId,
      writeToken: edgeWriteToken
    });
    console.log("Edge meta:", edgeMeta);

    //console.log("CONFIG: ", edgeMeta.live_recording_parameters.live_playout_config);
    console.log("recording_start_time: ", edgeMeta.recording_start_time);
    console.log("recording_stop_time:  ", edgeMeta.recording_stop_time);

    // Set rebroadcast start
    edgeMeta.live_recording_parameters.live_playout_config.rebroadcast_start_time_sec_epoch = t;

    await client.MergeMetadata({
      libraryId: conf.libraryId,
      objectId: conf.objectId,
      writeToken: edgeWriteToken,
      metadata: {
        "live_recording_parameters": {
		  "live_playout_config" : edgeMeta.live_recording_parameters.live_playout_config
        }
	  }
    });

  } catch (error) {
    console.error(error);
  }
};
*/



exports.EluvioLiveStream = EluvioLiveStream;
