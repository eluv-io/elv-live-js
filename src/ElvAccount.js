const { ElvClient } = require("elv-client-js");
const Utils = require("elv-client-js/src/Utils.js");

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

  InitWithClient({ elvClient }) {
    this.client = elvClient;
  }

  Address () {
    if (this.client){
      return this.client.signer.address;
    }
    return null;
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
  async Create({ funds = 0.25, accountName, tenantAdminsAddress }) {
    if (!this.client) {
      throw Error("ElvAccount not intialized");
    }
    if (tenantAdminsAddress) {
      if (!Utils.ValidAddress(tenantAdminsAddress)) {
        throw Error(`Invalid tenant admins address: ${tenantAdminsAddress}`);
      }
    }

    let client = await ElvClient.FromConfigurationUrl({
      configUrl: this.configUrl,
    });
    let wallet = this.client.GenerateWallet();
    const mnemonic = wallet.GenerateMnemonic();
    const signer = wallet.AddAccountFromMnemonic({ mnemonic });
    const privateKey = signer.privateKey;
    const address = signer.address;

    if (this.debug){
      console.log("privateKey: ",privateKey);
      console.log("address: ", address);
    }

    try {
      client.SetSigner({ signer });

      let res = await this.client.SendFunds({
        recipient: address,
        ether: funds,
      });

      if (this.debug){
        console.log("Send Funds result: ", res);
      }

      await client.userProfileClient.CreateWallet();

      let tenantAdminsId = "";
      if (tenantAdminsAddress) {
        await client.userProfileClient.SetTenantId({
          address: tenantAdminsAddress,
        });
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
    } catch (e) {
      if (funds > 0.01) {
        await client.SendFunds({
          recipient: this.client.signer.address,
          ether: funds - 0.01,
        });
      }
      throw e;
    }
  }

  /**
   * Show info about this account.
   */
  async Show() {
    if (!this.client) {
      throw Error("ElvAccount not intialized");
    }

    let address = await this.client.signer.address;
    let tenantAmdinsId = await this.client.userProfileClient.TenantId();
    let walletAddress = await this.client.userProfileClient.WalletAddress();
    let userWalletObject =
      await this.client.userProfileClient.UserWalletObjectInfo();
    let userMetadata = await this.client.userProfileClient.UserMetadata();
    let wallet = this.client.GenerateWallet();
    let balance = await wallet.GetAccountBalance({ signer:this.client.signer });

    return { address, tenantAmdinsId, walletAddress, userWalletObject, userMetadata, balance };
  }

  async SetAccountTenantAdminsAddress({ tenantAdminsAddress }) {
    if (!this.client) {
      throw Error("ElvAccount not intialized");
    }

    await this.client.userProfileClient.SetTenantId({
      address: tenantAdminsAddress,
    });
  }

  async CreateAccessGroup({ name }) {
    const address = await this.client.CreateAccessGroup({
      name,
    });

    await this.client.AddAccessGroupManager({
      contractAddress: address,
      memberAddress: this.client.signer.address,
    });

    return { name, address };
  }

  async Send({ address, funds }) {
    await this.client.SendFunds({
      recipient: address,
      ether: funds,
    });
  }

  async AddToAccessGroup({ groupAddress, accountAddress, isManager = false }) {
    let res = {};
    if (isManager) {
      res = await this.client.AddAccessGroupManager({
        contractAddress: groupAddress,
        memberAddress: accountAddress,
      });
    } else {
      res = await this.client.AddAccessGroupMember({
        contractAddress: groupAddress,
        memberAddress: accountAddress,
      });
    }
    return { res };
  }

}

exports.ElvAccount = ElvAccount;
