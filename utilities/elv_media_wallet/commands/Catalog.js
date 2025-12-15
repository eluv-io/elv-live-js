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
                        })
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
                                    })
                            },
                            (argv) => {
                                CatalogCommand.CmdCatalogItemGet({argv});
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
                                    .option("content_id", {
                                        alias: "c",
                                        describe: "Content ID to set for the catalog item",
                                        type: "string",
                                    })
                                    .option("content_id_type", {
                                        alias: "t",
                                        describe: "Type of Content ID",
                                        type: "string",
                                    })
                            },
                            (argv) => {
                                CatalogCommand.CmdCatalogItemSet({argv});
                            }        
                        )
                }        
            )
    },
};