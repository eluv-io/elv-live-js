const { ElvClient } = require("@eluvio/elv-client-js");
const ethers = require("ethers");
const { ElvUtils } = require("./Utils");
const constants = require("./Constants");

const TOKEN_DURATION = 120000; //2 min
class ElvAccount {

  /**
   * Instantiate the ElvAccount Object
   *
   * @namedParams
   * @param {string} configUrl - The Content Fabric configuration URL
   * @param {string} mainObjectId - The top-level Eluvio Live object ID
   * @return {ElvSpace} - New ElvAccount object connected to the specified content fabric and blockchain
   */
  constructor({ configUrl, debugLogging = false }) {
    this.configUrl = configUrl;
    this.debug = debugLogging;
  }

  async Init({ privateKey }) {
    this.client = await ElvClient.FromConfigurationUrl({
      configUrl: this.configUrl,
    });
    this.wallet = this.client.GenerateWallet();
    this.signer = this.wallet.AddAccount({
      privateKey,
    });
    this.client.SetSigner({ signer:this.signer });
    this.client.ToggleLogging(this.debug);
  }

  async InitWithId({ privateKey, tenantContractId, tenantId }) {
    await this.Init({privateKey});

    if (typeof tenantContractId !== "undefined"){
      await this.SetAccountTenantContractId({ tenantContractId });
    } else {
      if (typeof tenantId !== "undefined") {
        await this.SetAccountTenantId({tenantId});
      }
    }
    console.log(`tenantContractID: ${this.client.userProfileClient.tenantContractId}`);
    console.log(`tenantAdminGroup: ${this.client.userProfileClient.tenantId}`);
  }

  InitWithClient({ elvClient }) {
    if (!elvClient){
      throw Error("ElvAccount InitWithClient with null");
    }
    this.client = elvClient;
  }

  Address() {
    if (this.client) {
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
   * @param {string} accountName - The name of the account to set in it's wallet metadata (Optional)
   * @param {string} tenantContractId - The tenant contract ID (iten) (Optional)
   * @return {Promise<Object>} - An object containing the new account mnemonic, privateKey, address, accountName, balance
   */
  async Create({ funds = 0.25, accountName, tenantContractId }) {
    if (!this.client) {
      throw Error("ElvAccount not intialized");
    }

    // We don't require the key is part of a tenant (for example when creating a tenant root key)
    if (tenantContractId) {
      // Validate tenantContractID (make sure it is not the tenant admins ID)
      const idType = await this.client.AccessType({ id: tenantContractId });
      if (idType !== this.client.authClient.ACCESS_TYPES.TENANT) {
        throw Error("Bad tenant contract ID");
      }

      const tenantGroups = await this.client.TenantGroup({
        tenantContractId,
        groupType: constants.TENANT_ADMIN
      });
      if (!tenantGroups[constants.TENANT_ADMIN]){
        throw Error("Bad tenant - missing tenant admins group");
      }
    }

    // create new account
    let account = await ElvClient.FromConfigurationUrl({
      configUrl: this.configUrl,
    });
    let wallet = this.client.GenerateWallet();
    const mnemonic = wallet.GenerateMnemonic();
    const signer = wallet.AddAccountFromMnemonic({ mnemonic });
    const privateKey = signer.privateKey;
    const address = signer.address;

    if (this.debug) {
      console.log("privateKey: ", privateKey);
      console.log("address: ", address);
    }

    try {
      let res = await this.client.SendFunds({
        recipient: address,
        ether: funds,
      });

      if (this.debug) {
        console.log("Send Funds result: ", res);
      }

      await account.SetSigner({signer});
      // the new account can create wallet when it has funds
      await account.userProfileClient.CreateWallet();

      if (tenantContractId) {
        // set tenant info for new account
        let temp = this.client;
        this.client = account;
        await this.SetAccountTenantContractId({tenantContractId});
        this.client = temp;
      }

      if (accountName) {
        await account.userProfileClient.ReplaceUserMetadata({
          metadataSubtree: "public/name",
          metadata: accountName,
        });
      }

      let balance = await wallet.GetAccountBalance({signer});

      let accountInfo = {
        accountName,
        address,
        mnemonic,
        privateKey,
        balance
      };
      if (typeof tenantContractId !== "undefined"){
        accountInfo.tenantContractId = tenantContractId;
      }
      return accountInfo;
    } catch (e) {
      // Return funds in case of error
      if (funds > 0.01) {
        await account.SendFunds({
          recipient: this.client.signer.address,
          ether: funds - 0.01,
        });
        console.log("Funds returned", accountName, address, privateKey);
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
    let tenantContractId = "";
    let tenantAdminsId = "";
    let userMetadata = "";
    try {
      tenantAdminsId = await this.client.userProfileClient.TenantId();
    } catch (e){ console.log("No tenantAdminsId set."); }

    try {
      tenantContractId = await this.client.userProfileClient.TenantContractId();
    } catch (e){ console.log("No tenantContractId set."); }

    try {
      userMetadata = await this.client.userProfileClient.UserMetadata();
    } catch (e){ console.log("No User Metadata."); }

    let walletAddress = await this.client.userProfileClient.WalletAddress() || "";
    let userWalletObject =
      await this.client.userProfileClient.UserWalletObjectInfo() || "";
    let wallet = this.client.GenerateWallet();
    let balance = await wallet.GetAccountBalance({ signer: this.client.signer });
    let userId = ElvUtils.AddressToId({prefix:"iusr", address});

    return { address, userId, tenantContractId, tenantAdminsId, walletAddress, userWalletObject, userMetadata, balance };
  }

  async SetAccountTenantId({ tenantId }) {
    if (!this.client) {
      throw Error("ElvAccount not intialized");
    }

    await this.client.userProfileClient.SetTenantId({
      id: tenantId,
    });
  }

  async SetAccountTenantContractId({ tenantContractId }) {
    if (!this.client) {
      throw Error("ElvAccount not intialized");
    }

    console.log("tenantContractId", tenantContractId);
    const idType = await this.client.AccessType({ id: tenantContractId });
    if (idType === this.client.authClient.ACCESS_TYPES.GROUP) {
      throw Error("Bad tenant contract ID", tenantContractId);
    }

    // check if the user has tenant contract id set
    const userTenantContractId = await this.client.userProfileClient.TenantContractId();
    if (typeof userTenantContractId !== "undefined"){
      console.log("User wallet tenant ID", userTenantContractId);
      if (userTenantContractId !== "" && userTenantContractId !== tenantContractId) {
        console.log("User wallet has a different tenant ID", userTenantContractId);
      }
    }

    // set tenant contract id and tenant_admin group
    await this.client.userProfileClient.SetTenantContractId({tenantContractId});
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

  async ReplaceStuckTx({nonce}){
    const newNonce = nonce? nonce : await this.signer.getTransactionCount("latest"); // provides confirmed nonce
    console.log("nonce:", newNonce);

    // get the current gas price from the Ethereum network
    const gasPrice = await this.signer.getGasPrice();
    // increase gas price to prioritize the transaction
    const newGasPrice = gasPrice.mul(ethers.BigNumber.from("2"));

    let receipt = await this.signer.sendTransaction({
      to: await this.signer.getAddress(),
      value: ethers.utils.parseEther("0"),
      nonce: newNonce,
      gasPrice: newGasPrice,
      gasLimit: ethers.utils.hexlify(21000), // typical gas limit for ether transfer
    });
    console.log("Transaction sent:", receipt.hash);
    await receipt.wait();
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

  /**
   * Associate group with the tenant with tenantContractId.
   * @param {string} tenantContractId - The ID of the tenant contract (iten***)
   * @param {string} groupAddress - Address of the group we want to remove.
   */
  async SetGroupTenantConfig({ tenantContractId, groupAddress }) {
    const groupTenantContractId = await this.client.TenantContractId({
      contractAddress: groupAddress
    });
    if (groupTenantContractId){
      if (groupTenantContractId === tenantContractId){
        console.log(`Group ${groupAddress} has tenantContractId = ${tenantContractId}`);
      } else {
        throw Error(`Group ${groupAddress} has different tenantContractId = ${groupTenantContractId}, aborting...`);
      }
    } else {
      await this.client.SetTenantContractId({
        contractAddress: groupAddress,
        tenantContractId: tenantContractId
      });
    }
  }

  async CreateSignedToken({
    libraryId,
    objectId,
    versionHash,
    policyId,
    subject = null,
    grantType,
    duration = TOKEN_DURATION,
    allowDecryption,
    context
  }) {
    if (!subject) {
      subject = this.client.signer.address.toLowerCase();
    }
    return await this.client.CreateSignedToken({
      libraryId, objectId, versionHash, policyId,
      subject, grantType, duration, allowDecryption, context
    });
  }

  async CreateFabricToken({duration=TOKEN_DURATION}){
    return await this.client.CreateFabricToken({duration});
  }

  async CreateOfferSignature({nftAddress, mintHelperAddress, tokenId, offerId}){
    const nftAddressBytes = ethers.utils.arrayify(nftAddress);
    const mintAddressBytes = ethers.utils.arrayify(mintHelperAddress);
    const tokenIdBigInt = ethers.BigNumber.from(tokenId).toHexString();

    const packedData = ethers.utils.solidityPack(
      ["bytes", "bytes", "uint256", "uint8"],
      [nftAddressBytes, mintAddressBytes, tokenIdBigInt, offerId]
    );

    const encodedData = ethers.utils.keccak256(
      packedData
    );

    let messageHashBytes = ethers.utils.arrayify(encodedData);

    const signedData = await this.client.signer.signMessage(messageHashBytes);
    const signature = ethers.utils.splitSignature(signedData);
    return {encodedData, messageHashBytes, packedData, signedData, signature};
  }

}

ElvAccount.TOKEN_DURATION = TOKEN_DURATION;
exports.ElvAccount = ElvAccount;
