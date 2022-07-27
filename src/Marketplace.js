const Utils = require("@eluvio/elv-client-js/src/Utils");
const { v4: UUID, parse: UUIDParse } = require("uuid");
const UrlJoin = require("url-join");
const { EluvioLive } = require("./EluvioLive");
const { ElvClient } = require("@eluvio/elv-client-js");
const fs = require("fs");

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
    name,
    price,
    currency="USD",
    maxPerUser,
    forSale=true
  }) {
    const free = (!!price && price === 0);
    const sku = Utils.B58(UUIDParse(UUID()));

    if (!nftObjectHash) {
      nftObjectHash = await this.client.LatestVersionHash({
        objectId: nftObjectId
      });
    }

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
      name: name,
      nft_template: this.CreateLink({
        targetHash: nftObjectHash
      }),
      price: price ? { [currency]: price } : {},
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

  async MarketplaceAddItemBatch({marketplaceObjectId, csv}) {
    const data = fs.readFileSync(csv).toString();

    const rows = data
      .slice(data.indexOf("\n") + 1)
      .split("\n")
      .map(field => {
        let splitFields = field.trim().split(",");
        return { object: splitFields[0], name: splitFields[1] };
      });

    const libraryId = await this.client.ContentObjectLibraryId({
      objectId: marketplaceObjectId
    });

    const items = await this.client.ContentObjectMetadata({
      objectId: marketplaceObjectId,
      libraryId,
      metadataSubtree: "/public/asset_metadata/info/items"
    }) || [];

    const newItems = [];

    await Promise.all(rows.map(async (row) => {
      let nftObjectHash;
      const sku = Utils.B58(UUIDParse(UUID()));

      if (row.object.startsWith("iq__")) {
        nftObjectHash = await this.client.LatestVersionHash({
          objectId: row.object
        });
      } else {
        nftObjectHash = row.object;
      }

      const newItem = {
        name: row.name,
        nft_template: this.CreateLink({
          targetHash: nftObjectHash
        }),
        price: {},
        sku
      };

      newItems.push(newItem);
    }));

    const { write_token } = await this.client.EditContentObject({
      objectId: marketplaceObjectId,
      libraryId
    });

    await this.client.ReplaceMetadata({
      objectId: marketplaceObjectId,
      libraryId,
      writeToken: write_token,
      metadataSubtree: "/public/asset_metadata/info/items",
      metadata: items.concat(newItems)
    });

    await this.client.FinalizeContentObject({
      objectId: marketplaceObjectId,
      libraryId,
      writeToken: write_token,
      commitMessage: "Add marketplace items"
    });

    return newItems;
  }

  async MarketplaceRemoveItem({marketplaceObjectId, nftObjectId}) {
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

    const skus = [];
    const filteredItems = items.filter(item => {
      const versionHash = (item.nft_template["/"].match(/^\/?qfab\/([\w]+)\/?.+/) || [])[1];

      if (Utils.DecodeVersionHash(versionHash).objectId === nftObjectId) {
        skus.push(item.sku);
        return false;
      } else {
        return true;
      }
    });

    if (skus.length > 0) {
      await Promise.all(
        skus.map(async sku => {
          await this.StorefrontSectionRemoveItem({
            objectId: marketplaceObjectId,
            sku,
            writeToken: write_token
          });
        })
      );
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
      section.items = section.items.filter(itemSKU => itemSKU !== sku);
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
