const O = require("./LiveOfferings.js");

const LEGACY = require("../test/testdata/live_offerings_legacy.json");
const ENABLED = require("../test/testdata/live_offerings_enabled.json");
const MULTILANG = require("../test/testdata/live_offerings_legacy_multilang.json");
const MULTILANG_ENABLED = require("../test/testdata/live_offerings_enabled_multilang.json");

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

    // The hand edit is evidence for track-level policy only, and no further:
    // it was edited from a cloned offering, so it inherited the same
    // representations this conversion now rebuilds from ladder_specs.
    // Representations are checked against the ladder instead - see
    // "representations are generated from ladder_specs" below.
    Object.keys(want).forEach((trackKey) => {
      expect(O.TrackSourceStream(got[trackKey])).toBe(O.TrackSourceStream(want[trackKey]));
      expect(got[trackKey].encryption_schemes).toEqual(want[trackKey].encryption_schemes);
    });

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

  test("an audio source stream with two rungs yields one track with two representations", () => {
    // The rungs determine the representations, so an audio ABR pair on one
    // source stream stays one track. The template's own representations are
    // not consulted at all.
    const specs = O.Clone(LADDER).concat([{
      media_type: 2, stream_name: "audio_1", stream_label: "Audio 1",
      representation: "audioaudio_aac@64000", bit_rate: 64000, codecs: "mp4a.40.2"
    }]);

    const {offerings} = O.EnableOfferings({offerings: legacyOfferings(), ladderSpecs: specs});
    const track = offerings.default.playout.streams.audio_1;
    expect(Object.keys(track.representations).sort()).toEqual([
      "audioaudio_aac@192000", "audioaudio_aac@64000"
    ]);
    expect(O.TrackSourceStream(track)).toBe("audio_1");
    expect(Object.keys(offerings.default.playout.streams).sort()).toEqual([
      "audio_1", "audio_2", "audio_3", "audio_4", "video"
    ]);
  });

  test("skips audio source streams with no stream_label", () => {
    // An empty stream_label is how the ladder encodes "recorded but not for
    // playout" (LiveConf sets playoutLabel only when playout: true, and the
    // fabric's ShouldBeAdvertised() drops such a rung from the master playlist).
    const specs = O.Clone(LADDER);
    specs.find((r) => r.stream_name === "audio_3").stream_label = "";

    const {offerings, changes} = O.EnableOfferings({offerings: legacyOfferings(), ladderSpecs: specs});
    const streams = offerings.default.playout.streams;

    expect(Object.keys(streams).sort()).toEqual(["audio_1", "audio_2", "audio_4", "video"]);
    expect(changes[0].added_tracks).toEqual(["audio_1", "audio_2", "audio_4"]);
    expect(changes[0].skipped_source_streams).toEqual(["audio_3"]);
    expect(changes[0].skipped_reason).toMatch(/not marked for playout/);
  });

  test("video rungs are never skipped for lacking a stream_label", () => {
    // ShouldBeAdvertised() gates only audio on the label; video rungs carry
    // none and are always advertised.
    const l = ladder();
    expect(l.video.every((s) => s.stream_label === "")).toBe(true);
    const {offerings} = O.EnableOfferings({offerings: legacyOfferings(), ladderSpecs: LADDER});
    expect(offerings.default.playout.streams.video).toBeDefined();
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

describe("EnableOfferings on the multilang legacy fixture", () => {
  // A second, independently recorded legacy object: five audio source streams
  // across four languages (one of them empty), a 192000 ladder, and DASH
  // formats on the offering. The rugby pair covers a four-audio object whose
  // converted form was hand-edited; this one covers the shapes that pair lacks.
  const specs = MULTILANG.live_recording.recording_config.recording_params.ladder_specs;
  const convert = () =>
    O.EnableOfferings({offerings: O.Clone(MULTILANG.offerings), ladderSpecs: specs});

  test("the fixture is legacy before conversion", () => {
    expect(O.OfferingType(MULTILANG.offerings.default)).toBe("ladder_specs");
    expect(Object.keys(MULTILANG.offerings.default.playout.streams).sort()).toEqual(["audio", "video"]);
  });

  test("emits one track per audio source stream plus video", () => {
    const {offerings, changes} = convert();
    const streams = offerings.default.playout.streams;

    expect(Object.keys(streams).sort()).toEqual([
      "audio_1", "audio_2", "audio_3", "audio_4", "audio_5", "video"
    ]);
    expect(changes).toEqual([{
      offering: "default",
      action: "converted",
      added_tracks: ["audio_1", "audio_2", "audio_3", "audio_4", "audio_5"],
      removed_tracks: ["audio"]
    }]);
    expect(Object.keys(streams).map((k) => O.TrackSourceStream(streams[k])).sort()).toEqual([
      "audio_1", "audio_2", "audio_3", "audio_4", "audio_5", "video"
    ]);
  });

  test("an empty lang does not suppress a track", () => {
    // audio_5 is recorded with lang "" but a non-empty stream_label, so it is
    // advertised. The skip rule keys on the label, which is what the fabric's
    // ShouldBeAdvertised() reads — never on lang.
    expect(specs.find((r) => r.stream_name === "audio_5").lang).toBe("");
    expect(convert().offerings.default.playout.streams.audio_5).toBeDefined();
  });

  test("labels and the default come from the ladder", () => {
    const streams = convert().offerings.default.playout.streams;
    expect(["audio_1", "audio_2", "audio_3", "audio_4", "audio_5"].map((k) => streams[k].label))
      .toEqual(["Audio 1", "Audio 2", "Audio 3", "Audio 4", "Audio 5"]);
    expect(streams.audio_1.default_for_media_type).toBe(true);
    expect(["audio_2", "audio_3", "audio_4", "audio_5"]
      .every((k) => streams[k].default_for_media_type === undefined)).toBe(true);
  });

  test("the converted offering is valid, with DASH the only structural caveat", () => {
    const body = O.DescribeOfferings({offerings: convert().offerings, ladderSpecs: specs});
    expect(body.offerings.default.type).toBe("offerings");
    expect(body.offerings.default.errors).toEqual([]);
    expect(body.offerings.default.valid).toBe(true);
    // The offering carries dash-* formats against non-generic audio track keys.
    expect(codes(body.offerings.default.warnings)).toContain("W_DASH_AUDIO_KEY");
  });

  test("is idempotent", () => {
    const once = convert().offerings;
    expect(O.EnableOfferings({offerings: O.Clone(once), ladderSpecs: specs}).offerings).toEqual(once);
  });
});

describe("representations are generated from ladder_specs", () => {
  // ladder_specs and the base offering's representations are two independent
  // playout ladders - resolveMeta serves whichever one play_mode selects - and
  // create() builds the offering's from a fabricated production master rather
  // than from this object's ladder. Converting by cloning therefore switches
  // the object to a ladder nobody configured. Generating from ladder_specs is
  // what makes conversion observationally neutral.
  const cases = [
    ["rugby", LEGACY],
    ["multilang", MULTILANG]
  ];

  const convert = (fixture) => O.EnableOfferings({
    offerings: O.Clone(fixture.offerings),
    ladderSpecs: fixture.live_recording.recording_config.recording_params.ladder_specs
  }).offerings.default.playout.streams;

  // Every playout URL the legacy master playlist advertises is
  // "{rung.stream_name}/{rung.representation}/", and the offerings playlist
  // emits "{trackKey}/{repKey}/". Conversion keys tracks by stream_name, so
  // asserting the two sets are equal is asserting that no URL is invented and,
  // more importantly, that none is retired.
  test.each(cases)("%s: playout URLs are exactly the ladder's", (_name, fixture) => {
    const specs = fixture.live_recording.recording_config.recording_params.ladder_specs;
    const streams = convert(fixture);

    const advertised = new Set();
    Object.keys(streams).forEach((trackKey) => {
      Object.keys(streams[trackKey].representations).forEach((repKey) => {
        advertised.add(`${trackKey}/${repKey}`);
      });
    });
    const fromLadder = new Set(specs.map((r) => `${r.stream_name}/${r.representation}`));

    expect([...advertised].sort()).toEqual([...fromLadder].sort());
  });

  test("the video ladder is the recorded one, not the fabricated one", () => {
    // Regression guard with a name: cloning advertised six video rungs, three
    // of which the ladder never asked for, and dropped 960x540@900000, which
    // it did.
    const before = Object.keys(LEGACY.offerings.default.playout.streams.video.representations);
    expect(before).toHaveLength(6);
    expect(before).not.toContain("videovideo_960x540_h264@900000");

    const after = Object.keys(convert(LEGACY).video.representations).sort();
    expect(after).toEqual([
      "videovideo_1280x720_h264@4500000",
      "videovideo_1920x1080_h264@9500000",
      "videovideo_960x540_h264@2000000",
      "videovideo_960x540_h264@900000"
    ]);
  });

  test("representation fields come from the rung", () => {
    const streams = convert(MULTILANG);
    expect(streams.audio_3.representations["audioaudio_aac@192000"]).toEqual({
      bit_rate: 192000,
      codec: "aac",
      codec_desc: "mp4a.40.2",
      media_struct_stream_key: "audio_3",
      transcode_matches_rep: false,
      type: "RepAudio"
    });
    expect(streams.video.representations["videovideo_960x540_h264@2000000"]).toEqual({
      bit_rate: 2000000,
      codec: "h264",
      codec_desc: "avc1.640028",
      height: 540,
      media_struct_stream_key: "video",
      transcode_matches_rep: false,
      type: "RepVideo",
      width: 960
    });
  });

  test("a video codec_desc never carries the audio codec too", () => {
    // The offerings playlist builder appends the audio codec itself, so a
    // combined codec_desc would emit it twice. The rungs are combined -
    // "avc1.640028,mp4a.40.2" - because that is the HLS CODECS attribute of a
    // variant stream.
    const specs = MULTILANG.live_recording.recording_config.recording_params.ladder_specs;
    expect(specs.filter((r) => r.media_type === 1).every((r) => r.codecs.includes(","))).toBe(true);

    const reps = Object.values(convert(MULTILANG).video.representations);
    expect(reps.every((rep) => !rep.codec_desc.includes(","))).toBe(true);
  });

  test("transcode_matches_rep marks the top video rung and nothing else", () => {
    const streams = convert(MULTILANG);
    const video = streams.video.representations;
    expect(video["videovideo_1920x1080_h264@9500000"].transcode_matches_rep).toBe(true);
    expect(Object.values(video).filter((r) => r.transcode_matches_rep)).toHaveLength(1);
    // Audio is always false: the recorded audio is none of these rungs.
    expect(["audio_1", "audio_2", "audio_3", "audio_4", "audio_5"].every((k) =>
      Object.values(streams[k].representations).every((r) => r.transcode_matches_rep === false)
    )).toBe(true);
  });

  test.each([
    ["avc1.640028,mp4a.40.2", "h264"],
    ["hev1.2.4.L150.90", "h265"],
    ["hvc1.2.4.L150.90", "h265"],
    ["mp4a.40.2", "aac"],
    ["ec-3", "eac3"],
    ["ac-3", "ac3"],
    ["ac-4.02.01.01", "ac4"]
  ])("codecs %p maps to codec %p", (codecs, expected) => {
    const specs = O.Clone(MULTILANG.live_recording.recording_config.recording_params.ladder_specs);
    specs.find((r) => r.stream_name === "audio_2").codecs = codecs;
    const {offerings} = O.EnableOfferings({offerings: O.Clone(MULTILANG.offerings), ladderSpecs: specs});
    expect(Object.values(offerings.default.playout.streams.audio_2.representations)[0].codec)
      .toBe(expected);
  });

  test("a rung with no codecs is its own error", () => {
    // A user-supplied playout_config.ladder_specs is used verbatim as the
    // ladder profile (LiveConf.js:583), so a rung can reach us without codecs.
    // Missing is not the same as unmapped and must not be reported as such.
    const specs = O.Clone(MULTILANG.live_recording.recording_config.recording_params.ladder_specs);
    delete specs.find((r) => r.stream_name === "audio_2").codecs;
    expect(() => O.EnableOfferings({offerings: O.Clone(MULTILANG.offerings), ladderSpecs: specs}))
      .toThrow(/audio_2.*no codecs/);
  });

  test("an unmapped codec is an error, not a guess", () => {
    const specs = O.Clone(MULTILANG.live_recording.recording_config.recording_params.ladder_specs);
    specs.find((r) => r.stream_name === "audio_2").codecs = "opus";
    expect(() => O.EnableOfferings({offerings: O.Clone(MULTILANG.offerings), ladderSpecs: specs}))
      .toThrow(/audio_2.*"opus"/);
  });

  test("a converted offering no longer diverges from the ladder", () => {
    // W_BITRATE_DIVERGES stays in the RULES table - it still catches a
    // hand-authored offering, and every object converted by the earlier
    // cloning implementation, which enable_offerings will never revisit. What
    // changes is that conversion stops producing the condition itself.
    const specs = MULTILANG.live_recording.recording_config.recording_params.ladder_specs;
    const {offerings} = O.EnableOfferings({offerings: O.Clone(MULTILANG.offerings), ladderSpecs: specs});
    const body = O.DescribeOfferings({offerings, ladderSpecs: specs});
    expect(codes(body.offerings.default.warnings)).not.toContain("W_BITRATE_DIVERGES");

    const diverged = O.Clone(offerings);
    Object.values(diverged.default.playout.streams.audio_1.representations)[0].bit_rate = 128000;
    expect(codes(O.DescribeOfferings({offerings: diverged, ladderSpecs: specs}).offerings.default.warnings))
      .toContain("W_BITRATE_DIVERGES");
  });
});

describe("golden: the converted form of a legacy object", () => {
  // live_offerings_enabled_multilang.json is a verified artifact, not a
  // snapshot of this code's output: it is the metadata of demov3 object
  // iq__P3xUVn2MpNEjabinoJixRPM7FfP after enable_offerings, whose HLS master
  // playlist was confirmed identical to the same object's legacy one, with
  // every rung's playlist, init segment and media segment serving 200 and
  // ffprobe showing each video segment decoded at the rung's declared
  // geometry and bitrate.
  //
  // It is the converted form of a DIFFERENT object from the legacy fixture -
  // we have no pre-conversion dump of this one - so DRM material cannot match:
  // encryption_schemes and drm_keys are per-object and are inherited from
  // whichever base offering create() built. Everything the transformation
  // itself decides is compared exactly.
  const specs = MULTILANG.live_recording.recording_config.recording_params.ladder_specs;
  const convert = () =>
    O.EnableOfferings({offerings: O.Clone(MULTILANG.offerings), ladderSpecs: specs}).offerings.default;

  const golden = () => O.Clone(MULTILANG_ENABLED.offerings.default);
  const GOLDEN_LADDER =
    MULTILANG_ENABLED.live_recording.recording_config.recording_params.ladder_specs;

  test("play_mode, tracks and representations match the verified object exactly", () => {
    const got = convert().playout.streams;
    const want = golden().playout.streams;

    expect(convert().play_mode).toBe(MULTILANG_ENABLED.offerings.default.play_mode);
    expect(Object.keys(got).sort()).toEqual(Object.keys(want).sort());

    Object.keys(want).forEach((trackKey) => {
      expect(got[trackKey].representations).toEqual(want[trackKey].representations);
      expect(got[trackKey].label).toEqual(want[trackKey].label);
      expect(got[trackKey].default_for_media_type).toEqual(want[trackKey].default_for_media_type);
    });
  });

  test("nothing outside playout.streams and play_mode is invented", () => {
    // Per-object DRM material and mez_prep_specs provenance aside, the rest of
    // the offering is whatever the base offering already carried.
    const got = convert();
    const want = golden();
    ["drm_optional", "offer_as_live", "store_clear", "audio_individual_drm_keys", "ready"]
      .forEach((field) => expect(got[field]).toEqual(want[field]));
    expect(Object.keys(got.playout.playout_formats).sort())
      .toEqual(Object.keys(want.playout.playout_formats).sort());
  });

  test("every offering on the golden object is valid", () => {
    const body = O.DescribeOfferings({
      offerings: O.Clone(MULTILANG_ENABLED.offerings), ladderSpecs: GOLDEN_LADDER
    });
    expect(Object.keys(body.offerings).sort())
      .toEqual(["audio_only", "clear", "default", "one_rung"]);
    Object.keys(body.offerings).forEach((key) => {
      expect([key, body.offerings[key].type]).toEqual([key, "offerings"]);
      expect([key, body.offerings[key].errors]).toEqual([key, []]);
    });
  });

  test("a second run leaves every offering alone", () => {
    const again = O.EnableOfferings({
      offerings: O.Clone(MULTILANG_ENABLED.offerings), ladderSpecs: GOLDEN_LADDER
    });
    expect(again.offerings).toEqual(MULTILANG_ENABLED.offerings);
    expect(again.changes.map((c) => c.action)).toEqual(["skipped", "skipped", "skipped", "skipped"]);
  });

  test("every advertised playout URL is a ladder rung", () => {
    // Each derived offering presents a subset, so it must be a subset of the
    // ladder's URLs; `default` presents all of them.
    const fromLadder = new Set(
      GOLDEN_LADDER.map((r) => `${r.stream_name}/${r.representation}`));

    const urls = (key) => {
      const streams = MULTILANG_ENABLED.offerings[key].playout.streams;
      const out = [];
      Object.keys(streams).forEach((t) =>
        Object.keys(streams[t].representations).forEach((r) => out.push(`${t}/${r}`)));
      return out.sort();
    };

    Object.keys(MULTILANG_ENABLED.offerings).forEach((key) => {
      urls(key).forEach((u) => expect([key, u, fromLadder.has(u)]).toEqual([key, u, true]));
    });
    expect(urls("default")).toEqual([...fromLadder].sort());
  });
});

describe("golden: offerings derived with add_offering", () => {
  // The three offerings beside `default` were produced by add_offering on the
  // same demov3 object and each was played back: `clear` advertises only the
  // clear playout method, `one_rung` only DRM ones and a single video rung,
  // and `audio_only` emits its audio as variant streams because it has no
  // video. All three served init and media segments, one_rung's under AES-128.
  const offering = (key) => O.Clone(MULTILANG_ENABLED.offerings[key]);

  test.each([
    ["audio_only", ["audio_1", "audio_2"]],
    ["clear", ["audio_1", "audio_2", "audio_3", "audio_4", "audio_5", "video"]],
    ["one_rung", ["audio_1", "audio_2", "audio_3", "audio_5", "video"]]
  ])("%s presents exactly its tracks", (key, tracks) => {
    expect(Object.keys(O.Tracks(offering(key))).sort()).toEqual(tracks);
  });

  test("a filtered offering keeps only the formats it selected", () => {
    expect(Object.keys(offering("clear").playout.playout_formats)).toEqual(["hls-clear"]);
    // one_rung drops every clear format, so playout is DRM-only.
    expect(Object.keys(offering("one_rung").playout.playout_formats).sort())
      .toEqual(["hls-aes128", "hls-fairplay", "hls-playready-cenc", "hls-sample-aes",
        "hls-widevine-cenc"]);
  });

  test("one_rung keeps a single video representation", () => {
    expect(Object.keys(O.Tracks(offering("one_rung")).video.representations))
      .toEqual(["videovideo_1920x1080_h264@9500000"]);
  });

  test("derived offerings inherit encryption_schemes and drm_keys untouched", () => {
    // This is what let one_rung play under AES-128: filtering formats must not
    // prune the keys they resolve against.
    const base = offering("default");
    ["audio_only", "clear", "one_rung"].forEach((key) => {
      const derived = offering(key);
      expect([key, derived.playout.drm_keys]).toEqual([key, base.playout.drm_keys]);
      Object.keys(O.Tracks(derived)).forEach((trackKey) => {
        expect([key, trackKey, O.Tracks(derived)[trackKey].encryption_schemes])
          .toEqual([key, trackKey, O.Tracks(base)[trackKey].encryption_schemes]);
      });
    });
  });

  test("each offering round-trips through ExtractSelection", () => {
    Object.keys(MULTILANG_ENABLED.offerings).forEach((key) => {
      const o = offering(key);
      const selection = O.ExtractSelection({offering: o});
      expect([key, O.FilterOffering({baseOffering: offering(key), selection})])
        .toEqual([key, MULTILANG_ENABLED.offerings[key]]);
    });
  });

  test("the derived offerings are reproducible from default by FilterOffering", () => {
    ["audio_only", "clear", "one_rung"].forEach((key) => {
      const selection = O.ExtractSelection({offering: offering(key)});
      const built = O.FilterOffering({baseOffering: offering("default"), selection});
      expect([key, Object.keys(O.Tracks(built)).sort()])
        .toEqual([key, Object.keys(O.Tracks(offering(key))).sort()]);
      expect([key, Object.keys(built.playout.playout_formats).sort()])
        .toEqual([key, Object.keys(offering(key).playout.playout_formats).sort()]);
    });
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
