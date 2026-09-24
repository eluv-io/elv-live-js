# Creating a test stream object for the offerings commands

How `iq__47zHsDFK6E6a25vxic1zQMMFdSmp` (demov3) was created, and how to make
another. You need one of these to exercise `enable_offerings`, because a
converted object can only be converted once — the command is idempotent by
design, so testing the conversion needs a *legacy* offering.

## Prerequisites

- `PRIVATE_KEY` in the environment.
- A network flag on every command. `elv-stream` maps `-d` to `ELV_NET=demov3`;
  a script calling `src/LiveStream.js` directly must export `ELV_NET` itself,
  because `--url` selects the node while `ELV_NET` selects the qspace. A
  mismatch fails with `Cannot read properties of undefined (reading 'services')`,
  which names neither.

## 1. Take the library and ingest URL from an existing stream

```bash
S=iq__2VFduRpKr4rtnNKA9Z65STx1wuT7
U=https://host-76-74-28-234.contentfabric.io

./elv-stream status $S --url $U -d          # libraryId, and url = the ingest URL
```

Reusing a live stream's ingest URL is safe as long as the new object is never
started — two objects may name the same SRT listener, but only one may bind it.

## 2. Build a `live_recording_config` that needs no probe

This is the step that matters, and it is not obvious:

- `create` **requires** `--live_recording_config`. Without it the argument is
  `undefined`, `fs.existsSync` is false, and it falls through to a site-profile
  lookup that throws `Either profileName or profileSlug must be provided`.
- The config **must contain `input_stream_info`**. Only then does `create` also
  run `StreamConfig`, which is what writes `ladder_specs`. Without it you get an
  object with offerings but no ladder, and `enable_offerings` correctly refuses
  with `object has no ladder_specs`.
- Supplying `input_stream_info` also **skips live probing**, so the source does
  not have to be streaming.

Build it from an existing configured stream's `live_recording_config`, whose
`probe_info` has exactly the shape `input_stream_info` wants:

```js
{
  name: "scratch-offerings-test",
  input_stream_info: <probe_info from a configured stream>,
  recording_config: <recording_config from that stream>,
  recording_stream_config: <recording_stream_config from that stream>,
  playout_config: {playout_formats: ["hls-clear", "hls-aes128"]}
}
```

`recording_stream_config.audio` decides how many audio source streams the ladder
declares, and therefore how many tracks `enable_offerings` produces. Five
entries gave `audio_1`…`audio_5`.

## 3. Create the object

```bash
./elv-stream create --url $U -d \
  --library ilib3xjQjKgtB1d1aKwEwaB1hUioYFar \
  --stream_url 'srt://host-76-74-91-17.contentfabric.io:11031?mode=listener' \
  --live_recording_config /tmp/scratch_cfg.json \
  --name "scratch-offerings-test" \
  --no-link_to_site
```

`--no-link_to_site` keeps the throwaway object out of the live-stream site
listing; it defaults to true. The command prints `objectId` and the new `hash`.

## 4. Confirm it is legacy

```bash
./elv-stream list_offerings <new_object_id> --url $U -d
```

Expect one `default` offering, `type: ladder_specs`, tracks `audio` and `video`,
and `source_streams` listing the audio streams the ladder declares. A
`W_LEGACY_EMPTY_LABEL` warning is normal when the config sets no `playout_label`
— the converted tracks then get empty labels and warn with `W_EMPTY_LABEL`,
which is worth seeing at least once.

## 5. Exercise the commands

```bash
./elv-stream enable_offerings <id> --url $U -d --dry_run   # inspect first
./elv-stream enable_offerings <id> --url $U -d             # converts, one new version
./elv-stream enable_offerings <id> --url $U -d             # idempotent: skipped, no version

./elv-stream add_offering <id> commentary --url $U -d \
    --offering_selection selection.json
./elv-stream delete_offering <id> commentary --url $U -d
```

To confirm a run created no version, compare the object hash before and after —
`enable_offerings` opens no draft when nothing converts.

## Cleanup

The object is a throwaway. It is not linked to the site, so deleting it (or
leaving it) affects nothing else. Do not point cleanup at the source stream the
ingest URL came from.
