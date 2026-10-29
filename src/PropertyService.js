const { v4: uuidv4 } = require("uuid");
const fs = require("fs");
const path = require("path");
const yaml = require("js-yaml");

class PropertyService {
  constructor(wallet) {
    this.wallet = wallet;
  }

  get client() {
    return this.wallet.client;
  }

  async PropertySectionItemAdd({ propertyObjectId, sectionId, mediaItemId }) {
    console.log("Property Object ID:", propertyObjectId);
    console.log("Section ID:", sectionId);
    console.log("Media Item ID:", mediaItemId);

    const { libraryId } = await this.wallet.getLibraryAndHash(propertyObjectId);

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

    const newItemId = "psci" + uuidv4().replace(/-/g, "");

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

    const { libraryId } = await this.wallet.getLibraryAndHash(propertyObjectId);

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
      const newItemId = "psci" + uuidv4().replace(/-/g, "");

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

    const { libraryId } = await this.wallet.getLibraryAndHash(propertyObjectId);

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

module.exports = { PropertyService };
