const { ElvUtils } = require("./Utils");
const { ElvAccount } = require("./ElvAccount");

const { ElvClient } = require("@eluvio/elv-client-js");
const Utils = require("@eluvio/elv-client-js/src/Utils.js");

const Ethers = require("ethers");
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
      contractAddress: this.client.contentSpaceAddress,
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
   * Return tenant admins group and content admins group corresponding to this tenant.
   * @param {string} tenantId - The ID of the tenant (iten***)
   */
  async TenantShow({ tenantId, show_metadata = false }) {
    let contractType = await this.client.authClient.AccessType(tenantId);
    if (contractType != this.client.authClient.ACCESS_TYPES.TENANT) {
      throw Error("the contract corresponding to this tenantId is not a tenant contract");
    }

    let tenantInfo = {};

    const tenantAddr = Utils.HashToAddress(tenantId); 
    const abi = fs.readFileSync(
      path.resolve(__dirname, "../contracts/v3/BaseTenantSpace.abi")
    );

    let errors = [];

    let owner = await this.client.CallContractMethod({
      contractAddress: tenantAddr,
      abi: JSON.parse(abi),
      methodName: "owner",
      methodArgs: [],
    });

    let tenantAdminAddr;
    try {
      tenantAdminAddr = await this.client.CallContractMethod({
        contractAddress: tenantAddr,
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
    
    //Content admins group might not exist for the tenant with this tenantId due to legacy reasons.
    //Running ./elv-admin tenant-fix to update this tenant.
    let contentAdminAddr;
    try {
      contentAdminAddr = await this.client.CallContractMethod({
        contractAddress: tenantAddr,
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
        let res = await this.TenantCheckGroupConfig({tenantId, groupAddr, tenantOwner: owner});
        if (!res.success) {
          errors.push(`${args[0]} ${args[1]} ${res.message}`);
        }
      }
    }

    tenantInfo["tenant_root_key"] = owner;

    if (show_metadata) {
      let services = [];
      let tenantObjectId = ElvUtils.AddressToId({prefix: "iq__", address: tenantAddr});
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
   * @param {string} tenantId - The ID of the tenant (iten***)
   * @param {string} contentAdminAddr - Content Admin Group's address, new group will be created if not specified (optional)
   * @returns {string} Content Admin Group's address
   */
  async TenantSetContentAdmins({ tenantId, contentAdminAddr }) {
    //Check that the user is the owner of the tenant
    const tenantOwner = await this.client.authClient.Owner({id: tenantId});
    if (tenantOwner.toLowerCase() != this.client.signer.address.toLowerCase()) {
      throw Error("Content Admin must be set by the owner of tenant " + tenantId);
    }

    //The tenant must not already have a content admin group - can only have 1 content admin group for each tenant.
    const abi = fs.readFileSync(
      path.resolve(__dirname, "../contracts/v3/BaseTenantSpace.abi")
    );

    const tenantAddr = Utils.HashToAddress(tenantId);

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
      let logMsg = `Tenant ${tenantId} already has a content admin group: ${contentAdmin}, aborting...`;
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
    await this.TenantSetGroupConfig({tenantId: tenantId, groupAddress: contentAdminAddr});

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
   * @param {string} tenantId - The ID of the tenant (iten***)
   * @param {string} contentAdminsAddress - Address of content admin we want to remove.
   */
  async TenantRemoveContentAdmin({ tenantId, contentAdminsAddress }) {
    const abi = fs.readFileSync(
      path.resolve(__dirname, "../contracts/v3/BaseTenantSpace.abi")
    );

    const tenantAddr = Utils.HashToAddress(tenantId);

    let res = await this.client.CallContractMethodAndWait({
      contractAddress: tenantAddr,
      abi: JSON.parse(abi),
      methodName: "removeGroup",
      methodArgs: ["content_admin", contentAdminsAddress],
      formatArguments: true,
    });

    return res;
  }

  /**
   * Associate group with the tenant with tenantId.
   * @param {string} tenantId - The ID of the tenant (iten***)
   * @param {string} groupAddress - Address of the group we want to remove.
   */
  async TenantSetGroupConfig({ tenantId, groupAddress }) {
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
        let id = Ethers.utils.toUtf8String(idHex);
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
        throw Error(`Group ${groupAddress} already has elv/tenant_id content fabric metadata set to ${tenantContractId}, aborting...`);
      }
    }

    // Add tenant id to fabric meta
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
      commitMessage: "Set tenant ID " + tenantId,
    });

    return res;
  }

  async TenantCheckGroupConfig ({ tenantId, groupAddr, tenantOwner }) {
    let groupOwner = await this.client.CallContractMethod({
      contractAddress: groupAddr,
      methodName: "owner",
      methodArgs: [], 
    });
    if (groupOwner != tenantOwner) {
      return {success: false, message: `The owner of the group (${groupOwner}) is not the same as the owner of the tenant (${tenantOwner}).`};
    }

    //Ensure groupAddr actually belongs to a group contract.
    if (await this.client.authClient.AccessType("igrp"+ Utils.AddressToHash(groupAddr)) != this.client.authClient.ACCESS_TYPES.GROUP) {
      return {success: false, message: "on the tenant contract is not a group", need_format: true};
    }

    let verified = false;
    //Retreive tenant contract id assoicated with this group from the contract's metadata
    try {
      let tenantContractIdHex = await this.client.CallContractMethod({
        contractAddress: groupAddr,
        methodName: "getMeta",
        methodArgs: ["_ELV_TENANT_ID"], 
      });
      if (tenantContractIdHex == "0x") {
        return {success: false, message: "group can't be verified or is not associated with any tenant", need_format: true};
      }
      let tenantContractId = Ethers.utils.toUtf8String(tenantContractIdHex);

      if (tenantId != tenantContractId) {
        return {success: false, message: "group doesn't belong to this tenant", need_format: true};
      }
      verified = true;
    } catch (e) {
      if (e.message.includes("Unknown method: getMeta")) {
        console.log(`Log: The group contract with group address ${groupAddr} doesn't support metadata.`);
      } else {
        throw e;
      }
    }

    //Retreive tenant contract id associated with this group from the contract's tenant field
    try {
      let tenantContractAddress = await this.client.CallContractMethod({
        contractAddress: groupAddr,
        methodName: "tenant",
        methodArgs: [], 
      });
      let tenantContractId = "iten" + this.client.utils.AddressToHash(tenantContractAddress);
      if (tenantId != tenantContractId) {
        return {success: false, message: "group can't be verified or is not associated with any tenant", need_format: true};
      }
      verified = true;
    } catch (e) {
      if (e.message.includes("Unknown method: tenant")) {
        console.log(`Log: the group contract with group address ${groupAddr} doesn't contain tenant information on contract.`);
      } else {
        throw e;
      }
    }

    //Retrieve tenant contract id associated with this group from its content fabric metadata
    try {
      let groupObjectId = ElvUtils.AddressToId({prefix: "iq__", address: groupAddr});
      let groupLibraryId = await this.client.ContentObjectLibraryId({objectId: groupObjectId});

      let groupMeta = await this.client.ContentObjectMetadata({
        libraryId: groupLibraryId,
        objectId: groupObjectId,
        select:"elv/tenant_id",
      });
      if (!groupMeta) {
        return {success: false, message: "group can't be verified or is not associated with any tenant", need_format: true};
      }

      let tenantContractId = groupMeta.elv.tenant_id;
      if (tenantContractId != tenantId) {
        return {success: false, message: "group can't be verified or is not associated with any tenant", need_format: true};
      }
      verified = true;
    } catch (e) {
      if (e.message.includes("Forbidden")) {
        console.log("Log: can't verify the group's content fabric metadata - must be a tenant admin user to do so.");
      }
    }

    if (verified) {
      return {success: true};
    } else {
      throw Error(`Unable to verify group ${groupAddr} - must be logged in with an account in the tenant admins group.`);
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
