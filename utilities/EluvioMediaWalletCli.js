const yargs = require("yargs/yargs");
const { hideBin } = require("yargs/helpers");
const yaml = require("js-yaml");

const { ElvMediaWallet } = require("../src/ElvMediaWallet");
const { ApiTestService } = require("../src/ApiTestService");
const { Config } = require("../src/Config");

const makeWallet = (argv) => new ElvMediaWallet({
  configUrl: Config.networks[Config.net],
  debugLogging: argv.verbose
});

/* ----------------------- Catalog handlers ----------------------- */

const CmdCatalogList = async ({ argv }) => {
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

const CmdCatalogItemGet = async ({ argv }) => {
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

const CmdCatalogItemDelete = async ({ argv }) => {
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

const CmdCatalogItemSet = async ({ argv }) => {
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
      sidebarTitle: argv.sidebar_title,
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

const CmdCatalogItemAdd = async ({ argv }) => {
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
      sidebarTitle: argv.sidebar_title,
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

const CmdCatalogItemCopy = async ({ argv }) => {
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

const CmdCatalogItemBulkAdd = async ({ argv }) => {
  console.log("Catalog Item Bulk-Add Command Invoked\n");
  try {
    const wallet = makeWallet(argv);
    await wallet.Init({ privateKey: process.env.PRIVATE_KEY });
    const res = await wallet.CatalogItemBulkAdd({
      objectId: argv.object_id,
      filePath: argv.file,
      thumbnailDir: argv.thumbnail_dir,
    });
    console.log(yaml.dump(res));
  } catch (error) {
    console.error("Error bulk-adding catalog items:", error);
    process.exit(1);
  }
};

/* ----------------------- Property handlers ----------------------- */

const CmdPropertySectionItemAdd = async ({ argv }) => {
  console.log("Property Section Item Add Command Invoked\n");
  try {
    const wallet = makeWallet(argv);
    await wallet.Init({ privateKey: process.env.PRIVATE_KEY });
    const res = await wallet.PropertySectionItemAdd({
      propertyObjectId: argv.property_object_id,
      sectionId: argv.section_id,
      mediaItemId: argv.media_item_id,
    });
    console.log(yaml.dump(res));
  } catch (error) {
    console.error("Error adding item to property section:", error);
    process.exit(1);
  }
};

const CmdPropertySectionItemBulkAdd = async ({ argv }) => {
  console.log("Property Section Item Bulk-Add Command Invoked\n");
  try {
    const wallet = makeWallet(argv);
    await wallet.Init({ privateKey: process.env.PRIVATE_KEY });
    const res = await wallet.PropertySectionItemBulkAdd({
      propertyObjectId: argv.property_object_id,
      sectionId: argv.section_id,
      filePath: argv.file,
    });
    console.log(yaml.dump(res));
  } catch (error) {
    console.error("Error bulk-adding items to property section:", error);
    process.exit(1);
  }
};

const CmdPropertySectionItemDelete = async ({ argv }) => {
  console.log("Property Section Item Delete Command Invoked\n");
  try {
    const wallet = makeWallet(argv);
    await wallet.Init({ privateKey: process.env.PRIVATE_KEY });
    const res = await wallet.PropertySectionItemDelete({
      propertyObjectId: argv.property_object_id,
      sectionId: argv.section_id,
      sectionItemId: argv.section_item_id,
    });
    console.log(yaml.dump(res));
  } catch (error) {
    console.error("Error deleting item from property section:", error);
    process.exit(1);
  }
};

/* ----------------------- API test handler ----------------------- */

const CmdApiTest = async ({ argv }) => {
  console.log("API Test Command Invoked\n");
  try {
    // Same aliases as src/Config.js (ELV_NET): demo and dv3 both mean demov3.
    const network = { demo: "demov3", dv3: "demov3" }[argv.network] || argv.network;
    const consts = Config.consts[network] || {};
    const service = new ApiTestService({
      configUrl: Config.networks[network],
      network,
      walletUrl: consts.walletUrl,
      env: argv.env,
      timeoutMs: argv.timeout * 1000,
      slowMs: argv.slow_ms,
      readOnly: argv.read_only,
      skipNodeSweep: argv.skip_node_sweep,
      mediaScan: argv.media_scan,
      debugLogging: argv.verbose
    });

    // Secrets come from env vars by default so they stay out of shell history.
    const { counts } = await service.Run({
      token: argv.anonymous ? undefined : argv.token || process.env.ELV_FABRIC_TOKEN,
      jwt: argv.anonymous ? undefined : argv.jwt || process.env.ELV_JWT,
      privateKey: argv.anonymous ? undefined : process.env.PRIVATE_KEY,
      tenantId: argv.tenant_id,
      propertyIds: argv.property_id || [],
      maxProperties: argv.max_properties
    });

    if (argv.junit) service.WriteJunit(argv.junit);
    if (argv.json) service.WriteJson(argv.json);

    if (counts.FAIL || (argv.strict && counts.WARN)) process.exit(1);
  } catch (error) {
    console.error("Error running API tests:", error);
    process.exit(1);
  }
};

/* ----------------------- CLI ----------------------- */

const yargsInstance = yargs(hideBin(process.argv))
  .option("verbose", {
    alias: "v",
    describe: "Verbose mode",
    type: "boolean",
    default: false,
  })
  .command({
    command: "catalog <command>",
    describe: "Catalog related commands",
    builder: (yargs) => {
      yargs
        .command(
          "list <object_id>",
          "List catalog items",
          (yargs) => {
            yargs.positional("object_id", { describe: "Catalog Object ID", type: "string" });
          },
          (argv) => CmdCatalogList({ argv })
        )
        .command(
          "item <command>",
          "Catalog item related commands",
          (yargs) => {
            yargs
              .command(
                "get <object_id> <item_id>",
                "Get catalog item details",
                (yargs) => {
                  yargs
                    .positional("object_id", { describe: "Catalog Object ID", type: "string" })
                    .positional("item_id", { describe: "Catalog Item ID", type: "string" });
                },
                (argv) => CmdCatalogItemGet({ argv })
              )
              .command(
                "delete <object_id> <item_id>",
                "Delete catalog item",
                (yargs) => {
                  yargs
                    .positional("object_id", { describe: "Catalog Object ID", type: "string" })
                    .positional("item_id", { describe: "Catalog Item ID", type: "string" });
                },
                (argv) => CmdCatalogItemDelete({ argv })
              )
              .command(
                "set <object_id> <item_id> [options]",
                "Set catalog item content",
                (yargs) => {
                  yargs
                    .positional("object_id", { describe: "Catalog Object ID", type: "string" })
                    .positional("item_id", { describe: "Catalog Item ID", type: "string" })
                    .option("item_label", { alias: "l", describe: "New Media Item Label", type: "string" })
                    .option("catalog_title", { alias: "ct", describe: "New Media Item Catalog Title", type: "string" })
                    .option("display_title", { alias: "dt", describe: "New Media Item Display Title", type: "string" })
                    .option("subtitle", { alias: "st", describe: "New Media Item Subtitle", type: "string" })
                    .option("sidebar_title", { describe: "New Media Item Sidebar Title", type: "string" })
                    .option("description", { alias: "d", describe: "New Media Item Description", type: "string" })
                    .option("content_id", { alias: "c", describe: "Content ID to add as catalog item", type: "string" })
                    .option("content_id_type", { alias: "t", describe: "Type of Content ID", type: "string" })
                    .option("public", { alias: "p", describe: "Set Item to Public", type: "boolean" })
                    .option("composition_key", { describe: "Name of Composition Key", type: "string" })
                    .option("thumbnail_landscape", { describe: "Landscape Thumbnail Image (16:9) of Media Item", type: "string" })
                    .option("thumbnail_portrait", { describe: "Portrait Thumbnail Image (2:3) of Media Item", type: "string" })
                    .option("thumbnail_square", { describe: "Square Thumbnail Image (1:1) of Media Item", type: "string" })
                    .option("media_metadata", { describe: "Path to .json or .yaml file containing media item metadata to add", type: "string" });
                },
                (argv) => CmdCatalogItemSet({ argv })
              )
              .command(
                "add <object_id> [options]",
                "Add object as catalog item",
                (yargs) => {
                  yargs
                    .positional("object_id", { describe: "Catalog Object ID", type: "string" })
                    .option("item_label", { alias: "l", describe: "New Media Item Label", type: "string" })
                    .option("catalog_title", { alias: "ct", describe: "New Media Item Catalog Title", type: "string" })
                    .option("display_title", { alias: "dt", describe: "New Media Item Display Title", type: "string" })
                    .option("subtitle", { alias: "st", describe: "New Media Item Subtitle", type: "string" })
                    .option("sidebar_title", { describe: "New Media Item Sidebar Title", type: "string" })
                    .option("description", { alias: "d", describe: "New Media Item Description", type: "string" })
                    .option("content_id", { alias: "c", describe: "Content ID to add as catalog item", type: "string" })
                    .option("content_id_type", { alias: "t", describe: "Type of Content ID", type: "string" })
                    .option("public", { alias: "p", describe: "Set Item to Public", type: "boolean", default: false })
                    .option("composition_key", { describe: "Name of Composition Key", type: "string" })
                    .option("thumbnail_landscape", { describe: "Landscape Thumbnail Image (16:9) of Media Item", type: "string" })
                    .option("thumbnail_portrait", { describe: "Portrait Thumbnail Image (2:3) of Media Item", type: "string" })
                    .option("thumbnail_square", { describe: "Square Thumbnail Image (1:1) of Media Item", type: "string" })
                    .option("media_metadata", { describe: "Path to .json or .yaml file containing media item metadata to add", type: "string" });
                },
                (argv) => CmdCatalogItemAdd({ argv })
              )
              .command(
                "copy <source_object_id> <item_id> <dest_object_id>",
                "Copy a catalog item to another catalog",
                (yargs) => {
                  yargs
                    .positional("source_object_id", { describe: "Source Catalog Object ID", type: "string" })
                    .positional("item_id", { describe: "Media Item ID to copy", type: "string" })
                    .positional("dest_object_id", { describe: "Destination Catalog Object ID", type: "string" });
                },
                (argv) => CmdCatalogItemCopy({ argv })
              )
              .command(
                "bulk-add <object_id>",
                "Add multiple catalog items from a JSON or YAML file",
                (yargs) => {
                  yargs
                    .positional("object_id", { describe: "Catalog Object ID", type: "string" })
                    .option("file", { alias: "f", describe: "Path to JSON or YAML file containing an array of media item definitions", type: "string", demandOption: true })
                    .option("thumbnail_dir", { alias: "t", describe: "Directory containing local thumbnail images to upload and attach to each media item", type: "string" });
                },
                (argv) => CmdCatalogItemBulkAdd({ argv })
              );
          }
        );
    },
  })
  .command({
    command: "property <command>",
    describe: "Media property related commands",
    builder: (yargs) => {
      yargs.command(
        "section <command>",
        "Property section related commands",
        (yargs) => {
          yargs.command(
            "item <command>",
            "Property section item related commands",
            (yargs) => {
              yargs
                .command(
                  "add <property_object_id> <section_id> <media_item_id>",
                  "Add a catalog media item to a property page section",
                  (yargs) => {
                    yargs
                      .positional("property_object_id", { describe: "Media Property Object ID", type: "string" })
                      .positional("section_id", { describe: "Section ID (e.g. pscm...)", type: "string" })
                      .positional("media_item_id", { describe: "Media Item ID (e.g. mvid...)", type: "string" });
                  },
                  (argv) => CmdPropertySectionItemAdd({ argv })
                )
                .command(
                  "delete <property_object_id> <section_id> <section_item_id>",
                  "Delete an item from a property page section",
                  (yargs) => {
                    yargs
                      .positional("property_object_id", { describe: "Media Property Object ID", type: "string" })
                      .positional("section_id", { describe: "Section ID (e.g. pscm...)", type: "string" })
                      .positional("section_item_id", { describe: "Section Item ID (e.g. psci...)", type: "string" });
                  },
                  (argv) => CmdPropertySectionItemDelete({ argv })
                )
                .command(
                  "bulk-add <property_object_id> <section_id>",
                  "Add multiple media items to a property page section from a JSON or YAML file",
                  (yargs) => {
                    yargs
                      .positional("property_object_id", { describe: "Media Property Object ID", type: "string" })
                      .positional("section_id", { describe: "Section ID (e.g. pscm...)", type: "string" })
                      .option("file", { alias: "f", describe: "Path to JSON or YAML file containing an array of media item IDs", type: "string", demandOption: true });
                  },
                  (argv) => CmdPropertySectionItemBulkAdd({ argv })
                );
            }
          );
        }
      );
    },
  })
  .command(
    "api-test [options]",
    "Check every API the media wallet apps use, on each active property (run after infra redeploys)",
    (yargs) => {
      yargs
        .option("property_id", { alias: "p", describe: "Property ID(s) to test (default: every active property)", type: "array", string: true })
        .option("max_properties", { describe: "Test at most this many properties", type: "number" })
        .option("network", { describe: "Network to test (default: ELV_NET, or main)", choices: ["main", "demov3", "dv3", "demo"], default: Config.net })
        .option("env", { describe: "API environment (staging appends env=staging)", choices: ["prod", "staging"], default: "prod" })
        .option("jwt", { describe: "OAuth ID token: runs the real app login (wlt/login/jwt, wlt/sign/csat). Env: ELV_JWT", type: "string" })
        .option("token", { describe: "Existing fabric token / CSAT to test with. Env: ELV_FABRIC_TOKEN", type: "string" })
        .option("anonymous", { describe: "Ignore PRIVATE_KEY / ELV_JWT / ELV_FABRIC_TOKEN and test logged out", type: "boolean", default: false })
        .option("tenant_id", { describe: "Tenant ID (iten...). With PRIVATE_KEY: must match the account's tenant, or is used when it can't be read. Also used for JWT login and redemption status", type: "string" })
        .option("media_scan", { describe: "Videos to try per property when looking for one the user can play", type: "number", default: 5 })
        .option("read_only", { describe: "Skip calls that create server records (activation code, short URL)", type: "boolean", default: false })
        .option("skip_node_sweep", { describe: "Only test the first node of each service", type: "boolean", default: false })
        .option("timeout", { describe: "Per-request timeout in seconds", type: "number", default: 30 })
        .option("slow_ms", { describe: "WARN when a call takes longer than this", type: "number", default: 8000 })
        .option("strict", { describe: "Exit non-zero on warnings too", type: "boolean", default: false })
        .option("junit", { describe: "Write a JUnit XML report to this path", type: "string" })
        .option("json", { describe: "Write a JSON report to this path", type: "string" });
    },
    (argv) => CmdApiTest({ argv })
  );

yargsInstance
  .strict()
  .help()
  .usage("Eluvio Media Wallet CLI\n\nUsage: elv-mediawallet <command> [options]")
  .alias("help", "h")
  .scriptName("")
  .demandCommand(1, "You need at least one command before moving on").argv;
