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
    segmentIndexes = [1, 2],
    playoutFormat = "hls-clear",
    contentType
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

    const formats = [playoutFormat].filter(f => f in formatObjs);

    if (formats.length === 0) {
      throw new Error(`${playoutFormat} is not found in metadata`);
    }

    outputDir =
      outputDir || path.join(process.cwd(), "output");

    for (const format of formats) {
      const hlsUrl = `playout/default/${format}`;

      const playlistUrl =
        await this.client.FabricUrl({
          libraryId,
          objectId,
          rep: `${hlsUrl}/playlist.m3u8`,
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
          `${url}/qlibs/${libraryId}/q/${hash}/rep/${hlsUrl}`,
          playlistText
        );

      const targetDir = contentType
        ? path.join(outputDir, contentType)
        : outputDir;

      for (const renditionPlaylistUrl of renditionPlaylists) {
        await this._downloadHlsClearRepresentation(
          renditionPlaylistUrl,
          targetDir,
          segmentIndexes
        );
      }
    }

    const buildDir = contentType
      ? path.join(outputDir, contentType)
      : outputDir;

    this._buildAllRenditions(buildDir);

    return `Successfully downloaded ${playoutFormat} segments and generated MP4 files.`;
  }

  async DownloadDashSegments({
    objectId,
    url,
    outputDir,
    segmentIndexes = [1, 2],
    contentType,
    atmos,
    playoutFormat = "dash-widevine"
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

    const formats = [playoutFormat].filter(f => f in formatObjs);

    if (formats.length === 0) {
      throw new Error(`${playoutFormat} is not found in metadata`);
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

      const updatedUrl = playlistUrl.replace(
        new URL(playlistUrl).origin,
        url,
      );
      console.log("dash url:", updatedUrl);

      await this._downloadDashAdaptation({mpdUrl: updatedUrl, outputBaseDir: outputDir, contentType, atmos, segmentIndexes});
    }

    if (contentType === "video") {
      this._buildAllRenditions(outputDir + "/video");
    } else {
      this._buildAllRenditions(outputDir+ "/audio");
    }

    return `Successfully downloaded ${playoutFormat} segments and generated MP4 files.`;
  }

  _parseM3U8(basePath, playlistText) {
    console.log("basePath:", basePath);

    return playlistText
      .split("\n")
      .map(line => line.trim())
      .filter(line => line && !line.startsWith("#"))
      .map(segment => `${basePath}/${segment}`);
  }

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
    for (const segment of ["/video/", "/audio/"]) {
      const parts = url.split(segment);
      if (parts.length > 1) {
        return parts[1].split("/")[0];
      }
    }
    throw new Error(`Cannot extract rep name from URL: ${url}`);
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


  async _downloadDashAdaptation({
    mpdUrl,
    outputBaseDir,
    contentType = "video",
    atmos = false,
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
    const adaptationSets = mpd?.MPD?.Period?.AdaptationSet;

    if (!adaptationSets) {
      throw new Error("No AdaptationSet found");
    }

    const sets = Array.isArray(adaptationSets) ? adaptationSets : [adaptationSets];

    const isVideo = (a) =>
      a.contentType === "video" || a.mimeType?.includes("video");

    const isAudio = (a) =>
      a.contentType === "audio" || a.mimeType?.includes("audio");

    const isAtmosRep = (rep) => {
      const codecs = (rep?.codecs || "").toLowerCase();
      const id = (rep?.id || "").toLowerCase();

      // Explicitly reject if codec says AAC, even if ID mentions Atmos
      if (codecs.includes("mp4a") || codecs.includes("aac")) {
        return false;
      }

      return (
        codecs.includes("ec-3") ||
        codecs.includes("eac3-joc") ||
        codecs.includes("ac-4") ||
        id.includes("ec-3") ||
        id.includes("eac3")
      );
    };

    const hasAtmos = (adaptation) => {
      const reps = Array.isArray(adaptation.Representation)
        ? adaptation.Representation
        : [adaptation.Representation];

      if (reps.some(isAtmosRep)) return true;

      // Check parent properties for Dolby Atmos signaling flags
      const props = [].concat(
        adaptation.SupplementalProperty || [],
        adaptation.EssentialProperty || []
      );

      return props.some((p) => {
        const scheme = (p.schemeIdUri || "").toLowerCase();
        const value = (p.value || "").toLowerCase();
        return (
          scheme.includes("dolby") ||
          value.includes("joc") ||
          value.includes("ec-3")
        );
      });
    };

    // Debug print
    for (const a of sets) {
      console.log("----");
      console.log("contentType:", a.contentType);
      console.log("label:", a.label || a.Name || a.name);
    }

    let adaptation;

    if (contentType === "video") {
      adaptation = sets.find(isVideo);
    } else {
      const audioSets = sets.filter(isAudio);
      console.log("Audio sets found:", audioSets.length);

      if (atmos) {
        adaptation = audioSets.find(hasAtmos);
      } else {
        adaptation = audioSets.find((a) => !hasAtmos(a));
      }

      console.log(
        "Selected adaptation:",
        adaptation?.label || adaptation?.name || "Unknown"
      );
    }

    if (!adaptation) {
      throw new Error(
        `No ${contentType}${atmos ? " (Atmos)" : ""} AdaptationSet found`
      );
    }

    const representations = adaptation.Representation;
    let reps = Array.isArray(representations) ? representations : [representations];
    reps = reps.filter(Boolean);

    if (contentType === "audio" && atmos) {
      const atmosReps = reps.filter(isAtmosRep);

      console.log("Available reps:", reps.map((r) => r.codecs || r.id));
      console.log("Atmos filtered reps:", atmosReps.map((r) => r.codecs || r.id));

      if (atmosReps.length === 0) {
        throw new Error("No Atmos track found inside selected AdaptationSet");
      }

      reps = atmosReps;
    }

    const mpdBase = mpdUrl.substring(0, mpdUrl.lastIndexOf("/") + 1);

    for (const rep of reps) {
      const repId = rep.id;
      const segmentTemplate = rep.SegmentTemplate || adaptation.SegmentTemplate;

      if (!segmentTemplate) {
        console.log(`Skipping ${repId}, no SegmentTemplate`);
        continue;
      }

      const flatFolderName = repId.split("/").pop().replace(/[^a-zA-Z0-9_@.-]/g, "_");
      const dir = path.join(outputBaseDir, contentType, flatFolderName);
      fs.mkdirSync(dir, { recursive: true });

      const initTemplate = segmentTemplate.initialization;

      const initUrl = mpdBase + initTemplate.replace("$RepresentationID$", repId);
      const mediaTemplate = segmentTemplate.media;

      const allFiles = [{ url: initUrl, name: "init.m4s" }];

      for (const index of segmentIndexes) {
        const segmentPath = mediaTemplate
          .replace("$RepresentationID$", repId)
          .replace(/\$Number%0(\d+)d\$/, (_, w) =>
            String(index).padStart(parseInt(w), "0")
          )
          .replace("$Number$", index);

        allFiles.push({
          url: mpdBase + segmentPath,
          name: `${String(index).padStart(5, "0")}.m4s`
        });
      }

      for (const file of allFiles) {
        console.log(`[${contentType}] downloading`, file.url);

        const r = await fetch(file.url);

        if (!r.ok) {
          throw new Error(`Failed download: ${file.url}`);
        }

        const buffer = Buffer.from(await r.arrayBuffer());
        const filePath = path.join(dir, file.name);

        fs.writeFileSync(filePath, buffer);
        console.log(`[${repId}] Downloaded ${file.name}`);
      }
    }

    return `${contentType} download completed`;
  }
  
}

exports.ElvSegments = ElvSegments;