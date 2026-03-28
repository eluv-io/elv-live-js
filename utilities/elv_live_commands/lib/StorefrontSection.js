const { Init, marketplace } = require("./Init");
const yaml = require("js-yaml");

const CmdStorefrontSectionAddItem = async ({ argv }) => {
  console.log("Storefront Section Add Item");
  console.log(`Marketplace Object ID: ${argv.marketplace}`);
  console.log(`Marketplace Item SKU: ${argv.sku}`);
  console.log(`Marketplace Storefront Section: ${argv.section}`);

  try {
    await Init({ debugLogging: argv.verbose, asUrl: argv.as_url });
    const res = await marketplace.StorefrontSectionAddItem({
      objectId: argv.marketplace,
      sku: argv.sku,
      name: argv.section,
    });

    console.log(yaml.dump(res));
  } catch (e) {
    console.error("ERROR:", e);
  }
};

const CmdStorefrontSectionRemoveItem = async ({ argv }) => {
  console.log("Storefront Section Remove Item");
  console.log(`Marketplace Object ID: ${argv.marketplace}`);
  console.log(`Marketplace Item SKU: ${argv.sku}`);
  console.log(`Object Write Token: ${argv.writeToken}`);

  try {
    await Init({ debugLogging: argv.verbose, asUrl: argv.as_url });
    const res = await marketplace.StorefrontSectionRemoveItem({
      objectId: argv.marketplace,
      sku: argv.sku,
      writeToken: argv.writeToken,
    });

    console.log(yaml.dump(res));
  } catch (e) {
    console.error("ERROR:", e);
  }
};

module.exports = {
  CmdStorefrontSectionAddItem,
  CmdStorefrontSectionRemoveItem
};