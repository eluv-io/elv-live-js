const Utils = require("elv-client-js/src/Utils");
const { v4: UUID, parse: UUIDParse } = require("uuid");
const UrlJoin = require("url-join");
const { EluvioLive } = require("./EluvioLive");
const { ElvClient } = require("elv-client-js");

class Marketplace extends EluvioLive {
  constructor({ configUrl, mainObjectId }) {
    super(configUrl);

    this.configUrl = configUrl || ElvClient.main;
    this.mainObjectId = mainObjectId;
  }

  CreateLink({targetHash, linkTarget="/meta/public/asset_metadata", options={}}) {
    if (!targetHash) {
      return {
        ...options,
        ".": {
          ...(options["."] || {}),
          "auto_update":{"tag":"latest"}
        },
        "/": UrlJoin("./", linkTarget)
      };
    } else {
      return {
        ...options,
        ".": {
          ...(options["."] || {}),
          "auto_update":{"tag":"latest"}
        },
        "/": UrlJoin("/qfab", targetHash, linkTarget)
      };
    }
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

    const { write_token } = await this.client.EditContentObject({
      objectId: marketplaceObjectId,
      libraryId
    });

    let sku;
    const filteredItems = items.filter(item => {
      if (item.nft_template["/"].includes(nftObjectHash)) {
        sku = item.sku;
        return false;
      } else {
        return true;
      }
    });

    if (sku) {
      await this.StorefrontSectionRemoveItem({
        objectId: marketplaceObjectId,
        sku,
        writeToken: write_token
      });
    }

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

  async StorefrontSectionAddItem({objectId, sku, name}) {
    const libraryId = await this.client.ContentObjectLibraryId({
      objectId
    });
    let section;

    const sections = await this.client.ContentObjectMetadata({
      objectId,
      libraryId,
      metadataSubtree: "/public/asset_metadata/info/storefront/sections"
    });

    if (!sections || sections.length === 0) {
      sections.push({
        items: [],
        section_header: "",
        section_subheader: ""
      });
    }

    const sectionByName = sections.find(section => section.section_header === name);
    section = (name && sectionByName) ? sectionByName : sections[0];

    if (!section.items || !Array.isArray(section.items)) section.items = [];

    if (!section.items.find(itemSKU => sku === itemSKU)) {
      section.items.push(sku);
    }

    const { write_token } = await this.client.EditContentObject({
      objectId,
      libraryId
    });

    await this.client.ReplaceMetadata({
      objectId,
      libraryId,
      writeToken: write_token,
      metadataSubtree: "/public/asset_metadata/info/storefront/sections",
      metadata: sections
    });

    await this.client.FinalizeContentObject({
      objectId,
      libraryId,
      writeToken: write_token,
      commitMessage: "Add storefront section item"
    });

    return section;
  }

  async StorefrontSectionRemoveItem({objectId, sku, writeToken}) {
    const libraryId = await this.client.ContentObjectLibraryId({
      objectId
    });

    const sections = await this.client.ContentObjectMetadata({
      objectId,
      libraryId,
      metadataSubtree: "/public/asset_metadata/info/storefront/sections"
    });

    sections.forEach(section => {
      const index = section.items.indexOf(sku);

      if (index > -1) section.items.splice(index, 1);
    });

    const finalize = !writeToken;
    if (!writeToken) {
      const response = await this.client.EditContentObject({
        objectId,
        libraryId
      });
      writeToken = response.write_token;
    }

    await this.client.ReplaceMetadata({
      objectId,
      libraryId,
      writeToken,
      metadataSubtree: "/public/asset_metadata/info/storefront/sections",
      metadata: sections
    });

    if (finalize) {
      return await this.client.FinalizeContentObject({
        objectId,
        libraryId,
        writeToken,
        commitMessage: "Remove storefront section item"
      });
    }
  }
}

exports.Marketplace = Marketplace;
