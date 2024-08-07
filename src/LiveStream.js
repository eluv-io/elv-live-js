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

const MakeTxLessToken = async({client, libraryId, objectId, versionHash}) => {
  const tok = await client.authClient.AuthorizationToken({libraryId, objectId,
						    versionHash, channelAuth: false, noCache: true,
						    noAuth: true});
  return tok;
};

class EluvioLiveStream {

  /**
   * Instantiate the EluvioLiveStream
   *
   * @namedParams
   * @param {string} url - Optional node endpoint URL (overwrites config URL)
   * @param {bool} debugLogging - Optional debug logging flag
   * @return {EluvioLive} - New EluvioLive object connected to the specified content fabric and blockchain
   */
  constructor({ url, debugLogging = false }) {

    if (url) {
      this.configUrl = url+"/config?self&qspace="+Config.net;
    } else {
      this.configUrl = Config.networks[Config.net];
    }
    this.debug = debugLogging;
  }

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
  }

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

  /*
   * Retrive the status of the current live stream session
   *
   * States:

   * unconfigured    - no live_recording_config
   * uninitialized   - no live_recording config generated
   * inactive        - live_recording config initialized but no 'edge write token'
   * stopped         - edge-write-token but not started
   * starting        - LRO running but no source data yet
   * running         - stream is running and producing output
   * stalled         - LRO running but no source data (so not producing output)
   */
  async Status({name, stopLro = false, showParams = false}) {
    return this.client.StreamStatus({name, stopLro, showParams});
  }

  /*
  * StreamCreate creates a new edge write token
  */
  async StreamCreate ({name, start = false, show_curl = false}) {
    const status = await this.client.StreamCreate({name, start});

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


  /*
  * Start, stop or reset a stream within the current session (current edge write token)
  * The 'op' parameter can be:
  * - 'start'
  * - 'reset'  Stops current LRO recording and starts a new one.  Does not create a new edge write token
  *            (just creates a new recording period in the existing edge write token)
  * - 'stop'
  * Returns stream status
  */
  async StartOrStopOrReset({name, op}) {
    return this.client.StreamStartOrStopOrReset({name, op});
  }

  /*
   * Stop the live stream session and close the edge write token.
   * Not implemented fully
   */
  async StopSession({name}) {
    return this.client.StreamStopSession({name});
  }

  async Initialize({name, drm=false, format}) {
    return this.client.StreamInitialize({name, drm, format});
  }

  // Add a content insertion entry
  // Parameters:
  // - insertionTime - seconds (float)
  // - sinceStart - true if time specified since stream start, false if since epoch
  // - duration - seconds (float, deafault 20.0)
  // - targetHash -  playable
  // - remove - flag to remove the insertion at that exact 'time' (instead of adding)
  async Insertion({name, insertionTime, sinceStart, duration, targetHash, remove}) {
    return this.client.StreamInsertion({name, insertionTime, sinceStart, duration, targetHash, remove});
  }

  async StreamDownload({name, period, offset, makeFrame}) {

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
      let mts = ["video"];
      for (let mi = 0; mi < streams.length; mi ++) {
        if (streams[mi].includes("video"))
          continue;
        mts.push(streams[mi]);
      }

      let inputs = "";
      let inputs_map = "";
      let makeFrameCmds = [];

      for (let mi = 0; mi < mts.length; mi ++) {
        let mt = mts[mi];
        inputs = inputs + " -i " + dpath + "/" + mt + ".mp4";
        if (mt.includes("video")) {
          inputs_map = inputs_map + ` -map ${mi}:v:0`;
        } else {
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


  /*
  * Copy a portion of a live stream recording into a standard VoD object using the zero-copy content fabric API.
  *
  * Limitations:
  * - currently requires the target object to be pre-created and have content encryption keys (CAPS)
  * - for audio and video to be sync'd, the live stream needs to have the beginning of the desired recording period
  *   - for an event stream, make sure the TTL is long enough to allow running the live-to-vod command before the beginning of the recording expires
  *   - for 24/7 streams, make sure to reset the stream before the desired recording (as to create a new recording period) and have the TTL long enough
  *     to allow running the live-to-vod command before the beginning of the recording expires.
  * - startTime and endTime are not currently implemented by this tool
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
  async StreamCopyToVod({name, object, library, eventId, startTime, endTime, recordingPeriod, streams}) {

    const objectId = name;
    const abrProfileLiveToVod = require("./abr_profile_live_to_vod.json");

    let status = await this.Status({name});
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
      const newObject = await this.client.CreateContentObject({libraryId: library, options: {
        type: typeId,
        meta: {
          public: {
            name: "VOD - Live Stream " + name + " - " + new Date().toISOString()
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

    console.log("Copying stream", name, "object", object);

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

      console.log("Process live source (takes around 20 sec per hour of content)");
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
          "variant_key": "default"
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
        "keep_other_streams": false
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
        method: "/media/live_to_vod/copy",
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

  async StreamListUrls({siteId}) {
    return this.client.StreamListUrls({siteId});
  }

  async ReadEdgeMeta() {

  }

  /**
   * Calculate live streaming latency - ingest, egress, metadata.
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
   * Calculate latency stats for a given segment
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

  // Find a content type by label (e.g. 'live-stream', 'title') based on the
  // content types stored in the tenant object
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
