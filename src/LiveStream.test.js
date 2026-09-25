const {EluvioLiveStream} = require("./LiveStream.js");
const O = require("./LiveOfferings.js");

const LEGACY = require("../test/testdata/live_offerings_legacy.json");

const LADDER = LEGACY.live_recording.recording_config.recording_params.ladder_specs;

// A LiveStream with the fabric calls stubbed out: it reads `offerings` and the
// fixture ladder, and fails the test if it tries to write.
const stubbedStream = (offerings) => {
  const stream = Object.create(EluvioLiveStream.prototype);
  stream._checkWriteToken = () => {};
  stream._RequireStoppedStream = async () => ({libraryId: "ilib_test"});
  stream._ReadOfferingsMeta = async () => ({offerings, ladderSpecs: LADDER});
  stream.client = new Proxy({}, {get: (_, name) => () => { throw new Error(`unexpected client.${String(name)}`); }});
  return stream;
};

describe("EnableOfferings", () => {
  test("a skipped offering's errors do not block converting the others", async () => {
    const offerings = O.Clone(LEGACY.offerings);
    offerings.odd = O.Clone(offerings.default);
    offerings.odd.play_mode = "not_a_mode";

    const res = await stubbedStream(offerings).EnableOfferings({objectId: "iq__test", dryRun: true});
    expect(res.dry_run).toBe(true);
    expect(res.changes.map((c) => [c.offering, c.action]))
      .toEqual([["default", "converted"], ["odd", "skipped"]]);
  });

  test("a converted offering that is invalid still blocks the write", async () => {
    const offerings = O.Clone(LEGACY.offerings);
    const specs = O.Clone(LADDER);
    specs.find((r) => r.stream_name === "audio_1").bit_rate = 0;
    const stream = stubbedStream(offerings);
    stream._ReadOfferingsMeta = async () => ({offerings, ladderSpecs: specs});

    await expect(stream.EnableOfferings({objectId: "iq__test", dryRun: true}))
      .rejects.toThrow(/refusing to write an invalid result[\s\S]*E_BAD_BITRATE/);
  });
});
