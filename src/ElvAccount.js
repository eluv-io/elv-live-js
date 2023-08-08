const { ElvClient } = require("@eluvio/elv-client-js");
const ethers = require("ethers");
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
    await this.SetAccountTenantContractId({ id });
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
        accountName,
        address,
        mnemonic,
        privateKey,
        balance,
        tenantAdminsId,
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
    let tenantAdminsId = "";
    let userMetadata = "";
    try {
      tenantAdminsId = await this.client.userProfileClient.TenantId();
    } catch (e){ console.log("No tenantAdminsId set."); }

    try {
      userMetadata = await this.client.userProfileClient.UserMetadata();
    } catch (e){ console.log("No User Metadata."); }

    let walletAddress = await this.client.userProfileClient.WalletAddress() || "";
    let userWalletObject =
      await this.client.userProfileClient.UserWalletObjectInfo() || "";
    let wallet = this.client.GenerateWallet();
    let balance = await wallet.GetAccountBalance({ signer: this.client.signer });
    let userId = ElvUtils.AddressToId({prefix:"iusr", address});
    return { address, userId, tenantAdminsId, walletAddress, userWalletObject, userMetadata, balance };
  }

  async SetAccountTenantAdminsAddress({ tenantAdminsAddress }) {
    if (!this.client) {
      throw Error("ElvAccount not intialized");
    }

    await this.client.userProfileClient.SetTenantId({
      address: tenantAdminsAddress,
    });
  }

  async SetAccountTenantContractId({ id }) {
    if (!this.client) {
      throw Error("ElvAccount not intialized");
    }

    //Automatic fix: convert tenant admin group id to tenant contract id 
    const idType = await this.client.AccessType({ id });
    if (idType === this.client.authClient.ACCESS_TYPES.GROUP) {
      let groupAddress = this.client.utils.HashToAddress(id);

      let tenantContractIdHex = await this.client.CallContractMethod({
        contractAddress: groupAddress,
        methodName: "getMeta",
        methodArgs: ["_ELV_TENANT_ID"], 
      });

      if (tenantContractIdHex == "0x") {
        let args = group.split("_");
        throw (`${args[0]} ${args[1]} group can't be verified or is not associated with any tenant`);
      }
      id = ethers.utils.toUtf8String(tenantContractIdHex);
    }

    await this.client.userProfileClient.SetTenantContractId({
      tenantContractId: id,
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

  /**
   * Associate group with the tenant with tenantId.
   * @param {string} tenantId - The ID of the tenant (iten***)
   * @param {string} groupAddress - Address of the group we want to remove.
   */
  async SetGroupTenantConfig({ tenantId, groupAddress }) {
    let idHex;
    let contractHasMeta = true;
    try {
      idHex = await this.client.CallContractMethod({
        contractAddress: groupAddress,
        methodName: "getMeta",
        methodArgs: ["_ELV_TENANT_ID"], 
      });
    } catch (e) {
      console.log(`Log: The group contract with group address ${groupAddress} doesn't support metadata. Some operations with this group contract may fail.`);
      contractHasMeta = false;
    }

    // Set _ELV_TENANT_ID in the group contract's metadata if possible
    let res;
    if (contractHasMeta) {
      if (idHex != "0x") {
        let id = ethers.utils.toUtf8String(idHex);
        if (!Utils.EqualHash(tenantId, id)) {
          throw Error(`Group ${groupAddress} already has _ELV_TENANT_ID metadata set to ${id}, aborting...`);
        } else {
          console.log(`Group ${groupAddress} already has _ELV_TENANT_ID metadata set correctly to ${id}`);
        }
      } else {
        res = await this.client.CallContractMethod({
          contractAddress: groupAddress,
          methodName: "putMeta",
          methodArgs: [
            "_ELV_TENANT_ID",
            tenantId
          ],
        });
      }
      // Set the tenant field on the contract to tenantId so that it is consistent with the metadata
      try {
        await this.client.CallContractMethod({
          contractAddress: groupAddress,
          methodName: "setTenant",
          methodArgs: [this.client.utils.HashToAddress(tenantId)], 
        });
      } catch (e) {
        if (e.message.includes("Unknown method: setTenant")) {
          console.log(`Log: The group contract with address ${groupAddress} doesn't support setTenant method`);
        } else {
          throw e;
        }
      }
    }

    // If the contract doesn't have metadata, the group's fabric metadata is the main identification point and can't be replaced if set
    let groupObjectId = ElvUtils.AddressToId({prefix: "iq__", address: groupAddress});
    let groupLibraryId = await this.client.ContentObjectLibraryId({objectId: groupObjectId});

    let groupMeta = await this.client.ContentObjectMetadata({
      libraryId: groupLibraryId,
      objectId: groupObjectId,
      select:"elv/tenant_id",
    });
    if (groupMeta && !contractHasMeta) {
      let tenantContractId = groupMeta.elv.tenant_id;
      if (tenantContractId != tenantId) {
        throw Error(`Group ${groupAddress} already has _ELV_TENANT_ID metadata set to ${id}, aborting...`);
      }
    }

    // Set tenantId in the group's fabric metadata to support legacy group contracts
    let tenantContractId = await this.client.ContentObjectMetadata({
      libraryId: groupLibraryId,
      objectId: groupObjectId,
      select:"elv/tenant_id",
    });
    if (!tenantContractId) {
      //add tenant id to fabric meta
      var e = await this.client.EditContentObject({
        libraryId: groupLibraryId,
        objectId: groupObjectId, 
      });
      await this.client.ReplaceMetadata({
        libraryId: groupLibraryId,
        objectId: groupObjectId, 
        writeToken: e.write_token,
        metadataSubtree: "elv/tenant_id",
        metadata: tenantId,
      });
      await this.client.FinalizeContentObject({
        libraryId: groupLibraryId,
        objectId: groupObjectId, 
        writeToken: e.write_token,
        commitMessage: "Set Eluvio Live object ID " + tenantId,
      });
    }

    return res;
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
