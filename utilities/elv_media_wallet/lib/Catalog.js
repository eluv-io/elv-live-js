const { ElvMediaWallet } = require("../../../src/ElvMediaWallet");
const { Config } = require("../../../src/Config");
const yaml = require("js-yaml");

const CmdCatalogList = async({argv}) => {
    console.log("Catalog List Command Invoked\n");

    try {
        let elvMediaWallet = new ElvMediaWallet({
            configUrl: Config.networks[Config.net],
            debugLogging: argv.verbose
        });

        await elvMediaWallet.Init({
            privateKey: process.env.PRIVATE_KEY,
        });
        let res = await elvMediaWallet.CatalogList({
            objectId: argv.object_id
        });
        
        console.log(yaml.dump(res));
    } catch(error) {
        console.error("Error listing catalog items:", error);
    }
};

const CmdCatalogItemGet = async({argv}) => {
    console.log("Catalog Item Get Command Invoked\n");

    try {
        let elvMediaWallet = new ElvMediaWallet({
            configUrl: Config.networks[Config.net],
            debugLogging: argv.verbose
        });

        await elvMediaWallet.Init({
            privateKey: process.env.PRIVATE_KEY,
        });
        let res = await elvMediaWallet.CatalogItemGet({
            objectId: argv.object_id,
            itemId: argv.item_id,
        });
        
        console.log(yaml.dump(res));
    } catch(error) {
        console.error("Error listing catalog items:", error);
    }

}

const CmdCatalogItemSet = async({argv}) => {
    console.log("Catalog Item Set Command Invoked\n");

    try {
        let elvMediaWallet = new ElvMediaWallet({
            configUrl: Config.networks[Config.net],
            debugLogging: argv.verbose
        });

        await elvMediaWallet.Init({
            privateKey: process.env.PRIVATE_KEY,
        });
        let res = await elvMediaWallet.CatalogItemSet({
            objectId: argv.object_id,
            itemId: argv.item_id,
            contentId: argv.content_id,
            contentIdType: argv.content_id_type,
            isPublic: argv.public, 
            compositionKey: argv.composition_key
        });
        
        console.log(yaml.dump(res));
    } catch(error) {
        console.error("Error setting catalog item:", error);
    }
    
}
const CmdCatalogItemAdd = async({argv}) => {
    console.log("Catalog Item Add Command Invoked\n");

    try {
        let elvMediaWallet = new ElvMediaWallet({
            configUrl: Config.networks[Config.net],
            debugLogging: argv.verbose
        });

        await elvMediaWallet.Init({
            privateKey: process.env.PRIVATE_KEY,
        });
        let res = await elvMediaWallet.CatalogItemAdd({
            objectId: argv.object_id,
            itemName: argv.item_name,
            contentId: argv.content_id,
            contentIdType: argv.content_id_type,
            public: argv.public
        });
        
        console.log(yaml.dump(res));
    } catch(error) {
        console.error("Error adding catalog item:", error);
    }
    
}

module.exports = {
    CmdCatalogList,
    CmdCatalogItemGet,
    CmdCatalogItemSet,
    CmdCatalogItemAdd
};