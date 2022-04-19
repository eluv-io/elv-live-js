const Utils = require("elv-client-js/src/Utils");
const { v4: UUID, parse: UUIDParse } = require("uuid");
const { EluvioLive } = require("./EluvioLive");
const { ElvClient } = require("elv-client-js");

class Marketplace extends EluvioLive {
  constructor({ configUrl, mainObjectId }) {
    super(configUrl);

    this.configUrl = configUrl || ElvClient.main;
    this.mainObjectId = mainObjectId;
  }

  CreateLink({targetHash, linkTarget="/meta/public/asset_metadata", options={}}) {
    return {
      ...options,
      ".": {
        ...(options["."] || {}),
        "auto_update":{"tag":"latest"}
      },
      "/": `/qfab/${targetHash}${linkTarget}`
    };
  }

  async MarketplaceAddItem({
    marketplaceObjectId,
    nftObjectId,
    nftObjectHash,
    price,
    currency="USD",
    maxPerUser,
    forSale=true
  }) {
    const free = (price === 0);
    const sku = Utils.B58(UUIDParse(UUID()));

    if (nftObjectId) {
      nftObjectHash = this.client.LatestVersionHash({
        objectId: nftObjectId
      });
    }

    if (nftObjectHash) {
      nftObjectId = Utils.DecodeVersionHash(nftObjectHash).objectId;
    }

    const nftTemplateLibraryId = await this.client.ContentObjectLibraryId({
      objectId: nftObjectId
    });

    const nftTemplateMeta = await this.client.ContentObjectMetadata({
      objectId: nftObjectId,
      libraryId: nftTemplateLibraryId,
      versionHash: nftObjectHash,
      metadataSubtree: "/public/asset_metadata"
    });

    const libraryId = await this.client.ContentObjectLibraryId({
      objectId: marketplaceObjectId
    });

    const items = await this.client.ContentObjectMetadata({
      objectId: marketplaceObjectId,
      libraryId,
      metadataSubtree: "/public/asset_metadata/info/items"
    }) || [];

    const newItem = {
      for_sale: forSale,
      free,
      max_per_user: free ? (maxPerUser || 1) : 0,
      name: nftTemplateMeta.display_title || "",
      nft_template: this.CreateLink({
        targetHash: nftObjectHash
      }),
      price: free ? null : { [currency]: price },
      sku
    };

    items.push(newItem);

    const { write_token } = await this.client.EditContentObject({
      objectId: marketplaceObjectId,
      libraryId
    });

    await this.client.ReplaceMetadata({
      objectId: marketplaceObjectId,
      libraryId,
      writeToken: write_token,
      metadataSubtree: "/public/asset_metadata/info/items",
      metadata: items
    });

    await this.client.FinalizeContentObject({
      objectId: marketplaceObjectId,
      libraryId,
      writeToken: write_token,
      commitMessage: "Add marketplace item"
    });

    return newItem;
  }

  async MarketplaceRemoveItem({marketplaceObjectId, nftObjectHash}) {
    const libraryId = await this.client.ContentObjectLibraryId({
      objectId: marketplaceObjectId
    });

    const items = await this.client.ContentObjectMetadata({
      objectId: marketplaceObjectId,
      libraryId,
      metadataSubtree: "/public/asset_metadata/info/items"
    }) || [];

    const filteredItems = items.filter(item => !item.nft_template["/"].includes(nftObjectHash));

    const { write_token } = await this.client.EditContentObject({
      objectId: marketplaceObjectId,
      libraryId
    });

    await this.client.ReplaceMetadata({
      objectId: marketplaceObjectId,
      libraryId,
      writeToken: write_token,
      metadataSubtree: "/public/asset_metadata/info/items",
      metadata: filteredItems
    });

    return await this.client.FinalizeContentObject({
      objectId: marketplaceObjectId,
      libraryId,
      writeToken: write_token,
      commitMessage: "Remove marketplace item"
    });
  }
}

exports.Marketplace = Marketplace;
