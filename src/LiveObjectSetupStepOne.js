/* eslint-disable no-console */

/*

Function to generate DRM keys and offering metadata for a live object

EXAMPLE OF USE FROM WITHIN ANOTHER FILE:
================================================

const {GenerateOffering} = require("./LiveObjectSetupStepOne");

const client = (...STANDARD CODE TO GENERATE INSTANCE OF CLIENT...);

const streamUrl = "https://live-stream-source.com:PORT/PATH/FILENAME";

const aBitRate = 128000;
const aChannels = 2;
const aSampleRate = 48000;
const aStreamIndex = 1;
const aTimeBase = "1/48000";
const aChannelLayout = "stereo";

const vBitRate = 9500000;
const vHeight = 1080;
const vStreamIndex = 0;
const vWidth = 1920;
const vDisplayAspectRatio = "16/9";
const vFrameRate = "24";
const vTimeBase = "1/12288";

const abrProfile = require("path/to/abr/profile");

const objectId = "qid";
const libraryId = "lib_id";

await GenerateOffering({
    client,
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

*/


// https://www.npmjs.com/package/fraction.js
const Fraction = require("fraction.js");

const DUMMY_DURATION = 1001; // should result in integer duration_ts values for both audio and video

const GenerateOffering = async ({
  client, // elvClient object
  libraryId, objectId, // lib/object ID of new live object
  streamUrl,  // live source URL
  abrProfile, // JSON.parse(abr profile json file contents)
  // audio info - integers
  aBitRate, aChannels, aSampleRate, aStreamIndex,
  // audio info - string containing fraction, e.g. "1/48000" (usually == 1/aSampleRate)
  aTimeBase,
  // audio info - string containing channel layout, e.g. "stereo"
  aChannelLayout,
  // video info - integers
  vBitRate, vHeight, vStreamIndex, vWidth,
  // video info - strings containing either integers or fractions, e.g. "16/9", "30", "1/30000"
  vDisplayAspectRatio, vFrameRate, vTimeBase
}) => {

  // compute duration_ts
  const aDurationTs = Fraction(aTimeBase).inverse().mul(DUMMY_DURATION).valueOf();
  const vDurationTs = Fraction(vTimeBase).inverse().mul(DUMMY_DURATION).valueOf();

  // construct /production_master/sources/STREAM_URL/streams

  const sourceAudioStream = {
    "bit_rate": aBitRate,
    "channel_layout": aChannelLayout,
    "channels": aChannels,
    "codec_name": "aac",
    "duration": DUMMY_DURATION,
    "duration_ts": aDurationTs,
    "frame_count": 0,
    "language": "",
    "max_bit_rate": aBitRate,
    "sample_rate": aSampleRate,
    "start_pts": 0,
    "start_time": 0,
    "time_base": aTimeBase,
    "type": "StreamAudio"
  };

  const sourceVideoStream = {
    "bit_rate": vBitRate,
    "codec_name": "h264",
    "display_aspect_ratio": vDisplayAspectRatio,
    "duration": DUMMY_DURATION,
    "duration_ts": vDurationTs,
    "field_order": "progressive",
    "frame_count": 0,
    "frame_rate": vFrameRate,
    "hdr": null,
    "height": vHeight,
    "language": "",
    "max_bit_rate": vBitRate,
    "sample_aspect_ratio": "1",
    "start_pts": 0,
    "start_time": 0,
    "time_base": vTimeBase,
    "type": "StreamVideo",
    "width": vWidth
  };

  // placeholder stream to use if [aStreamIndex, vStreamIndex].sort() is not [0,1]
  const DUMMY_STREAM = {
    "bit_rate": 0,
    "codec_name": "",
    "duration": DUMMY_DURATION,
    "duration_ts": 2500 * DUMMY_DURATION,
    "frame_count": 1,
    "language": "",
    "max_bit_rate": 0,
    "start_pts": 0,
    "start_time": 0,
    "time_base": "1/2500",
    "type": "StreamData"
  };

  const sourceStreams = [];
  const maxStreamIndex = Math.max(aStreamIndex, vStreamIndex);

  for(let i = 0; i <= maxStreamIndex; i++) {
    if(i === aStreamIndex) {
      sourceStreams.push(sourceAudioStream);
    } else if(i === vStreamIndex) {
      sourceStreams.push(sourceVideoStream);
    } else {
      sourceStreams.push(DUMMY_STREAM);
    }
  }

  // construct /production_master/sources
  const sources = {
    [streamUrl]: {
      "container_format": {
        "duration": DUMMY_DURATION,
        "filename": streamUrl,
        "format_name": "mov,mp4,m4a,3gp,3g2,mj2",
        "start_time": 0
      },
      "streams": sourceStreams
    }
  };

  // construct /production_master/variants
  const variants = {
    "default": {
      "streams": {
        "audio": {
          "default_for_media_type": false,
          "label": "",
          "language": "",
          "mapping_info": "",
          "sources": [
            {
              "files_api_path": streamUrl,
              "stream_index": aStreamIndex
            }
          ]
        },
        "video": {
          "default_for_media_type": false,
          "label": "",
          "language": "",
          "mapping_info": "",
          "sources": [
            {
              "files_api_path": streamUrl,
              "stream_index": vStreamIndex
            }
          ]
        }
      }
    }
  };

  // construct /production_master
  const production_master = {sources, variants};

  // get existing metadata
  console.log("Retrieving current metadata...");
  let metadata = await client.ContentObjectMetadata({
    libraryId,
    objectId
  });

  // add /production_master to metadata
  metadata.production_master = production_master;

  // write back to object
  console.log("Getting write token...");
  let editResponse = await client.EditContentObject({
    libraryId,
    objectId
  });
  let writeToken = editResponse.write_token;
  console.log(`New write token: ${writeToken}`);

  console.log("Writing back metadata with /production_master added...");
  await client.ReplaceMetadata({
    libraryId,
    metadata,
    objectId,
    writeToken
  });

  console.log("Finalizing...");
  let finalizeResponse = await client.FinalizeContentObject({
    libraryId,
    objectId,
    writeToken
  });
  let masterVersionHash = finalizeResponse.hash;
  console.log(`Finalized, new version hash: ${masterVersionHash}`);

  // Generate offering
  const createResponse = await client.CreateABRMezzanine({
    libraryId,
    objectId,
    masterVersionHash,
    variant: "default",
    offeringKey: "default",
    abrProfile
  });

  if(createResponse.warnings.length > 0) {
    console.log("WARNINGS:");
    console.log(JSON.stringify(createResponse.warnings, null, 2));
  }

  if(createResponse.errors.length > 0) {
    console.log("ERRORS:");
    console.log(JSON.stringify(createResponse.errors, null, 2));
  }

  let versionHash = createResponse.hash;
  console.log(`New version hash: ${versionHash}`);

  // get new metadata
  console.log("Retrieving revised metadata with offering...");
  metadata = await client.ContentObjectMetadata({
    libraryId,
    versionHash
  });

  console.log("Moving /abr_mezzanine/offerings to /offerings and removing /abr_mezzanine...");
  metadata.offerings = metadata.abr_mezzanine.offerings;
  delete metadata.abr_mezzanine;

  // add items to media_struct needed to use options.json handler
  metadata.offerings.default.media_struct.duration_rat = `${DUMMY_DURATION}`;

  // write back to object
  console.log("Getting write token...");
  editResponse = await client.EditContentObject({
    libraryId,
    objectId
  });
  writeToken = editResponse.write_token;
  console.log(`New write token: ${writeToken}`);

  console.log("Writing back metadata with /offerings...");
  await client.ReplaceMetadata({
    libraryId,
    metadata,
    objectId,
    writeToken
  });

  console.log("Finalizing...");
  finalizeResponse = await client.FinalizeContentObject({
    libraryId,
    objectId,
    writeToken
  });
  let finalHash = finalizeResponse.hash;
  console.log(`Finalized, new version hash: ${finalHash}`);
};

module.exports = {GenerateOffering};
