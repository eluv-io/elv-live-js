const LiveconfTemplate = require("./LiveConfTemplate");
const LadderTemplate = require("./LadderTemplate");

class LiveConf {
  constructor(probeData, nodeId, nodeUrl, includeAVSegDurations, overwriteOriginUrl, syncAudioToVideo) {
    this.probeData = probeData;
    this.nodeId = nodeId;
    this.nodeUrl = nodeUrl;
    this.includeAVSegDurations = includeAVSegDurations;
    this.overwriteOriginUrl = overwriteOriginUrl;
    this.syncAudioToVideo = syncAudioToVideo;
  }

  probeKind() {
    let fileNameSplit = this.probeData.format.filename.split(":");
    return fileNameSplit[0];
  }

  getStreamDataForCodecType(codecType) {
    let stream = null;
    for (let index = 0; index < this.probeData.streams.length; index++) {
      if (this.probeData.streams[index].codec_type == codecType) {
        stream = this.probeData.streams[index];
      }
    }
    return stream;
  }

  getFrameRate() {
    let videoStream = this.getStreamDataForCodecType("video");
    let frameRate = videoStream.r_frame_rate || videoStream.frame_rate;
    return frameRate.split("/");
  }

  isFrameRateWhole() {
    let frameRate = this.getFrameRate();
    return frameRate[1] == "1";
  }

  getForceKeyint() {
    let frameRate = this.getFrameRate();
    let roundedFrameRate = Math.round(frameRate[0] / frameRate[1]);
    if (roundedFrameRate > 30) {
      return roundedFrameRate;
    } else {
      return roundedFrameRate * 2;
    }
  }

  calcSegDuration({sourceTimescale}) {

    let videoStream = this.getStreamDataForCodecType("video");
    let frameRate = videoStream.frame_rate;

    let seg ={};
    switch (frameRate) {
      case "24":
        seg.video = 30 * sourceTimescale;
        seg.audio = 30 * 48000;
        seg.keyint = 48;
        seg.duration = "30";
        break;
      case "25":
        seg.video = 30 * sourceTimescale;
        seg.audio = 30 * 48000;
        seg.keyint = 50;
        seg.duration = "30";
        break;
      case "30":
        seg.video = 30 * sourceTimescale;
        seg.audio = 30 * 48000;
        seg.keyint = 60;
        seg.duration = "30";
        break;
      case "30000/1001":
        seg.video = 30.03 * sourceTimescale;
        seg.audio = 29.76 * 48000;
        seg.keyint = 60;
        seg.duration = "30.03";
        break;
      case "48":
        seg.video = 30 * sourceTimescale;
        seg.audio = 30 * 48000;
        seg.keyint = 96;
        seg.duration = "30";
        break;
      case "50":
        seg.video = 30 * sourceTimescale;
        seg.audio = 30 * 48000;
        seg.keyint = 100;
        seg.duration = "30";
        break;
      case "60":
        seg.video = 30 * sourceTimescale;
        seg.audio = 30 * 48000;
        seg.keyint = 120;
        seg.duration = "30";
        break;
      case "60000/1001":
        seg.video = 30.03 * sourceTimescale;
        seg.audio = 29.76 * 48000;
        seg.keyint = 120;
        seg.duration = "30.03";
        break;
      default:
        console.log("Unsupported frame rate", frameRate);
        break;
    }
    return seg;
  }

  syncAudioToStreamIdValue() {
    let sync_id = -1;
    let videoStream = this.getStreamDataForCodecType("video");
    switch (this.probeKind()) {
      case "udp":
        sync_id = videoStream.stream_id;
        break;
      case "rtmp":
        sync_id = -1; // Pending fabric API: videoStream.stream_index
        break;
    }
    return sync_id;
  }

  generateLiveConf() {
    // gather required data
    var conf = LiveconfTemplate;
    var fileName = this.overwriteOriginUrl || this.probeData.format.filename;
    var audioStream = this.getStreamDataForCodecType("audio");
    var sampleRate = parseInt(audioStream.sample_rate);
    var videoStream = this.getStreamDataForCodecType("video");
    var sourceTimescale;

    console.log("AUDIO", audioStream);
    console.log("VIDEO", videoStream);

    // Fill in liveconf all formats have in common
    conf.live_recording.fabric_config.ingress_node_api = this.nodeUrl || null;
    conf.live_recording.fabric_config.ingress_node_id = this.nodeId || null;
    conf.live_recording.recording_config.recording_params.description;
    conf.live_recording.recording_config.recording_params.origin_url = fileName;
    conf.live_recording.recording_config.recording_params.description = `Ingest stream ${fileName}`;
    conf.live_recording.recording_config.recording_params.name = `Ingest stream ${fileName}`;
    conf.live_recording.recording_config.recording_params.xc_params.audio_index[0] = audioStream.stream_index;
    conf.live_recording.recording_config.recording_params.xc_params.sample_rate = sampleRate;
    conf.live_recording.recording_config.recording_params.xc_params.enc_height = videoStream.height;
    conf.live_recording.recording_config.recording_params.xc_params.enc_width = videoStream.width;

    if (this.syncAudioToVideo) {
      conf.live_recording.recording_config.recording_params.xc_params.sync_audio_to_stream_id = this.syncAudioToStreamIdValue();
    }

    // Fill in specifics for protocol
    switch (this.probeKind()) {
      case "udp":
        sourceTimescale = 90000;
        conf.live_recording.recording_config.recording_params.source_timescale = sourceTimescale;
        break;
      case "rtmp":
        sourceTimescale = 16000;
        conf.live_recording.recording_config.recording_params.source_timescale = sourceTimescale;
        break;
      case "hls":
        console.log("HLS detected. Not yet implemented");
        break;
      default:
        console.log("Unsuppoted media", this.probeKind());
        break;
    }

    var segDurations = this.calcSegDuration({sourceTimescale});

    // Segment conditioning parameters
    conf.live_recording.recording_config.recording_params.xc_params.seg_duration = segDurations.duration;
    conf.live_recording.recording_config.recording_params.xc_params.audio_seg_duration_ts = segDurations.audio;
    conf.live_recording.recording_config.recording_params.xc_params.video_seg_duration_ts = segDurations.video;
    conf.live_recording.recording_config.recording_params.xc_params.force_keyint = segDurations.keyint;

    switch (videoStream.height) {
      case 2160:
        conf.live_recording.recording_config.recording_params.ladder_specs.unshift(
          LadderTemplate[2160],
          LadderTemplate[1080],
          LadderTemplate[720],
          LadderTemplate[540],
          LadderTemplate["540_low"]
        );
        conf.live_recording.recording_config.recording_params.xc_params.video_bitrate = LadderTemplate[2160].bit_rate;
        conf.live_recording.recording_config.recording_params.xc_params.enc_height = 2160;
        conf.live_recording.recording_config.recording_params.xc_params.enc_width = 3840;

        break;
      case 1080:
        conf.live_recording.recording_config.recording_params.ladder_specs.unshift(
          LadderTemplate[1080],
          LadderTemplate[720],
          LadderTemplate[540],
          LadderTemplate["540_low"]
        );
        conf.live_recording.recording_config.recording_params.xc_params.video_bitrate = LadderTemplate[1080].bit_rate;
        conf.live_recording.recording_config.recording_params.xc_params.enc_height = 1080;
        conf.live_recording.recording_config.recording_params.xc_params.enc_width = 1920;
        break;
      case 720:
        conf.live_recording.recording_config.recording_params.ladder_specs.unshift(
          LadderTemplate[720],
          LadderTemplate[540],
          LadderTemplate["540_low"]
        );
        conf.live_recording.recording_config.recording_params.xc_params.video_bitrate = LadderTemplate[720].bit_rate;
        conf.live_recording.recording_config.recording_params.xc_params.enc_height = 720;
        conf.live_recording.recording_config.recording_params.xc_params.enc_width = 1280;
        break;
      case 540:
        conf.live_recording.recording_config.recording_params.ladder_specs.unshift(
          LadderTemplate[540],
          LadderTemplate["540_low"]
        );
        conf.live_recording.recording_config.recording_params.xc_params.video_bitrate = LadderTemplate[540].bit_rate;
        conf.live_recording.recording_config.recording_params.xc_params.enc_height = 540;
        conf.live_recording.recording_config.recording_params.xc_params.enc_width = 960;
        break;
      default:
        throw new Error("ERROR: Probed stream does not conform to one of the following built in resolution ladders [4096, 2160], [1920, 1080] [1280, 720], [960, 540]");
    }

    return JSON.stringify(conf, null, 2);
  }
}
module.exports = { LiveConf };