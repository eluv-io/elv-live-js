const { ElvClient } = require("@eluvio/elv-client-js");
const ethers = require("ethers");
const fs = require("fs");
const path = require("path");
const Utils = require("@eluvio/elv-client-js/src/Utils.js");
const { ElvUtils } = require("./Utils");

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

  async InitWithId({ privateKey, id }) {
    await this.Init({privateKey});
    await this.SetAccountTenantContractId({ tenantId: id });
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
   * @param {string} tenantId - The tenant ID (iten) (Optional)
   * @return {Promise<Object>} - An object containing the new account mnemonic, privateKey, address, accountName, balance
   */
  async Create({ funds = 0.25, accountName, tenantId }) {
    if (!this.client) {
      throw Error("ElvAccount not intialized");
    }

    // We don't require the key is part of a tenant (for example when creating a tenant root key)
    if (tenantId) {
      // Validate tenant ID (make sure it is not the tenant admins ID)
      const idType = await this.client.AccessType({ id: tenantId });
      if (idType !== this.client.authClient.ACCESS_TYPES.TENANT) {
        throw Error("Bad tenant ID");
      }

      // Find tenant admins address
      let tenantAddr = this.client.utils.HashToAddress(tenantId);
      try {
        await this.client.CallContractMethod({
          contractAddress: tenantAddr,
          methodName: "groupsMapping",
          methodArgs: ["tenant_admin", 0],
          formatArguments: true,
        });
      } catch (e) {
        throw Error("Bad tenant - missing tenant admins group");
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

    if (this.debug) {
      console.log("privateKey: ", privateKey);
      console.log("address: ", address);
    }

    try {
      client.SetSigner({ signer });

      let res = await this.client.SendFunds({
        recipient: address,
        ether: funds,
      });

      if (this.debug) {
        console.log("Send Funds result: ", res);
      }

      await client.userProfileClient.CreateWallet();

      if (tenantId) {
        await client.userProfileClient.SetTenantContractId({tenantContractId: tenantId});
      }

      if (accountName) {
        await client.userProfileClient.ReplaceUserMetadata({
          metadataSubtree: "public/name",
          metadata: accountName,
        });
      }

      let balance = await wallet.GetAccountBalance({ signer });

      return {
        accountName,
        address,
        mnemonic,
        privateKey,
        balance,
        tenantId,
      };
    } catch (e) {
      // Return funds in case of error
      if (funds > 0.01) {
        await client.SendFunds({
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
    let tenantId = "";
    let tenantAdminsId = "";
    let userMetadata = "";
    try {
      tenantAdminsId = await this.client.userProfileClient.TenantId();
    } catch (e){ console.log("No tenantAdminsId set."); }

    try {
      tenantId = await this.client.userProfileClient.TenantContractId();
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

    const abi = fs.readFileSync(
      path.resolve(__dirname, "../contracts/v3/BaseAccessWallet.abi")
    );

    let userTenantIdHex = await this.client.CallContractMethod({
      contractAddress: walletAddress,
      abi: JSON.parse(abi),
      methodName: "getMeta",
      methodArgs: ["_ELV_TENANT_ID"],
    });
    const userTenantId = ethers.utils.toUtf8String(userTenantIdHex);

    if (tenantId !== userTenantId) {
      console.log("Bad user - inconsistent tenant ID", tenantId, userTenantId);
    }
    return { address, userId, tenantId, tenantAdminsId, walletAddress, userWalletObject, userMetadata, balance };
  }

  async SetAccountTenantAdminsAddress({ tenantAdminsAddress }) {
    if (!this.client) {
      throw Error("ElvAccount not intialized");
    }

    await this.client.userProfileClient.SetTenantId({
      address: tenantAdminsAddress,
    });
  }

  async SetAccountTenantContractId({ tenantId }) {
    if (!this.client) {
      throw Error("ElvAccount not intialized");
    }

    await this.client.userProfileClient.SetTenantContractId({
      tenantContractId: tenantId,
    });

    let tenantContractId = await this.client.userProfileClient.TenantContractId();

    if (tenantContractId !== tenantId) {
      throw new Error(`User wallet has a different tenant ID: ${tenantContractId}`);
    }
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

  async SetTenantContractId({contractAddress, objectId, versionHash, tenantContractId}){
    if (!this.client) {
      throw Error("ElvAccount not intialized");
    }

    await this.client.SetTenantContractId({contractAddress, objectId, versionHash, tenantContractId});
    return await this.client.TenantContractId({contractAddress, objectId, versionHash});
  }

  async GetTenantInfo({contractAddress, objectId, versionHash}){
    if (!this.client) {
      throw Error("ElvAccount not intialized");
    }

    const tenantContractId = await this.client.TenantContractId({contractAddress, objectId, versionHash});
    const tenantId = await this.client.TenantId({contractAddress, objectId, versionHash});

    return {
      tenant_contract_id: tenantContractId,
      tenant_id: tenantId,
    };
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

  async RemoveFromAccessGroup({ groupAddress, accountAddress, isManager = false }) {
    let res = {};
    if (isManager) {
      res = await this.client.RemoveAccessGroupManager({
        contractAddress: groupAddress,
        memberAddress: accountAddress,
      });
    } else {
      res = await this.client.RemoveAccessGroupMember({
        contractAddress: groupAddress,
        memberAddress: accountAddress,
      });
    }
    return { res };
  }
  
  /**
   * Associate group with the tenant with tenant contract Id.
   * @param {string} tenantId - The ID of the tenant (iten***)
   * @param {string} groupAddress - Address of the group we want to remove.
   */
  async SetGroupTenantConfig({ tenantId, groupAddress }) {

    // check if the group has tenant contract id set
    let idHex =  await this.client.TenantContractId({
      contractAddress: groupAddress,
    });
    if (idHex) {
      let id = ethers.utils.toUtf8String(idHex);
      if (!Utils.EqualHash(tenantId, id)) {
        throw Error(`Group ${groupAddress} already has _ELV_TENANT_ID metadata set to ${id}, aborting...`);
      } else {
        console.log(`Group ${groupAddress} already has _ELV_TENANT_ID metadata set correctly to ${id}`);
        return;
      }
    }

    return await this.client.SetTenantContractId({
      contractAddress: groupAddress,
      tenantContractId: tenantId
    });
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

  async GetBalance(){
    if (!this.client) {
      throw Error("ElvAccount not intialized");
    }
    let wallet = this.client.GenerateWallet();
    let res = await wallet.GetAccountBalance({signer: this.client.signer});
    return res;
  }

}

ElvAccount.TOKEN_DURATION = TOKEN_DURATION;
exports.ElvAccount = ElvAccount;
