const { ElvUtils } = require("./Utils");
const { ElvAccount } = require("./ElvAccount");

const { ElvClient } = require("@eluvio/elv-client-js");
const Utils = require("@eluvio/elv-client-js/src/Utils.js");

const Ethers = require("ethers");
const fs = require("fs");
const path = require("path");

class ElvSpace {
  /**
   * Instantiate the ElvSpace Object
   *
   * @namedParams
   * @param {string} configUrl - The Content Fabric configuration URL
   * @param {string} mainObjectId - The top-level Eluvio Live object ID
   * @return {ElvSpace} - New ElvSpace object connected to the specified content fabric and blockchain
   */
  constructor({ configUrl, spaceAddress, kmsAddress, debugLogging = false }) {
    this.configUrl = configUrl;
    (this.spaceAddress = spaceAddress), (this.kmsAddress = kmsAddress);
    this.debug = debugLogging;
  }

  async Init({ spaceOwnerKey }) {
    this.client = await ElvClient.FromConfigurationUrl({
      configUrl: this.configUrl,
    });
    let wallet = this.client.GenerateWallet();
    let signer = wallet.AddAccount({
      privateKey: spaceOwnerKey,
    });
    this.client.SetSigner({ signer });
    this.client.ToggleLogging(this.debug);
  }

  InitWithClient({ elvClient }) {
    this.client = elvClient;
  }

  async TenantCreate({ tenantName, funds = 20 }) {
    let account = null;
    let elvAccount = null;
    try {
      //Create ElvAccount
      elvAccount = new ElvAccount({
        configUrl: this.configUrl,
      });

      await elvAccount.InitWithClient({
        elvClient: this.client,
      });

      const tenantSlug = tenantName.toLowerCase().replace(/ /g, "-");
      account = await elvAccount.Create({
        funds: funds,
        accountName: `${tenantSlug}-elv-admin`,
      });

      if (this.debug){
        console.log("create account - done");
      }

      await elvAccount.Init({ privateKey: account.privateKey });

      if (this.debug){
        console.log("create admin group");
      }

      let adminGroup = await elvAccount.CreateAccessGroup({
        name: `${tenantName} Tenant Admins`,
      });

      await elvAccount.AddToAccessGroup({
        groupAddress: adminGroup.address,
        accountAddress: account.address,
        isManager: true,
      });

      // Add KMS to tenant admins group
      await elvAccount.AddToAccessGroup({
        groupAddress: adminGroup.address,
        accountAddress: this.kmsAddress,
      });

      await elvAccount.SetAccountTenantAdminsAddress({
        tenantAdminsAddress: adminGroup.address,
      });

      account.tenantAdminsId = await elvAccount.client.userProfileClient.TenantId();

      if (this.debug){
        console.log("tenant admins:", adminGroup);
      }

      let tenant = await this.TenantDeploy({
        tenantName,
        ownerAddress: account.address,
        adminGroupAddress: adminGroup.address,
      });
      return {
        account,
        adminGroup,
        tenant,
      };
    } catch (e){
      throw {error:e, account};
    }
  }

  async TenantDeploy({ tenantName, ownerAddress, adminGroupAddress }) {
    let tenantContract = await ElvUtils.DeployContractFile({
      client: this.client,
      fileName: "BaseTenantSpace",
      args: [this.spaceAddress, tenantName, this.kmsAddress],
    });

    let res = {};

    let tenantFuncsContract = await ElvUtils.DeployContractFile({
      client: this.client,
      fileName: "TenantFuncsBase",
    });

    var tt4Bytes = ElvUtils.GetFunc4Bytes(
      "transferToken(bytes,uint256,address)"
    );

    var ag4Bytes = ElvUtils.GetFunc4Bytes("applyGroups(bytes,uint256,address)");

    var array4Bytes = [tt4Bytes, ag4Bytes];

    res = await this.client.CallContractMethodAndWait({
      contractAddress: tenantContract.address,
      abi: JSON.parse(tenantContract.abi),
      methodName: "addFuncs",
      methodArgs: [array4Bytes, tenantFuncsContract.address],
      formatArguments: false,
    });

    if (this.debug){
      console.log("Result addFuncs", res);
    }

    if (adminGroupAddress) {
      let contractAdminGroup = await this.client.CallContractMethod({
        contractAddress: tenantContract.address,
        abi: JSON.parse(tenantContract.abi),
        methodName: "GROUP_ID_ADMIN",
      });

      contractAdminGroup = Ethers.utils.parseBytes32String(contractAdminGroup);

      res = await this.client.CallContractMethodAndWait({
        contractAddress: tenantContract.address,
        abi: JSON.parse(tenantContract.abi),
        methodName: "addGroup",
        methodArgs: [contractAdminGroup, adminGroupAddress],
        formatArguments: true,
      });

      if (this.debug){
        console.log("Result set admin group", res);
      }
    }

    if (ownerAddress) {
      res = await this.client.CallContractMethodAndWait({
        contractAddress: tenantContract.address,
        abi: JSON.parse(tenantContract.abi),
        methodName: "transferOwnership",
        methodArgs: [ownerAddress],
        formatArguments: true,
      });

      if (this.debug){
        console.log("Result transferOwnership", res);
      }

      let owner = await this.client.CallContractMethod({
        contractAddress: tenantContract.address,
        abi: JSON.parse(tenantContract.abi),
        methodName: "owner",
      });

      let creator = await this.client.CallContractMethod({
        contractAddress: tenantContract.address,
        abi: JSON.parse(tenantContract.abi),
        methodName: "creator",
      });

      if (this.debug){
        console.log("New owner", owner, "creator", creator);
      }

    }

    return {
      name: tenantName,
      id: ElvUtils.AddressToId({prefix:"iten", address:tenantContract.address}),
      address: tenantContract.address,
      adminGroupAddress,
    };
  }

  /**
   * Get tenant-level information
   * @param {string} tenantId Tenant ID (iten)
   */
  async TenantInfo({ tenantId }) {

    const abi = fs.readFileSync(
      path.resolve(__dirname, "../contracts/v3/BaseTenantSpace.abi")
    );
    const abiSpace = fs.readFileSync(
      path.resolve(__dirname, "../contracts/v3/BaseTenantSpace.abi")
    );
    const abiLib = fs.readFileSync(
      path.resolve(__dirname, "../contracts/v3/BaseLibrary.abi")
    );

    const tenantAddr = Utils.HashToAddress(tenantId);

    // Space owner
    const spaceOwner = await this.client.CallContractMethod({
      contractAddress: this.spaceAddress,
      abi: JSON.parse(abiSpace),
      methodName: "creator",
      methodArgs: [],
      formatArguments: true,
    });

    let tenant = {
      id: tenantId,
      warns: [],
      groups: []
    };

    tenant.name = await this.client.CallContractMethod({
      contractAddress: tenantAddr,
      abi: JSON.parse(abi),
      methodName: "name",
      methodArgs: [],
      formatArguments: true,
    });

    tenant.description = await this.client.CallContractMethod({
      contractAddress: tenantAddr,
      abi: JSON.parse(abi),
      methodName: "description",
      methodArgs: [],
      formatArguments: true,
    });

    const kmsAddress = await this.client.CallContractMethod({
      contractAddress: tenantAddr,
      abi: JSON.parse(abi),
      methodName: "addressKMS",
      methodArgs: [],
      formatArguments: true,
    });
    tenant.kmsId = ElvUtils.AddressToId({prefix:"ikms", address: kmsAddress});

    tenant.owner = await this.client.CallContractMethod({
      contractAddress: tenantAddr,
      abi: JSON.parse(abi),
      methodName: "owner",
      methodArgs: [],
      formatArguments: true,
    });

    if (this.client.CurrentAccountAddress() != tenant.owner.toLowerCase()) {
      tenant.warns.push("Not run as tenant admin");
      return tenant;
    }

    tenant.creator = await this.client.CallContractMethod({
      contractAddress: tenantAddr,
      abi: JSON.parse(abi),
      methodName: "creator",
      methodArgs: [],
      formatArguments: true,
    });
    tenant.creatorId = ElvUtils.AddressToId({prefix:"ispc", address: tenant.creator});
    if (tenant.creator != spaceOwner) {
      tenant.warns.push(`Bad space ID creator id=${tenant.creatorId}`);
    }

    tenant.adminsGroup = await this.client.CallContractMethod({
      contractAddress: tenantAddr,
      abi: JSON.parse(abi),
      methodName: "groupsMapping",
      methodArgs: ["tenant_admin", 0],
      formatArguments: true,
    });

    // Tenant consumer group (should be deprecated)
    tenant.consumerGroup = await this.client.CallContractMethod({
      contractAddress: tenantAddr,
      abi: JSON.parse(abi),
      methodName: "groupsMapping",
      methodArgs: ["tenant_consumer", 0],
      formatArguments: true,
    });

    // Fabric object information
    tenant.fabric_object_visibility = await this.client.CallContractMethod({
      contractAddress: tenantAddr,
      abi: JSON.parse(abi),
      methodName: "visibility",
      methodArgs: [],
      formatArguments: true,
    });

    const m = await this.client.ContentObjectMetadata({
      libraryId: ElvUtils.AddressToId({prefix: "ilib", address: tenantAddr}),
      objectId: ElvUtils.AddressToId({prefix: "iq__", address: tenantAddr}),
      noAuth: true
    });

    if (m.public && m.public.eluvio_live_id) {
      tenant.eluvio_live_id = m.public.eluvio_live_id;
    } else {
      tenant.eluvio_live_id = "";
    }

    const groups = await this.client.ListAccessGroups();
    for (const g of groups) {
      tenant.groups.push({id: g.id, name: g.meta.public.name});
    }

    tenant.libs = await this.client.ContentLibraries();
    for (var i = 0; i < tenant.libs.length; i ++) {
      const libTenantAdminsIdHex = await this.client.CallContractMethod({
        contractAddress: Utils.HashToAddress(tenant.libs[i]),
        abi: JSON.parse(abiLib),
        methodName: "getMeta",
        methodArgs: ["_tenantId"],
        formatArguments: true,
      });
      const libTenantAdminsId = new Buffer.from(libTenantAdminsIdHex.substring(2), "hex").toString("utf8");
      const libTenantAdmins = Utils.HashToAddress(libTenantAdminsId);
      if (libTenantAdmins.toLowerCase() != tenant.adminsGroup.toLowerCase()) {
        tenant.warns.push(`Wrong tenant ID library ${tenant.libs[i]} ${libTenantAdmins}`);
      }
    }

    return tenant;
  }

  /**
   * Set the Eluvio Live tenant object ID in the tenant contract.
   * @param {string} tenantId Tenant ID (iten)
   * @param {string} eluvioLiveId Object ID of the tenant-leve Eluvio Live object
   */
  async TenantSetEluvioLiveId({ tenantId, eluvioLiveId }) {

    const tenantAddr = Utils.HashToAddress(tenantId);

    var e = await this.client.EditContentObject({
      libraryId: ElvUtils.AddressToId({prefix: "ilib", address: tenantAddr}),
      objectId: ElvUtils.AddressToId({prefix: "iq__", address: tenantAddr}),
    });

    await this.client.ReplaceMetadata({
      libraryId: ElvUtils.AddressToId({prefix: "ilib", address: tenantAddr}),
      objectId: ElvUtils.AddressToId({prefix: "iq__", address: tenantAddr}),
      writeToken: e.write_token,
      metadataSubtree: "public/eluvio_live_id",
      metadata: eluvioLiveId,
    });

    const res = await this.client.FinalizeContentObject({
      libraryId: ElvUtils.AddressToId({prefix: "ilib", address: tenantAddr}),
      objectId: ElvUtils.AddressToId({prefix: "iq__", address: tenantAddr}),
      writeToken: e.write_token,
      commitMessage: "Set Eluvio Live object ID " + eluvioLiveId,
    });

    return res;
  }

}

exports.ElvSpace = ElvSpace;
