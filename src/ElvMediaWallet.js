const { ElvClient } = require("@eluvio/elv-client-js");


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

  async CatalogItemSet({
    objectId,
    itemId,
    contentId,
    contentIdType,
    isPublic = false,
    compositionKey
  }) {
    const { libraryId: catalogLib, versionHash: catalogHash } =
      await this.getLibraryAndHash(objectId);

    const mediaItemMeta = await this.CatalogItemGet({ objectId, itemId });

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

    mediaItemMeta.public = !!isPublic;

    const edit = await this.client.EditContentObject({
      libraryId: catalogLib,
      objectId
    });

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

  async CatalogItemAdd({
    objectId,
    itemName = "New Media Item",
    contentId,
    contentIdType,
    isPublic = false,
    compositionKey
  }) {
    const { libraryId: catalogLib, versionHash: catalogHash } =
      await this.getLibraryAndHash(objectId);

    const catalogMedia =
      (await this.client.ContentObjectMetadata({
        libraryId: catalogLib,
        objectId,
        metadataSubtree: "/public/asset_metadata/info/media",
        resolveLinks: false
      })) || {};

    const newMediaId = `mvid${Math.random().toString(36).slice(2, 24)}`;

    const contentMeta = await this.getContentMeta(contentId);
    const { versionHash: contentHash } =
      await this.getLibraryAndHash(contentId);

    const newItem = {
      id: newMediaId,
      label: itemName,
      media_catalog_id: objectId,
      media_type: "Video",
      live_video: false,
      media_link: {},
      media_link_info: {},
      offerings: [],
      public: !!isPublic
    };

    this.applyMediaLink({
      target: newItem,
      contentMeta,
      catalogHash,
      contentHash,
      contentIdType,
      compositionKey
    });

    catalogMedia[newMediaId] = newItem;

    const edit = await this.client.EditContentObject({
      libraryId: catalogLib,
      objectId
    });

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

