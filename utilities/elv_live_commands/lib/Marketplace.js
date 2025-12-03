const { Init, marketplace } = require("./Init");
const yaml = require("js-yaml");

const CmdMarketplaceAddItem = async ({ argv }) => {
  console.log("Marketplace Add Item");
  console.log(`Marketplace Object ID: ${argv.marketplace}`);
  console.log(`NFT Template Object ID/Hash: ${argv.object}`);
  console.log(`NFT Template Name${argv.name}`);
  console.log(`NFT Template Price: ${argv.price}`);
  console.log(`NFT For Sale: ${argv.forSale}`);

  try {
    await Init({ debugLogging: argv.verbose, asUrl: argv.as_url });
    const res = await marketplace.MarketplaceAddItem({
      nftObjectId: argv.object.startsWith("iq__") ? argv.object : undefined,
      nftObjectHash: argv.object.startsWith("hq__") ? argv.object : undefined,
      marketplaceObjectId: argv.marketplace,
      name: argv.name,
      price: argv.price,
      currency: argv.currency,
      maxPerUser: argv.maxPerUser,
      forSale: argv.forSale
    });

    console.log(yaml.dump(res));
  } catch (e) {
    console.error("ERROR:", e);
  }
};

const CmdMarketplaceAddItemBatch = async ({ argv }) => {
  console.log("Marketplace Add Item Batch");
  console.log(`Marketplace Object ID: ${argv.marketplace}`);
  console.log(`CSV file containing Object Names and IDs: ${argv.csv}`);

  try {
    await Init({ debugLogging: argv.verbose, asUrl: argv.as_url });

    const res = await marketplace.MarketplaceAddItemBatch({
      marketplaceObjectId: argv.marketplace,
      csv: argv.csv
    });

    console.log(yaml.dump(res));
  } catch (e) {
    console.error("ERROR:", e);
  }
};

const CmdMarketplaceRemoveItem = async ({ argv }) => {
  console.log("Marketplace Remove Item");
  console.log(`Marketplace Object ID: ${argv.marketplace}`);
  console.log(`NFT Template Object ID: ${argv.object}`);

  try {
    await Init({ debugLogging: argv.verbose, asUrl: argv.as_url });
    const res = await marketplace.MarketplaceRemoveItem({
      nftObjectId: argv.object,
      marketplaceObjectId: argv.marketplace,
    });

    console.log(yaml.dump(res));
  } catch (e) {
    console.error("ERROR:", e);
  }
};

module.exports = {
  CmdMarketplaceAddItem,
  CmdMarketplaceAddItemBatch,
  CmdMarketplaceRemoveItem,
};
