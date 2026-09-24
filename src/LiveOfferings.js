/*
 * Live stream offerings: validation, description and transformation.
 *
 * Pure functions only - plain data in, plain data out. This module must not
 * require anything (no fs, no js-yaml, no ElvClient), must not perform I/O,
 * must not write to the console and must not set process.exitCode. Deciding
 * what a finding means for the process is the CLI layer's job.
 *
 * Terminology (see also doc/design/live-streaming/livestream-offerings.md in
 * content-fabric):
 *
 *   source stream  - one audio or video program the recorder produces,
 *                    identified by ladder_specs[].stream_name. This is what
 *                    media_struct_stream_key points at.
 *   track          - one selectable rendition group in an offering, living at
 *                    offerings.<key>.playout.streams.<trackKey>. The track key
 *                    is a path segment in the playout URL.
 *   representation - one encoding of a track, typed RepAudio or RepVideo.
 *
 * Bare "stream" always means a source stream. The thing under playout.streams
 * is a track. "Ladder" is not used as a noun for either: ladder_specs conflates
 * source-stream identity with representation geometry, which is the flaw the
 * offerings model exists to undo.
 */

const OFFERINGS_PLAY_MODE = "avtest_live";

const MEDIA_TYPE_AUDIO = 2;

const REP_AUDIO = "RepAudio";
const REP_VIDEO = "RepVideo";

// A track key becomes a path segment in the playout URL.
const TRACK_KEY_RE = /^[A-Za-z0-9_.-]+$/;

// Legacy playout rewrites requested track keys to these two, so any other key
// in a legacy offering is unreachable.
const LEGACY_TRACK_KEYS = ["audio", "video"];

/**
 * Every validation rule, keyed by code. Severity and applicability are data so
 * a rule can be retightened, relaxed or retired without touching traversal.
 *
 * `appliesTo` is one of "object", "both", "offerings" or "ladder_specs".
 */
const RULES = {
  // Object-level precondition, checked once before any offering.
  E_NO_LADDER: {severity: "error", appliesTo: "object"},

  // Structural - both offering types.
  E_NO_TRACKS: {severity: "error", appliesTo: "both"},
  E_NO_REPS: {severity: "error", appliesTo: "both"},
  E_MIXED_REP_TYPE: {severity: "error", appliesTo: "both"},
  E_MIXED_MSS: {severity: "error", appliesTo: "both"},
  E_MSS_MISSING: {severity: "error", appliesTo: "both"},
  E_DRM_SCHEME_UNAVAILABLE: {severity: "error", appliesTo: "both"},
  E_BAD_BITRATE: {severity: "error", appliesTo: "both"},
  E_BAD_DIMENSIONS: {severity: "error", appliesTo: "both"},
  W_NO_CODEC: {severity: "warning", appliesTo: "both"},

  // Offerings-based playout.
  E_MSS_NOT_IN_LADDER: {severity: "error", appliesTo: "offerings"},
  E_MEDIA_TYPE_MISMATCH: {severity: "error", appliesTo: "offerings"},
  E_MIXED_AUDIO_CODEC: {severity: "error", appliesTo: "offerings"},
  E_BAD_TRACK_KEY: {severity: "error", appliesTo: "offerings"},
  W_MULTI_DEFAULT: {severity: "warning", appliesTo: "offerings"},
  W_NO_DEFAULT: {severity: "warning", appliesTo: "offerings"},
  W_MULTI_AUDIO_REP: {severity: "warning", appliesTo: "offerings"},
  W_EMPTY_LABEL: {severity: "warning", appliesTo: "offerings"},
  // Retire this rule once live DASH is fixed in content-fabric.
  W_DASH_AUDIO_KEY: {severity: "warning", appliesTo: "offerings"},
  W_BITRATE_DIVERGES: {severity: "warning", appliesTo: "offerings"},
  W_DUPLICATE_SOURCE: {severity: "warning", appliesTo: "offerings"},

  // An unrecognized play_mode: reported, never validated, never converted.
  E_UNKNOWN_PLAY_MODE: {severity: "error", appliesTo: "object"},

  // Legacy playout - the offering carries DRM only.
  E_LEGACY_TRACK_KEY: {severity: "error", appliesTo: "ladder_specs"},
  E_LEGACY_MISSING_TRACK: {severity: "error", appliesTo: "ladder_specs"},
  W_LEGACY_EMPTY_LABEL: {severity: "warning", appliesTo: "ladder_specs"}
};

const Clone = (o) => JSON.parse(JSON.stringify(o));

const SortedKeys = (o) => Object.keys(o || {}).sort();

const Finding = (code, message, context = {}) => ({
  code,
  severity: RULES[code].severity,
  message,
  ...context
});

/**
 * Group ladder rungs into source streams.
 *
 * A stream_name may legitimately carry several rungs - the rugby object's four
 * video rungs are all named "video", and an audio ABR ladder would be two rungs
 * both named "audio_1". Grouping is therefore by name, and a group identifies a
 * source stream, not a representation. Stream-level metadata comes from the
 * first rung of each group, which is what the fabric's own rungMap does.
 *
 * @param {Array<Object>} ladderSpecs - live_recording/recording_config/recording_params/ladder_specs
 * @returns {Object} {audio: [...], video: [...], names: Set<string>, byName: Object}
 */
const SourceStreams = (ladderSpecs) => {
  const audio = [];
  const video = [];
  const byName = {};

  (ladderSpecs || []).forEach((rung) => {
    const name = rung.stream_name;
    if (name === undefined || name === null || byName[name] !== undefined) {
      return;
    }
    const entry = {
      stream_name: name,
      media_type: rung.media_type === MEDIA_TYPE_AUDIO ? "audio" : "video",
      stream_label: rung.stream_label || "",
      lang: rung.lang || "",
      channels: rung.channels,
      default: rung.default === true,
      bit_rate: rung.bit_rate
    };
    byName[name] = entry;
    (rung.media_type === MEDIA_TYPE_AUDIO ? audio : video).push(entry);
  });

  return {audio, video, byName, names: new Set(Object.keys(byName))};
};

/**
 * Classify an offering by its play_mode.
 *
 * The fabric compares play_mode by equality, so an unrecognized value silently
 * degrades to legacy behavior while the track keys are named for offerings
 * mode - the worst of both. Such an offering is reported, never validated and
 * never converted.
 *
 * @param {Object} offering
 * @returns {string} "offerings" | "ladder_specs" | "unknown"
 */
const OfferingType = (offering) => {
  const playMode = (offering || {}).play_mode;
  if (playMode === OFFERINGS_PLAY_MODE) {
    return "offerings";
  }
  if (playMode === null || playMode === undefined) {
    return "ladder_specs";
  }
  return "unknown";
};

const Tracks = (offering) => ((offering || {}).playout || {}).streams || {};

const Reps = (track) => (track || {}).representations || {};

/** Media type of a track, from its representations. */
const TrackMediaType = (track) => {
  const reps = Object.values(Reps(track));
  if (reps.length === 0) {
    return undefined;
  }
  return reps[0].type === REP_AUDIO ? "audio" : reps[0].type === REP_VIDEO ? "video" : undefined;
};

/** The media_struct_stream_key shared by a track's representations, if any. */
const TrackSourceStream = (track) => {
  const keys = [...new Set(Object.values(Reps(track)).map((r) => r.media_struct_stream_key))];
  return keys.length === 1 ? keys[0] : undefined;
};

/**
 * Validate one offering against the object's source streams.
 *
 * Errors make the offering invalid and block any write; warnings do not. Rules
 * mirror fabric behavior - see the plan for the justification of each, and note
 * that representation geometry is deliberately NOT compared against the ladder:
 * under avtest_live the representation is authoritative.
 *
 * @namedParams
 * @param {Object} offering - One entry of the /offerings map
 * @param {Object} ladder - Result of SourceStreams()
 * @returns {Object} {valid, type, errors: [], warnings: []}
 */
const ValidateOffering = ({offering, ladder}) => {
  const errors = [];
  const warnings = [];
  const push = (code, message, context) => {
    const finding = Finding(code, message, context);
    (finding.severity === "error" ? errors : warnings).push(finding);
  };

  const type = OfferingType(offering);
  if (type === "unknown") {
    push(
      "E_UNKNOWN_PLAY_MODE",
      `unknown play_mode "${offering.play_mode}"; expected null (legacy) or "${OFFERINGS_PLAY_MODE}"`
    );
    return {valid: false, type, errors, warnings};
  }

  const tracks = Tracks(offering);
  const trackKeys = SortedKeys(tracks);

  if (trackKeys.length === 0) {
    push("E_NO_TRACKS", "offering presents no tracks");
    return {valid: errors.length === 0, type, errors, warnings};
  }

  // ---- structural, both types -------------------------------------------
  trackKeys.forEach((trackKey) => {
    const track = tracks[trackKey];
    const repKeys = SortedKeys(Reps(track));

    if (repKeys.length === 0) {
      push("E_NO_REPS", `track "${trackKey}" has no representations`, {track: trackKey});
      return;
    }

    const repTypes = [...new Set(repKeys.map((k) => Reps(track)[k].type))];
    if (repTypes.length > 1) {
      push(
        "E_MIXED_REP_TYPE",
        `track "${trackKey}" mixes representation types (${repTypes.join(", ")}); ` +
          "all representations of a track must be the same media type",
        {track: trackKey}
      );
    }

    const mssKeys = [...new Set(repKeys.map((k) => Reps(track)[k].media_struct_stream_key))];
    if (mssKeys.length > 1) {
      push(
        "E_MIXED_MSS",
        `track "${trackKey}" representations name different source streams ` +
          `(${mssKeys.join(", ")}); all representations of a track must share ` +
          "media_struct_stream_key",
        {track: trackKey}
      );
    }

    repKeys.forEach((repKey) => {
      const rep = Reps(track)[repKey];
      const where = {track: trackKey, representation: repKey};

      if (!rep.media_struct_stream_key) {
        push("E_MSS_MISSING", `representation "${repKey}" of track "${trackKey}" has no media_struct_stream_key`, where);
      }
      if (!(rep.bit_rate > 0)) {
        push("E_BAD_BITRATE", `representation "${repKey}" of track "${trackKey}" has bit_rate ${rep.bit_rate}`, where);
      }
      if (rep.type === REP_VIDEO && !(rep.width > 0 && rep.height > 0)) {
        push(
          "E_BAD_DIMENSIONS",
          `video representation "${repKey}" of track "${trackKey}" has dimensions ${rep.width}x${rep.height}`,
          where
        );
      }
      if (!rep.codec) {
        push("W_NO_CODEC", `representation "${repKey}" of track "${trackKey}" has no codec; CODECS will be omitted or wrong`, where);
      }
    });
  });

  // A playout format naming an encryption scheme some track lacks makes the
  // whole offering unparseable (abr.Playout.UnmarshalJSON -> CheckConsistency),
  // which takes down every format including the clear ones.
  const formats = ((offering.playout || {}).playout_formats) || {};
  SortedKeys(formats).forEach((formatKey) => {
    const scheme = ((formats[formatKey] || {}).drm || {}).enc_scheme_name;
    if (!scheme) {
      return;
    }
    trackKeys.forEach((trackKey) => {
      const schemes = tracks[trackKey].encryption_schemes || {};
      if (schemes[scheme] === undefined) {
        push(
          "E_DRM_SCHEME_UNAVAILABLE",
          `playout format "${formatKey}" requires encryption scheme "${scheme}", ` +
            `which track "${trackKey}" does not carry; the fabric cannot unmarshal ` +
            "this offering at all. Run regen_drm.",
          {track: trackKey, format: formatKey}
        );
      }
    });
  });

  if (type === "offerings") {
    ValidateOfferingsType({offering, ladder, tracks, trackKeys, formats, push});
  } else {
    ValidateLegacyType({ladder, tracks, trackKeys, push});
  }

  return {valid: errors.length === 0, type, errors, warnings};
};

/** Rules that apply only to play_mode: avtest_live. */
const ValidateOfferingsType = ({ladder, tracks, trackKeys, formats, push}) => {
  const audioCodecs = new Set();
  const defaults = [];
  const sourceUse = {};

  const hasDash = SortedKeys(formats).some(
    (k) => (((formats[k] || {}).protocol || {}).type) === "ProtoDash"
  );

  trackKeys.forEach((trackKey) => {
    const track = tracks[trackKey];
    const mediaType = TrackMediaType(track);
    const mssKey = TrackSourceStream(track);
    const repKeys = SortedKeys(Reps(track));

    if (!TRACK_KEY_RE.test(trackKey)) {
      push("E_BAD_TRACK_KEY", `track key "${trackKey}" is not usable as a playout URL path segment`, {track: trackKey});
    }

    if (mssKey === undefined) {
      return; // E_MIXED_MSS / E_NO_REPS already reported
    }

    const source = ladder.byName[mssKey];
    if (source === undefined) {
      const recorded = [...ladder.names].sort().join(", ");
      push(
        "E_MSS_NOT_IN_LADDER",
        `track "${trackKey}" names source stream "${mssKey}", which the ladder does ` +
          `not record; recorded source streams are [${recorded}]`,
        {track: trackKey, media_struct_stream_key: mssKey}
      );
      return;
    }

    if (mediaType !== undefined && source.media_type !== mediaType) {
      push(
        "E_MEDIA_TYPE_MISMATCH",
        `track "${trackKey}" presents source stream "${mssKey}" as ${mediaType}, ` +
          `but the ladder records it as ${source.media_type}`,
        {track: trackKey, media_struct_stream_key: mssKey}
      );
    }

    sourceUse[mssKey] = (sourceUse[mssKey] || []).concat(trackKey);

    if (mediaType !== "audio") {
      return;
    }

    repKeys.forEach((k) => audioCodecs.add(Reps(track)[k].codec));

    if (track.default_for_media_type === true) {
      defaults.push(trackKey);
    }
    if (repKeys.length > 1) {
      push(
        "W_MULTI_AUDIO_REP",
        `audio track "${trackKey}" has ${repKeys.length} representations; each emits its ` +
          "own EXT-X-MEDIA rendition into a single hardcoded GROUP-ID with the same NAME, " +
          "so players see indistinguishable renditions rather than bitrate variants",
        {track: trackKey}
      );
    }
    if (!track.label && !source.stream_label) {
      push(
        "W_EMPTY_LABEL",
        `audio track "${trackKey}" resolves to an empty name; the rendition will appear unnamed`,
        {track: trackKey}
      );
    }
    if (hasDash && trackKey !== "audio") {
      push(
        "W_DASH_AUDIO_KEY",
        `offering has DASH playout formats but audio track key "${trackKey}"; deployed ` +
          "fabric builds live DASH from ladder_specs and looks up DRM under the literal " +
          "key \"audio\", so DASH playout fails. HLS is unaffected.",
        {track: trackKey}
      );
    }
    repKeys.forEach((repKey) => {
      const rep = Reps(track)[repKey];
      if (source.bit_rate !== undefined && rep.bit_rate !== source.bit_rate) {
        push(
          "W_BITRATE_DIVERGES",
          `audio track "${trackKey}" representation "${repKey}" targets ${rep.bit_rate} bps ` +
            `but the ladder records source stream "${mssKey}" at ${source.bit_rate} bps; ` +
            "under avtest_live the representation is authoritative, so this silently " +
            "changes the encode",
          {track: trackKey, representation: repKey}
        );
      }
    });
  });

  if (audioCodecs.size > 1) {
    push(
      "E_MIXED_AUDIO_CODEC",
      `offering mixes audio codecs (${[...audioCodecs].sort().join(", ")}); the fabric ` +
        "assumes a single audio codec and stamps the first one on every EXT-X-MEDIA and " +
        "every video CODECS attribute"
    );
  }
  if (defaults.length > 1) {
    push("W_MULTI_DEFAULT", `${defaults.length} audio tracks are marked default_for_media_type; at most one should be`);
  }
  if (defaults.length === 0 && audioCodecs.size > 0) {
    push("W_NO_DEFAULT", "no audio track is marked default_for_media_type; player track selection will be arbitrary");
  }
  SortedKeys(sourceUse).forEach((mssKey) => {
    if (sourceUse[mssKey].length > 1) {
      push("W_DUPLICATE_SOURCE", `tracks ${sourceUse[mssKey].join(", ")} all present source stream "${mssKey}"`, {
        media_struct_stream_key: mssKey
      });
    }
  });
};

/** Rules that apply only to a legacy (play_mode-less) offering. */
const ValidateLegacyType = ({ladder, tracks, trackKeys, push}) => {
  trackKeys.forEach((trackKey) => {
    if (!LEGACY_TRACK_KEYS.includes(trackKey)) {
      push(
        "E_LEGACY_TRACK_KEY",
        `legacy offering has track key "${trackKey}"; the fabric rewrites requested keys ` +
          "to \"audio\"/\"video\" for legacy offerings, so this track is unreachable",
        {track: trackKey}
      );
    }
  });

  [["audio", ladder.audio], ["video", ladder.video]].forEach(([key, sources]) => {
    if (sources.length > 0 && tracks[key] === undefined) {
      push("E_LEGACY_MISSING_TRACK", `legacy offering has no "${key}" track; DRM lookup for ${key} playout will fail`, {
        track: key
      });
    }
  });

  ladder.audio.forEach((source) => {
    if (!source.stream_label) {
      push(
        "W_LEGACY_EMPTY_LABEL",
        `ladder audio source stream "${source.stream_name}" has an empty stream_label and ` +
          "is not advertised in the master playlist",
        {media_struct_stream_key: source.stream_name}
      );
    }
  });
};

/**
 * Describe an offering's tracks: what each points at, how it is labelled,
 * whether it is the default. Deliberately separate from the selection, which is
 * only a filter.
 *
 * @namedParams
 * @param {Object} offering
 * @returns {Object} trackKey -> {media_type, media_struct_stream_key, label, default_for_media_type?}
 */
const TrackInfo = ({offering}) => {
  const tracks = Tracks(offering);
  const info = {};
  SortedKeys(tracks).forEach((trackKey) => {
    const track = tracks[trackKey];
    info[trackKey] = {
      media_type: TrackMediaType(track),
      media_struct_stream_key: TrackSourceStream(track),
      label: track.label || ""
    };
    if (track.default_for_media_type === true) {
      info[trackKey].default_for_media_type = true;
    }
  });
  return info;
};

/**
 * Extract the selection that selects exactly this offering, so that applying it
 * to the same offering is the identity.
 *
 * @namedParams
 * @param {Object} offering
 * @returns {Object} {default_audio_key?, formats, tracks}
 */
const ExtractSelection = ({offering}) => {
  const tracks = Tracks(offering);
  const selection = {
    formats: SortedKeys(((offering.playout || {}).playout_formats) || {}),
    tracks: {}
  };

  SortedKeys(tracks).forEach((trackKey) => {
    selection.tracks[trackKey] = SortedKeys(Reps(tracks[trackKey]));
    if (tracks[trackKey].default_for_media_type === true && TrackMediaType(tracks[trackKey]) === "audio") {
      selection.default_audio_key = trackKey;
    }
  });

  return selection;
};

/**
 * Copy a base offering and delete everything the selection excludes.
 *
 * The selection is a filter: absent means keep everything, present means keep
 * only what is listed. Nothing is renamed or repointed, and every surviving
 * field keeps the value it had in the base offering. `default_audio_key` is the
 * one non-filter key, because that choice is only answerable after filtering.
 *
 * @namedParams
 * @param {Object} baseOffering - The offering to copy
 * @param {string} [baseOfferingKey] - Its key, for error messages
 * @param {Object} [selection] - {default_audio_key?, formats?, tracks?}
 * @returns {Object} The new offering
 */
const FilterOffering = ({baseOffering, baseOfferingKey = "default", selection = {}}) => {
  const offering = Clone(baseOffering);
  const tracks = Tracks(offering);
  const formats = ((offering.playout || {}).playout_formats) || {};

  if (selection.tracks !== undefined) {
    SortedKeys(selection.tracks).forEach((trackKey) => {
      if (tracks[trackKey] === undefined) {
        throw new Error(
          `track "${trackKey}" not found in base offering "${baseOfferingKey}" ` +
            `(available: ${SortedKeys(tracks).join(", ")})`
        );
      }
      const wanted = selection.tracks[trackKey];
      if (wanted === null || wanted === undefined) {
        return; // keep all representations
      }
      const available = SortedKeys(Reps(tracks[trackKey]));
      wanted.forEach((repKey) => {
        if (Reps(tracks[trackKey])[repKey] === undefined) {
          throw new Error(
            `representation "${repKey}" not found in track "${trackKey}" of base ` +
              `offering "${baseOfferingKey}" (available: ${available.join(", ")})`
          );
        }
      });
      available.forEach((repKey) => {
        if (!wanted.includes(repKey)) {
          delete tracks[trackKey].representations[repKey];
        }
      });
    });

    SortedKeys(tracks).forEach((trackKey) => {
      if (selection.tracks[trackKey] === undefined) {
        delete tracks[trackKey];
      }
    });
  }

  if (selection.formats !== undefined) {
    selection.formats.forEach((formatKey) => {
      if (formats[formatKey] === undefined) {
        throw new Error(
          `playout format "${formatKey}" not found in base offering "${baseOfferingKey}" ` +
            `(available: ${SortedKeys(formats).join(", ")})`
        );
      }
    });
    SortedKeys(formats).forEach((formatKey) => {
      if (!selection.formats.includes(formatKey)) {
        delete formats[formatKey];
      }
    });
  }

  if (selection.default_audio_key !== undefined) {
    const trackKey = selection.default_audio_key;
    if (tracks[trackKey] === undefined) {
      throw new Error(`default_audio_key "${trackKey}" does not name a track kept by this selection`);
    }
    if (TrackMediaType(tracks[trackKey]) !== "audio") {
      throw new Error(`default_audio_key "${trackKey}" names a ${TrackMediaType(tracks[trackKey])} track`);
    }
    SortedKeys(tracks).forEach((k) => {
      if (k === trackKey) {
        tracks[k].default_for_media_type = true;
      } else {
        delete tracks[k].default_for_media_type;
      }
    });
  }

  return offering;
};

/**
 * Convert legacy offerings on an object to offerings-based playout.
 *
 * Walks every offering but converts only the legacy ones: an offering already
 * at avtest_live is a deliberate presentation (possibly a partial one) and is
 * left untouched, which also makes the whole operation idempotent.
 *
 * @namedParams
 * @param {Object} offerings - The /offerings map
 * @param {Array<Object>} ladderSpecs
 * @returns {Object} {offerings, changes}
 */
const EnableOfferings = ({offerings, ladderSpecs}) => {
  const ladder = SourceStreams(ladderSpecs);
  const result = Clone(offerings || {});
  const changes = [];

  if (ladder.video.length > 1) {
    throw new Error(
      `ladder records ${ladder.video.length} video source streams ` +
        `(${ladder.video.map((s) => s.stream_name).join(", ")}); naming tracks for a ` +
        "multi-video ladder is an authoring decision this tool will not guess"
    );
  }

  const defaults = ladder.audio.filter((s) => s.default).map((s) => s.stream_name);
  if (defaults.length > 1) {
    throw new Error(`ladder marks ${defaults.length} audio source streams default (${defaults.join(", ")}); at most one may be`);
  }

  SortedKeys(result).forEach((offeringKey) => {
    const type = OfferingType(result[offeringKey]);
    if (type !== "ladder_specs") {
      changes.push({
        offering: offeringKey,
        action: "skipped",
        reason: type === "offerings" ? "already offerings-based" : `unknown play_mode "${result[offeringKey].play_mode}"`
      });
      return;
    }
    changes.push(ConvertOffering({offering: result[offeringKey], offeringKey, ladder, defaults}));
  });

  return {offerings: result, changes};
};

/** Convert one legacy offering in place. Returns its `changes` entry. */
const ConvertOffering = ({offering, offeringKey, ladder, defaults}) => {
  const tracks = Tracks(offering);
  const addedTracks = [];
  const removedTracks = [];

  const audioTrackKeys = SortedKeys(tracks).filter((k) => TrackMediaType(tracks[k]) === "audio");
  if (audioTrackKeys.length !== 1) {
    throw new Error(
      `offering "${offeringKey}" has ${audioTrackKeys.length} audio tracks ` +
        `(${audioTrackKeys.join(", ") || "none"}); expected exactly one to use as a ` +
        "template. encryption_schemes cannot be synthesized - create the offering with " +
        "DRM first, or run regen_drm"
    );
  }
  const templateKey = audioTrackKeys[0];
  const template = tracks[templateKey];

  // An audio rung with an empty stream_label is recorded but not meant for
  // playout: LiveConf sets playoutLabel only when recording_stream_config marks
  // the stream playout: true, and the fabric's own ShouldBeAdvertised() leaves
  // such a rung out of the legacy master playlist. Creating a track for it would
  // publish a stream the object deliberately does not advertise, so skip it.
  // The rule is audio-only - video rungs carry no stream_label and are always
  // advertised.
  const forPlayout = ladder.audio.filter((source) => source.stream_label);
  const notForPlayout = ladder.audio.filter((source) => !source.stream_label).map((s) => s.stream_name);

  // One track per playable audio source stream, keyed by that stream's name.
  // Every representation of the template is kept; only the source pointer,
  // label and default flag change.
  forPlayout.forEach((source) => {
    const track = Clone(template);
    track.label = source.stream_label || "";
    SortedKeys(Reps(track)).forEach((repKey) => {
      track.representations[repKey].media_struct_stream_key = source.stream_name;
    });
    if (defaults.includes(source.stream_name)) {
      track.default_for_media_type = true;
    } else {
      delete track.default_for_media_type;
    }
    if (tracks[source.stream_name] === undefined) {
      addedTracks.push(source.stream_name);
    }
    tracks[source.stream_name] = track;
  });

  // Video: repoint every representation at the single video source stream.
  // Usually already correct, which is exactly why a hand transformation forgets
  // it - and why E_MSS_NOT_IN_LADDER checks video as well as audio.
  const videoName = ladder.video.length === 1 ? ladder.video[0].stream_name : undefined;
  if (videoName !== undefined) {
    SortedKeys(tracks).forEach((trackKey) => {
      if (TrackMediaType(tracks[trackKey]) !== "video") {
        return;
      }
      SortedKeys(Reps(tracks[trackKey])).forEach((repKey) => {
        tracks[trackKey].representations[repKey].media_struct_stream_key = videoName;
      });
    });
  }

  // Drop the orphaned template track: mandatory, not cosmetic. A surviving
  // generic "audio" track points at a source stream the ladder does not record,
  // which hard-fails the entire master playlist.
  if (tracks[templateKey] !== undefined && !ladder.names.has(templateKey)) {
    const mssKey = TrackSourceStream(tracks[templateKey]);
    if (mssKey === undefined || !ladder.names.has(mssKey)) {
      delete tracks[templateKey];
      removedTracks.push(templateKey);
    }
  }

  offering.play_mode = OFFERINGS_PLAY_MODE;

  const change = {
    offering: offeringKey,
    action: "converted",
    added_tracks: addedTracks.sort(),
    removed_tracks: removedTracks.sort()
  };
  if (notForPlayout.length > 0) {
    change.skipped_source_streams = notForPlayout.sort();
    change.skipped_reason = "no stream_label: recorded but not marked for playout";
  }
  return change;
};

/**
 * Build the list_offerings body: the object's source streams, plus per-offering
 * type, validity, findings, track info and selection.
 *
 * @namedParams
 * @param {Object} offerings - The /offerings map (may be absent)
 * @param {Array<Object>} ladderSpecs
 * @returns {Object}
 */
const DescribeOfferings = ({offerings, ladderSpecs}) => {
  const ladder = SourceStreams(ladderSpecs);
  const body = {
    source_streams: {
      audio: ladder.audio,
      video: ladder.video
    },
    valid: true,
    errors: [],
    warnings: [],
    offerings: {}
  };

  if (ladder.names.size === 0) {
    body.valid = false;
    body.errors.push(
      Finding(
        "E_NO_LADDER",
        "object has no ladder_specs; it is not a configured live stream - run elv-stream config first"
      )
    );
    return body;
  }

  SortedKeys(offerings || {}).forEach((offeringKey) => {
    const offering = offerings[offeringKey];
    const {valid, type, errors, warnings} = ValidateOffering({offering, ladder});
    if (!valid) {
      body.valid = false;
    }
    body.offerings[offeringKey] = {
      type,
      valid,
      errors,
      warnings,
      tracks: TrackInfo({offering}),
      selection: ExtractSelection({offering})
    };
  });

  return body;
};

module.exports = {
  OFFERINGS_PLAY_MODE,
  RULES,
  Clone,
  SourceStreams,
  OfferingType,
  Tracks,
  Reps,
  TrackMediaType,
  TrackSourceStream,
  ValidateOffering,
  TrackInfo,
  ExtractSelection,
  FilterOffering,
  EnableOfferings,
  DescribeOfferings
};
