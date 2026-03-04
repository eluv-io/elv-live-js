const CatalogCommand = require("../lib/Catalog");

module.exports = {
  command: "catalog <command>",
  describe: "Catalog related commands",
  builder: (yargs) => {
    yargs
      .command(
        "list <object_id>",
        "List catalog items",
        (yargs) => {
          yargs
            .positional("object_id", {
              describe: "Catalog Object ID",
              type: "string",
            });
        },
        (argv) => {
          CatalogCommand.CmdCatalogList({argv});
        }
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
                  .positional("object_id", {
                    describe: "Catalog Object ID",
                    type: "string",
                  })
                  .positional("item_id", {
                    describe: "Catalog Item ID",
                    type: "string",
                  });
              },
              (argv) => {
                CatalogCommand.CmdCatalogItemGet({argv});
              }
            )
            .command(
              "delete <object_id> <item_id>",
              "Delete catalog item",
              (yargs) => {
                yargs
                  .positional("object_id", {
                    describe: "Catalog Object ID",
                    type: "string",
                  })
                  .positional("item_id", {
                    describe: "Catalog Item ID",
                    type: "string",
                  });
              },
              (argv) => {
                CatalogCommand.CmdCatalogItemDelete({argv});
              }
            )
            .command(
              "set <object_id> <item_id> [options]",
              "Set catalog item content",
              (yargs) => {
                yargs
                  .positional("object_id", {
                    describe: "Catalog Object ID",
                    type: "string",
                  })
                  .positional("item_id", {
                    describe: "Catalog Item ID",
                    type: "string",
                  })
                  .option("item_label", {
                    alias: "l",
                    describe: "New Media Item Label",
                    type: "string"
                  })
                  .option("catalog_title", {
                    alias: "ct",
                    describe: "New Media Item Catalog Title",
                    type: "string"
                  })
                  .option("display_title", {
                    alias: "dt",
                    describe: "New Media Item Display Title",
                    type: "string"
                  })
                  .option("subtitle", {
                    alias: "st",
                    describe: "New Media Item Subtitle",
                    type: "string"
                  })
                  .option("description", {
                    alias: "d",
                    describe: "New Media Item Description",
                    type: "string"
                  })
                  .option("content_id", {
                    alias: "c",
                    describe: "Content ID to add as catalog item",
                    type: "string",
                  })
                  .option("content_id_type", {
                    alias: "t",
                    describe: "Type of Content ID",
                    type: "string",
                  })
                  .option("public", {
                    alias: "p",
                    describe: "Set Item to Public",
                    type: "boolean",
                  })
                  .option("composition_key", {
                    describe: "Name of Composition Key",
                    type: "string"
                  })
                  .option("thumbnail_landscape", {
                    describe: "Landscape Thumbnail Image (16:9) of Media Item",
                    type: "string"
                  })
                  .option("thumbnail_portrait", {
                    describe: "Portrait Thumbnail Image (2:3) of Media Item",
                    type: "string"
                  })
                  .option("thumbnail_square", {
                    describe: "Square Thumbnail Image (1:1) of Media Item",
                    type: "string"
                  })
                  .option("media_metadata", {
                    describe: "Path to .json or .yaml file containing media item metadata to add",
                    type: "string"
                  });
              },
              (argv) => {
                CatalogCommand.CmdCatalogItemSet({argv});
              }
            )
            .command(
              "add <object_id> [options]",
              "Add object as catalog item",
              (yargs) => {
                yargs
                  .positional("object_id", {
                    describe: "Catalog Object ID",
                    type: "string",
                  })
                  .option("item_label", {
                    alias: "l",
                    describe: "New Media Item Label",
                    type: "string"
                  })
                  .option("catalog_title", {
                    alias: "ct",
                    describe: "New Media Item Catalog Title",
                    type: "string"
                  })
                  .option("display_title", {
                    alias: "dt",
                    describe: "New Media Item Display Title",
                    type: "string"
                  })
                  .option("subtitle", {
                    alias: "st",
                    describe: "New Media Item Subtitle",
                    type: "string"
                  })
                  .option("description", {
                    alias: "d",
                    describe: "New Media Item Description",
                    type: "string"
                  })
                  .option("content_id", {
                    alias: "c",
                    describe: "Content ID to add as catalog item",
                    type: "string",
                  })
                  .option("content_id_type", {
                    alias: "t",
                    describe: "Type of Content ID",
                    type: "string",
                  })
                  .option("public", {
                    alias: "p",
                    describe: "Set Item to Public",
                    type: "boolean",
                    default: false
                  })
                  .option("composition_key", {
                    describe: "Name of Composition Key",
                    type: "string"
                  })
                  .option("thumbnail_landscape", {
                    describe: "Landscape Thumbnail Image (16:9) of Media Item",
                    type: "string"
                  })
                  .option("thumbnail_portrait", {
                    describe: "Portrait Thumbnail Image (2:3) of Media Item",
                    type: "string"
                  })
                  .option("thumbnail_square", {
                    describe: "Square Thumbnail Image (1:1) of Media Item",
                    type: "string"
                  })
                  .option("media_metadata", {
                    describe: "Path to .json or .yaml file containing media item metadata to add",
                    type: "string"
                  });
              },
              (argv) => {
                CatalogCommand.CmdCatalogItemAdd({argv});
              }
            )
            .command(
              "copy <source_object_id> <item_id> <dest_object_id>",
              "Copy a catalog item to another catalog",
              (yargs) => {
                yargs
                  .positional("source_object_id", {
                    describe: "Source Catalog Object ID",
                    type: "string",
                  })
                  .positional("item_id", {
                    describe: "Media Item ID to copy",
                    type: "string",
                  })
                  .positional("dest_object_id", {
                    describe: "Destination Catalog Object ID",
                    type: "string",
                  });
              },
              (argv) => {
                CatalogCommand.CmdCatalogItemCopy({argv});
              }
            )
            .command(
              "bulk-add <object_id>",
              "Add multiple catalog items from a JSON or YAML file",
              (yargs) => {
                yargs
                  .positional("object_id", {
                    describe: "Catalog Object ID",
                    type: "string",
                  })
                  .option("file", {
                    alias: "f",
                    describe: "Path to JSON or YAML file containing an array of media item definitions",
                    type: "string",
                    demandOption: true
                  });
              },
              (argv) => {
                CatalogCommand.CmdCatalogItemBulkAdd({argv});
              }
            );
        }
      );
  },
};
