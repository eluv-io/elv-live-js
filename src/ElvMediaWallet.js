const { ElvClient } = require("@eluvio/elv-client-js");
const crypto = require("crypto");
const fs = require("fs");
const path = require("path");
const mime = require("mime-types");
const yaml = require("js-yaml");

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

    // CLI flags always win. Only fall back to metadata-file Fabric links when no CLI flags given.
    const hasCliThumbs = thumbnail_landscape || thumbnail_portrait || thumbnail_square;
    const hasDirectThumbs =
      metadata.thumbnail_image_landscape !== undefined ||
      metadata.thumbnail_image_portrait !== undefined ||
      metadata.thumbnail_image_square !== undefined;

    if (hasCliThumbs) {
      await this.applyThumbnailLink({
        libraryId: catalogLib,
        objectId,
        writeToken: edit.write_token,
        target: newItem,
        catalogHash,
        thumbnail_landscape,
        thumbnail_portrait,
        thumbnail_square
      });
    } else if (!hasDirectThumbs && (resolvedThumbnails.landscape || resolvedThumbnails.portrait || resolvedThumbnails.square)) {
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

    itemLabel,

    contentId,
    contentIdType,
    isPublic,
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

    // CLI flags always win. Only fall back to metadata-file Fabric links when no CLI flags given.
    const hasCliThumbs = thumbnail_landscape || thumbnail_portrait || thumbnail_square;
    const hasDirectThumbs =
      metadata.thumbnail_image_landscape !== undefined ||
      metadata.thumbnail_image_portrait !== undefined ||
      metadata.thumbnail_image_square !== undefined;

    if (hasCliThumbs) {
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
    } else if (!hasDirectThumbs && (resolvedThumbnails?.landscape || resolvedThumbnails?.portrait || resolvedThumbnails?.square)) {
      await this.applyThumbnailLink({
        libraryId: catalogLib,
        objectId,
        writeToken: edit.write_token,
        target: merged,
        catalogHash,
        thumbnail_landscape: resolvedThumbnails.landscape,
        thumbnail_portrait: resolvedThumbnails.portrait,
        thumbnail_square: resolvedThumbnails.square
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

  async CatalogItemCopy({ sourceObjectId, sourceItemId, destObjectId }) {
    console.log("Source Object ID:", sourceObjectId);
    console.log("Item ID:", sourceItemId);
    console.log("Dest Object ID:", destObjectId);

    const sourceItem = await this.CatalogItemGet({
      objectId: sourceObjectId,
      itemId: sourceItemId
    });

    const { libraryId: destLib } = await this.getLibraryAndHash(destObjectId);

    const newMediaId =
      "mvid" +
      crypto
        .randomBytes(18)
        .toString("base64")
        .replace(/[^a-zA-Z0-9]/g, "")
        .slice(0, 24);

    const newItem = JSON.parse(JSON.stringify(sourceItem));
    newItem.id = newMediaId;
    newItem.media_catalog_id = destObjectId;

    const destCatalogMedia =
      (await this.client.ContentObjectMetadata({
        libraryId: destLib,
        objectId: destObjectId,
        metadataSubtree: "/public/asset_metadata/info/media",
        resolveLinks: false
      })) || {};

    destCatalogMedia[newMediaId] = newItem;

    const edit = await this.client.EditContentObject({
      libraryId: destLib,
      objectId: destObjectId
    });

    await this.client.ReplaceMetadata({
      libraryId: destLib,
      objectId: destObjectId,
      writeToken: edit.write_token,
      metadata: destCatalogMedia,
      metadataSubtree: "/public/asset_metadata/info/media"
    });

    await this.client.FinalizeContentObject({
      libraryId: destLib,
      objectId: destObjectId,
      writeToken: edit.write_token,
      commitMessage: `Copied Media Item ${sourceItemId} as ${newMediaId}`
    });

    return newItem;
  }

  async CatalogItemBulkAdd({ objectId, filePath }) {
    console.log("Object ID:", objectId);
    console.log("File:", filePath);

    const { libraryId: catalogLib, versionHash: catalogHash } =
      await this.getLibraryAndHash(objectId);

    const ext = path.extname(filePath).toLowerCase();
    const raw = fs.readFileSync(filePath, "utf-8");
    let definitions;
    if (ext === ".json") {
      definitions = JSON.parse(raw);
    } else if (ext === ".yaml" || ext === ".yml") {
      definitions = yaml.load(raw);
    } else {
      throw new Error(`Unsupported file type: ${ext} (use .json, .yaml, .yml)`);
    }

    if (!Array.isArray(definitions)) {
      throw new Error("Bulk-add file must contain a top-level array of media item definitions");
    }

    const catalogMedia =
      (await this.client.ContentObjectMetadata({
        libraryId: catalogLib,
        objectId,
        metadataSubtree: "/public/asset_metadata/info/media",
        resolveLinks: false
      })) || {};

    const edit = await this.client.EditContentObject({
      libraryId: catalogLib,
      objectId
    });

    const createdItems = [];

    for (const definition of definitions) {
      let metadata = this.normalizeMediaMetadata(definition);

      const resolvedItemLabel = metadata.label ?? "New Media Item";
      const resolvedContentId = metadata.contentId;
      const resolvedContentIdType = metadata.contentIdType;
      const resolvedPublic = metadata.public ?? false;
      const resolvedCompositionKey = metadata.compositionKey;

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

        ...(metadata.catalog_title && { catalog_title: metadata.catalog_title }),
        ...(metadata.display_title && { title: metadata.display_title }),
        ...(metadata.subtitle && { subtitle: metadata.subtitle }),
        ...(metadata.description && { description: metadata.description })
      };

      this.applyMediaMetadataFields(newItem, metadata);

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

      const hasDirectThumbs =
        metadata.thumbnail_image_landscape !== undefined ||
        metadata.thumbnail_image_portrait !== undefined ||
        metadata.thumbnail_image_square !== undefined;

      const resolvedThumbnails = {
        landscape: metadata.thumbnails?.landscape,
        portrait: metadata.thumbnails?.portrait,
        square: metadata.thumbnails?.square
      };

      if (!hasDirectThumbs &&
        (resolvedThumbnails.landscape || resolvedThumbnails.portrait || resolvedThumbnails.square)) {
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

      catalogMedia[newMediaId] = newItem;
      createdItems.push(newItem);
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
      commitMessage: `Bulk-added ${createdItems.length} media item(s)`
    });

    return createdItems;
  }

  async PropertySectionItemAdd({ propertyObjectId, sectionId, mediaItemId }) {
    console.log("Property Object ID:", propertyObjectId);
    console.log("Section ID:", sectionId);
    console.log("Media Item ID:", mediaItemId);

    const { libraryId } = await this.getLibraryAndHash(propertyObjectId);

    const section = await this.client.ContentObjectMetadata({
      libraryId,
      objectId: propertyObjectId,
      metadataSubtree: `/public/asset_metadata/info/sections/${sectionId}`,
      resolveLinks: false
    });

    if (!section) {
      throw new Error(`Section ${sectionId} does not exist on property ${propertyObjectId}`);
    }

    if (section.type !== "manual") {
      throw new Error(`Section ${sectionId} is type "${section.type}" — only "manual" sections support content items`);
    }

    const slugMapEntry = await this.client.ContentObjectMetadata({
      libraryId,
      objectId: propertyObjectId,
      metadataSubtree: `/public/asset_metadata/info/slug_map/sections/${sectionId}`,
      resolveLinks: false
    }) || { section_id: sectionId, label: section.label || "", slug: sectionId, section_items: {} };

    const newItemId =
      "psci" +
      crypto
        .randomBytes(18)
        .toString("base64")
        .replace(/[^a-zA-Z0-9]/g, "")
        .slice(0, 22);

    const content = Array.isArray(section.content) ? section.content : [];

    const newContentItem = {
      id: newItemId,
      label: "",
      media_id: mediaItemId,
      media_type: "media",
      type: "media",
      use_media_settings: true,
      disabled: false,
      expand: false,
      description: "",
      display: {
        attributes: {},
        catalog_title: "",
        description: "",
        description_rich_text: "",
        headers: [],
        permissions: [],
        public: false,
        subtitle: "",
        tags: [],
        title: ""
      },
      permissions: {
        behavior: "",
        permission_item_ids: [],
        secondary_market_purchase_option: ""
      }
    };

    content.push(newContentItem);
    section.content = content;

    slugMapEntry.section_items = slugMapEntry.section_items || {};
    slugMapEntry.section_items[newItemId] = {
      index: content.length - 1,
      label: "",
      section_item_id: newItemId,
      slug: newItemId
    };

    const edit = await this.client.EditContentObject({
      libraryId,
      objectId: propertyObjectId
    });

    await this.client.ReplaceMetadata({
      libraryId,
      objectId: propertyObjectId,
      writeToken: edit.write_token,
      metadata: section,
      metadataSubtree: `/public/asset_metadata/info/sections/${sectionId}`
    });

    await this.client.ReplaceMetadata({
      libraryId,
      objectId: propertyObjectId,
      writeToken: edit.write_token,
      metadata: slugMapEntry,
      metadataSubtree: `/public/asset_metadata/info/slug_map/sections/${sectionId}`
    });

    await this.client.FinalizeContentObject({
      libraryId,
      objectId: propertyObjectId,
      writeToken: edit.write_token,
      commitMessage: `Added media item ${mediaItemId} to section ${sectionId}`
    });

    return { sectionItemId: newItemId, mediaItemId, sectionId };
  }

  async PropertySectionItemBulkAdd({ propertyObjectId, sectionId, filePath }) {
    console.log("Property Object ID:", propertyObjectId);
    console.log("Section ID:", sectionId);
    console.log("File:", filePath);

    const ext = path.extname(filePath).toLowerCase();
    const raw = fs.readFileSync(filePath, "utf-8");
    let mediaItemIds;
    if (ext === ".json") {
      mediaItemIds = JSON.parse(raw);
    } else if (ext === ".yaml" || ext === ".yml") {
      mediaItemIds = yaml.load(raw);
    } else {
      throw new Error(`Unsupported file type: ${ext} (use .json, .yaml, .yml)`);
    }

    if (!Array.isArray(mediaItemIds)) {
      throw new Error("Bulk-add file must contain a top-level array of media item IDs");
    }

    const { libraryId } = await this.getLibraryAndHash(propertyObjectId);

    const section = await this.client.ContentObjectMetadata({
      libraryId,
      objectId: propertyObjectId,
      metadataSubtree: `/public/asset_metadata/info/sections/${sectionId}`,
      resolveLinks: false
    });

    if (!section) {
      throw new Error(`Section ${sectionId} does not exist on property ${propertyObjectId}`);
    }

    if (section.type !== "manual") {
      throw new Error(`Section ${sectionId} is type "${section.type}" — only "manual" sections support content items`);
    }

    const slugMapEntry = await this.client.ContentObjectMetadata({
      libraryId,
      objectId: propertyObjectId,
      metadataSubtree: `/public/asset_metadata/info/slug_map/sections/${sectionId}`,
      resolveLinks: false
    }) || { section_id: sectionId, label: section.label || "", slug: sectionId, section_items: {} };

    const content = Array.isArray(section.content) ? section.content : [];
    slugMapEntry.section_items = slugMapEntry.section_items || {};

    const createdItems = [];

    for (const mediaItemId of mediaItemIds) {
      const newItemId =
        "psci" +
        crypto
          .randomBytes(18)
          .toString("base64")
          .replace(/[^a-zA-Z0-9]/g, "")
          .slice(0, 22);

      content.push({
        id: newItemId,
        label: "",
        media_id: mediaItemId,
        media_type: "media",
        type: "media",
        use_media_settings: true,
        disabled: false,
        expand: false,
        description: "",
        display: {
          attributes: {},
          catalog_title: "",
          description: "",
          description_rich_text: "",
          headers: [],
          permissions: [],
          public: false,
          subtitle: "",
          tags: [],
          title: ""
        },
        permissions: {
          behavior: "",
          permission_item_ids: [],
          secondary_market_purchase_option: ""
        }
      });

      slugMapEntry.section_items[newItemId] = {
        index: content.length - 1,
        label: "",
        section_item_id: newItemId,
        slug: newItemId
      };

      createdItems.push({ sectionItemId: newItemId, mediaItemId });
    }

    section.content = content;

    const edit = await this.client.EditContentObject({
      libraryId,
      objectId: propertyObjectId
    });

    await this.client.ReplaceMetadata({
      libraryId,
      objectId: propertyObjectId,
      writeToken: edit.write_token,
      metadata: section,
      metadataSubtree: `/public/asset_metadata/info/sections/${sectionId}`
    });

    await this.client.ReplaceMetadata({
      libraryId,
      objectId: propertyObjectId,
      writeToken: edit.write_token,
      metadata: slugMapEntry,
      metadataSubtree: `/public/asset_metadata/info/slug_map/sections/${sectionId}`
    });

    await this.client.FinalizeContentObject({
      libraryId,
      objectId: propertyObjectId,
      writeToken: edit.write_token,
      commitMessage: `Bulk-added ${createdItems.length} media items to section ${sectionId}`
    });

    return createdItems;
  }

  async PropertySectionItemDelete({ propertyObjectId, sectionId, sectionItemId }) {
    console.log("Property Object ID:", propertyObjectId);
    console.log("Section ID:", sectionId);
    console.log("Section Item ID:", sectionItemId);

    const { libraryId } = await this.getLibraryAndHash(propertyObjectId);

    const section = await this.client.ContentObjectMetadata({
      libraryId,
      objectId: propertyObjectId,
      metadataSubtree: `/public/asset_metadata/info/sections/${sectionId}`,
      resolveLinks: false
    });

    if (!section) {
      throw new Error(`Section ${sectionId} does not exist on property ${propertyObjectId}`);
    }

    const content = Array.isArray(section.content) ? section.content : [];
    const itemIndex = content.findIndex(item => item.id === sectionItemId);

    if (itemIndex === -1) {
      throw new Error(`Section item ${sectionItemId} does not exist in section ${sectionId}`);
    }

    content.splice(itemIndex, 1);
    section.content = content;

    const slugMapEntry = await this.client.ContentObjectMetadata({
      libraryId,
      objectId: propertyObjectId,
      metadataSubtree: `/public/asset_metadata/info/slug_map/sections/${sectionId}`,
      resolveLinks: false
    });

    if (slugMapEntry && slugMapEntry.section_items) {
      delete slugMapEntry.section_items[sectionItemId];
    }

    const edit = await this.client.EditContentObject({
      libraryId,
      objectId: propertyObjectId
    });

    await this.client.ReplaceMetadata({
      libraryId,
      objectId: propertyObjectId,
      writeToken: edit.write_token,
      metadata: section,
      metadataSubtree: `/public/asset_metadata/info/sections/${sectionId}`
    });

    if (slugMapEntry) {
      await this.client.ReplaceMetadata({
        libraryId,
        objectId: propertyObjectId,
        writeToken: edit.write_token,
        metadata: slugMapEntry,
        metadataSubtree: `/public/asset_metadata/info/slug_map/sections/${sectionId}`
      });
    }

    await this.client.FinalizeContentObject({
      libraryId,
      objectId: propertyObjectId,
      writeToken: edit.write_token,
      commitMessage: `Deleted section item ${sectionItemId} from section ${sectionId}`
    });

    return { sectionItemId, sectionId };
  }
}

exports.ElvMediaWallet = ElvMediaWallet;

