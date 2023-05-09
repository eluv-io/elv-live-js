const liveconfTemplate = require("./LiveRecordingTemplate");
class LiveRecording {
  constructor(probeData, nodeId, nodeUrl, calcAvSegDurations, overwriteOriginUrl) {
    this.probeData = probeData;
    this.nodeId = nodeId;
    this.nodeUrl = nodeUrl;
    this.calcAvSegDurations = calcAvSegDurations;
    this.overwriteOriginUrl = overwriteOriginUrl;
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

  isFrameRateWhole() {
    let videoStream = this.getStreamDataForCodecType("video");
    let frameRate = videoStream.r_frame_rate.split("/");
    return frameRate[1] == "1";
  }

  getForceKeyint() {
    let videoStream = this.getStreamDataForCodecType("video");
    let frameRate = videoStream.r_frame_rate.split("/");
    let roundedFrameRate = Math.round(frameRate[0] / frameRate[1]);
    if (roundedFrameRate > 30) {
      return roundedFrameRate;
    } else {
      return roundedFrameRate * 2;
    }
  }

  calcSegDuration() {
    // I've only seen these two values. Herd coded for now...
    if (this.isFrameRateWhole()) {
      return "30";
    }
    return "30.03";
  }

  generateLiveConf() {
    // gather required data
    var conf = liveconfTemplate;
    var fileName = this.overwriteOriginUrl || this.probeData.format.filename;
    var audioStream = this.getStreamDataForCodecType("audio");
    var sampleRate = parseInt(audioStream.sample_rate);
    var segDuration = this.calcSegDuration();
    var videoStream = this.getStreamDataForCodecType("video");
    var sourceTimescale;
    
    // Fill in liveconf all formats have in common
    conf.live_recording.fabric_config.ingress_node_api = this.nodeUrl || null;
    conf.live_recording.fabric_config.ingress_node_id = this.nodeId || null;
    conf.live_recording.recording_config.recording_params.description;
    conf.live_recording.recording_config.recording_params.origin_url = fileName;
    conf.live_recording.recording_config.recording_params.description = `Ingest stream ${fileName}`;
    conf.live_recording.recording_config.recording_params.name = `Ingest stream ${fileName}`;
    conf.live_recording.recording_config.recording_params.xc_params.audio_index[0] = audioStream.index;
    conf.live_recording.recording_config.recording_params.xc_params.force_keyint = this.getForceKeyint();
    conf.live_recording.recording_config.recording_params.xc_params.sample_rate = sampleRate;
    conf.live_recording.recording_config.recording_params.xc_params.seg_duration = segDuration;
    conf.live_recording.recording_config.recording_params.xc_params.enc_height = videoStream.height;
    conf.live_recording.recording_config.recording_params.xc_params.enc_width = videoStream.width;

    // Fill in specifics for protocol
    switch (this.probeKind()) {
      case "udp":
        sourceTimescale = 90000;
        conf.live_recording.recording_config.recording_params.source_timescale = sourceTimescale;
        break;
      case "rtmp":
        sourceTimescale = 16000;
        conf.live_recording.recording_config.recording_params.source_timescale = sourceTimescale;
        conf.live_recording.recording_config.recording_params.xc_params.video_bitrate = parseInt(videoStream.bit_rate);
        break;
      case "hls":
        console.log("HLS detected. Not yet implemented");
        break;
      default:
        console.log("Something we do not support detected.");
        break;
    }

    // Fill in AV segdurations if specified. 
    if (this.calcAvSegDurations) {
      conf.live_recording.recording_config.recording_params.xc_params.audio_seg_duration_ts = segDuration * sampleRate;
      conf.live_recording.recording_config.recording_params.xc_params.video_seg_duration_ts = segDuration * sourceTimescale;
    } else {
      delete conf.live_recording.recording_config.recording_params.xc_params.audio_seg_duration_ts;
      delete conf.live_recording.recording_config.recording_params.xc_params.video_seg_duration_ts;
    }

    return JSON.stringify(conf, null, 2);
  }
}
module.exports = { LiveRecording };