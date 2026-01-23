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

  async CatalogList({ objectId }) {
    console.log("Object ID:", objectId);

    const libraryId = await this.client.ContentObjectLibraryId({
      objectId,
    });

    const res = await this.client.ContentObjectMetadata({
      libraryId,
      objectId,
      metadataSubtree: "/public/asset_metadata/info/media",
      resolveLinks: false
    });

    return res;
  }

  async CatalogItemGet({ objectId, itemId }) {
    console.log("Object ID:", objectId);
    console.log("Item ID:", itemId);

    const libraryId = await this.client.ContentObjectLibraryId({ objectId });
    let res;

    try {
      res = await this.client.ContentObjectMetadata({
        libraryId,
        objectId,
        metadataSubtree: `/public/asset_metadata/info/media/${itemId}`,
        resolveLinks: false
      });
    } catch (err) {
      throw new Error(`Item ${itemId} does not exist in Catalog ${objectId}`);
    }

    return res;
  }

  async CatalogItemSet({ objectId, itemId, contentId, contentIdType, isPublic = false, compositionKey }) {
    console.log("Object ID:", objectId);
    console.log("Item ID:", itemId);
    console.log("Content ID:", contentId);
    console.log("Content ID Type:", contentIdType);
    console.log("Composition Key:", compositionKey);
    console.log("Public:", isPublic);

    const catalogLibraryId = await this.client.ContentObjectLibraryId({ objectId });
    const catalogLatestVersionHash = await this.client.LatestVersionHash({ objectId });

    try {
      var mediaItemMeta = await this.client.ContentObjectMetadata({
        libraryId: catalogLibraryId,
        objectId,
        metadataSubtree: `/public/asset_metadata/info/media/${itemId}`,
        resolveLinks: false
      });
    } catch (err) {
      throw new Error(`Item ${itemId} does not exist in Catalog ${objectId}`);
    }

    const contentLibraryId = await this.client.ContentObjectLibraryId({ objectId: contentId });
    const contentLatestVersionHash = await this.client.LatestVersionHash({ objectId: contentId });

    const contentMeta = await this.client.ContentObjectMetadata({
      libraryId: contentLibraryId,
      objectId: contentId,
      resolveLinks: false
    });
    mediaItemMeta.media_link = mediaItemMeta.media_link || {};
    mediaItemMeta.media_link_info = mediaItemMeta.media_link_info || {};

    switch (contentIdType) {
      case "live":
        mediaItemMeta.live_video = true;
        mediaItemMeta.media_link["."] = { container: catalogLatestVersionHash };
        mediaItemMeta.media_link["/"] = `/qfab/${contentLatestVersionHash}/meta/public/asset_metadata`;
        mediaItemMeta.media_link_info.name = contentMeta.public.name;
        mediaItemMeta.media_link_info.type = "main";
        break;

      case "vod":
        mediaItemMeta.live_video = false;
        mediaItemMeta.media_link["."] = { container: catalogLatestVersionHash };
        mediaItemMeta.media_link["/"] = `/qfab/${contentLatestVersionHash}/meta/public/asset_metadata`;
        mediaItemMeta.media_link_info.name = contentMeta.public.name;
        mediaItemMeta.media_link_info.type = "main";
        break;

      case "composition": {
        const offerings = contentMeta?.channel?.offerings;

        if (!offerings || typeof offerings !== "object") {
          return "Content object has no compositions";
        }

        const offeringKeys = Object.keys(offerings);

        if (offeringKeys.length === 0) {
          return "Content object has no compositions";
        }

        let selectedCompositionKey;

        if (compositionKey) {
          // Validate provided composition key
          if (!offerings[compositionKey]) {
            return `Composition does not exist: ${compositionKey}`;
          }
          selectedCompositionKey = compositionKey;
        } else {
          // Default to first available composition
          selectedCompositionKey = offeringKeys[0];
        }

        mediaItemMeta.live_video = false;
        mediaItemMeta.media_link["."] = { container: catalogLatestVersionHash };
        mediaItemMeta.media_link["/"] = `/qfab/${contentLatestVersionHash}/meta/public/asset_metadata`;
        mediaItemMeta.media_link_info.type = "composition";
        mediaItemMeta.media_link_info.composition_key = selectedCompositionKey;

        break;
      }

      default:
        throw new Error(`Invalid contentType: ${contentIdType}`);
    }

    mediaItemMeta["public"] = !!isPublic;

    var e = await this.client.EditContentObject({
      libraryId: catalogLibraryId,
      objectId,
    });
    await this.client.ReplaceMetadata({
      libraryId: catalogLibraryId,
      objectId,
      writeToken: e.write_token,
      metadata: mediaItemMeta,
      metadataSubtree: `/public/asset_metadata/info/media/${itemId}`
    });
    await this.client.FinalizeContentObject({
      libraryId: catalogLibraryId,
      objectId,
      writeToken: e.write_token,
      commitMessage: `Added Media Item ${itemId} to Catalog ${objectId}`
    });

    console.log(`Content Object ${contentId} of type ${contentIdType} added to Media Item ${itemId} in Catalog ${objectId}`);

    return mediaItemMeta;
  }

  async CatalogItemAdd({ objectId, itemName = "New Media Item", contentId, contentIdType, isPublic = false, compositionKey }) {
    console.log("Object ID:", objectId);
    console.log("New Item Name:", itemName);
    console.log("Content ID:", contentId);
    console.log("Content ID Type:", contentIdType);
    console.log("Composition Key:", compositionKey);
    console.log("Public:", isPublic);

    const catalogLibraryId = await this.client.ContentObjectLibraryId({ objectId });
    const catalogLatestVersionHash = await this.client.LatestVersionHash({ objectId });

    let catalogMediaMeta;
    try {
      catalogMediaMeta = await this.client.ContentObjectMetadata({
        libraryId: catalogLibraryId,
        objectId,
        metadataSubtree: "/public/asset_metadata/info/media/",
        resolveLinks: false
      });
    } catch (err) {
      throw new Error("Object not of Catalog Type");
    }

    catalogMediaMeta = catalogMediaMeta || {};

    const generateMediaId = () => {
      const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz123456789";
      let id = "mvid";
      for (let i = 0; i < 22; i++) {
        id += chars.charAt(Math.floor(Math.random() * chars.length));
      }
      return id;
    };

    const newMediaId = generateMediaId();

    const contentLibraryId = await this.client.ContentObjectLibraryId({ objectId: contentId });
    const contentLatestVersionHash = await this.client.LatestVersionHash({ objectId: contentId });

    const contentMeta = await this.client.ContentObjectMetadata({
      libraryId: contentLibraryId,
      objectId: contentId,
      resolveLinks: false
    });

    // Create the new media item
    const newMediaItem = {
      id: newMediaId,
      label: itemName,
      media_catalog_id: objectId,
      media_type: "Video",
      live_video: false,
      media_link: {},
      media_link_info: {},
      offerings: []
    };

    switch (contentIdType) {
      case "live":
        newMediaItem.live_video = true;
        newMediaItem.media_link["."] = { container: catalogLatestVersionHash };
        newMediaItem.media_link["/"] = `/qfab/${contentLatestVersionHash}/meta/public/asset_metadata`;
        newMediaItem.media_link_info.name = contentMeta.public.name;
        newMediaItem.media_link_info.type = "main";
        break;

      case "vod":
        newMediaItem.live_video = false;
        newMediaItem.media_link["."] = { container: catalogLatestVersionHash };
        newMediaItem.media_link["/"] = `/qfab/${contentLatestVersionHash}/meta/public/asset_metadata`;
        newMediaItem.media_link_info.name = contentMeta.public.name;
        newMediaItem.media_link_info.type = "main";
        break;

      case "composition": {
        const offerings = contentMeta?.channel?.offerings;

        if (!offerings || typeof offerings !== "object") {
          return "Content object has no compositions";
        }

        const offeringKeys = Object.keys(offerings);

        if (offeringKeys.length === 0) {
          return "Content object has no compositions";
        }

        let selectedCompositionKey;

        if (compositionKey) {
          // Validate provided composition key
          if (!offerings[compositionKey]) {
            return `Composition does not exist: ${compositionKey}`;
          }
          selectedCompositionKey = compositionKey;
        } else {
          // Default to first available composition
          selectedCompositionKey = offeringKeys[0];
        }

        newMediaItem.live_video = false;
        newMediaItem.media_link["."] = { container: catalogLatestVersionHash };
        newMediaItem.media_link["/"] = `/qfab/${contentLatestVersionHash}/meta/public/asset_metadata`;
        newMediaItem.media_link_info.type = "composition";
        newMediaItem.media_link_info.composition_key = selectedCompositionKey;
        newMediaItem.media_link_info.name = contentMeta.public.name;

        break;
      }

      default:
        throw new Error(`Invalid contentType: ${contentIdType}`);
    }

    newMediaItem["public"] = !!isPublic;
    catalogMediaMeta[newMediaId] = newMediaItem;
    console.log(catalogMediaMeta);

    var e = await this.client.EditContentObject({
      libraryId: catalogLibraryId,
      objectId,
    });
    await this.client.ReplaceMetadata({
      libraryId: catalogLibraryId,
      objectId,
      writeToken: e.write_token,
      metadata: catalogMediaMeta,
      metadataSubtree: "/public/asset_metadata/info/media"
    });
    await this.client.FinalizeContentObject({
      libraryId: catalogLibraryId,
      objectId,
      writeToken: e.write_token,
      commitMessage: `Added Media Item ${newMediaId} to Catalog ${objectId}`
    });

    console.log(`✅ Media Item ${newMediaId} added to Catalog ${objectId}`);
    return newMediaItem;
  }
}

exports.ElvMediaWallet = ElvMediaWallet;

