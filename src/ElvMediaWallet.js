const { ElvClient } = require("@eluvio/elv-client-js");
const crypto = require("crypto");
const fs = require("fs");
const path = require("path");
const mime = require("mime-types");

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
      if (!filePath) continue; // skip if not provided
      if (!fs.existsSync(filePath)) {
        console.warn(`Thumbnail file for ${size} not found, skipping: ${filePath}`);
        continue;
      }

      const fileName = path.basename(filePath);
      const mimeType = mime.lookup(filePath) || "application/octet-stream";
      const fileBuffer = fs.readFileSync(filePath);
      const hashBuffer = crypto.randomBytes(32); // random 256-bit hash

      // Upload the file to the catalog object
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

      // Metadata keys for this thumbnail size
      const imgKey = `thumbnail_image_${size}`;
      const hashKey = `thumbnail_image_${size}_hash`;

      // Merge into existing metadata without overwriting other sizes
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

  /* ----------------------- Catalog APIs ----------------------- */


  async CatalogList({ objectId }) {
    console.log("Object ID:", objectId);

    const { libraryId } = await this.getLibraryAndHash(objectId);

    return await this.client.ContentObjectMetadata({
      libraryId,
      objectId,
      metadataSubtree: "/public/asset_metadata/info/media",
      resolveLinks: false
    });
  }

  async CatalogItemGet({ objectId, itemId }) {
    console.log("Object ID:", objectId);
    console.log("Item ID:", itemId);

    const { libraryId } = await this.getLibraryAndHash(objectId);
    try {
      return await this.client.ContentObjectMetadata({
        libraryId,
        objectId,
        metadataSubtree: `/public/asset_metadata/info/media/${itemId}`,
        resolveLinks: false
      });
    } catch {
      throw new Error(`Item ${itemId} does not exist in Catalog ${objectId}`);
    }
  }

  async CatalogItemDelete({ objectId, itemId }) {
    console.log("Object ID:", objectId);
    console.log("Item ID:", itemId);

    const { libraryId } = await this.getLibraryAndHash(objectId);
    const edit = await this.client.EditContentObject({
      libraryId,
      objectId
    });

    await this.client.DeleteMetadata({
      libraryId,
      objectId,
      writeToken: edit.write_token,
      metadataSubtree: `/public/asset_metadata/info/media/${itemId}`,
      resolveLinks: false
    });

    await this.client.FinalizeContentObject({
      libraryId,
      objectId,
      writeToken: edit.write_token,
      commitMessage: `Deleted Media Item ${itemId}`
    });

    return console.log(`Deleted Media Item ${itemId}`);
  }

  async CatalogItemAdd({
    objectId,
    itemLabel = "New Media Item",

    contentId,
    contentIdType,
    isPublic = false,
    compositionKey,
    thumbnail_landscape,
    thumbnail_portrait,
    thumbnail_square,

    catalogTitle,
    displayTitle,
    subtitle,
    description,

    mediaMetadata
  }) {
    const { libraryId: catalogLib, versionHash: catalogHash } =
      await this.getLibraryAndHash(objectId);

    // Parse + normalize file/object metadata
    let metadata = this.readMetadataFileOrObject(mediaMetadata);
    metadata = this.normalizeMediaMetadata(metadata);

    // Resolve values (file > flags)
    const resolvedItemLabel = metadata.label ?? itemLabel;
    const resolvedContentId = metadata.contentId ?? contentId;
    const resolvedContentIdType = metadata.contentIdType ?? contentIdType;
    const resolvedPublic = metadata.public ?? isPublic;
    const resolvedCompositionKey = metadata.compositionKey ?? compositionKey;

    const resolvedTitles = {
      catalog_title: metadata.catalog_title ?? catalogTitle,
      title: metadata.display_title ?? displayTitle,
      subtitle: metadata.subtitle ?? subtitle,
      description: metadata.description ?? description
    };


    const resolvedThumbnails = {
      landscape: metadata.thumbnails?.landscape ?? thumbnail_landscape,
      portrait: metadata.thumbnails?.portrait ?? thumbnail_portrait,
      square: metadata.thumbnails?.square ?? thumbnail_square
    };

    const catalogMedia =
      (await this.client.ContentObjectMetadata({
        libraryId: catalogLib,
        objectId,
        metadataSubtree: "/public/asset_metadata/info/media",
        resolveLinks: false
      })) || {};

    const newMediaId =
      "mvid" +
      crypto
        .randomBytes(18)
        .toString("base64")
        .replace(/[^a-zA-Z0-9]/g, "")
        .slice(0, 24);

    const newItem = {
      id: newMediaId,
      label: resolvedItemLabel,
      media_catalog_id: objectId,
      media_type: metadata.media_type ?? "Video",
      live_video: metadata.live_video ?? resolvedContentIdType === "live",
      public: !!resolvedPublic,

      ...(resolvedTitles.catalog_title && { catalog_title: resolvedTitles.catalog_title }),
      ...(resolvedTitles.title && { title: resolvedTitles.title }),
      ...(resolvedTitles.subtitle && { subtitle: resolvedTitles.subtitle }),
      ...(resolvedTitles.description && { description: resolvedTitles.description })
    };

    // Apply “extra fields” from metadata file (overwrites if present)
    this.applyMediaMetadataFields(newItem, metadata);

    catalogMedia[newMediaId] = newItem;

    // Media link: if file includes media_link, keep it and skip applyMediaLink
    const hasDirectMediaLink = metadata.media_link !== undefined;

    if (!hasDirectMediaLink && resolvedContentId) {
      const contentMeta = await this.getContentMeta(resolvedContentId);
      const { versionHash: contentHash } =
        await this.getLibraryAndHash(resolvedContentId);

      this.applyMediaLink({
        target: newItem,
        contentMeta,
        catalogHash,
        contentHash,
        contentIdType: resolvedContentIdType,
        compositionKey: resolvedCompositionKey
      });
    }

    const edit = await this.client.EditContentObject({
      libraryId: catalogLib,
      objectId
    });

    // Thumbnails: if file includes thumbnail_image_* objects, keep and skip applyThumbnailLink
    const hasDirectThumbs =
      metadata.thumbnail_image_landscape !== undefined ||
      metadata.thumbnail_image_portrait !== undefined ||
      metadata.thumbnail_image_square !== undefined;

    if (!hasDirectThumbs && (resolvedThumbnails.landscape || resolvedThumbnails.portrait || resolvedThumbnails.square)) {
      await this.applyThumbnailLink({
        libraryId: catalogLib,
        objectId,
        writeToken: edit.write_token,
        target: newItem,
        catalogHash,
        thumbnail_landscape: resolvedThumbnails.landscape,
        thumbnail_portrait: resolvedThumbnails.portrait,
        thumbnail_square: resolvedThumbnails.square
      });
    }

    await this.client.ReplaceMetadata({
      libraryId: catalogLib,
      objectId,
      writeToken: edit.write_token,
      metadata: catalogMedia,
      metadataSubtree: "/public/asset_metadata/info/media"
    });

    await this.client.FinalizeContentObject({
      libraryId: catalogLib,
      objectId,
      writeToken: edit.write_token,
      commitMessage: `Added Media Item ${newMediaId}`
    });

    return newItem;
  }

  async CatalogItemSet({
    objectId,
    itemId,

    itemLabel = "New Media Item",

    contentId,
    contentIdType,
    isPublic = false,
    compositionKey,
    thumbnail_landscape,
    thumbnail_portrait,
    thumbnail_square,

    catalogTitle,
    displayTitle,
    subtitle,
    description,

    mediaMetadata
  }) {
    const { libraryId: catalogLib, versionHash: catalogHash } =
      await this.getLibraryAndHash(objectId);

    // Existing item metadata
    const mediaItemMeta = await this.CatalogItemGet({ objectId, itemId });

    /* --------------------------------------------
     * Load + normalize metadata file
     * -------------------------------------------- */
    let metadata = this.readMetadataFileOrObject(mediaMetadata);
    metadata = this.normalizeMediaMetadata(metadata);

    // Force identity from CLI
    metadata.id = itemId;
    metadata.media_catalog_id = objectId;

    /* --------------------------------------------
     * Merge file metadata over existing
     * -------------------------------------------- */
    let merged = this.deepMergeOverwrite(mediaItemMeta, metadata);

    // Apply normalized field handling (titles, passthrough keys)
    this.applyMediaMetadataFields(merged, metadata);

    /* --------------------------------------------
     * Apply CLI flags (override file + existing)
     * -------------------------------------------- */

    if (itemLabel !== undefined) {
      merged.label = itemLabel;
    }

    if (catalogTitle !== undefined) {
      merged.catalog_title = catalogTitle;
    }

    if (displayTitle !== undefined) {
      merged.title = displayTitle;
    }

    if (subtitle !== undefined) {
      merged.subtitle = subtitle;
    }

    if (description !== undefined) {
      merged.description = description;
    }

    // Public flag
    if (isPublic !== undefined) {
      merged.public = !!isPublic;
    }

    /* --------------------------------------------
     * Media Link Handling
     * -------------------------------------------- */

    const resolvedContentId = metadata.contentId ?? contentId;
    const resolvedContentIdType = metadata.contentIdType ?? contentIdType;
    const resolvedCompositionKey = metadata.compositionKey ?? compositionKey;

    const hasDirectMediaLink = metadata.media_link !== undefined;

    if (!hasDirectMediaLink && resolvedContentId) {
      const contentMeta = await this.getContentMeta(resolvedContentId);
      const { versionHash: contentHash } =
        await this.getLibraryAndHash(resolvedContentId);

      this.applyMediaLink({
        target: merged,
        contentMeta,
        catalogHash,
        contentHash,
        contentIdType: resolvedContentIdType,
        compositionKey: resolvedCompositionKey
      });
    }

    /* --------------------------------------------
     * Begin Edit
     * -------------------------------------------- */

    const edit = await this.client.EditContentObject({
      libraryId: catalogLib,
      objectId
    });

    /* --------------------------------------------
     * Thumbnails
     * -------------------------------------------- */

    const hasDirectThumbs =
      metadata.thumbnail_image_landscape !== undefined ||
      metadata.thumbnail_image_portrait !== undefined ||
      metadata.thumbnail_image_square !== undefined;

    if (!hasDirectThumbs &&
      (thumbnail_landscape || thumbnail_portrait || thumbnail_square)) {

      await this.applyThumbnailLink({
        libraryId: catalogLib,
        objectId,
        writeToken: edit.write_token,
        target: merged,
        catalogHash,
        thumbnail_landscape,
        thumbnail_portrait,
        thumbnail_square
      });
    }

    /* --------------------------------------------
     * Persist
     * -------------------------------------------- */

    await this.client.ReplaceMetadata({
      libraryId: catalogLib,
      objectId,
      writeToken: edit.write_token,
      metadata: merged,
      metadataSubtree: `/public/asset_metadata/info/media/${itemId}`
    });

    await this.client.FinalizeContentObject({
      libraryId: catalogLib,
      objectId,
      writeToken: edit.write_token,
      commitMessage: `Updated Media Item ${itemId}`
    });

    return merged;
  }
}

exports.ElvMediaWallet = ElvMediaWallet;

