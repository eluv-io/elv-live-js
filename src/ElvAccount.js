const { ElvClient } = require("elv-client-js");

class ElvAccount {
  /**
   * Instantiate the ElvAccount Object
   *
   * @namedParams
   * @param {string} configUrl - The Content Fabric configuration URL
   * @param {string} mainObjectId - The top-level Eluvio Live object ID
   * @return {ElvSpace} - New ElvSpace object connected to the specified content fabric and blockchain
   */
  constructor({ configUrl, debugLogging = false }) {
    this.configUrl = configUrl;
    this.debug = debugLogging;
  }

  async Init({ privateKey }) {
    this.client = await ElvClient.FromConfigurationUrl({
      configUrl: this.configUrl,
    });
    let wallet = this.client.GenerateWallet();
    let signer = wallet.AddAccount({
      privateKey,
    });
    this.client.SetSigner({ signer });
    this.client.ToggleLogging(this.debug);
  }

  InitWithClient({elvClient}){
    this.client = elvClient;
  }

  /**
   * Creates a new account including wallet object and contract.
   * Current client must be initialized and funded.
   *
   * @namedParams
   * @param {number} funds - The amount in ETH to fund the new account.
   * @cauth {string} accountName - The name of the account to set in it's wallet metadata (Optional)
   * @cauth {string} tenantAdminsGroup - The tenant admins group ID to set for the user's wallet (Optional)
   * @return {Promise<Object>} - An object containing the new account mnemonic, privateKey, address, accountName, balance
   */
  async Create({ funds = 0.25, accountName, tenantAdminsId }) {
    if (!this.client) {
      throw Error("ElvAccount not intialized");
    }

    let client = await ElvClient.FromConfigurationUrl({
      configUrl: this.configUrl,
    });
    let wallet = this.client.GenerateWallet();
    const mnemonic = wallet.GenerateMnemonic();
    const signer = wallet.AddAccountFromMnemonic({ mnemonic });
    const privateKey = signer.privateKey;
    const address = signer.address;

    client.SetSigner({ signer });

    await this.client.SendFunds({
      recipient: address,
      ether: funds,
    });

    await client.userProfileClient.CreateWallet();

    if (tenantAdminsId) {
      await client.userProfileClient.SetTenantId({ id: tenantAdminsId });
      tenantAdminsId = await this.client.userProfileClient.TenantId();
    }

    if (accountName) {
      await client.userProfileClient.ReplaceUserMetadata({
        metadataSubtree: "public/name",
        metadata: accountName,
      });
    }

    let balance = await wallet.GetAccountBalance({ signer });
    return {
      tenantAdminsId,
      mnemonic,
      privateKey,
      address,
      accountName,
      balance,
    };
  }

  /**
   * Show info about this account.
   */
  async Show() {
    if (!this.client) {
      throw Error("ElvAccount not intialized");
    }

    let tenantAmdinsId = await this.client.userProfileClient.TenantId();
    let walletAddress = await this.client.userProfileClient.WalletAddress();
    let userWalletObject =
      await this.client.userProfileClient.UserWalletObjectInfo();
    let userMetadata = await this.client.userProfileClient.UserMetadata();

    return { tenantAmdinsId, walletAddress, userWalletObject, userMetadata };
  }

  async CreateAccessGroup({name}){
    const address = await this.client.CreateAccessGroup({
      name
    });

    await this.client.AddAccessGroupManager({
      contractAddress: address,
      memberAddress: this.client.signer.address
    });

    return {address};
  }

  async AddAccessGroup({groupAddress, accountAddress, isManager=false}) {
    if (isManager){
      await this.client.AddAccessGroupManager({
        contractAddress: groupAddress,
        memberAddress: accountAddress
      });
    } else {
      await this.client.AddAccessGroupMember({
        contractAddress: groupAddress,
        memberAddress: accountAddress
      });
    }
  }

}

exports.ElvAccount = ElvAccount;