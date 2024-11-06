const { ElvUtils } = require("./Utils");
const { ElvAccount } = require("./ElvAccount");
const constants = require("./Constants");

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

    tenant.tenantGroups = await this.TenantGroup({tenantContractId});

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
      const libTenantContractId = await this.client.TenantContractId({
        contractAddress: Utils.HashToAddress(tenant.libs[i])
      });

      if (libTenantContractId.toLowerCase() !== tenant.adminsGroup.toLowerCase()) {
        tenant.warns.push(`Wrong tenant ID library ${tenant.libs[i]} ${libTenantContractId}`);
      }
    }

    return tenant;
  }

  /**
   * Show tenant information like root key, tenant_admin, cotent_admin, tenant_user_group and metadata.
   *
   * @param {string} tenantContractId - The ID of the tenant contract (iten***)
   * @param {boolean} show_metadata - show metadata of tenant
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

    const groupList = await this.TenantGroup({tenantContractId});
    for (let group in groupList) {
      let groupName = group.replace(/_/g, " ");
      if (!groupList[group]){
        errors.push(`missing ${groupName}`);
      } else {
        // check _ELV_TENANT_ID set on these groups
        let res = await this.TenantCheckGroupConfig({
          tenantContractId,
          groupAddr: groupList[group],
          tenantOwner: owner});
        if (!res.success) {
          errors.push(`${groupName} ${res.message}`);
        }
      }
    }
    tenantInfo["groups"] = groupList;
    tenantInfo["tenant_root_key"] = owner;

    tenantInfo["tenant_status"] = await this.TenantStatus({tenantContractId});

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
      if (services.length !== 0) {
        tenantInfo["services"] = services;
      }
    }

    if (errors.length !== 0) {
      tenantInfo["errors"] = errors;
    }

    return tenantInfo;
  }

  /**
   * Retrieve tenant groups
   *
   * @param {string} tenantContractId - The ID of the tenant (iten***)
   * @param {string} groupType - tenant_admin | content_admin | tenant_user_group
   * @returns {Promise<*[]>} - list of groups
   */
  async TenantGroup({ tenantContractId, groupType }) {

    const abi = fs.readFileSync(
      path.resolve(__dirname, "../contracts/v3/BaseTenantSpace.abi")
    );

    const tenantAddr = Utils.HashToAddress(tenantContractId);
    if (groupType){
      if (groupType !== constants.TENANT_ADMIN &&
        groupType !== constants.CONTENT_ADMIN &&
        groupType !== constants.TENANT_USER_GROUP){
        throw Error(`Invalid groupType, require tenant_admin | content_admin | tenant_user_group: ${groupType}`);
      }
    }

    const groupTypes = [constants.TENANT_ADMIN, constants.CONTENT_ADMIN, constants.TENANT_USER_GROUP];

    let groupList = {};
    let groupAddress;
    for (let i = 0; i < groupTypes.length; i++) {
      if (typeof groupType === "undefined" || groupType === groupTypes[i]){
        try {
          groupAddress = await this.client.CallContractMethod({
            contractAddress: tenantAddr,
            abi: JSON.parse(abi),
            methodName: "groupsMapping",
            methodArgs: [groupTypes[i], 0],
            formatArguments: true,
          });
        } catch (e) {
          //call cannot override gasLimit error will be thrown if content admin group doesn't exist for this tenant.
          groupAddress = null;
        }
        groupList[groupTypes[i]]=groupAddress;
      }
    }
    return groupList;
  }

  /**
   * Set new tenant admin | content admin | user group corresponding to this tenant.
   *
   * @param {string} tenantContractId - The ID of the tenant (iten***)
   * @param {string} groupType - tenant_admin | content_admin | tenant_user_group
   * @param {string} groupAddress - Group's address, new group will be created if not specified (optional)
   * @returns {Promise<string|*>} Group's address
   */
  async TenantSetGroup({ tenantContractId, groupType, groupAddress }) {
    //Check that the user is the owner of the tenant
    const tenantOwner = await this.client.authClient.Owner({id: tenantContractId});
    if (tenantOwner.toLowerCase() !== this.client.signer.address.toLowerCase()) {
      throw Error("tenant group must be set by the owner of tenant " + tenantContractId);
    }

    const abi = fs.readFileSync(
      path.resolve(__dirname, "../contracts/v3/BaseTenantSpace.abi")
    );

    const tenantAddr = Utils.HashToAddress(tenantContractId);

    if (groupType !== constants.TENANT_ADMIN &&
      groupType !== constants.CONTENT_ADMIN &&
      groupType !== constants.TENANT_USER_GROUP){
      throw Error(`Invalid groupType, require tenant_admin | content_admin | tenant_user_group: ${groupType}`);
    }

    let tenantGroupAddr;
    try {
      tenantGroupAddr = await this.client.CallContractMethod({
        contractAddress: tenantAddr,
        abi: JSON.parse(abi),
        methodName: "groupsMapping",
        methodArgs: [groupType, 0],
        formatArguments: true,
      });
    } catch (e) {
      //call cannot override gasLimit error will be thrown if content admin group doesn't exist for this tenant.
      tenantGroupAddr = null;
    }

    if (tenantGroupAddr) {
      let logMsg = `Tenant ${tenantContractId} already has a group: ${tenantGroupAddr} for ${groupType} aborting...`;
      return logMsg;
    }

    let elvAccount = new ElvAccount({configUrl:this.configUrl, debugLogging: this.debug});
    elvAccount.InitWithClient({elvClient:this.client});

    // create new group if not provided
    if (!groupAddress) {
      let accountName = await this.client.userProfileClient.UserMetadata({
        metadataSubtree: "public/name"
      });

      let newGroup = await elvAccount.CreateAccessGroup({
        name: `${accountName} ${groupType.replace(/_/g, " ").toUpperCase()}`,
      });

      groupAddress = newGroup.address;

      await elvAccount.AddToAccessGroup({
        groupAddress,
        accountAddress: this.client.signer.address.toLowerCase(),
        isManager: true,
      });
    }

    //Associate the group with this tenant -- needs group owner to run
    //await this.TenantSetGroupConfig({tenantContractId, groupAddress});

    //Associate the tenant with this group - set tenant's group on the tenant's contract.
    await this.client.CallContractMethodAndWait({
      contractAddress: tenantAddr,
      abi: JSON.parse(abi),
      methodName: "addGroup",
      methodArgs: [groupType, groupAddress],
      formatArguments: true,
    });

    return groupAddress;
  }

  /**
   * Remove a tenant_amdin | content_admin | tenant_user_group from this tenant.
   * @param {string} tenantContractId - The ID of the tenant Id (iten***)
   * @param {string} groupType - tenant_admin | content_admin | tenant_user_group
   * @param {string} groupAddress - Address of group we want to remove.
   */
  async TenantRemoveGroup({ tenantContractId, groupType, groupAddress }) {

    if (groupType !== constants.TENANT_ADMIN &&
      groupType !== constants.CONTENT_ADMIN &&
      groupType !== constants.TENANT_USER_GROUP){
      throw Error(`Invalid groupType, require tenant_admin or content_admin or tenant_user_group: ${groupType}`);
    }

    //Check that the user is the owner of the tenant
    const tenantOwner = await this.client.authClient.Owner({id: tenantContractId});
    if (tenantOwner.toLowerCase() !== this.client.signer.address.toLowerCase()) {
      throw Error("tenant group must be removed by the owner of tenant " + tenantContractId);
    }

    const abi = fs.readFileSync(
      path.resolve(__dirname, "../contracts/v3/BaseTenantSpace.abi")
    );

    const tenantAddr = Utils.HashToAddress(tenantContractId);

    //Remove tenant from group
    await this.TenantRemoveGroupConfig({groupAddress});

    return await this.client.CallContractMethodAndWait({
      contractAddress: tenantAddr,
      abi: JSON.parse(abi),
      methodName: "removeGroup",
      methodArgs: [groupType, groupAddress],
      formatArguments: true,
    });
  }

  /**
   * Add tenant status
   *
   * @param {string} tenantContractId - The ID of the tenant Id (iten***)
   * @param {string} tenantStatus - tenant status: acive | inactive | frozen
   * @returns {Promise<{tenantStatus: string, tenantContractId: string}>}
   */
  async TenantSetStatus({tenantContractId, tenantStatus}) {
    if (tenantStatus !== constants.TENANT_STATE_ACTIVE &&
      tenantStatus !== constants.TENANT_STATE_INACTIVE &&
      tenantStatus !== constants.TENANT_STATE_FROZEN){
      throw Error(`Invalid tenant status, require active | inactive | frozen: ${tenantStatus}`);
    }

    //Check that the user is the owner of the tenant
    const tenantOwner = await this.client.authClient.Owner({id: tenantContractId});
    if (tenantOwner.toLowerCase() !== this.client.signer.address.toLowerCase()) {
      throw Error("tenant group must be set by the owner of tenant " + tenantContractId);
    }

    const tenantAddr = Utils.HashToAddress(tenantContractId);
    await this.client.ReplaceContractMetadata({
      contractAddress: tenantAddr,
      metadataKey: constants.TENANT_STATE,
      metadata: tenantStatus,
    });

    tenantStatus = await this.TenantStatus({tenantContractId});
    return {tenantContractId, tenantStatus};
  }

  /**
   * Retrieve tenant status
   *
   * @param {string} tenantContractId - The ID of the tenant Id (iten***)
   * @returns {Promise<string>}
   */
  async TenantStatus({tenantContractId}) {
    const tenantAddr = Utils.HashToAddress(tenantContractId);
    let tenantStatus;
    try {
      tenantStatus = await this.client.ContractMetadata({
        contractAddress: tenantAddr,
        metadataKey: constants.TENANT_STATE
      });
    } catch (e) {
      tenantStatus = "";
    }
    return tenantStatus;
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
        return {success: false, message: "can't be verified or is not associated with any tenant", need_format: true};
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
