const { ElvClient } = require("@eluvio/elv-client-js");

class ElvMediaWallet {
  constructor({ configUrl, debugLogging = false }) {
    this.configUrl = configUrl;
    this.debugLogging = debugLogging;
  }

  async Init({privateKey}) {
    this.client = await ElvClient.FromConfigurationUrl({
      configUrl: this.configUrl,
    });
    let wallet = this.client.GenerateWallet();
    let signer = wallet.AddAccount({
      privateKey: privateKey,
    });
    this.client.SetSigner({signer});
    this.client.ToggleLogging(this.debugLogging);
  }

  async CatalogList({objectId}) {
    console.log("Object ID:", objectId);
    
    // TODO
    let res = {"output": "xyz"};
    return res;
  }

  async CatalogItemGet({objectId, itemId}) {
    console.log("Object ID:", objectId);
    console.log("Item ID:", itemId);
    
    // TODO
    let res = {"output": "xyz"};
    return res;
  }
  
  async CatalogItemSet({objectId, itemId, contentId, contentIdType}) {
    console.log("Object ID:", objectId);
    console.log("Item ID:", itemId);
    console.log("Content ID:", contentId);
    console.log("Content ID Type:", contentIdType);

    // TODO
    let res = {"output": "xyz"};
    return res;
  }
}

exports.ElvMediaWallet = ElvMediaWallet;

