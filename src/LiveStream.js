/*
 * Content Fabric live stream management
 */

const { ElvClient } = require("@eluvio/elv-client-js");
const got = require("got");

const PRINT_DEBUG = true;

const streams = require("../liveconf.json");
const channels = require("../channelsconf.json");

const MakeTxLessToken = async({client, libraryId, objectId, versionHash}) => {
  tok = await client.authClient.AuthorizationToken({libraryId, objectId,
						    versionHash, channelAuth: false, noCache: true,
						    noAuth: true});
  return tok;
};

class EluvioLiveStream {

  /**
   * Instantiate the EluvioLiveStream
   *
   * @namedParams
   * @param {string} configUrl - The Content Fabric configuration URL
   * @return {EluvioLive} - New EluvioLive object connected to the specified content fabric and blockchain
   */
  constructor({ configUrl, debugLogging = false }) {
    this.configUrl = configUrl || ElvClient.main;

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

    // Pick the first object if name not specified
    if (name == null) {
      name = Object.keys(streams)[0];
    }

    const conf = streams[name];
    if (conf == null) {
      console.log("Bad name: ", name);
      return;
    }

    try {

      // Set static token - avoid individual auth for separate channels/streams
      let token = await MakeTxLessToken({client: this.client, libraryId: conf.libraryId});
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
   * - inactive
   * - stopped
   * - starting
   * - running
   * - stalled
   * - terminated
   */
  async Status({name, stopLro = false}) {

    const conf = streams[name];
    if (conf == null) {
      console.log("Bad name: ", name);
      return;
    }

    let status = {name: name};

    try {

      let libraryId = await this.client.ContentObjectLibraryId({objectId: conf.objectId});
      status.library_id = libraryId;
      status.object_id = conf.objectId;

      let mainMeta = await this.client.ContentObjectMetadata({
        libraryId: libraryId,
        objectId: conf.objectId
      });

      let fabURI = mainMeta.live_recording.fabric_config.ingress_node_api;

      // Support both hostname and URL ingress_node_api
      if (!fabURI.startsWith("http")) {
        // Assume https
        fabURI = "https://" + fabURI;
      }
      this.client.SetNodes({fabricURIs: [fabURI]});

      status.fabric_api = fabURI;
      status.url = mainMeta.live_recording.recording_config.recording_params.origin_url;

      let edgeWriteToken = mainMeta.live_recording.fabric_config.edge_write_token;

      status.edge_write_token = edgeWriteToken;
      let edgeMeta = await this.client.ContentObjectMetadata({
        libraryId: libraryId,
        objectId: conf.objectId,
        writeToken: edgeWriteToken
      });

      // If a stream has never been started return state 'inactive'
      if (!edgeMeta.live_recording.recordings || !edgeMeta.live_recording.recordings.recording_sequence) {
        status.state = "inactive";
        return status;
      }

      let recordings = edgeMeta.live_recording.recordings;
      status.recording_period_sequence = recordings.recording_sequence;

      let period = recordings.live_offering[recordings.recording_sequence - 1];

      let tlro = period.live_recording_handle;
      status.tlro = tlro;

      let sinceLastFinalize = Math.floor(new Date().getTime() / 1000) -
      period.video_finalized_parts_info.last_finalization_time /1000000;

      let recording_period = {
        activation_time_epoch_sec: period.recording_start_time_epoch_sec,
        start_time_epoch_sec: period.start_time_epoch_sec,
        start_time_text: new Date(period.start_time_epoch_sec * 1000).toLocaleString(),
        end_time_epoch_sec: period.end_time_epoch_sec,
        end_time_text:  period.end_time_epoch_sec == 0 ? null : new Date(period.end_time_epoch_sec * 1000).toLocaleString(),
        video_parts: period.video_finalized_parts_info.n_parts,
        video_last_part_finalized_epoch_sec: period.video_finalized_parts_info.last_finalization_time / 1000000,
        video_since_last_finalize_sec : sinceLastFinalize
      };
      status.recording_period = recording_period;

      status.lro_status_url = await this.client.FabricUrl({
        libraryId: libraryId,
        objectId: conf.objectId,
        writeToken: edgeWriteToken,
        call: "live/status/" + tlro
      });

      let state = "stopped";
      let lroStatus = "";
      try {
        lroStatus = await got(status.lro_status_url);
        state = JSON.parse(lroStatus.body).state;
      } catch (error) {
        console.log("LRO Status (failed): ", error.response.statusCode);
      }
      if (state == "running" && period.video_finalized_parts_info.last_finalization_time ==0) {
        state = "starting";
      } else if (state == "running" && sinceLastFinalize > 32.9) {
        state = "stalled";
      }
      status.state = state;

      if ((state == "running" || state == "stalled" || state == "starting") && stopLro) {
        lroStopUrl = await this.client.FabricUrl({
          libraryId: libraryId,
          objectId: conf.objectId,
          writeToken: edgeWriteToken,
          call: "live/stop/" + tlro
        });

        try {
          stop = await got(lroStopUrl);
          console.log("LRO Stop: ", lroStatus.body);
        } catch (error) {
          console.log("LRO Stop (failed): ", error.response.statusCode);
        }
      }

    } catch (error) {
      console.error(error);
    }

    return status;
  }

  /*
  * StartSession creates a new edge write token
  */
  async StartSession ({name}) {

    console.log("START: ", name);
    const conf = streams[name];
    if (conf == null) {
      console.log("Bad name: ", name);
      return;
    }

    let libraryId = await this.client.ContentObjectLibraryId({objectId: conf.objectId});

    // Read live recording parameters - determine ingest node
    let liveRecording = await this.client.ContentObjectMetadata({
      libraryId: libraryId,
      objectId: conf.objectId,
      metadataSubtree: "/live_recording"
    });

    let fabURI = liveRecording.fabric_config.ingress_node_api;
    // Support both hostname and URL ingress_node_api
    if (!fabURI.startsWith("http")) {
      // Assume https
      fabURI = "https://" + fabURI;
    }

    this.client.SetNodes({fabricURIs: [fabURI]});

    console.log("Node URI", fabURI, "ID", liveRecording.fabric_config.ingress_node_id);

    let response = await this.client.EditContentObject({
      libraryId: libraryId,
      objectId: conf.objectId
    });
    const edgeToken = response.write_token;
    console.log("Edge token:", edgeToken);

    /*
    * Set the metadata, including the edge token.
    */
    response = await this.client.EditContentObject({
      libraryId: libraryId,
      objectId: conf.objectId
    });
    let writeToken = response.write_token;

    if (PRINT_DEBUG) console.log("MergeMetadata", libraryId, conf.objectId, writeToken);
    await this.client.MergeMetadata({
      libraryId: libraryId,
      objectId: conf.objectId,
      writeToken: writeToken,
      metadata: {
        live_recording: {
          status: {
            edge_write_token: edgeToken,
            state: "active"  // indicates there is an active session (set to 'closed' when done)
          },
          fabric_config: {
            edge_write_token: edgeToken
          }
        }
      }
    });

    if (PRINT_DEBUG) console.log("FinalizeContentObject", libraryId, conf.objectId, writeToken);
    response = await this.client.FinalizeContentObject({
      libraryId: libraryId,
      objectId: conf.objectId,
      writeToken: writeToken
    });
    const objectHash = response.hash;
    console.log("Object hash:", objectHash);

    if (PRINT_DEBUG) console.log("AuthorizationToken", libraryId, conf.objectId);
    response = await this.client.authClient.AuthorizationToken({
      libraryId: libraryId,
      objectId: conf.objectId,
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

    try {

      console.log("Stream ", op, ": ", name);
      let status = await this.Status({name});
      console.log("STATUS: ", status);

      if (status.state != "terminated" && status.state != "inactive") {
        if (op == "start") {
          return status;
        }
        console.log("STOPPING");
        try {
          await this.client.CallBitcodeMethod({
            libraryId: status.library_id,
            objectId: status.object_id,
            writeToken: status.edge_write_token,
            method: "/live/stop/" + status.tlro,
            constant: false
          });
        } catch (error) {
          // The /call/lro/stop API returns empty response
          // console.log("LRO Stop (failed): ", error);
        }

        // Wait until LRO is terminated
        let tries = 10;
        while (status.state != "terminated" && tries-- > 0) {
          console.log("Wait to terminate - ", status.state);
          await sleep(1000);
          status = await this.Status({name});
        }
        console.log("Status after terminate - ", status.state);

        if (tries <= 0) {
          console.log("Failed to terminate");
          return status;
        }
      }

      if (op == "stop") {
        return status;
      }

      console.log("STARTING");
      try {
        await this.client.CallBitcodeMethod({
          libraryId: status.library_id,
          objectId: status.object_id,
          writeToken: status.edge_write_token,
          method: "/live/start",
          constant: false
        });
      } catch (error) {
        console.log("LRO Start (failed): ", error);
      }

      // Wait until LRO is 'starting'
      let tries = 10;
      while (status.state != "starting" && tries-- > 0) {
        console.log("Wait to start - ", status.state);
        await sleep(1000);
        status = await this.Status({name});
      }

      console.log("Status after restart - ", status.state);
      return status;

    } catch (error) {
      console.error(error);
    }
  }

  /*
   * Stop the live stream session and close the edge write token.
   * Not implemented fully
   */
  async StopSession({name}) {

    try {

      console.log("START: ", name);
      const conf = streams[name];
      if (conf == null) {
        console.log("Bad name: ", name);
        return;
      }

      let libraryId = await this.client.ContentObjectLibraryId({objectId: conf.objectId});

      let mainMeta = await this.client.ContentObjectMetadata({
        libraryId: libraryId,
        objectId: conf.objectId
      });

      let fabURI = mainMeta.live_recording.fabric_config.ingress_node_api;
      // Support both hostname and URL ingress_node_api
      if (!fabURI.startsWith("http")) {
        // Assume https
        fabURI = "https://" + fabURI;
      }

      this.client.SetNodes({fabricURIs: [fabURI]});

      let edgeWriteToken = mainMeta.live_recording.fabric_config.edge_write_token;

      let edgeMeta = await this.client.ContentObjectMetadata({
        libraryId: libraryId,
        objectId: conf.objectId,
        writeToken: edgeWriteToken
      });

      // Stop the LRO if running
      let status = await this.Status({name});
      if (status.state != "terminated") {
        console.log("STOPPING");
        try {
          await this.client.CallBitcodeMethod({
            libraryId: status.library_id,
            objectId: status.object_id,
            writeToken: status.edge_write_token,
            method: "/live/stop/" + status.tlro,
            constant: false
          });
        } catch (error) {
          // The /call/lro/stop API returns empty response
          // console.log("LRO Stop (failed): ", error);
        }

        // Wait until LRO is terminated
        let tries = 10;
        while (status.state != "terminated" && tries-- > 0) {
          console.log("Wait to terminate - ", status.state);
          await sleep(1000);
          status = await this.Status({name});
        }
        console.log("Status after terminate - ", status.state);

        if (tries <= 0) {
          console.log("Failed to terminate");
          return status;
        }
      }

      console.log("CONFIG:");
      console.log("recording_start_time: ", edgeMeta.recording_start_time);
      console.log("recording_stop_time:  ", edgeMeta.recording_stop_time);

      // Set stop time
      edgeMeta.recording_stop_time = Math.floor(new Date().getTime() / 1000);
      console.log("AFTER");
      console.log("recording_start_time: ", edgeMeta.recording_start_time);
      console.log("recording_stop_time:  ", edgeMeta.recording_stop_time);

      edgeMeta.live_recording.status = {state: "closed"};

      await this.client.ReplaceMetadata({
        libraryId: libraryId,
        objectId: conf.objectId,
        writeToken: edgeWriteToken,
        metadata: edgeMeta

      });

      return {
        name: name,
        edge_write_token: edgeWriteToken,
        state: "closed"
      };

    } catch (error) {
      console.error(error);
    }
  }

  async SetOfferingAndDRM({name}) {

    console.log("INIT: ", name);
    const conf = streams[name];
    if (conf == null) {
      console.log("Bad name: ", name);
      return;
    }

    const {GenerateOffering} = require("./LiveObjectSetupStepOne");

    const aBitRate = 128000;
    const aChannels = 2;
    const aSampleRate = 48000;
    const aStreamIndex = 1;
    const aTimeBase = "1/48000";
    const aChannelLayout = "stereo";

    const vBitRate = 14000000;
    const vHeight = 720;
    const vStreamIndex = 0;
    const vWidth = 1280;
    const vDisplayAspectRatio = "16/9";
    const vFrameRate = "30000/1001";
    const vTimeBase = "1/30000"; // "1/16000";

    const abrProfile = require("./abr_profile_live_drm.json");

    let libraryId = await this.client.ContentObjectLibraryId({objectId: conf.objectId});
    const objectId = conf.objectId;

    try {

      let mainMeta = await this.client.ContentObjectMetadata({
        libraryId: libraryId,
        objectId: conf.objectId
      });

      let fabURI = mainMeta.live_recording.fabric_config.ingress_node_api;
      // Support both hostname and URL ingress_node_api
      if (!fabURI.startsWith("http")) {
        // Assume https
        fabURI = "https://" + fabURI;
      }

      this.client.SetNodes({fabricURIs: [fabURI]});

      let streamUrl = mainMeta.live_recording.recording_config.recording_params.origin_url;

      await GenerateOffering({
        client: this.client,
        libraryId,
        objectId,
        streamUrl,
        abrProfile,
        aBitRate, aChannels, aSampleRate, aStreamIndex,
        aTimeBase,
        aChannelLayout,
        vBitRate, vHeight, vStreamIndex, vWidth,
        vDisplayAspectRatio, vFrameRate, vTimeBase
      });

      console.log("GenerateOffering - DONE");

      return {
        name,
        object_id: objectId,
        state: "initialized"
      };
    } catch (error) {
      console.error(error);
    }
  }

} // End class


function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

const ChannelStatus = async ({client, name}) => {

  let status = {name: name};

  const conf = channels[name];
  if (conf == null) {
    console.log("Bad name: ", name);
    return;
  }

  try {

    let meta = await client.ContentObjectMetadata({
      libraryId: conf.libraryId,
      objectId: conf.objectId
    });

    status.channel_title = meta.public.asset_metadata.title;
    let source = meta.channel.offerings.default.items[0].source["/"];
    let hash = source.split("/")[2];
    status.stream_hash = hash;
    latestHash = await client.LatestVersionHash({
	  versionHash: hash
    });
    status.stream_latest_hash = latestHash;

    if (hash != latestHash) {
	  status.warnings = ["Stream version is not the latest"];
    }

    let channelFormatsUrl = await client.FabricUrl({
      libraryId: conf.libraryId,
      objectId: conf.objectId,
	  rep: "channel/options.json"
    });

    try {
	  let offerings = await got(channelFormatsUrl);
	  status.offerings = JSON.parse(offerings.body);
    } catch (error) {
	  console.log(error);
	  status.offerings_error = "Failed to retrieve channel offerings";
    }

    status.playout = await ChannelPlayout({client, libraryId: conf.libraryId, objectId: conf.objectId});

  } catch (error) {
    console.error(error);
  }

  return status;
};

/*
 * Performs client-side playout operations - open the channel, read offerings,
 * retrieve playlist and one video init segment.
 */
const ChannelPlayout = async({client, libraryId, objectId}) => {

  let playout = {};

  const offerings = await client.AvailableOfferings({
    libraryId,
    objectId,
    handler: "channel",
    linkPath: "/public/asset_metadata/offerings"
  });

  // Choosing offering 'default'
  let offering = offerings.default;

  const playoutOptions = await client.PlayoutOptions({
    libraryId,
    objectId,
    offeringURI: offering.uri
  });

  // Retrieve master playlist
  let masterPlaylistUrl = playoutOptions["hls"]["playoutMethods"]["fairplay"]["playoutUrl"];
  playout.master_playlist_url = masterPlaylistUrl;
  try {
    //let masterPlaylist =  await got(masterPlaylistUrl);
    playout.master_playlist = "success";
  } catch (error) {
    playout.master_playlist = "fail";
  }

  let url = new URL(masterPlaylistUrl);
  let p = url.pathname.split("/");

  // Retrieve media playlist
  p[p.length - 1] = "video/720@14000000/live.m3u8";
  let pathMediaPlaylist = p.join("/");
  url.pathname = pathMediaPlaylist;
  let mediaPlaylistUrl = url.toString();
  playout.media_playlist_url = mediaPlaylistUrl;
  let mediaPlaylist;
  try {
    mediaPlaylist = await got(mediaPlaylistUrl);
    playout.media_playlist = "success";
  } catch (error) {
    playout.media_playlist = "fail";
  }

  // Retrieve init segment
  var regex = new RegExp("^#EXT-X-MAP:URI=\"init.m4s.(.*)\"$", "m");
  var match = regex.exec(mediaPlaylist.body);
  let initQueryParams;
  if (match) {
    initQueryParams = match[1];
  }

  p[p.length - 1] = "video/720@14000000/init.m4s";
  let pathInit = p.join("/");
  url.pathname = pathInit;
  url.search=initQueryParams;
  let initUrl = url.toString();
  playout.init_segment_url = initUrl;
  /*
  try {
	let initSegment = await got(initUrl);
	playout.init_segment = "success"
  } catch (error) {
	playout.init_segment = "fail";
  }
*/
  return playout;
};


const Summary = async ({client}) => {

  let summary = {};

  try {
    for (const [key] of Object.entries(streams)) {
	  conf = streams[key];
	  summary[key] = await Status({client, name: key, stopLro: false});
    }

  } catch (error) {
    console.error(error);
  }
  return summary;
};

const ChannelSummary = async ({client}) => {

  let summary = {};

  try {
    for (const [key] of Object.entries(channels)) {
	  conf = channels[key];
	  summary[key] = await ChannelStatus({client, name: key});
    }

  } catch (error) {
    console.error(error);
  }
  return summary;
};

const ConfigStream = async () => {

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

    if (PRINT_DEBUG) console.log("MergeMetadata", conf.libraryId, conf.objectId, writeToken);
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

async function EnsureAll() {
  client = await StatusPrep({name: null});
  let summary = await Summary({client});

  var res = {
    running: 0,
    stalled: 0,
    terminated: 0
  };

  try {
    for (const [key, value] of Object.entries(summary)) {
	  if (value.state == "stalled") {
        console.log("Stream stalled: ", key, " - restarting");
        console.log("todo ...");
	  }
	  res[value.state] = res[value.state] + 1;
    }
  } catch (error) {
    console.error(error);
  }

  return res;
}

/*
 * Original Run() function - kept for reference
 */
async function Run() {

  var client;

  switch (command) {

    case "start":
      StartStream({name});
      break;

    case "status":
      client = await StatusPrep({name});
      let status = await Status({client, name, stopLro: false});
      console.log(JSON.stringify(status, null, 4));
      break;

    case "stop":
      client = await UpdatePrep({name});
      Status({client, name, stopLro: true});
      break;

    case "summary":
      client = await StatusPrep({name: null});
      let summary = await Summary({client});
      console.log(JSON.stringify(summary, null, 4));
      break;

    case "init": // Set up DRM
      SetOfferingAndDRM();
      break;

    case "reset": // Stop and start LRO recording (same edge write token)
      client = await StatusPrep({name});
      let reset = await Reset({client, name, stopLro: false});
      console.log(JSON.stringify(reset, null, 4));
      break;

    case "channel":
      client = await StatusPrep({name});
      let channelStatus = await ChannelStatus({client, name});
      console.log(JSON.stringify(channelStatus, null, 4));
      break;

    case "channel_summary":
      client = await StatusPrep({name});
      let channelSummary = await ChannelSummary({client, name});
      console.log(JSON.stringify(channelSummary, null, 4));
      break;

    case "ensure_all": // Check all and restart stalled
      let ensureSummary = await EnsureAll();
      console.log(JSON.stringify(ensureSummary, null, 4));
      break;

    case "future_use_config":
      ConfigStream();
      break;

    default:
      console.log("Bad command: ", command);
      break;

  }
}

const useOldRunFunction = false;
if (useOldRunFunction) {
  Run();
}


exports.EluvioLiveStream = EluvioLiveStream;
