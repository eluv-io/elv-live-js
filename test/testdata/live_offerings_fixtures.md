# Reproducing the offerings fixtures

`live_offerings_legacy.json` and `live_offerings_enabled.json` are two versions
of one demov3 object, `iq__P3xUVn2MpNEjabinoJixRPM7FfP`, trimmed to `offerings`
plus `ladder_specs`:

| file | object version | contents |
|---|---|---|
| `live_offerings_legacy.json` | `hq__EXVh2KGQjtqJ…` | the legacy offering `create` writes — `play_mode: null`, generic `audio`/`video` track keys |
| `live_offerings_enabled.json` | `hq__DYjKCg37sRTk…` | after `enable_offerings`, plus `audio_only`, `clear` and `one_rung` from `add_offering` |

Every offering in both files was played back on demov3 before it was landed. The
pair is one lineage two versions apart, which is why the golden test can compare
the whole of `playout.streams` exactly rather than field by field.

This document is how to build an equivalent object from scratch, to re-verify the
flow or to regenerate the fixtures after a change to `src/LiveOfferings.js`.

## What you need

- `PRIVATE_KEY` exported for an account that can write the object. Never echo it
  or write it to a file.
- A live stream object on demov3 with several audio source streams. Every command
  below takes `-d` for demov3; without it `ELV_NET` defaults to `main` and the
  config fetch fails with `Cannot read properties of undefined (reading 'services')`.
- An SRT source you can start and stop. **Steps 1, 5 and 8 need a running
  stream**, and starting the ingest is the one part of this that is not a command
  in this repo.

```sh
export S=iq__P3xUVn2MpNEjabinoJixRPM7FfP     # your object
export ELV_NET=demov3                        # for the node scripts below only
```

The source object used here records five audio streams — `audio_1`…`audio_5`,
languages `en`, `en-GB`, `fra`, `und` and none at all — and a four-rung video
ladder. The empty `lang` on `audio_5` is deliberate: it proves the skip rule keys
on `stream_label`, never on `lang`.

## 1. Capture the legacy baseline (stream running)

This is the "before" that everything afterwards is compared against.

```sh
./elv-stream status $S -d | grep -E '^state|recordingPeriodSequence'
./elv-stream list_offerings $S -d
```

Expect `state: running`, one offering `default`, `type: ladder_specs`,
`valid: true`, and tracks `audio` and `video`.

Then fetch the HLS master playlist with `playout_tmp.js` below and keep it:

```sh
node playout_tmp.js $S default master /tmp/legacy-master.m3u8
```

Strip the query strings before saving it anywhere — they carry signed tokens.
The variant URIs should be exactly the ladder's rungs:

```
video/videovideo_1920x1080_h264@9500000/live.m3u8   BANDWIDTH=9500000  1920x1080
video/videovideo_1280x720_h264@4500000/live.m3u8    BANDWIDTH=4500000  1280x720
video/videovideo_960x540_h264@2000000/live.m3u8     BANDWIDTH=2000000  960x540
video/videovideo_960x540_h264@900000/live.m3u8      BANDWIDTH=900000   960x540
audio_1/audioaudio_aac@192000/live.m3u8   NAME="Audio 1" LANGUAGE="en" DEFAULT=YES
audio_2…audio_5                            NAME="Audio 2".."Audio 5"
```

## 2. Stop the stream

`enable_offerings` and `add_offering` refuse to write to a running stream. Stop
the ingest, then confirm:

```sh
./elv-stream status $S -d | grep -E '^state'      # stopped
```

## 3. Convert the legacy offering

Dry-run first — it prints exactly what the write would produce and touches
nothing:

```sh
./elv-stream enable_offerings $S -d --dry_run
./elv-stream enable_offerings $S -d
```

Expect one change entry: `action: converted`, `added_tracks: audio_1…audio_5`,
`removed_tracks: [audio]`. The generic `audio` track must disappear — a surviving
one points at a source stream the ladder does not record and hard-fails the whole
master playlist.

`live_offerings_legacy.json` is the object as it was **before** this step. If you
need it after the fact, walk the version history for the last version whose
`default` has `play_mode: null` — see step 9.

## 4. Add the derived offerings

Each is a copy of `default` with a filter applied. Write the three selection
files:

```sh
cat > /tmp/sel-audio_only.json <<'JSON'
{
  "formats": ["hls-aes128", "hls-clear", "hls-fairplay", "hls-playready-cenc",
              "hls-sample-aes", "hls-widevine-cenc"],
  "tracks": {"audio_1": null, "audio_2": null},
  "default_audio_key": "audio_1"
}
JSON

cat > /tmp/sel-clear.json <<'JSON'
{
  "formats": ["hls-clear"],
  "tracks": {"audio_1": null, "audio_2": null, "audio_3": null,
             "audio_4": null, "audio_5": null, "video": null},
  "default_audio_key": "audio_1"
}
JSON

cat > /tmp/sel-one_rung.json <<'JSON'
{
  "formats": ["hls-aes128", "hls-fairplay", "hls-playready-cenc",
              "hls-sample-aes", "hls-widevine-cenc"],
  "tracks": {
    "audio_1": null, "audio_2": null, "audio_3": null, "audio_5": null,
    "video": ["videovideo_1920x1080_h264@9500000"]
  },
  "default_audio_key": "audio_1"
}
JSON
```

`null` as a track's value keeps all of its representations. Prefer it to listing
representation keys: **keys are per-object**. An object converted before
representations were generated from `ladder_specs` carries `audioaudio_aac@128000`
and six video rungs; this one carries `audioaudio_aac@192000` and four. A
selection copied from another object will fail on the missing keys, which is the
intended behavior — `add_offering` refuses rather than silently dropping them.

```sh
for k in audio_only clear one_rung; do
  ./elv-stream add_offering $S $k -d --offering_selection /tmp/sel-$k.json --dry_run
done
for k in audio_only clear one_rung; do
  ./elv-stream add_offering $S $k -d --offering_selection /tmp/sel-$k.json
done
```

To land all three in a single version instead of three, pass `--write_token` from
a draft and finalize once with `elv-utils-js/utilities/DraftFinalize.js`. The
fixture was built with three separate commits.

## 5. Restart the stream

**The new offerings will not play until the stream is restarted.** The recorder
loads its live metadata when a recording period starts, so a running session keeps
serving the snapshot it began with; commits to the object do not reach it. A
restart creates a new edge write token seeded from the current version.

`options.json` reports `HandleOptionsFormats: offering not found` for an offering
that is committed but not yet visible to the running session — the metadata is
fine, the session is stale.

## 6. Check what each offering advertises

```sh
./elv-stream list_offerings $S -d
```

All four `valid: true`. Only `default` warns, `W_DASH_AUDIO_KEY`, because it is
the only one that kept DASH formats against non-generic audio track keys. The
derived three have no findings.

```sh
for k in default clear audio_only one_rung; do
  node playout_tmp.js $S $k master /tmp/off-$k.m3u8
done
```

| offering | playout methods | video | audio |
|---|---|---|---|
| `default` | aes-128, clear, fairplay, playready, sample-aes, widevine | 4 rungs | Audio 1-5 |
| `clear` | clear only | 4 rungs | Audio 1-5 |
| `audio_only` | 6 HLS | none | Audio 1, Audio 2 |
| `one_rung` | 5, no clear | 1080p only | Audio 1, 2, 3, 5 |

`audio_only` emits its audio as `EXT-X-STREAM-INF` variants rather than
`EXT-X-MEDIA` renditions. That is correct: the offerings playlist builder takes
its no-video branch.

## 7. Check that segments actually serve

A master playlist is built from metadata, so it proves nothing about playout.
Fetch each rung's media playlist, its init segment and one media segment:

```sh
node playout_tmp.js $S default reps \
  video/videovideo_1920x1080_h264@9500000 \
  video/videovideo_1280x720_h264@4500000 \
  video/videovideo_960x540_h264@2000000 \
  video/videovideo_960x540_h264@900000 \
  audio_1/audioaudio_aac@192000 \
  audio_3/audioaudio_aac@192000 \
  audio_5/audioaudio_aac@192000

node playout_tmp.js $S one_rung reps \
  video/videovideo_1920x1080_h264@9500000 audio_5/audioaudio_aac@192000
```

All 200. `one_rung` serves under AES-128 — worth checking explicitly, since it is
what shows that filtering formats did not prune the DRM keys they resolve
against.

Then confirm the fabric honors the representations rather than merely advertising
them. Concatenate an init segment and a media segment and probe it:

```sh
node playout_tmp.js $S default segment \
  video/videovideo_960x540_h264@900000 /tmp/v900k.mp4
ffprobe -v error -show_entries stream=codec_name,width,height,bit_rate \
  -of default=noprint_wrappers=1 /tmp/v900k.mp4
```

Expect `h264 960x540`, with `bit_rate` somewhere near 900000 — it is measured
over a single two-second fragment, so it moves by a hundred kbps or so between
runs. The geometry is the assertion that matters. The `@900000` rung is the interesting one: an
earlier implementation cloned the base offering's representations instead of
generating them from `ladder_specs`, which dropped this rung entirely — the URL
stopped resolving while the master playlist still looked well formed.

Finally, diff the master playlist against the step 1 baseline. Sorted and
de-duplicated they should be identical; conversion changes which code path builds
the manifest and nothing a player can observe. Sharding duplicates lines
per-request, so compare `sort -u` output rather than the raw files.

## 8. Dump the fixtures

```sh
node dump-offerings_tmp.js $S test/testdata/live_offerings_enabled.json
```

The script selects `offerings` and
`live_recording/recording_config/recording_params/ladder_specs` only, and writes
sorted keys with a two-space indent. Do not land a full metadata dump: it is
megabytes and carries `eluv.caps.*` entries.

For the legacy side, find the last version whose `default` still has
`play_mode: null` and dump that version instead:

```sh
node dump-offerings_tmp.js $S test/testdata/live_offerings_legacy.json --legacy
```

Then run the tests. The golden test compares the whole of `playout.streams`:

```sh
npm test && npm run lint
```

Six `playout.drm_keys.<id>["."].container` hashes differ between any two versions
of the same object — they name the version holding the blob. They live outside
`playout.streams`, so the golden comparison is unaffected, but a naive whole-
offering `toEqual` will trip on them.

## Helper scripts

These are not checked in. Write them at the **repo root** — they must sit inside
the repo so `@eluvio/elv-client-js` resolves from `node_modules` — run them, then
delete them. Do not put them in `scripts/`, which holds checked-in shell tools.

### `playout_tmp.js`

```js
const {ElvClient} = require("@eluvio/elv-client-js");
const fs = require("fs");

const [objectId, offering, mode, ...rest] = process.argv.slice(2);

const main = async () => {
  const client = await ElvClient.FromNetworkName({networkName: "demov3"});
  client.SetSigner({signer: client.GenerateWallet().AddAccount({privateKey: process.env.PRIVATE_KEY})});
  const libraryId = await client.ContentObjectLibraryId({objectId});
  const opts = await client.PlayoutOptions({
    objectId, libraryId, offering, protocols: ["hls"],
    drms: ["clear", "aes-128", "sample-aes", "fairplay", "playready", "widevine"]
  });
  const methods = opts.hls.playoutMethods;
  console.error(`${offering}: methods = ${Object.keys(methods).sort().join(",")}`);
  const master = (methods.clear || methods["aes-128"] || Object.values(methods)[0]).playoutUrl;

  if (mode === "master") {
    const res = await fetch(master);
    fs.writeFileSync(rest[0], await res.text());
    console.error(`${offering}: master ${res.status}`);
    return;
  }

  const parts = async (rep) => {
    const url = master.replace(/\/playlist\.m3u8\?/, `/${rep}/live.m3u8?`);
    const res = await fetch(url);
    if (res.status !== 200) return {status: res.status};
    const body = await res.text();
    const base = url.slice(0, url.lastIndexOf("/") + 1);
    const query = url.slice(url.indexOf("?"));
    const init = body.match(/#EXT-X-MAP:URI="([^"?]+)([^"]*)"/);
    const seg = body.split("\n").find((l) => l.trim() && !l.startsWith("#"));
    const get = async (n, e) => Buffer.from(await (await fetch(base + n + (e || query))).arrayBuffer());
    return {
      status: 200,
      encrypted: body.includes("#EXT-X-KEY"),
      init: await get(init[1], init[2]),
      seg: await get(seg.split("?")[0], seg.includes("?") ? seg.slice(seg.indexOf("?")) : query)
    };
  };

  if (mode === "segment") {
    const p = await parts(rest[0]);
    fs.writeFileSync(rest[1], Buffer.concat([p.init, p.seg]));
    return;
  }
  for (const rep of rest) {
    const p = await parts(rep);
    console.log(p.status !== 200
      ? `${rep.padEnd(46)} playlist ${p.status}`
      : `${rep.padEnd(46)} playlist 200  init ${p.init.length}B  segment ${p.seg.length}B` +
        `  ${p.encrypted ? "encrypted" : "clear"}`);
  }
};

main().catch((e) => { console.error("ERR", e && e.message); process.exit(1); });
```

### `dump-offerings_tmp.js`

```js
const {ElvClient} = require("@eluvio/elv-client-js");
const fs = require("fs");

const [objectId, out, flag] = process.argv.slice(2);
const SELECT = ["offerings", "live_recording/recording_config/recording_params/ladder_specs"];

const sorted = (v) => Array.isArray(v) ? v.map(sorted)
  : v && typeof v === "object"
    ? Object.keys(v).sort().reduce((o, k) => Object.assign(o, {[k]: sorted(v[k])}), {})
    : v;

const main = async () => {
  const client = await ElvClient.FromNetworkName({networkName: "demov3"});
  client.SetSigner({signer: client.GenerateWallet().AddAccount({privateKey: process.env.PRIVATE_KEY})});
  const libraryId = await client.ContentObjectLibraryId({objectId});

  let meta;
  if (flag === "--legacy") {
    const {versions} = await client.ContentObjectVersions({libraryId, objectId});
    for (const v of versions) {
      const m = await client.ContentObjectMetadata({
        libraryId, objectId, versionHash: v.hash, select: SELECT, resolveLinks: false});
      if (((m.offerings || {}).default || {}).play_mode === null) {
        console.error("legacy version:", v.hash);
        meta = m;
        break;
      }
    }
    if (!meta) throw new Error("no version with play_mode null");
  } else {
    meta = await client.ContentObjectMetadata({libraryId, objectId, select: SELECT, resolveLinks: false});
  }

  fs.writeFileSync(out, JSON.stringify(sorted(meta), null, 2) + "\n");
  console.error("offerings:", Object.keys(meta.offerings || {}).sort().join(","));
};

main().catch((e) => { console.error("ERR", e && e.message); process.exit(1); });
```
