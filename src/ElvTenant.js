const { ElvUtils } = require("./Utils");

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

exports.ElvTenant = ElvTenant;
