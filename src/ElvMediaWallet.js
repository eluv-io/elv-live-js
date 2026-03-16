const { ElvClient } = require("@eluvio/elv-client-js");
const crypto = require("crypto");
const fs = require("fs");
const path = require("path");
const mime = require("mime-types");
const yaml = require("js-yaml");

const { CatalogService } = require("./CatalogService");
const { PropertyService } = require("./PropertyService");

class ElvMediaWallet {
  constructor({ configUrl, debugLogging = false }) {
    this.configUrl = configUrl;
    this.debugLogging = debugLogging;
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
    this.client.ToggleLogging(this.debugLogging);

    this.catalogService = new CatalogService(this);
    this.propertyService = new PropertyService(this);
  }

  async getLibraryAndHash(objectId) {
    const libraryId = await this.client.ContentObjectLibraryId({ objectId });
    const versionHash = await this.client.LatestVersionHash({ objectId });
    return { libraryId, versionHash };
  }

  async getContentMeta(objectId) {
    const { libraryId } = await this.getLibraryAndHash(objectId);

    const meta = await this.client.ContentObjectMetadata({
      libraryId,
      objectId,
      resolveLinks: false
    });

    if (!meta?.public?.name) {
      throw new Error("Content object missing public.name property");
    }

    return meta;
  }

  /* ----------------------- Shared Helpers ----------------------- */

  resolveCompositionKey(contentMeta, compositionKey) {
    const offerings = contentMeta?.channel?.offerings;

    if (!offerings || typeof offerings !== "object") {
      throw new Error("Content object has no compositions");
    }

    const keys = Object.keys(offerings);
    if (!keys.length) {
      throw new Error("Content object has no compositions");
    }

    const key = compositionKey ?? keys[0];

    if (!offerings[key]) {
      throw new Error(`Composition does not exist: ${key}`);
    }

    return key;
  }

  async applyThumbnailLink({
    libraryId,
    objectId,
    writeToken,
    target,
    catalogHash,
    thumbnail_landscape,
    thumbnail_portrait,
    thumbnail_square
  }) {
    const thumbnails = {
      landscape: thumbnail_landscape,
      portrait: thumbnail_portrait,
      square: thumbnail_square
    };

    console.log("Received thumbnails:");
    console.log("Landscape:", thumbnails.landscape);
    console.log("Portrait:", thumbnails.portrait);
    console.log("Square:", thumbnails.square);

    for (const [size, filePath] of Object.entries(thumbnails)) {
      if (!filePath) continue;
      if (!fs.existsSync(filePath)) {
        console.warn(`Thumbnail file for ${size} not found, skipping: ${filePath}`);
        continue;
      }

      const fileName = path.basename(filePath);
      const mimeType = mime.lookup(filePath) || "application/octet-stream";
      const fileBuffer = fs.readFileSync(filePath);
      const hashBuffer = crypto.createHash("sha256").update(fileBuffer).digest();

      await this.client.UploadFiles({
        libraryId,
        objectId,
        writeToken,
        encrypted: false,
        fileInfo: [
          {
            path: fileName,
            mime_type: mimeType,
            size: fileBuffer.byteLength,
            data: fileBuffer
          }
        ]
      });

      const imgKey = `thumbnail_image_${size}`;
      const hashKey = `thumbnail_image_${size}_hash`;

      target[imgKey] = target[imgKey] || {};
      target[imgKey]["."] = { container: catalogHash };
      target[imgKey]["/"] = `./files/${fileName}`;

      target[hashKey] = target[hashKey] || hashBuffer.toString("base64");
    }
  }

  applyMediaLink({
    target,
    contentMeta,
    catalogHash,
    contentHash,
    contentIdType,
    compositionKey
  }) {
    target.media_link = target.media_link || {};
    target.media_link_info = target.media_link_info || {};

    target.media_link["."] = { container: catalogHash };
    target.media_link["/"] =
      `/qfab/${contentHash}/meta/public/asset_metadata`;

    switch (contentIdType) {
      case "live":
      case "vod":
        target.live_video = contentIdType === "live";
        target.media_link_info.type = "main";
        target.media_link_info.name = contentMeta.public.name;
        break;

      case "composition":
        target.live_video = false;
        target.media_link_info.type = "composition";
        target.media_link_info.composition_key =
          this.resolveCompositionKey(contentMeta, compositionKey);
        target.media_link_info.name = contentMeta.public.name;
        break;

      default:
        throw new Error(`Invalid contentType: ${contentIdType}`);
    }
  }

  readMetadataFileOrObject(mediaMetadata) {
    if (!mediaMetadata) return {};

    if (typeof mediaMetadata === "string") {
      const ext = path.extname(mediaMetadata).toLowerCase();
      const raw = fs.readFileSync(mediaMetadata, "utf-8");

      if (ext === ".json") return JSON.parse(raw);
      if (ext === ".yaml" || ext === ".yml") return yaml.load(raw);

      throw new Error(`Unsupported metadata file type: ${ext} (use .json, .yaml, .yml)`);
    }

    if (typeof mediaMetadata === "object") return mediaMetadata;
    return {};
  }

  normalizeMediaMetadata(raw = {}) {
    const meta = { ...raw };

    // ---- Title field aliasing (no "titles" object) ----
    // attached JSON: title -> display_title
    if (meta.display_title === undefined && meta.title !== undefined) {
      meta.display_title = meta.title;
    }

    // attached JSON sometimes uses description_rich_text
    if (meta.description === undefined && meta.description_rich_text !== undefined) {
      meta.description = meta.description_rich_text;
    }

    // ---- Thumbnail accessor convenience (optional, not persisted unless you later write it) ----
    // We do NOT add meta.thumbnails; we just normalize the known canonical thumbnail link fields when possible.
    // If your JSON has `thumbnails: { landscape }`, lift into `thumbnail_image_landscape`
    if (meta.thumbnails && typeof meta.thumbnails === "object") {
      if (meta.thumbnail_image_landscape === undefined && meta.thumbnails.landscape !== undefined) {
        meta.thumbnail_image_landscape = meta.thumbnails.landscape;
      }
      if (meta.thumbnail_image_portrait === undefined && meta.thumbnails.portrait !== undefined) {
        meta.thumbnail_image_portrait = meta.thumbnails.portrait;
      }
      if (meta.thumbnail_image_square === undefined && meta.thumbnails.square !== undefined) {
        meta.thumbnail_image_square = meta.thumbnails.square;
      }
    }

    // Also allow old/flag-ish fields to populate canonical ones if present
    if (meta.thumbnail_image_landscape === undefined && meta.thumbnail_landscape !== undefined) {
      meta.thumbnail_image_landscape = meta.thumbnail_landscape;
    }
    if (meta.thumbnail_image_portrait === undefined && meta.thumbnail_portrait !== undefined) {
      meta.thumbnail_image_portrait = meta.thumbnail_portrait;
    }
    if (meta.thumbnail_image_square === undefined && meta.thumbnail_square !== undefined) {
      meta.thumbnail_image_square = meta.thumbnail_square;
    }

    return meta;
  }

  applyMediaMetadataFields(targetItem, meta) {
    // Apply titles individually if present
    if (meta.catalog_title !== undefined) targetItem.catalog_title = meta.catalog_title;
    if (meta.display_title !== undefined) targetItem.display_title = meta.display_title;
    if (meta.subtitle !== undefined) targetItem.subtitle = meta.subtitle;
    if (meta.description !== undefined) targetItem.description = meta.description;

    // Other common passthrough fields
    const passthroughKeys = [
      "type",
      "media_type",
      "live_video",
      "public",

      "date",
      "start_time",
      "end_time",
      "stream_start_time",

      "allow_download",
      "enable_dvr",
      "override_settings_when_viewed",

      "player_controls",
      "player_loop",
      "player_muted",
      "player_profile",

      "primary_view_label",
      "additional_views",
      "additional_views_label",

      "offerings",
      "permissions",
      "tags",
      "attributes",
      "headers",
      "viewed_settings"
    ];

    for (const k of passthroughKeys) {
      if (meta[k] !== undefined) targetItem[k] = meta[k];
    }

    // Structured objects
    if (meta.media_link !== undefined) targetItem.media_link = meta.media_link;
    if (meta.media_link_info !== undefined) targetItem.media_link_info = meta.media_link_info;

    // Thumbnails (Fabric link objects)
    if (meta.thumbnail_image_landscape !== undefined)
      targetItem.thumbnail_image_landscape = meta.thumbnail_image_landscape;
    if (meta.thumbnail_image_portrait !== undefined)
      targetItem.thumbnail_image_portrait = meta.thumbnail_image_portrait;
    if (meta.thumbnail_image_square !== undefined)
      targetItem.thumbnail_image_square = meta.thumbnail_image_square;

    // Hash fields
    if (meta.thumbnail_image_landscape_hash !== undefined)
      targetItem.thumbnail_image_landscape_hash = meta.thumbnail_image_landscape_hash;
    if (meta.thumbnail_image_portrait_hash !== undefined)
      targetItem.thumbnail_image_portrait_hash = meta.thumbnail_image_portrait_hash;
    if (meta.thumbnail_image_square_hash !== undefined)
      targetItem.thumbnail_image_square_hash = meta.thumbnail_image_square_hash;
  }

  // Deep merge where SOURCE overwrites TARGET
  // - skips only undefined
  // - overwrites with null/false/0/""
  // - arrays overwrite wholesale
  deepMergeOverwrite(target, source) {
    if (source === undefined) return target;
    if (source === null || typeof source !== "object") return source;
    if (Array.isArray(source)) return source.slice();

    const out =
      target && typeof target === "object" && !Array.isArray(target)
        ? { ...target }
        : {};

    for (const [k, v] of Object.entries(source)) {
      if (v === undefined) continue;
      out[k] = this.deepMergeOverwrite(out[k], v);
    }

    return out;
  }

  /* ----------------------- Catalog delegates ----------------------- */

  async CatalogList(args) { return this.catalogService.CatalogList(args); }
  async CatalogItemGet(args) { return this.catalogService.CatalogItemGet(args); }
  async CatalogItemDelete(args) { return this.catalogService.CatalogItemDelete(args); }
  async CatalogItemAdd(args) { return this.catalogService.CatalogItemAdd(args); }
  async CatalogItemSet(args) { return this.catalogService.CatalogItemSet(args); }
  async CatalogItemCopy(args) { return this.catalogService.CatalogItemCopy(args); }
  async CatalogItemBulkAdd(args) { return this.catalogService.CatalogItemBulkAdd(args); }

  /* ----------------------- Property delegates ----------------------- */

  async PropertySectionItemAdd(args) { return this.propertyService.PropertySectionItemAdd(args); }
  async PropertySectionItemBulkAdd(args) { return this.propertyService.PropertySectionItemBulkAdd(args); }
  async PropertySectionItemDelete(args) { return this.propertyService.PropertySectionItemDelete(args); }
}

exports.ElvMediaWallet = ElvMediaWallet;
