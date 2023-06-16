const { ElvUtils } = require("./Utils");
const { ElvAccount } = require("./ElvAccount");

const { ElvClient } = require("@eluvio/elv-client-js");

const Ethers = require("ethers");

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
        console.log("create admin groups");
      }

      let admins = SetTenantAndContentAdminGroups(tenantName, account, elvAccount);
      let tenantAdminGroup = admins.tenantAdminGroup;
      let contentAdminGroup = admins.contentAdminGroup;

      if (this.debug){
        console.log("tenant admins:", tenantAdminGroup);
        console.log("content admins:", contentAdminGroup);
      }

      let tenant = await this.TenantDeploy({
        tenantName,
        ownerAddress: account.address,
        adminGroupAddress: tenantAdminGroup.address,
        contentGroupAddress: contentAdminGroup.address,
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

  async TenantDeploy({ tenantName, ownerAddress, tenantAdminGroupAddress, contentAdminGroupAddress }) {
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

    res = await this.client.CallContractMethodAndWait({
      contractAddress: tenantContract.address,
      abi: JSON.parse(tenantContract.abi),
      methodName: "addGroup",
      methodArgs: ["content_admin", contentAdminGroupAddress],
      formatArguments: true,
    });

    if (this.debug){
      console.log("Result set content admin group", res);
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
      tenantAdminGroupAddress,
      contentAdminGroupAddress
    };
  }

  //Helper function for TenantCreate
  async SetTenantAndContentAdminGroups(tenantName, account, elvAccount) {
    //Create Tenant Admin Access Group
    let tenantAdminGroup = await elvAccount.CreateAccessGroup({
      name: `${tenantName} Tenant Admins`,
    });

    await elvAccount.AddToAccessGroup({
      groupAddress: tenantAdminGroup.address,
      accountAddress: account.address,
      isManager: true,
    });
    await elvAccount.AddToAccessGroup({
      groupAddress: tenantAdminGroup.address,
      accountAddress: this.kmsAddress, // Add KMS to tenant admins group
    });

    await elvAccount.SetAccountTenantAdminsAddress({
      tenantAdminsAddress: tenantAdminGroup.address,
    });
    account.tenantAdminsId = await elvAccount.client.userProfileClient.TenantId();

    //Create Content Admin Access Group
    let contentAdminGroup = await elvAccount.CreateAccessGroup({
      name: `${tenantName} Content Admins`,
    });

    await elvAccount.AddToAccessGroup({
      groupAddress: contentAdminGroup.address,
      accountAddress: account.address,
      isManager: true,
    });
    await elvAccount.AddToAccessGroup({
      groupAddress: contentAdminGroup.address,
      accountAddress: this.kmsAddress, // Add KMS to tenant admins group
    });

    return {
      tenantAdminGroup, contentAdminGroup
    };
  }
}

exports.ElvSpace = ElvSpace;
