const { ElvUtils } = require("./Utils");
const { ElvAccount } = require("./ElvAccount");
const constants = require("./Constants");

const { ElvClient } = require("@eluvio/elv-client-js");

const Ethers = require("ethers");
const CBOR = require("cbor-x");
const { ElvTenant } = require("./ElvTenant");

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

  async TenantCreate({ tenantName, funds = 51 }) {
    let account = null;
    let elvAccount = null;
    try {
      // Create ElvAccount
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
        console.log("create admin groups");
      }

      // Create Tenant Admin Access Group
      let tenantAdminGroup = await elvAccount.CreateAccessGroup({
        name: `${tenantName} Tenant Admins`,
      });

      await elvAccount.AddToAccessGroup({
        groupAddress: tenantAdminGroup.address,
        accountAddress: account.address,
        isManager: true,
      });

      // Create Content Admin Access Group
      let contentAdminGroup = await elvAccount.CreateAccessGroup({
        name: `${tenantName} Content Admins`,
      });

      await elvAccount.AddToAccessGroup({
        groupAddress: contentAdminGroup.address,
        accountAddress: account.address,
        isManager: true,
      });

      // Create Tenant Users Access Group
      let tenantUsersGroup = await elvAccount.CreateAccessGroup({
        name: `${tenantName} Tenant Users`,
      });

      await elvAccount.AddToAccessGroup({
        groupAddress: tenantUsersGroup.address,
        accountAddress: account.address,
        isManager: true,
      });

      if (this.debug){
        console.log("tenant admins:", tenantAdminGroup);
        console.log("content admins:", contentAdminGroup);
        console.log("tenant users:", tenantUsersGroup);
      }
      let adminGroups = {
        tenantAdminGroup,
        contentAdminGroup,
        tenantUsersGroup
      };

      let tenant = await this.TenantDeploy({
        tenantName,
        ownerAddress: account.address,
        tenantAdminGroupAddress: tenantAdminGroup.address,
        contentAdminGroupAddress: contentAdminGroup.address,
        tenantUsersGroupAddress: tenantUsersGroup.address,
      });

      // Assign the created tenant to account
      await elvAccount.SetAccountTenantContractId({tenantId: tenant.id});
      account.tenantAdminsId = await elvAccount.client.userProfileClient.TenantId();
      account.tenantContractId = await elvAccount.client.userProfileClient.TenantContractId();

      // Add _ELV_TENANT_ID to groups' metadata so we can identify the tenant these groups belong to
      await elvAccount.SetGroupTenantConfig({
        tenantId: tenant.id,
        groupAddress: tenantAdminGroup.address
      });

      await elvAccount.SetGroupTenantConfig({
        tenantId: tenant.id,
        groupAddress: contentAdminGroup.address
      });

      await elvAccount.SetGroupTenantConfig({
        tenantId: tenant.id,
        groupAddress: tenantUsersGroup.address
      });

      return {
        account,
        adminGroups,
        tenant,
      };
    } catch (e){
      throw {error:e, account};
    }
  }

  async TenantDeploy({ tenantName, ownerAddress, tenantAdminGroupAddress, contentAdminGroupAddress, tenantUsersGroupAddress }) {
    let tenantContract;
    try {
      tenantContract = await ElvUtils.DeployContractFile({
        client: this.client,
        fileName: "BaseTenantSpace",
        args: [this.spaceAddress, tenantName, this.kmsAddress],
      });
    } catch (e) {
      console.log("[Error]: TenantDeploy can only be called by the space owner.");
      throw (e);
    }

    // Create ElvTenant
    const elvTenant = new ElvTenant({
      configUrl: this.configUrl,
    });
    await elvTenant.Init({
      privateKey: process.env.PRIVATE_KEY,
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

    if (tenantAdminGroupAddress) {
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
        methodArgs: [contractAdminGroup, tenantAdminGroupAddress],
        formatArguments: true,
      });

      if (this.debug){
        console.log("Result set tenant admin group", res);
      }
    }

    if (contentAdminGroupAddress) {
      res = await this.client.CallContractMethodAndWait({
        contractAddress: tenantContract.address,
        abi: JSON.parse(tenantContract.abi),
        methodName: "addGroup",
        methodArgs: ["content_admin", contentAdminGroupAddress],
        formatArguments: true,
      });

      if (this.debug) {
        console.log("Result set content admin group", res);
      }
    }

    if (tenantUsersGroupAddress) {
      res = await this.client.CallContractMethodAndWait({
        contractAddress: tenantContract.address,
        abi: JSON.parse(tenantContract.abi),
        methodName: "addGroup",
        methodArgs: ["tenant_users", tenantUsersGroupAddress],
        formatArguments: true,
      });

      if (this.debug) {
        console.log("Result set tenant users group", res);
      }
    }

    let tenantContractId = ElvUtils.AddressToId({prefix:"iten", address:tenantContract.address});
    // set tenant status to active
    await elvTenant.TenantSetStatus({
      tenantContractId,
      tenantStatus: constants.TENANT_STATE_ACTIVE,
    });
    const tenantStatus = await elvTenant.TenantStatus({tenantContractId});

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
      tenantStatus,
      tenantAdminGroupAddress,
      contentAdminGroupAddress,
      tenantUsersGroupAddress,
    };
  }

  /**
   * Return a list of nodes in the content space, optionally filtered by node ID or endpoint.
   *
   * @param {string} matchEndpoint Only return nodes that have endpoints matching this string
   * @param {string} matchNodeId Only return the node matching this nodeId
   */
  async SpaceNodes({matchEndpoint, matchNodeId}) {

    // List all nodes in the space
    let bign = await this.client.CallContractMethod({
      contractAddress: this.spaceAddress,
      methodName: "numActiveNodes",
    });
    let n = bign.toNumber();

    let nodes = [];

    for (let i = 0; i < n; i ++) {

      let bigi = Ethers.BigNumber.from(i);
      let addr = await this.client.CallContractMethod({
        contractAddress: this.spaceAddress,
        methodName: "activeNodeAddresses",
        methodArgs: [bigi],
        formatArguments: true
      });

      let locatorsHex = await this.client.CallContractMethod({
        contractAddress: this.spaceAddress,
        methodName: "activeNodeLocators",
        methodArgs: [bigi]
      });

      let nodeId = this.client.utils.AddressToNodeId(addr);

      if (matchNodeId != undefined && nodeId != matchNodeId) {
        continue; // Not a match
      }

      let node = {id: nodeId, endpoints: []};

      // Parse locators CBOR
      let buffer = locatorsHex.slice(2, locatorsHex.length); // Skip "0x"
      let hex = buffer.toString("hex");
      let locators = CBOR.decodeAllSync(hex);

      let match = false;
      if (locators.length >= 5) {
        let fabArray = locators[4].fab;
        if (fabArray != undefined) {
          for (let i = 0; i < fabArray.length; i ++) {
            let host = fabArray[i].host;
            if (matchEndpoint != undefined && !host.includes(matchEndpoint)) {
              continue; // Not a match
            }
            match = true;
            let endpoint = fabArray[i].scheme + "://" + host;
            if (fabArray[i].port != "") {
              endpoint = endpoint + ":" + fabArray[i].port;
            }
            endpoint = endpoint + "/" + fabArray[i].path;
            node.endpoints.push(endpoint);
          }
        }
      }
      if (match) {
        nodes.push(node);
      }
    }

    return nodes;
  }

}

exports.ElvSpace = ElvSpace;
