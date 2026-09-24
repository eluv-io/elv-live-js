const O = require("./LiveOfferings.js");

const LEGACY = require("../test/testdata/live_offerings_legacy.json");
const ENABLED = require("../test/testdata/live_offerings_enabled.json");

const LADDER = LEGACY.live_recording.recording_config.recording_params.ladder_specs;
const ladder = () => O.SourceStreams(LADDER);

const legacyOfferings = () => O.Clone(LEGACY.offerings);
const enabledOfferings = () => O.Clone(ENABLED.offerings);
const enabledOffering = (key) => O.Clone(ENABLED.offerings[key]);

const codes = (findings) => findings.map((f) => f.code);

describe("SourceStreams", () => {
  test("groups rungs by stream_name, first rung wins", () => {
    const l = ladder();
    expect(l.audio.map((s) => s.stream_name)).toEqual(["audio_1", "audio_2", "audio_3", "audio_4"]);
    // Four video rungs all named "video" collapse to one source stream.
    expect(l.video.map((s) => s.stream_name)).toEqual(["video"]);
    expect(l.byName.audio_1.stream_label).toBe("Audio 1");
    expect(l.byName.audio_1.default).toBe(true);
  });

  test("two rungs sharing an audio stream_name yield one source stream", () => {
    const specs = O.Clone(LADDER).concat([
      {media_type: 2, stream_name: "audio_1", bit_rate: 64000, representation: "audioaudio_aac@64000"}
    ]);
    expect(O.SourceStreams(specs).audio.map((s) => s.stream_name)).toEqual([
      "audio_1", "audio_2", "audio_3", "audio_4"
    ]);
  });
});

describe("OfferingType", () => {
  test.each([
    ["avtest_live", "offerings"],
    [null, "ladder_specs"],
    [undefined, "ladder_specs"],
    ["something_else", "unknown"]
  ])("play_mode %p -> %s", (playMode, expected) => {
    expect(O.OfferingType({play_mode: playMode})).toBe(expected);
  });
});

describe("EnableOfferings", () => {
  test("golden transform reproduces the hand-edited offering", () => {
    const {offerings, changes} = O.EnableOfferings({offerings: legacyOfferings(), ladderSpecs: LADDER});

    expect(changes).toEqual([
      {offering: "default", action: "converted", added_tracks: ["audio_1", "audio_2", "audio_3", "audio_4"], removed_tracks: ["audio"]}
    ]);
    expect(offerings.default.play_mode).toBe(O.OFFERINGS_PLAY_MODE);

    const got = offerings.default.playout.streams;
    const want = ENABLED.offerings.default.playout.streams;
    expect(Object.keys(got).sort()).toEqual(["audio_1", "audio_2", "audio_3", "audio_4", "video"]);

    // Byte-identical to the hand edit apart from the two documented deltas:
    // labels derive from the rung's stream_label, and the ladder's default
    // rung propagates to default_for_media_type.
    const normalize = (streams) => {
      const s = O.Clone(streams);
      Object.keys(s).forEach((k) => {
        delete s[k].label;
        delete s[k].default_for_media_type;
      });
      return s;
    };
    expect(normalize(got)).toEqual(normalize(want));

    expect(got.audio_1.label).toBe("Audio 1");
    expect(got.audio_4.label).toBe("Audio 4");
    expect(got.audio_1.default_for_media_type).toBe(true);
    expect(got.audio_2.default_for_media_type).toBeUndefined();

    // Fields outside playout.streams are untouched.
    expect(offerings.default.offer_as_live).toBe(false);
    expect(offerings.default.drm_optional).toBe(false);
    expect(offerings.default.mez_prep_specs).toEqual(LEGACY.offerings.default.mez_prep_specs);
  });

  test("every emitted track is a distinct clone", () => {
    const {offerings} = O.EnableOfferings({offerings: legacyOfferings(), ladderSpecs: LADDER});
    const streams = offerings.default.playout.streams;
    expect(["audio_1", "audio_2", "audio_3", "audio_4"].map((k) => O.TrackSourceStream(streams[k])))
      .toEqual(["audio_1", "audio_2", "audio_3", "audio_4"]);
    // Aliasing instead of deep-copying would make these the same object.
    expect(streams.audio_1.representations).not.toBe(streams.audio_2.representations);
  });

  test("keeps every representation of a multi-representation audio template", () => {
    const src = legacyOfferings();
    const reps = src.default.playout.streams.audio.representations;
    reps["audioaudio_aac@64000"] = {...O.Clone(Object.values(reps)[0]), bit_rate: 64000};

    const {offerings} = O.EnableOfferings({offerings: src, ladderSpecs: LADDER});
    ["audio_1", "audio_2", "audio_3", "audio_4"].forEach((k) => {
      const track = offerings.default.playout.streams[k];
      expect(Object.keys(track.representations).sort()).toEqual([
        "audioaudio_aac@128000", "audioaudio_aac@64000"
      ]);
      expect(O.TrackSourceStream(track)).toBe(k);
    });
  });

  test("is idempotent", () => {
    const once = O.EnableOfferings({offerings: legacyOfferings(), ladderSpecs: LADDER}).offerings;
    const twice = O.EnableOfferings({offerings: O.Clone(once), ladderSpecs: LADDER});
    expect(twice.offerings).toEqual(once);
    expect(twice.changes).toEqual([{offering: "default", action: "skipped", reason: "already offerings-based"}]);
  });

  test("leaves already-converted offerings untouched", () => {
    const input = enabledOfferings();
    const {offerings, changes} = O.EnableOfferings({offerings: O.Clone(input), ladderSpecs: LADDER});
    expect(offerings).toEqual(input);
    expect(changes.every((c) => c.action === "skipped")).toBe(true);
  });

  test("refuses a multi-video ladder", () => {
    const specs = O.Clone(LADDER).concat([{media_type: 1, stream_name: "video_2", bit_rate: 100, width: 1, height: 1}]);
    expect(() => O.EnableOfferings({offerings: legacyOfferings(), ladderSpecs: specs}))
      .toThrow(/multi-video ladder/);
  });

  test("refuses when there is no audio track to use as a template", () => {
    const src = legacyOfferings();
    delete src.default.playout.streams.audio;
    expect(() => O.EnableOfferings({offerings: src, ladderSpecs: LADDER}))
      .toThrow(/expected exactly one/);
  });
});

describe("ValidateOffering", () => {
  const validate = (offering) => O.ValidateOffering({offering, ladder: ladder()});

  const mutate = (fn, key = "default") => {
    const offering = enabledOffering(key);
    fn(offering, O.Tracks(offering));
    return offering;
  };

  test("every known-good offering is valid", () => {
    Object.keys(ENABLED.offerings).forEach((key) => {
      const result = validate(enabledOffering(key));
      expect({key, valid: result.valid, errors: codes(result.errors)}).toEqual({key, valid: true, errors: []});
    });
  });

  test("the legacy offering is valid and typed ladder_specs", () => {
    const result = validate(O.Clone(LEGACY.offerings.default));
    expect(result.type).toBe("ladder_specs");
    expect(result.valid).toBe(true);
  });

  test.each([
    ["audio mss names an unrecorded source stream", "E_MSS_NOT_IN_LADDER",
      (o, t) => { Object.values(t.audio_1.representations).forEach((r) => { r.media_struct_stream_key = "audio_9"; }); }],
    ["video mss names an unrecorded source stream", "E_MSS_NOT_IN_LADDER",
      (o, t) => { Object.values(t.video.representations).forEach((r) => { r.media_struct_stream_key = "video_0"; }); }],
    ["representations of one track disagree", "E_MIXED_MSS",
      (o, t) => { Object.values(t.video.representations)[0].media_struct_stream_key = "audio_2"; }],
    ["a track has no representations", "E_NO_REPS",
      (o, t) => { t.audio_1.representations = {}; }],
    ["the offering presents no tracks", "E_NO_TRACKS",
      (o) => { o.playout.streams = {}; }],
    ["a format needs a scheme a track lacks", "E_DRM_SCHEME_UNAVAILABLE",
      (o, t) => { delete t.audio_1.encryption_schemes.cenc; }],
    ["audio codecs are mixed", "E_MIXED_AUDIO_CODEC",
      (o, t) => { Object.values(t.audio_2.representations).forEach((r) => { r.codec = "ac-3"; }); }],
    ["representation types are mixed within a track", "E_MIXED_REP_TYPE",
      (o, t) => { Object.values(t.video.representations)[0].type = "RepAudio"; }],
    ["a track key is not URL-safe", "E_BAD_TRACK_KEY",
      (o, t) => { t["audio/1"] = t.audio_1; delete t.audio_1; }],
    ["a representation has no bit_rate", "E_BAD_BITRATE",
      (o, t) => { Object.values(t.audio_1.representations)[0].bit_rate = 0; }],
    ["a video representation has no dimensions", "E_BAD_DIMENSIONS",
      (o, t) => { Object.values(t.video.representations)[0].width = 0; }],
    ["an audio track points at a video source stream", "E_MEDIA_TYPE_MISMATCH",
      (o, t) => { Object.values(t.audio_1.representations).forEach((r) => { r.media_struct_stream_key = "video"; }); }]
  ])("%s -> %s", (_name, code, fn) => {
    const result = validate(mutate(fn));
    expect(codes(result.errors)).toContain(code);
    expect(result.valid).toBe(false);
  });

  test("an unknown play_mode is reported, not validated", () => {
    const result = validate(mutate((o) => { o.play_mode = "something_else"; }));
    expect(result.type).toBe("unknown");
    expect(codes(result.errors)).toEqual(["E_UNKNOWN_PLAY_MODE"]);
  });

  test("a bit_rate matching no rung is VALID - the ladder is not the authority", () => {
    const result = validate(mutate((o, t) => { Object.values(t.audio_1.representations)[0].bit_rate = 999999; }));
    expect(result.valid).toBe(true);
    expect(codes(result.warnings)).toContain("W_BITRATE_DIVERGES");
  });

  test("a legacy offering with a non-generic track key is invalid", () => {
    const offering = O.Clone(LEGACY.offerings.default);
    offering.playout.streams.audio_1 = offering.playout.streams.audio;
    delete offering.playout.streams.audio;
    expect(codes(validate(offering).errors)).toContain("E_LEGACY_TRACK_KEY");
  });

  test("DASH formats warn only when the audio track key is not literally 'audio'", () => {
    expect(codes(validate(enabledOffering("default")).warnings)).toContain("W_DASH_AUDIO_KEY");
    // one_rung keys its audio track "audio", which is what deployed DASH expects.
    expect(codes(validate(enabledOffering("one_rung")).warnings)).not.toContain("W_DASH_AUDIO_KEY");
    // clear carries no DASH formats at all.
    expect(codes(validate(enabledOffering("clear")).warnings)).not.toContain("W_DASH_AUDIO_KEY");
  });
});

describe("DescribeOfferings", () => {
  test("reports E_NO_LADDER without a per-offering cascade", () => {
    const body = O.DescribeOfferings({offerings: enabledOfferings(), ladderSpecs: []});
    expect(body.valid).toBe(false);
    expect(codes(body.errors)).toEqual(["E_NO_LADDER"]);
    expect(body.offerings).toEqual({});
  });

  test("an object with no offerings still reports its source streams", () => {
    const body = O.DescribeOfferings({offerings: undefined, ladderSpecs: LADDER});
    expect(body.valid).toBe(true);
    expect(body.offerings).toEqual({});
    expect(body.source_streams.audio.map((s) => s.stream_name)).toEqual([
      "audio_1", "audio_2", "audio_3", "audio_4"
    ]);
  });

  test("describes each offering with type, validity, tracks and selection", () => {
    const body = O.DescribeOfferings({offerings: enabledOfferings(), ladderSpecs: LADDER});
    expect(body.valid).toBe(true);
    expect(Object.keys(body.offerings).sort()).toEqual(["audio_only", "clear", "default", "one_rung"]);

    const oneRung = body.offerings.one_rung;
    expect(oneRung.type).toBe("offerings");
    // The track key and the source stream it presents are independent.
    expect(oneRung.tracks.audio.media_struct_stream_key).toBe("audio_4");
    expect(oneRung.selection.tracks.audio).toEqual(["audioaudio_aac@128000"]);
  });
});

describe("FilterOffering", () => {
  test("an empty selection is the identity", () => {
    Object.keys(ENABLED.offerings).forEach((key) => {
      expect(O.FilterOffering({baseOffering: enabledOffering(key)})).toEqual(ENABLED.offerings[key]);
    });
  });

  test("round-trips through ExtractSelection", () => {
    Object.keys(ENABLED.offerings).forEach((key) => {
      const offering = enabledOffering(key);
      const selection = O.ExtractSelection({offering});
      expect(O.FilterOffering({baseOffering: offering, selection})).toEqual(ENABLED.offerings[key]);
    });
  });

  test("excluding a track drops exactly that track", () => {
    const result = O.FilterOffering({
      baseOffering: enabledOffering("default"),
      selection: {tracks: {audio_3: null, video: null}}
    });
    expect(Object.keys(O.Tracks(result)).sort()).toEqual(["audio_3", "video"]);
    expect(O.Tracks(result).audio_3).toEqual(ENABLED.offerings.default.playout.streams.audio_3);
  });

  test("excluding representations leaves the rest of the track identical", () => {
    const base = enabledOffering("default");
    const keep = "videovideo_1920x1080_h264@9500000";
    const result = O.FilterOffering({baseOffering: base, selection: {tracks: {video: [keep]}}});
    expect(Object.keys(O.Tracks(result).video.representations)).toEqual([keep]);
    expect(O.Tracks(result).video.encryption_schemes)
      .toEqual(ENABLED.offerings.default.playout.streams.video.encryption_schemes);
  });

  test("excluding formats leaves drm_keys whole", () => {
    const result = O.FilterOffering({
      baseOffering: enabledOffering("default"),
      selection: {formats: ["hls-aes128"]}
    });
    expect(Object.keys(result.playout.playout_formats)).toEqual(["hls-aes128"]);
    expect(result.playout.drm_keys).toEqual(ENABLED.offerings.default.playout.drm_keys);
  });

  test("default_audio_key moves the default and clears the others", () => {
    const base = enabledOffering("default");
    O.Tracks(base).audio_1.default_for_media_type = true;
    const result = O.FilterOffering({baseOffering: base, selection: {default_audio_key: "audio_3"}});
    expect(O.Tracks(result).audio_3.default_for_media_type).toBe(true);
    expect(O.Tracks(result).audio_1.default_for_media_type).toBeUndefined();
  });

  test.each([
    ["a missing track", {tracks: {nope: null}}, /track "nope" not found/],
    ["a missing representation", {tracks: {audio_1: ["nope"]}}, /representation "nope" not found/],
    ["a missing format", {formats: ["nope"]}, /playout format "nope" not found/],
    ["a filtered-out default_audio_key", {tracks: {video: null}, default_audio_key: "audio_1"}, /does not name a track kept/],
    ["a video default_audio_key", {default_audio_key: "video"}, /names a video track/]
  ])("rejects %s", (_name, selection, message) => {
    expect(() => O.FilterOffering({baseOffering: enabledOffering("default"), selection})).toThrow(message);
  });
});
