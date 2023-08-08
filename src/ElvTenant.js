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

    let owner = await this.client.CallContractMethod({
      contractAddress: tenantAddr,
      abi: JSON.parse(abi),
      methodName: "owner",
      methodArgs: [],
    });

    let errors = [];

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
        let res = await this.TenantCheckGroupMeta({tenantId, groupAddr, tenantOwner: owner});
        if (!res.success) {
          errors.push(`${args[0]} ${args[1]} ${res.message}`);
        }
      }
    }

    tenantInfo["owner_address"] = owner;

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
    await this.TenantSetGroupMeta({tenantId: tenantId, groupAddress: contentAdminAddr});

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

    // Delete tenantId in the group's fabric metadata
    let groupObjectId = ElvUtils.AddressToId({prefix: "iq__", address: contentAdminsAddress});
    let groupLibraryId = await this.client.ContentObjectLibraryId({objectId: groupObjectId});

    var e = await this.client.EditContentObject({
      libraryId: groupLibraryId,
      objectId: groupObjectId, 
    });
    await this.client.DeleteMetadata({
      libraryId: groupLibraryId,
      objectId: groupObjectId, 
      writeToken: e.write_token,
      metadataSubtree: "elv/tenant_id",
    });
    await this.client.FinalizeContentObject({
      libraryId: groupLibraryId,
      objectId: groupObjectId, 
      writeToken: e.write_token,
    });

    return res;
  }

  /**
   * Set _ELV_TENANT_ID on group and tenant_id on content fabric metadata.
   * @param {string} tenantId - The ID of the tenant (iten***)
   * @param {string} groupAddress - Address of the group we want to remove.
   */
  async TenantSetGroupMeta({ tenantId, groupAddress }) {
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
          return;
        }
      }

      res = await this.client.CallContractMethod({
        contractAddress: groupAddress,
        methodName: "putMeta",
        methodArgs: [
          "_ELV_TENANT_ID",
          tenantId
        ],
      });
    }

    // Call setTenant method to set the tenant field on the group contract
    try {
      idHex = await this.client.CallContractMethod({
        contractAddress: groupAddress,
        methodName: "setTenant",
        methodArgs: ["_ELV_TENANT_ID"], 
      });
    } catch (e) {
      console.log(`Log: The group contract with address ${groupAddress} doesn't support setTenant method`);
    }

    // Set tenantId in the group's fabric metadata to support legacy group contracts
    let groupObjectId = ElvUtils.AddressToId({prefix: "iq__", address: groupAddress});
    let groupLibraryId = await this.client.ContentObjectLibraryId({objectId: groupObjectId});

    try {
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
    } catch (e) {
      console.log("Unable to access group's fabric metadata - make sure to use the private key of the group's owner");
    }
    return res;
  }

  async TenantCheckGroupMeta ({ tenantId, groupAddr, tenantOwner }) {
    let groupOwner = await this.client.CallContractMethod({
      contractAddress: groupAddr,
      methodName: "owner",
      methodArgs: [], 
    });
    if (groupOwner != tenantOwner) {
      return {success: false, message: `The owner of the group (${groupOwner}) is not the same as the owner of the tenant (${tenantOwner}).`};
    }

    let tenantContractId;
    try {
      let tenantContractIdHex = await this.client.CallContractMethod({
        contractAddress: groupAddr,
        methodName: "getMeta",
        methodArgs: ["_ELV_TENANT_ID"], 
      });
      if (tenantContractIdHex == "0x") {
        return {success: false, message: "group is not associated with any tenant", need_format: true};
      }
      tenantContractId = Ethers.utils.toUtf8String(tenantContractIdHex);
    } catch (e) {
      if (await this.client.authClient.AccessType("igrp"+ Utils.AddressToHash(groupAddr)) != this.client.authClient.ACCESS_TYPES.GROUP) {
        return {success: false, message: "on the tenant contract is not a group", need_format: true};
      } else if (e.message.includes("Unknown method: getMeta")) {
        console.log(`Log: The group contract with group address ${groupAddr} doesn't support metadata. Some operations with this group contract may fail.`);

        let groupObjectId = ElvUtils.AddressToId({prefix: "iq__", address: groupAddr});
        let groupLibraryId = await this.client.ContentObjectLibraryId({objectId: groupObjectId});

        try {
          let groupMeta = await this.client.ContentObjectMetadata({
            libraryId: groupLibraryId,
            objectId: groupObjectId,
            select:"elv/tenant_id",
          });
          if (!groupMeta) {
            return {success: false, message: "group is not associated with any tenant", need_format: true};
          }
          tenantContractId = groupMeta.elv.tenant_id;
        } catch (e) {
          console.log("Check unsuccessful - unable to check the tenant contract associated with this admins group.");
          return {success: true};
        }
      } else {
        throw e;
      };
    }
      
    if (tenantContractId != tenantId) {
      return {success: false, message: "group doesn't belong to this tenant", need_format: true};
    }

    return {success: true};
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
