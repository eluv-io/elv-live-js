module.exports = {
  live_recording: {
    fabric_config: {
      ingress_node_api: "",
      ingress_node_id: ""
    },
    playout_config: {
      rebroadcast_start_time_sec_epoch: 0,
      vod_enabled: false
    },
    recording_config: {
      recording_params: {
        description: "",
        ladder_specs: [
          {
            bit_rate: 14000000,
            codecs: "avc1.640028,mp4a.40.2",
            height: 2160,
            media_type: 1,
            representation: "2160@14000000",
            stream_name: "video",
            width: 3840
          },
          {
            bit_rate: 9500000,
            codecs: "avc1.640028,mp4a.40.2",
            height: 1080,
            media_type: 1,
            representation: "1080@9500000",
            stream_name: "video",
            width: 1920
          },
          {
            bit_rate: 4500000,
            codecs: "avc1.640028,mp4a.40.2",
            height: 720,
            media_type: 1,
            representation: "720@4500000",
            stream_name: "video",
            width: 1280
          },
          {
            bit_rate: 520000,
            codecs: "avc1.640028,mp4a.40.2",
            height: 360,
            media_type: 1,
            representation: "360@520000",
            stream_name: "video",
            width: 640
          },
          {
            bit_rate: 128000,
            channels: 2,
            codecs: "mp4a.40.2",
            media_type: 2,
            representation: "stereo@128000",
            stream_name: "audio"
          }
        ],
        listen: true,
        live_delay_nano: 2000000000,
        max_duration_sec: -1,
        name: "",
        origin_url: "",
        part_ttl: 2592000,
        playout_type: "live",
        source_timescale: null,
        xc_params: {
          audio_bitrate: 128000,
          audio_index: [
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0
          ],
          audio_seg_duration_ts: null,
          ecodec: "libx264",
          ecodec2: "aac",
          enc_height: 2160,
          enc_width: 3840,
          filter_descriptor: "",
          force_keyint: null,
          format: "fmp4-segment",
          listen: true,
          n_audio: 1,
          preset: "faster",
          sample_rate: 48000,
          seg_duration: null,
          skip_decoding: false,
          start_segment_str: "1",
          stream_id: -1,
          sync_audio_to_stream_id: -1,
          video_bitrate: null,
          video_seg_duration_ts: null,
          xc_type: 3
        }
      }
    }
  }
};