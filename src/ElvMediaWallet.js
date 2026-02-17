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

  // 

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

  normalizeMediaMetadata(raw = {}) {
    // Accept either "thumbnails" (old shape) or Fabric-style thumbnail fields (attached JSON)
    const thumbnails = {
      landscape:
        raw?.thumbnails?.landscape ??
        raw?.thumbnail_image_landscape ??
        raw?.thumbnail_landscape,
      portrait:
        raw?.thumbnails?.portrait ??
        raw?.thumbnail_image_portrait ??
        raw?.thumbnail_portrait,
      square:
        raw?.thumbnails?.square ??
        raw?.thumbnail_image_square ??
        raw?.thumbnail_square
    };

    // Titles: attached JSON uses `title` (not `display_title`)
    const titles = {
      catalog_title: raw?.catalog_title,
      display_title: raw?.display_title ?? raw?.title,
      subtitle: raw?.subtitle,
      description: raw?.description ?? raw?.description_rich_text
    };

    return {
      ...raw,
      titles,
      thumbnails
    };
  }

  applyMediaMetadataFields(targetItem, meta) {
    // Pass through common “safe” keys found in media item metadata
    // (Only copies keys if they exist in meta)
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

    // Structured objects (attached JSON often includes these)
    if (meta.media_link) targetItem.media_link = meta.media_link;
    if (meta.media_link_info) targetItem.media_link_info = meta.media_link_info;

    // Fabric-style thumbnail objects
    if (meta.thumbnail_image_landscape)
      targetItem.thumbnail_image_landscape = meta.thumbnail_image_landscape;
    if (meta.thumbnail_image_portrait)
      targetItem.thumbnail_image_portrait = meta.thumbnail_image_portrait;
    if (meta.thumbnail_image_square)
      targetItem.thumbnail_image_square = meta.thumbnail_image_square;

    // Hash fields (if present)
    if (meta.thumbnail_image_landscape_hash !== undefined)
      targetItem.thumbnail_image_landscape_hash =
        meta.thumbnail_image_landscape_hash;
    if (meta.thumbnail_image_portrait_hash !== undefined)
      targetItem.thumbnail_image_portrait_hash =
        meta.thumbnail_image_portrait_hash;
    if (meta.thumbnail_image_square_hash !== undefined)
      targetItem.thumbnail_image_square_hash = meta.thumbnail_image_square_hash;
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

  async CatalogItemSet({
    objectId,
    itemId,
    contentId,
    contentIdType,
    isPublic = false,
    compositionKey,
    thumbnail_landscape,
    thumbnail_portrait,
    thumbnail_square
  }) {
    const { libraryId: catalogLib, versionHash: catalogHash } =
      await this.getLibraryAndHash(objectId);

    const mediaItemMeta = await this.CatalogItemGet({ objectId, itemId });

    if (contentId) {
      const contentMeta = await this.getContentMeta(contentId);
      const { versionHash: contentHash } =
        await this.getLibraryAndHash(contentId);

      this.applyMediaLink({
        target: mediaItemMeta,
        contentMeta,
        catalogHash,
        contentHash,
        contentIdType,
        compositionKey
      });
    }

    mediaItemMeta.public = !!isPublic;

    const edit = await this.client.EditContentObject({
      libraryId: catalogLib,
      objectId
    });

    if (thumbnail_landscape || thumbnail_portrait || thumbnail_square) {
      await this.applyThumbnailLink({
        libraryId: catalogLib,
        objectId,
        writeToken: edit.write_token,
        target: mediaItemMeta,
        catalogHash,
        thumbnail_landscape,
        thumbnail_portrait,
        thumbnail_square
      });
    }

    await this.client.ReplaceMetadata({
      libraryId: catalogLib,
      objectId,
      writeToken: edit.write_token,
      metadata: mediaItemMeta,
      metadataSubtree: `/public/asset_metadata/info/media/${itemId}`
    });

    await this.client.FinalizeContentObject({
      libraryId: catalogLib,
      objectId,
      writeToken: edit.write_token,
      commitMessage: `Updated Media Item ${itemId}`
    });

    return mediaItemMeta;
  }

  // async CatalogItemAdd({
  //   objectId,
  //   itemLabel,
  //   catalogTitle,
  //   displayTitle,
  //   subtitle,
  //   description,
  //   contentId,
  //   contentIdType,
  //   isPublic,
  //   compositionKey,
  //   thumbnail_landscape,
  //   thumbnail_portrait,
  //   thumbnail_square,
  //   mediaMetadata
  // }) {
  //   const { libraryId: catalogLib, versionHash: catalogHash } =
  //     await this.getLibraryAndHash(objectId);

  //   const catalogMedia =
  //     (await this.client.ContentObjectMetadata({
  //       libraryId: catalogLib,
  //       objectId,
  //       metadataSubtree: "/public/asset_metadata/info/media",
  //       resolveLinks: false
  //     })) || {};

  //   const newMediaId = "mvid" + crypto.randomBytes(18).toString("base64").replace(/[^a-zA-Z0-9]/g, "").slice(0, 24);

  //   const newItem = {
  //     description,
  //     id: newMediaId,
  //     label: itemLabel,
  //     catalog_title: catalogTitle,
  //     media_catalog_id: objectId,
  //     media_type: "Video",
  //     live_video: contentIdType === "live",
  //     public: !!isPublic,
  //     subtitle,
  //     title: displayTitle
  //   };

  //   catalogMedia[newMediaId] = newItem;

  //   if (contentId) {
  //     const contentMeta = await this.getContentMeta(contentId);
  //     const { versionHash: contentHash } =
  //       await this.getLibraryAndHash(contentId);

  //     this.applyMediaLink({
  //       target: newItem,
  //       contentMeta,
  //       catalogHash,
  //       contentHash,
  //       contentIdType,
  //       compositionKey
  //     });
  //   }

  //   const edit = await this.client.EditContentObject({
  //     libraryId: catalogLib,
  //     objectId
  //   });

  //   if (thumbnail_landscape || thumbnail_portrait || thumbnail_square) {
  //     await this.applyThumbnailLink({
  //       libraryId: catalogLib,
  //       objectId,
  //       writeToken: edit.write_token,
  //       target: newItem,
  //       catalogHash,
  //       thumbnail_landscape,
  //       thumbnail_portrait,
  //       thumbnail_square
  //     });
  //   }

  //   await this.client.ReplaceMetadata({
  //     libraryId: catalogLib,
  //     objectId,
  //     writeToken: edit.write_token,
  //     metadata: catalogMedia,
  //     metadataSubtree: "/public/asset_metadata/info/media"
  //   });

  //   await this.client.FinalizeContentObject({
  //     libraryId: catalogLib,
  //     objectId,
  //     writeToken: edit.write_token,
  //     commitMessage: `Added Media Item ${newMediaId}`
  //   });

  //   return newItem;
  // }

  async CatalogItemAdd({
    objectId,

    // renamed flag
    itemLabel = "New Media Item",

    contentId,
    contentIdType,
    isPublic = false,
    compositionKey,
    thumbnail_landscape,
    thumbnail_portrait,
    thumbnail_square,

    // item metadata
    catalog_title,
    display_title,
    subtitle,
    description,

    // JSON / YAML file or object
    mediaMetadata
  }) {
    const { libraryId: catalogLib, versionHash: catalogHash } =
      await this.getLibraryAndHash(objectId);

    /* --------------------------------------------
     * Read mediaMetadata directly (JSON / YAML / object)
     * -------------------------------------------- */
    let metadata = {};

    if (mediaMetadata) {
      if (typeof mediaMetadata === "string") {
        const ext = path.extname(mediaMetadata).toLowerCase();
        const raw = fs.readFileSync(mediaMetadata, "utf-8");

        if (ext === ".json") {
          metadata = JSON.parse(raw);
        } else if (ext === ".yaml" || ext === ".yml") {
          metadata = yaml.load(raw);
        } else {
          throw new Error(
            `Unsupported metadata file type: ${ext} (use .json, .yaml, .yml)`
          );
        }
      } else if (typeof mediaMetadata === "object") {
        metadata = mediaMetadata;
      }
    }

    // Normalize to support attached JSON shapes (`title`, `thumbnail_image_*`, etc.)
    metadata = this.normalizeMediaMetadata(metadata);

    /* --------------------------------------------
     * Resolve values (file > flags)
     * -------------------------------------------- */
    const resolvedItemLabel = metadata.label ?? itemLabel;

    // Support either metadata.contentId/contentIdType OR your flags
    const resolvedContentId = metadata.contentId ?? contentId;
    const resolvedContentIdType = metadata.contentIdType ?? contentIdType;

    // If file has `public`, honor it; else fall back to CLI param
    const resolvedPublic = metadata.public ?? isPublic;

    const resolvedCompositionKey = metadata.compositionKey ?? compositionKey;

    const resolvedTitles = {
      catalog_title: metadata.titles?.catalog_title ?? catalog_title,
      display_title: metadata.titles?.display_title ?? display_title,
      subtitle: metadata.titles?.subtitle ?? subtitle,
      description: metadata.titles?.description ?? description
    };

    // Normalized thumbnails: can be old style or attached JSON style
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

    /* --------------------------------------------
     * Media item
     * -------------------------------------------- */
    const newItem = {
      id: newMediaId,
      label: resolvedItemLabel,
      media_catalog_id: objectId,
      media_type: metadata.media_type ?? "Video",

      // If file says live_video, respect it; otherwise infer from contentIdType
      live_video: metadata.live_video ?? resolvedContentIdType === "live",
      public: !!resolvedPublic,

      ...(resolvedTitles.catalog_title && {
        catalog_title: resolvedTitles.catalog_title
      }),
      ...(resolvedTitles.display_title && {
        display_title: resolvedTitles.display_title
      }),
      ...(resolvedTitles.subtitle && {
        subtitle: resolvedTitles.subtitle
      }),
      ...(resolvedTitles.description && {
        description: resolvedTitles.description
      })
    };

    // Copy across additional fields present in mediaMetadata JSON
    this.applyMediaMetadataFields(newItem, metadata);

    catalogMedia[newMediaId] = newItem;

    /* --------------------------------------------
     * Media link
     * -------------------------------------------- */
    // If media_link was provided in the JSON, keep it as-is and skip applyMediaLink.
    // Otherwise, if contentId is provided, generate the media link.
    const hasDirectMediaLink = !!metadata.media_link;

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

    /* --------------------------------------------
     * Thumbnails
     * -------------------------------------------- */
    // If file already includes thumbnail_image_* objects, do NOT call applyThumbnailLink.
    const hasDirectThumbs =
      !!metadata.thumbnail_image_landscape ||
      !!metadata.thumbnail_image_portrait ||
      !!metadata.thumbnail_image_square;

    if (
      !hasDirectThumbs &&
      (resolvedThumbnails.landscape ||
        resolvedThumbnails.portrait ||
        resolvedThumbnails.square)
    ) {
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
}

exports.ElvMediaWallet = ElvMediaWallet;

