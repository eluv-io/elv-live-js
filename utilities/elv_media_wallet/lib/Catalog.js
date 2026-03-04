const { ElvMediaWallet } = require("../../../src/ElvMediaWallet");
const { Config } = require("../../../src/Config");
const yaml = require("js-yaml");

const makeWallet = (argv) => {
  const wallet = new ElvMediaWallet({
    configUrl: Config.networks[Config.net],
    debugLogging: argv.verbose
  });
  return wallet;
};

const CmdCatalogList = async({argv}) => {
  console.log("Catalog List Command Invoked\n");

  try {
    const wallet = makeWallet(argv);
    await wallet.Init({ privateKey: process.env.PRIVATE_KEY });
    const res = await wallet.CatalogList({ objectId: argv.object_id });
    console.log(yaml.dump(res));
  } catch (error) {
    console.error("Error listing catalog items:", error);
    process.exit(1);
  }
};

const CmdCatalogItemGet = async({argv}) => {
  console.log("Catalog Item Get Command Invoked\n");

  try {
    const wallet = makeWallet(argv);
    await wallet.Init({ privateKey: process.env.PRIVATE_KEY });
    const res = await wallet.CatalogItemGet({
      objectId: argv.object_id,
      itemId: argv.item_id,
    });
    console.log(yaml.dump(res));
  } catch (error) {
    console.error("Error getting catalog item:", error);
    process.exit(1);
  }
};

const CmdCatalogItemDelete = async({argv}) => {
  console.log("Catalog Item Delete Command Invoked\n");

  try {
    const wallet = makeWallet(argv);
    await wallet.Init({ privateKey: process.env.PRIVATE_KEY });
    await wallet.CatalogItemDelete({
      objectId: argv.object_id,
      itemId: argv.item_id,
    });
  } catch (error) {
    console.error("Error deleting catalog item:", error);
    process.exit(1);
  }
};

const CmdCatalogItemSet = async({argv}) => {
  console.log("Catalog Item Set Command Invoked\n");

  try {
    const wallet = makeWallet(argv);
    await wallet.Init({ privateKey: process.env.PRIVATE_KEY });
    const res = await wallet.CatalogItemSet({
      objectId: argv.object_id,
      itemId: argv.item_id,
      itemLabel: argv.item_label,
      catalogTitle: argv.catalog_title,
      displayTitle: argv.display_title,
      subtitle: argv.subtitle,
      description: argv.description,
      contentId: argv.content_id,
      contentIdType: argv.content_id_type,
      isPublic: argv.public,
      compositionKey: argv.composition_key,
      thumbnail_landscape: argv.thumbnail_landscape,
      thumbnail_portrait: argv.thumbnail_portrait,
      thumbnail_square: argv.thumbnail_square,
      mediaMetadata: argv.media_metadata
    });
    console.log(yaml.dump(res));
  } catch (error) {
    console.error("Error setting catalog item:", error);
    process.exit(1);
  }
};

const CmdCatalogItemAdd = async({argv}) => {
  console.log("Catalog Item Add Command Invoked\n");

  try {
    const wallet = makeWallet(argv);
    await wallet.Init({ privateKey: process.env.PRIVATE_KEY });
    const res = await wallet.CatalogItemAdd({
      objectId: argv.object_id,
      itemLabel: argv.item_label,
      catalogTitle: argv.catalog_title,
      displayTitle: argv.display_title,
      subtitle: argv.subtitle,
      description: argv.description,
      contentId: argv.content_id,
      contentIdType: argv.content_id_type,
      isPublic: argv.public,
      compositionKey: argv.composition_key,
      thumbnail_landscape: argv.thumbnail_landscape,
      thumbnail_portrait: argv.thumbnail_portrait,
      thumbnail_square: argv.thumbnail_square,
      mediaMetadata: argv.media_metadata
    });
    console.log(yaml.dump(res));
  } catch (error) {
    console.error("Error adding catalog item:", error);
    process.exit(1);
  }
};

const CmdCatalogItemCopy = async({argv}) => {
  console.log("Catalog Item Copy Command Invoked\n");

  try {
    const wallet = makeWallet(argv);
    await wallet.Init({ privateKey: process.env.PRIVATE_KEY });
    const res = await wallet.CatalogItemCopy({
      sourceObjectId: argv.source_object_id,
      sourceItemId: argv.item_id,
      destObjectId: argv.dest_object_id,
    });
    console.log(yaml.dump(res));
  } catch (error) {
    console.error("Error copying catalog item:", error);
    process.exit(1);
  }
};

const CmdCatalogItemBulkAdd = async({argv}) => {
  console.log("Catalog Item Bulk-Add Command Invoked\n");

  try {
    const wallet = makeWallet(argv);
    await wallet.Init({ privateKey: process.env.PRIVATE_KEY });
    const res = await wallet.CatalogItemBulkAdd({
      objectId: argv.object_id,
      filePath: argv.file,
    });
    console.log(yaml.dump(res));
  } catch (error) {
    console.error("Error bulk-adding catalog items:", error);
    process.exit(1);
  }
};

module.exports = {
  CmdCatalogList,
  CmdCatalogItemGet,
  CmdCatalogItemDelete,
  CmdCatalogItemSet,
  CmdCatalogItemAdd,
  CmdCatalogItemCopy,
  CmdCatalogItemBulkAdd,
};
