const { ElvUtils } = require("./Utils");
const { ElvAccount } = require("./ElvAccount");

const { ElvClient } = require("@eluvio/elv-client-js");
const Utils = require("@eluvio/elv-client-js/src/Utils.js");

const fs = require("fs");
const path = require("path");

class ElvTenant {
  /**
   * Instantiate the ElvTenant object
   *
   * @namedParams
   * @param {string} configUrl - The Content Fabric configuration URL
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
      privateKey: privateKey,
    });
    this.client.SetSigner({ signer });
    this.client.ToggleLogging(this.debug);
  }

  /**
   * Get tenant-level information
   * @param {string} tenantContractId Tenant contract ID (iten)
   */
  async TenantInfo({ tenantContractId }) {

    const abi = fs.readFileSync(
      path.resolve(__dirname, "../contracts/v3/BaseTenantSpace.abi")
    );
    const abiSpace = fs.readFileSync(
      path.resolve(__dirname, "../contracts/v3/BaseTenantSpace.abi")
    );

    const tenantContractAddr = Utils.HashToAddress(tenantContractId);

    // Space owner
    const spaceOwner = await this.client.CallContractMethod({
      contractAddress: this.client.contentSpaceAddress,
      abi: JSON.parse(abiSpace),
      methodName: "creator",
      methodArgs: [],
      formatArguments: true,
    });

    let tenant = {
      id: tenantContractId,
      warns: [],
      groups: []
    };

    tenant.name = await this.client.CallContractMethod({
      contractAddress: tenantContractAddr,
      abi: JSON.parse(abi),
      methodName: "name",
      methodArgs: [],
      formatArguments: true,
    });

    tenant.description = await this.client.CallContractMethod({
      contractAddress: tenantContractAddr,
      abi: JSON.parse(abi),
      methodName: "description",
      methodArgs: [],
      formatArguments: true,
    });

    const kmsAddress = await this.client.CallContractMethod({
      contractAddress: tenantContractAddr,
      abi: JSON.parse(abi),
      methodName: "addressKMS",
      methodArgs: [],
      formatArguments: true,
    });
    tenant.kmsId = ElvUtils.AddressToId({prefix:"ikms", address: kmsAddress});

    tenant.owner = await this.client.CallContractMethod({
      contractAddress: tenantContractAddr,
      abi: JSON.parse(abi),
      methodName: "owner",
      methodArgs: [],
      formatArguments: true,
    });

    if (this.client.CurrentAccountAddress() !== tenant.owner.toLowerCase()) {
      tenant.warns.push("Not run as tenant admin");
      return tenant;
    }

    tenant.creator = await this.client.CallContractMethod({
      contractAddress: tenantContractAddr,
      abi: JSON.parse(abi),
      methodName: "creator",
      methodArgs: [],
      formatArguments: true,
    });
    tenant.creatorId = ElvUtils.AddressToId({prefix:"ispc", address: tenant.creator});
    if (tenant.creator !== spaceOwner) {
      tenant.warns.push(`Bad space ID creator id=${tenant.creatorId}`);
    }

    tenant.adminsGroup = await this.client.CallContractMethod({
      contractAddress: tenantContractAddr,
      abi: JSON.parse(abi),
      methodName: "groupsMapping",
      methodArgs: ["tenant_admin", 0],
      formatArguments: true,
    });
    tenant.contentAdminsGroup = await this.client.CallContractMethod({
      contractAddress: tenantContractAddr,
      abi: JSON.parse(abi),
      methodName: "groupsMapping",
      methodArgs: ["content_admin", 0],
      formatArguments: true,
    });

    // Fabric object information
    tenant.fabric_object_visibility = await this.client.CallContractMethod({
      contractAddress: tenantContractAddr,
      abi: JSON.parse(abi),
      methodName: "visibility",
      methodArgs: [],
      formatArguments: true,
    });

    const m = await this.client.ContentObjectMetadata({
      libraryId: ElvUtils.AddressToId({prefix: "ilib", address: tenantContractAddr}),
      objectId: ElvUtils.AddressToId({prefix: "iq__", address: tenantContractAddr}),
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
      const libTenantContractId = this.client.TenantContractId({
        contractAddress: Utils.HashToAddress(tenant.libs[i])
      });

      if (libTenantContractId.toLowerCase() !== tenant.adminsGroup.toLowerCase()) {
        tenant.warns.push(`Wrong tenant ID library ${tenant.libs[i]} ${libTenantContractId}`);
      }
    }

    return tenant;
  }

  /**
   * Return tenant admins group and content admins group corresponding to this tenant.
   * @param {string} tenantContractId - The ID of the tenant contract (iten***)
   */
  async TenantShow({ tenantContractId, show_metadata = false }) {
    let contractType = await this.client.authClient.AccessType(tenantContractId);
    if (contractType !== this.client.authClient.ACCESS_TYPES.TENANT) {
      throw Error("the contract corresponding to this tenantContractId is not a tenant contract");
    }

    let tenantInfo = {};

    const tenantContractAddr = Utils.HashToAddress(tenantContractId);
    const abi = fs.readFileSync(
      path.resolve(__dirname, "../contracts/v3/BaseTenantSpace.abi")
    );

    let errors = [];

    let owner = await this.client.CallContractMethod({
      contractAddress: tenantContractAddr,
      abi: JSON.parse(abi),
      methodName: "owner",
      methodArgs: [],
    });

    let tenantAdminAddr;
    try {
      tenantAdminAddr = await this.client.CallContractMethod({
        contractAddress: tenantContractAddr,
        abi: JSON.parse(abi),
        methodName: "groupsMapping",
        methodArgs: ["tenant_admin", 0],
        formatArguments: true,
      });
    } catch (e) {
      tenantAdminAddr = null;
      errors.push("missing tenant admins");
    }
    tenantInfo["tenant_admin_address"] = tenantAdminAddr;

    //Content admins group might not exist for the tenant with this tenantContractId due to legacy reasons.
    //Running ./elv-admin tenant-fix to update this tenant.
    let contentAdminAddr;
    try {
      contentAdminAddr = await this.client.CallContractMethod({
        contractAddress: tenantContractAddr,
        abi: JSON.parse(abi),
        methodName: "groupsMapping",
        methodArgs: ["content_admin", 0],
        formatArguments: true,
      });
    } catch (e) {
      contentAdminAddr = null;
      errors.push("missing content admins");
    }
    tenantInfo["content_admin_address"] = contentAdminAddr;

    //Check if the groups have _ELV_TENANT_ID set correctly
    for (const group in tenantInfo) {
      let groupAddr = tenantInfo[group];
      let args = group.split("_");
      if (groupAddr) {
        let res = await this.TenantCheckGroupConfig({tenantContractId, groupAddr, tenantOwner: owner});
        if (!res.success) {
          errors.push(`${args[0]} ${args[1]} ${res.message}`);
        }
      }
    }

    tenantInfo["tenant_root_key"] = owner;

    if (show_metadata) {
      let services = [];
      let tenantObjectId = ElvUtils.AddressToId({prefix: "iq__", address: tenantContractAddr});
      let tenantLibraryId = await this.client.ContentObjectLibraryId({objectId: tenantObjectId});

      try {
        let liveId = await this.client.ContentObjectMetadata({
          libraryId: tenantLibraryId,
          objectId: tenantObjectId,
          noAuth: true,
          select:"public/eluvio_live_id",
        });
        if (liveId["public"]) {
          services.push(liveId["public"]);
        }

      } catch (e) {
        console.log(e);
        errors.push("Encountered an error when getting metadata for the eluvio_live_id service");
      }
      if (services.length != 0) {
        tenantInfo["services"] = services;
      }
    }

    if (errors.length != 0) {
      tenantInfo["errors"] = errors;
    }

    return tenantInfo;
  }

  /**
   * Create a new content admin group corresponding to this tenant.
   * @param {string} tenantContractId - The ID of the tenant (iten***)
   * @param {string} contentAdminAddr - Content Admin Group's address, new group will be created if not specified (optional)
   * @returns {string} Content Admin Group's address
   */
  async TenantSetContentAdmins({ tenantContractId, contentAdminAddr }) {
    //Check that the user is the owner of the tenant
    const tenantOwner = await this.client.authClient.Owner({id: tenantContractId});
    if (tenantOwner.toLowerCase() != this.client.signer.address.toLowerCase()) {
      throw Error("Content Admin must be set by the owner of tenant " + tenantContractId);
    }

    //The tenant must not already have a content admin group - can only have 1 content admin group for each tenant.
    const abi = fs.readFileSync(
      path.resolve(__dirname, "../contracts/v3/BaseTenantSpace.abi")
    );

    const tenantAddr = Utils.HashToAddress(tenantContractId);

    let contentAdmin;
    try {
      contentAdmin = await this.client.CallContractMethod({
        contractAddress: tenantAddr,
        abi: JSON.parse(abi),
        methodName: "groupsMapping",
        methodArgs: ["content_admin", 0],
        formatArguments: true,
      });
    } catch (e) {
      //call cannot override gasLimit error will be thrown if content admin group doesn't exist for this tenant.
      contentAdmin = null;
    }

    if (contentAdmin) {
      let logMsg = `Tenant ${tenantContractId} already has a content admin group: ${contentAdmin}, aborting...`;
      return logMsg;
    }

    let elvAccount = new ElvAccount({configUrl:this.configUrl, debugLogging: this.debug});
    elvAccount.InitWithClient({elvClient:this.client});

    //Arguments don't contain content admin group address, creating a new content admin group for the user's account.
    if (!contentAdminAddr) {
      let accountName = await this.client.userProfileClient.UserMetadata({
        metadataSubtree: "public/name"
      });

      let contentAdminGroup = await elvAccount.CreateAccessGroup({
        name: `${accountName} Content Admins`,
      });

      contentAdminAddr = contentAdminGroup.address;

      await elvAccount.AddToAccessGroup({
        groupAddress: contentAdminAddr,
        accountAddress: this.client.signer.address.toLowerCase(),
        isManager: true,
      });
    }

    //Associate the group with this tenant - set the content admin group's _ELV_TENANT_ID to this tenant's tenant id.
    await this.TenantSetGroupConfig({tenantContractId, groupAddress: contentAdminAddr});

    //Associate the tenant with this group - set tenant's content admin group on the tenant's contract.
    await this.client.CallContractMethodAndWait({
      contractAddress: tenantAddr,
      abi: JSON.parse(abi),
      methodName: "addGroup",
      methodArgs: ["content_admin", contentAdminAddr],
      formatArguments: true,
    });

    return contentAdminAddr;
  }

  /**
   * Remove a content admin from this tenant.
   * @param {string} tenantContractId - The ID of the tenant Id (iten***)
   * @param {string} contentAdminsAddress - Address of content admin we want to remove.
   */
  async TenantRemoveContentAdmin({ tenantContractId, contentAdminsAddress }) {
    const abi = fs.readFileSync(
      path.resolve(__dirname, "../contracts/v3/BaseTenantSpace.abi")
    );

    const tenantAddr = Utils.HashToAddress(tenantContractId);

    //Remove tenant from group
    await this.TenantRemoveGroupConfig({groupAddress: contentAdminsAddress});

    return await this.client.CallContractMethodAndWait({
      contractAddress: tenantAddr,
      abi: JSON.parse(abi),
      methodName: "removeGroup",
      methodArgs: ["content_admin", contentAdminsAddress],
      formatArguments: true,
    });
  }

  /**
   * Create a new tenant user group corresponding to this tenant.
   * @param {string} tenantContractId - The ID of the tenant (iten***)
   * @param {string} tenantUserGroupAddr - Tenant User Group's address, new group will be created if not specified (optional)
   * @returns {string} Tenant User Group's address
   */
  async TenantSetTenantUserGroup({ tenantContractId, tenantUserGroupAddr }) {

    let elvAccount = new ElvAccount({configUrl:this.configUrl, debugLogging: this.debug});
    elvAccount.InitWithClient({elvClient:this.client});

    //Check that the user is the owner of the tenant
    const tenantOwner = await this.client.authClient.Owner({id: tenantContractId});
    if (tenantOwner.toLowerCase() !== this.client.signer.address.toLowerCase()) {
      throw Error("Tenant User Group must be set by the owner of tenant " + tenantContractId);
    }

    //The tenant must not already have a tenant user group - can only have 1 tenant user group for each tenant.
    const abi = fs.readFileSync(
      path.resolve(__dirname, "../contracts/v3/BaseTenantSpace.abi")
    );

    const tenantContractAddr = Utils.HashToAddress(tenantContractId);
    let tenantUserGroup;
    try {
      tenantUserGroup = await this.client.CallContractMethod({
        contractAddress: tenantContractAddr,
        abi: JSON.parse(abi),
        methodName: "groupsMapping",
        methodArgs: ["tenant_user_group", 0],
        formatArguments: true,
      });
      if (tenantUserGroup) {
        return `Tenant ${tenantContractId} already has a tenant User Group: ${tenantUserGroup}, aborting...`;
      }
    } catch (e) {
      //call cannot override gasLimit error will be thrown if content admin group doesn't exist for this tenant.
      tenantUserGroup = null;
    }

    //Arguments don't contain tenant user group address, creating a new group for the user's account.
    if (!tenantUserGroupAddr) {
      let accountName = await this.client.userProfileClient.UserMetadata({
        metadataSubtree: "public/name"
      });

      tenantUserGroup = await elvAccount.CreateAccessGroup({
        name: `${accountName} Tenant User Group`,
      });

      tenantUserGroupAddr = tenantUserGroup.address;

      await elvAccount.AddToAccessGroup({
        groupAddress: tenantUserGroupAddr,
        accountAddress: this.client.signer.address.toLowerCase(),
        isManager: true,
      });
    }

    //Associate the group with this tenant - set the tenant_user_group
    await this.TenantSetGroupConfig({tenantContractId, groupAddress: tenantUserGroupAddr});

    //Associate the tenant with this group - set tenant user group on the tenant's contract.
    await this.client.CallContractMethodAndWait({
      contractAddress: tenantContractAddr,
      abi: JSON.parse(abi),
      methodName: "addGroup",
      methodArgs: ["tenant_user_group", tenantUserGroupAddr],
      formatArguments: true,
    });

    return tenantUserGroupAddr;
  }

  /**
   * Remove tenant user group from this tenant.
   * @param {string} tenantContractId - The ID of the tenant Id (iten***)
   * @param {string} tenantUserGroupAddr - Address of tenant user group we want to remove.
   */
  async TenantRemoveTenantUserGroup({ tenantContractId, tenantUserGroupAddr }) {

    //Check that the user is the owner of the tenant
    const tenantOwner = await this.client.authClient.Owner({id: tenantContractId});
    if (tenantOwner.toLowerCase() !== this.client.signer.address.toLowerCase()) {
      throw Error("Tenant User Group must be set by the owner of tenant " + tenantContractId);
    }

    const abi = fs.readFileSync(
      path.resolve(__dirname, "../contracts/v3/BaseTenantSpace.abi")
    );

    const tenantContractAddr = Utils.HashToAddress(tenantContractId);

    //Remove tenant from group
    await this.TenantRemoveGroupConfig({groupAddress: tenantUserGroupAddr});

    return await this.client.CallContractMethodAndWait({
      contractAddress: tenantContractAddr,
      abi: JSON.parse(abi),
      methodName: "removeGroup",
      methodArgs: ["tenant_user_group", tenantUserGroupAddr],
      formatArguments: true,
    });
  }

  /**
   * Associate group with the tenant contract Id.
   * @param {string} tenantContractId - The ID of the tenant contract (iten***)
   * @param {string} groupAddress - Address of the group we want to remove.
   */
  async TenantSetGroupConfig({ tenantContractId, groupAddress }) {

    let tid = await this.client.TenantContractId({
      contractAddress: groupAddress
    });
    if (tid !== ""){
      if (tid !== tenantContractId){
        throw Error(`Group ${groupAddress} has different tenant contract ID set to ${tid}, aborting...`);
      }
    }

    return await this.client.SetTenantContractId({
      contractAddress: groupAddress,
      tenantContractId
    });
  }

  /**
   * Remove tenant from group
   * @param {string} groupAddress - Address of the group we want to remove.
   */
  async TenantRemoveGroupConfig({ groupAddress }) {
    return await this.client.RemoveTenant({
      contractAddress: groupAddress,
    });
  }

  async TenantCheckGroupConfig ({ tenantContractId, groupAddr, tenantOwner }) {
    let groupOwner = await this.client.CallContractMethod({
      contractAddress: groupAddr,
      methodName: "owner",
      methodArgs: [],
    });
    if (groupOwner !== tenantOwner) {
      return {success: false, message: `The owner of the group (${groupOwner}) is not the same as the owner of the tenant (${tenantOwner}).`};
    }

    //Ensure groupAddr actually belongs to a group contract.
    if (await this.client.authClient.AccessType("igrp"+ Utils.AddressToHash(groupAddr)) !== this.client.authClient.ACCESS_TYPES.GROUP) {
      return {success: false, message: "on the tenant contract is not a group", need_format: true};
    }

    //Retrieve tenant contract id assoicated with this group
    try {
      let groupTenantContractId = await this.client.TenantContractId({
        contractAddress: groupAddr,
      });

      if (groupTenantContractId === "") {
        return {success: false, message: "group can't be verified or is not associated with any tenant", need_format: true};
      }

      if (tenantContractId !== groupTenantContractId) {
        return {success: false, message: "group doesn't belong to this tenant", need_format: true};
      }
      return {success: true};
    } catch (e) {
      return {success: false, message: e.message};
    }
  }

  /**
   * Set the Eluvio Live tenant object ID on the tenant contract.
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

exports.ElvTenant = ElvTenant;
