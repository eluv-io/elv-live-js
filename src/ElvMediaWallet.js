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

  async CatalogItemSet({ objectId, itemId, contentId, contentIdType }) {
    console.log("Object ID:", objectId);
    console.log("Item ID:", itemId);
    console.log("Content ID:", contentId);
    console.log("Content ID Type:", contentIdType);
    // console.log("Public:", isPublic);


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
    })
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

      case "composition":
        const hasOfferings =
          contentMeta?.channel?.offerings &&
          Object.keys(contentMeta.channel.offerings).length > 0;
        if (!hasOfferings) {
          return "Content object has no compositions";
        }

        mediaItemMeta.live_video = false;
        mediaItemMeta.media_link["."] = { container: catalogLatestVersionHash };
        mediaItemMeta.media_link["/"] = `/qfab/${contentLatestVersionHash}/meta/public/asset_metadata`;
        mediaItemMeta.media_link_info.name = contentMeta.public.name;
        mediaItemMeta.media_link_info.type = "composition";
        break;

      default:
        throw new Error(`Invalid contentType: ${contentIdType}`);
    }

    // mediaItemMeta["public"] = !!isPublic;

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

  async CatalogItemAdd({objectId }) {
    console.log("Object ID:", objectId);

  }
}

exports.ElvMediaWallet = ElvMediaWallet;

