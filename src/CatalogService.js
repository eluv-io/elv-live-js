const { v4: uuidv4 } = require("uuid");
const fs = require("fs");
const path = require("path");
const yaml = require("js-yaml");

class CatalogService {
  constructor(wallet) {
    this.wallet = wallet;
  }

  get client() {
    return this.wallet.client;
  }

  async CatalogList({ objectId }) {
    console.log("Object ID:", objectId);

    const { libraryId } = await this.wallet.getLibraryAndHash(objectId);

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

    const { libraryId } = await this.wallet.getLibraryAndHash(objectId);
    try {
      return await this.client.ContentObjectMetadata({
        libraryId,
        objectId,
        metadataSubtree: `/public/asset_metadata/info/media/${itemId}`,
        resolveLinks: false
      });
    } catch (err) {
      throw new Error(`Item ${itemId} does not exist in Catalog ${objectId}: ${err.message}`);
    }
  }

  async CatalogItemDelete({ objectId, itemId }) {
    console.log("Object ID:", objectId);
    console.log("Item ID:", itemId);

    const { libraryId } = await this.wallet.getLibraryAndHash(objectId);
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
      await this.wallet.getLibraryAndHash(objectId);

    // Parse + normalize file/object metadata
    let metadata = this.wallet.readMetadataFileOrObject(mediaMetadata);
    metadata = this.wallet.normalizeMediaMetadata(metadata);

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

    const newMediaId = "mvid" + uuidv4().replace(/-/g, "");

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

    // Apply "extra fields" from metadata file (overwrites if present)
    this.wallet.applyMediaMetadataFields(newItem, metadata);

    catalogMedia[newMediaId] = newItem;

    // Media link: if file includes media_link, keep it and skip applyMediaLink
    const hasDirectMediaLink = metadata.media_link !== undefined;

    if (!hasDirectMediaLink && resolvedContentId) {
      const contentMeta = await this.wallet.getContentMeta(resolvedContentId);
      const { versionHash: contentHash } =
        await this.wallet.getLibraryAndHash(resolvedContentId);

      this.wallet.applyMediaLink({
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
      await this.wallet.applyThumbnailLink({
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
      await this.wallet.applyThumbnailLink({
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
      await this.wallet.getLibraryAndHash(objectId);

    // Existing item metadata
    const mediaItemMeta = await this.CatalogItemGet({ objectId, itemId });

    // Load + normalize metadata file
    let metadata = this.wallet.readMetadataFileOrObject(mediaMetadata);
    metadata = this.wallet.normalizeMediaMetadata(metadata);

    // Force identity from CLI
    metadata.id = itemId;
    metadata.media_catalog_id = objectId;

    // Merge file metadata over existing
    let merged = this.wallet.deepMergeOverwrite(mediaItemMeta, metadata);

    // Apply normalized field handling (titles, passthrough keys)
    this.wallet.applyMediaMetadataFields(merged, metadata);

    // Apply CLI flags (override file + existing)
    if (itemLabel !== undefined) merged.label = itemLabel;
    if (catalogTitle !== undefined) merged.catalog_title = catalogTitle;
    if (displayTitle !== undefined) merged.title = displayTitle;
    if (subtitle !== undefined) merged.subtitle = subtitle;
    if (description !== undefined) merged.description = description;
    if (isPublic !== undefined) merged.public = !!isPublic;

    // Media Link Handling
    const resolvedContentId = metadata.contentId ?? contentId;
    const resolvedContentIdType = metadata.contentIdType ?? contentIdType;
    const resolvedCompositionKey = metadata.compositionKey ?? compositionKey;

    const resolvedThumbnails = {
      landscape: metadata.thumbnails?.landscape ?? thumbnail_landscape,
      portrait: metadata.thumbnails?.portrait ?? thumbnail_portrait,
      square: metadata.thumbnails?.square ?? thumbnail_square
    };

    const hasDirectMediaLink = metadata.media_link !== undefined;

    if (!hasDirectMediaLink && resolvedContentId) {
      const contentMeta = await this.wallet.getContentMeta(resolvedContentId);
      const { versionHash: contentHash } =
        await this.wallet.getLibraryAndHash(resolvedContentId);

      this.wallet.applyMediaLink({
        target: merged,
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
      await this.wallet.applyThumbnailLink({
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
      await this.wallet.applyThumbnailLink({
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

    const { libraryId: destLib } = await this.wallet.getLibraryAndHash(destObjectId);

    const newMediaId = "mvid" + uuidv4().replace(/-/g, "");

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
      await this.wallet.getLibraryAndHash(objectId);

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
      let metadata = this.wallet.normalizeMediaMetadata(definition);

      const resolvedItemLabel = metadata.label ?? "New Media Item";
      const resolvedContentId = metadata.contentId;
      const resolvedContentIdType = metadata.contentIdType;
      const resolvedPublic = metadata.public ?? false;
      const resolvedCompositionKey = metadata.compositionKey;

      const newMediaId = "mvid" + uuidv4().replace(/-/g, "");

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

      this.wallet.applyMediaMetadataFields(newItem, metadata);

      const hasDirectMediaLink = metadata.media_link !== undefined;

      if (!hasDirectMediaLink && resolvedContentId) {
        const contentMeta = await this.wallet.getContentMeta(resolvedContentId);
        const { versionHash: contentHash } =
          await this.wallet.getLibraryAndHash(resolvedContentId);

        this.wallet.applyMediaLink({
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
        await this.wallet.applyThumbnailLink({
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
}

module.exports = { CatalogService };
