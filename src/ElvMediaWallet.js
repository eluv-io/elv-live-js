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
      resolveLinks: true,
      resolveIncludeSource: true,
      resolveIgnoreErrors: true,
      linkDepthLimit: 5,
    });

    return res;
  }

  async CatalogItemGet({ objectId, itemId }) {
    console.log("Object ID:", objectId);
    console.log("Item ID:", itemId);

    const libraryId = await this.client.ContentObjectLibraryId({
      objectId,
    });

    let res;

    try {
      res = await this.client.ContentObjectMetadata({
        libraryId,
        objectId,
        metadataSubtree: `/public/asset_metadata/info/media/${itemId}`,
        resolveLinks: true,
        resolveIncludeSource: true,
        resolveIgnoreErrors: true,
        linkDepthLimit: 5,
      });
    } catch (err) {
      throw new Error(`Item ${itemId} does not exist in Catalog ${objectId}`);
    }

    // Handle "soft failures" (missing subtree)
    if (!res || (typeof res === "object" && Object.keys(res).length === 0)) {
      throw new Error(`Item ${itemId} is not set in Catalog ${objectId}`);
    }


    return res;
  }

  async CatalogItemSet({ objectId, itemId, contentId, contentIdType }) {
    console.log("Object ID:", objectId);
    console.log("Item ID:", itemId);
    console.log("Content ID:", contentId);
    console.log("Content ID Type:", contentIdType);

    // TODO
    let res = { "output": "xyz" };
    return res;
  }
}

exports.ElvMediaWallet = ElvMediaWallet;

