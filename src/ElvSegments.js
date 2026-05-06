const { ElvClient } = require("@eluvio/elv-client-js");
const fs = require("fs");
const path = require("path");

class ElvSegments {
  constructor({configUrl, debugLogging = false}) {
    this.configUrl = configUrl;
    this.debug = debugLogging;
  }

  async Init({privateKey}) {
    this.client = await ElvClient.FromConfigurationUrl({
      configUrl: this.configUrl,
    });
    let wallet = this.client.GenerateWallet();
    let signer = wallet.AddAccount({
      privateKey: privateKey,
    });
    this.client.SetSigner({signer});
    this.client.ToggleLogging(this.debug);
  }

  async DownloadHlsClearSegments({objectId, url, outputDir}) {
    if (!objectId) {
      throw new Error("objectId is required");
    }
    if (!url) {
      throw new Error("url is required");
    }

    const libraryId = await this.client.ContentObjectLibraryId({ objectId });

    // check offerings has hls-clear
    const metadata = await this.client.ContentObjectMetadata({
      libraryId,
      objectId,
    });
    const hash = await this.client.LatestVersionHash({objectId});

    const formatObjs =
      metadata?.offerings?.default?.playout?.playout_formats;
    if (!formatObjs || typeof formatObjs !== "object") {
      throw new Error ("metadata.offerings.default.playout.playout_formats not found");
    }
    const formats = ["hls-clear"].filter(f => f in formatObjs);
    if (formats.length === 0) {
      throw new Error ("hls-clear is not found in metadata");
    }

    outputDir = outputDir || path.join(process.cwd(), "output");
    for (const format of formats) {
      const hlsClearUrl = `playout/default/${format}`;
      const basePath = `${url}/qlibs/${libraryId}/q/${hash}/rep/${hlsClearUrl}`;
      const playlistUrl = await this.client.FabricUrl({
        libraryId: libraryId,
        objectId: objectId,
        rep: `${hlsClearUrl}/playlist.m3u8`,
        channelAuth: true,
      });

      const res = await fetch(playlistUrl);
      if (!res.ok) {
        throw new Error(`HTTP error! status: ${res.status} for ${playlistUrl}`);
      }
      const playlistText = await res.text();
      const segmentUrls = this._parseM3U8(basePath, playlistText);

      for (const segmentUrl of segmentUrls) {
        await this._downloadHlsClearRepresentation(
          segmentUrl,
          outputDir
        );
      }
    }

    this._buildAllRenditions(outputDir);
    return "Successfully downloaded HLS segments and generated MP4 files for each resolution.";
  }

  _parseM3U8(basePath, playlistText) {
    return playlistText
      .split("\n")
      .map(line => line.trim())
      .filter(line => line && !line.startsWith("#"))
      .map(segment => `${basePath}/${segment}`);
  }

  _parseHlsInitAndSegments(playlistUrl, playlistText) {
    const base = playlistUrl.substring(0, playlistUrl.lastIndexOf("/") + 1);

    let init = null;
    const segments = [];

    const lines = playlistText.split("\n").map(l => l.trim());

    for (const line of lines) {
      if (!line) continue;

      // INIT segment
      if (line.startsWith("#EXT-X-MAP")) {
        const match = line.match(/URI="([^"]+)"/);
        if (match?.[1]) {
          const uri = match[1];
          init = uri.startsWith("http") ? uri : base + uri;
        }
        continue;
      }

      // media segments
      if (!line.startsWith("#")) {
        const url = line.startsWith("http") ? line : base + line;
        segments.push(url);

        if (segments.length === 2) break;
      }
    }

    return {
      init: init ?? null,
      segments
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

  async _downloadHlsClearRepresentation(playlistUrl, outputBaseDir) {
    const repName = this._getRepName(playlistUrl);

    const dir = `${outputBaseDir}/${repName}`;
    this._dirExists(dir);

    // fetch playlist
    const res = await fetch(playlistUrl);
    if (!res.ok) throw new Error(`Failed playlist: ${res.status}`);

    const playlistText = await res.text();

    // parse init + first segments
    const { init, segments } =
      this._parseHlsInitAndSegments(playlistUrl, playlistText);

    const allFiles = [];

    if (init) allFiles.push({ url: init, name: "init.m4s" });

    segments.forEach((segUrl, i) => {
      allFiles.push({
        url: segUrl,
        name: `${String(i + 1).padStart(5, "0")}.m4s`
      });
    });

    // download all files
    for (const file of allFiles) {
      const r = await fetch(file.url);
      if (!r.ok) throw new Error(`Failed segment: ${file.url}`);

      const buffer = Buffer.from(await r.arrayBuffer());

      const path = `${dir}/${file.name}`;
      fs.writeFileSync(path, buffer);
    }

    return dir;
  }

  _buildMp4ForFolder(dir) {
    console.log(`Building MP4 for ${dir}`);

    const initFile = path.join(dir, "init.m4s");

    if (!fs.existsSync(initFile)) {
      throw new Error(`Missing init.m4s in ${dir}`);
    }

    // collect segments (sorted)
    const segments = fs
      .readdirSync(dir)
      .filter(f => f.endsWith(".m4s") && f !== "init.m4s")
      .sort((a, b) => {
        const na = parseInt(a);
        const nb = parseInt(b);
        return na - nb;
      });

    if (segments.length === 0) {
      throw new Error(`No segments found in ${dir}`);
    }

    const outputFile = path.join(dir, "output.mp4");

    // clean output if exists
    if (fs.existsSync(outputFile)) {
      fs.unlinkSync(outputFile);
    }

    const out = fs.createWriteStream(outputFile);

    // write init segment first
    out.write(fs.readFileSync(initFile));

    // append media segments
    for (const seg of segments) {
      const segPath = path.join(dir, seg);
      out.write(fs.readFileSync(segPath));
    }
    out.end();
    console.log("Created:", outputFile);
    console.log();
  }

  _buildAllRenditions(baseDir) {
    const dirs = fs.readdirSync(baseDir)
      .map(name => path.join(baseDir, name))
      .filter(p => fs.statSync(p).isDirectory());

    for (const dir of dirs) {
      this._buildMp4ForFolder(dir);
    }
  }
}

exports.ElvSegments = ElvSegments;