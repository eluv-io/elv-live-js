const { ElvClient } = require("elv-client-js");
const ElvUtils = require("./ElvUtils");

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
    this.spaceAddress = spaceAddress,
    this.kmsAddress = kmsAddress;
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

  InitWithClient({elvClient}){
    this.client = elvClient;
  }

  async DeployTenant({ tenantName, ownerAddress, adminGroupAddress }) {
    console.log("DeployTenant");
    let tenantContract = await ElvUtils.DeployContract({filename: "BaseTenantSpace",
      args: [
        this.spaceAddress,
        tenantName,
        this.kmsAddress
      ]
    });

    let tenantFuncsContract = await ElvUtils.DeployContract({filename: "TenantFuncsBase"
    });

    await this.client.CallContractMethodAndWait({
      contractAddress: tenantContract.address,
      abi: JSON.parse(abi),
      methodName: "addFuncs",
      methodArgs: ["funcAddr", tenantFuncsContract.address],
      formatArguments: true,
    });

    if (ownerAddress){
      await this.client.CallContractMethodAndWait({
        contractAddress: tenantContract.address,
        abi: JSON.parse(abi),
        methodName: "transferOwnership",
        methodArgs: ["newOwner", ownerAddress],
        formatArguments: true,
      });
    }

    if (adminGroupId){
      let contractAdminGroup = await this.client.CallContractMethodAndWait({
        contractAddress: tenantContract.address,
        abi: JSON.parse(abi),
        methodName: "GROUPIDADMIN",
        formatArguments: true,
      });

      await this.client.CallContractMethodAndWait({
        contractAddress: tenantContract.address,
        abi: JSON.parse(abi),
        methodName: "addGroup",
        methodArgs: ["id", contractAdminGroup,
          "groupAddr", adminGroupAddress
        ],
        formatArguments: true,
      });
    }

    return {address:tenantContract.address};
  }

}

exports.ElvSpace = ElvSpace;