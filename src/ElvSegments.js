const { ElvClient } = require("@eluvio/elv-client-js");
const fs = require("fs");
const path = require("path");
const { XMLParser } = require("fast-xml-parser");

class ElvSegments {
  constructor({ configUrl, debugLogging = false }) {
    this.configUrl = configUrl;
    this.debug = debugLogging;
  }

  async Init({ privateKey }) {
    this.client = await ElvClient.FromConfigurationUrl({
      configUrl: this.configUrl,
    });

    let wallet = this.client.GenerateWallet();

    let signer = wallet.AddAccount({
      privateKey: privateKey,
    });

    this.client.SetSigner({ signer });
    this.client.ToggleLogging(this.debug);
  }

  async DownloadHlsClearSegments({
    objectId,
    url,
    outputDir,
    segmentIndexes = [1, 2]
  }) {
    if (!objectId) {
      throw new Error("objectId is required");
    }

    if (!url) {
      throw new Error("url is required");
    }

    const libraryId =
      await this.client.ContentObjectLibraryId({ objectId });

    const metadata = await this.client.ContentObjectMetadata({
      libraryId,
      objectId,
    });

    const hash =
      await this.client.LatestVersionHash({ objectId });

    const formatObjs =
      metadata?.offerings?.default?.playout?.playout_formats;

    if (!formatObjs || typeof formatObjs !== "object") {
      throw new Error(
        "metadata.offerings.default.playout.playout_formats not found"
      );
    }

    const formats = ["hls-clear"].filter(f => f in formatObjs);

    if (formats.length === 0) {
      throw new Error("hls-clear is not found in metadata");
    }

    outputDir =
      outputDir || path.join(process.cwd(), "output");

    for (const format of formats) {
      const hlsClearUrl = `playout/default/${format}`;

      const playlistUrl =
        await this.client.FabricUrl({
          libraryId,
          objectId,
          rep: `${hlsClearUrl}/playlist.m3u8`,
          channelAuth: true,
        });

      const res = await fetch(playlistUrl);

      if (!res.ok) {
        throw new Error(
          `HTTP error! status: ${res.status} for ${playlistUrl}`
        );
      }

      const playlistText = await res.text();

      const renditionPlaylists =
        this._parseM3U8(
          `${url}/qlibs/${libraryId}/q/${hash}/rep/${hlsClearUrl}`,
          playlistText
        );

      for (const renditionPlaylistUrl of renditionPlaylists) {
        await this._downloadHlsClearRepresentation(
          renditionPlaylistUrl,
          outputDir,
          segmentIndexes
        );
      }
    }

    this._buildAllRenditions(outputDir);

    return "Successfully downloaded HLS segments and generated MP4 files.";
  }

  async DownloadDashWidevineSegments({
    objectId,
    url,
    outputDir,
    segmentIndexes = [1, 2]
  }) {
    if (!objectId) {
      throw new Error("objectId is required");
    }

    if (!url) {
      throw new Error("url is required");
    }

    const libraryId =
      await this.client.ContentObjectLibraryId({ objectId });

    const metadata = await this.client.ContentObjectMetadata({
      libraryId,
      objectId,
    });

    // const hash =
    //   await this.client.LatestVersionHash({ objectId });

    const formatObjs =
      metadata?.offerings?.default?.playout?.playout_formats;

    if (!formatObjs || typeof formatObjs !== "object") {
      throw new Error(
        "metadata.offerings.default.playout.playout_formats not found"
      );
    }

    const formats = ["dash-widevine"].filter(f => f in formatObjs);

    if (formats.length === 0) {
      throw new Error("dash-widevine is not found in metadata");
    }

    outputDir =
      outputDir || path.join(process.cwd(), "output");

    for (const format of formats) {
      const dashWidewineUrl = `playout/default/${format}`;

      const playlistUrl =
        await this.client.FabricUrl({
          libraryId,
          objectId,
          rep: `${dashWidewineUrl}/dash.mpd`,
          channelAuth: true,
        });

      // const res = await fetch(playlistUrl);
      //
      // if (!res.ok) {
      //   throw new Error(
      //     `HTTP error! status: ${res.status} for ${playlistUrl}`
      //   );
      // }
      //
      // const playlistText = await res.text();
      console.log(playlistUrl);

      await this._downloadDashWidevineRepresentation({mpdUrl: playlistUrl, outputBaseDir: outputDir, segmentIndexes});
    }

    this._buildAllRenditions(outputDir);

    return "Successfully downloaded Dash-widevine segments and generated MP4 files.";
  }

  _parseM3U8(basePath, playlistText) {
    return playlistText
      .split("\n")
      .map(line => line.trim())
      .filter(line => line && !line.startsWith("#"))
      .map(segment => `${basePath}/${segment}`);
  }

  // UPDATED
  _parseHlsInitAndSegments(
    playlistUrl,
    playlistText,
    segmentIndexes = [1, 2]
  ) {
    const base =
      playlistUrl.substring(
        0,
        playlistUrl.lastIndexOf("/") + 1
      );

    let init = null;

    const allSegments = [];

    const lines =
      playlistText
        .split("\n")
        .map(l => l.trim());

    for (const line of lines) {
      if (!line) continue;

      // init segment
      if (line.startsWith("#EXT-X-MAP")) {
        const match = line.match(/URI="([^"]+)"/);

        if (match?.[1]) {
          const uri = match[1];

          init =
            uri.startsWith("http")
              ? uri
              : base + uri;
        }

        continue;
      }

      // media segment
      if (!line.startsWith("#")) {
        const url =
          line.startsWith("http")
            ? line
            : base + line;

        allSegments.push(url);
      }
    }

    console.log("Total Segments:", allSegments.length);

    // pick requested segments
    const selectedSegments = [];

    for (const index of segmentIndexes) {
      const seg = allSegments[index - 1];

      if (seg) {
        selectedSegments.push({
          index,
          url: seg
        });
      }
    }

    return {
      init,
      segments: selectedSegments
    };
  }

  _getRepName(url) {
    return url.split("/video/")[1].split("/")[0];
  }

  _dirExists(dir) {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  }

  async _downloadHlsClearRepresentation(
    playlistUrl,
    outputBaseDir,
    segmentIndexes
  ) {
    const repName = this._getRepName(playlistUrl);

    const dir = `${outputBaseDir}/${repName}`;

    this._dirExists(dir);

    const res = await fetch(playlistUrl);

    if (!res.ok) {
      throw new Error(`Failed playlist: ${res.status}`);
    }

    const playlistText = await res.text();

    const { init, segments } =
      this._parseHlsInitAndSegments(
        playlistUrl,
        playlistText,
        segmentIndexes
      );

    const allFiles = [];

    if (init) {
      allFiles.push({
        url: init,
        name: "init.m4s"
      });
    }

    for (const seg of segments) {
      allFiles.push({
        url: seg.url,
        name: `${String(seg.index).padStart(5, "0")}.m4s`
      });
    }

    for (const file of allFiles) {
      const r = await fetch(file.url);

      if (!r.ok) {
        throw new Error(
          `Failed segment: ${file.url}`
        );
      }

      const buffer =
        Buffer.from(await r.arrayBuffer());

      const filePath =
        `${dir}/${file.name}`;

      fs.writeFileSync(filePath, buffer);

      console.log(`Downloaded ${file.name}`);
    }

    return dir;
  }

  _buildMp4ForFolder(dir) {
    console.log(`Building MP4 for ${dir}`);

    const initFile = path.join(dir, "init.m4s");

    if (!fs.existsSync(initFile)) {
      throw new Error(`Missing init.m4s in ${dir}`);
    }

    const segments = fs
      .readdirSync(dir)
      .filter(
        f =>
          f.endsWith(".m4s") &&
          f !== "init.m4s"
      )
      .sort((a, b) => {
        const na = parseInt(a);
        const nb = parseInt(b);
        return na - nb;
      });

    if (segments.length === 0) {
      throw new Error(`No segments found in ${dir}`);
    }

    const outputFile =
      path.join(dir, "output.mp4");

    if (fs.existsSync(outputFile)) {
      fs.unlinkSync(outputFile);
    }

    const out =
      fs.createWriteStream(outputFile);

    out.write(fs.readFileSync(initFile));

    for (const seg of segments) {
      const segPath = path.join(dir, seg);

      out.write(fs.readFileSync(segPath));
    }

    out.end();

    console.log("Created:", outputFile);
    console.log();
  }

  _buildAllRenditions(baseDir) {
    const dirs = fs
      .readdirSync(baseDir)
      .map(name => path.join(baseDir, name))
      .filter(p => fs.statSync(p).isDirectory());

    for (const dir of dirs) {
      this._buildMp4ForFolder(dir);
    }
  }

  async _downloadDashWidevineRepresentation({
    mpdUrl,
    outputBaseDir,
    segmentIndexes = [1, 2]
  }) {
    const res = await fetch(mpdUrl);

    if (!res.ok) {
      throw new Error(`Failed MPD fetch: ${res.status}`);
    }

    const mpdText = await res.text();

    const parser = new XMLParser({
      ignoreAttributes: false,
      attributeNamePrefix: ""
    });

    const mpd = parser.parse(mpdText);

    const adaptationSets =
      mpd?.MPD?.Period?.AdaptationSet;

    if (!adaptationSets) {
      throw new Error("No AdaptationSet found");
    }

    const videoAdaptation =
      Array.isArray(adaptationSets)
        ? adaptationSets.find(a => a.contentType === "video")
        : adaptationSets;

    if (!videoAdaptation) {
      throw new Error("No video AdaptationSet found");
    }

    const representations =
      videoAdaptation.Representation;

    const reps =
      Array.isArray(representations)
        ? representations
        : [representations];

    const mpdBase =
      mpdUrl.substring(
        0,
        mpdUrl.lastIndexOf("/") + 1
      );

    for (const rep of reps) {
      const repId = rep.id;

      const segmentTemplate = rep.SegmentTemplate;

      if (!segmentTemplate) {
        console.log(`Skipping ${repId}, no SegmentTemplate`);
        continue;
      }

      const dir =
        path.join(outputBaseDir, repId);

      this._dirExists(dir);

      // init url
      const initTemplate =
        segmentTemplate.initialization;

      const initUrl =
        mpdBase +
        initTemplate.replace(
          "$RepresentationID$",
          repId
        );

      // media template
      const mediaTemplate =
        segmentTemplate.media;

      const allFiles = [];

      allFiles.push({
        url: initUrl,
        name: "init.m4s"
      });

      for (const index of segmentIndexes) {
        const segmentPath =
          mediaTemplate
            .replace("$RepresentationID$", repId)
            .replace(
              /\$Number%0(\d+)d\$/,
              (_, width) =>
                String(index).padStart(
                  parseInt(width),
                  "0"
                )
            );

        const segmentUrl =
          mpdBase + segmentPath;

        allFiles.push({
          url: segmentUrl,
          name: `${String(index).padStart(5, "0")}.m4s`
        });
      }

      // download files
      for (const file of allFiles) {
        const r = await fetch(file.url);

        if (!r.ok) {
          throw new Error(
            `Failed download: ${file.url}`
          );
        }

        const buffer =
          Buffer.from(await r.arrayBuffer());

        const filePath =
          path.join(dir, file.name);

        fs.writeFileSync(filePath, buffer);

        console.log(
          `[${repId}] Downloaded ${file.name}`
        );
      }
    }

    return "DASH Widevine download completed";
  }

}

exports.ElvSegments = ElvSegments;