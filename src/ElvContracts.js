const { ElvClient } = require("@eluvio/elv-client-js");
const { Config } = require("./Config.js");
const fs = require("fs");
const path = require("path");

class ElvContracts {

  /**
    * Instantiate the ElvContract SDK 
    *
    * @namedParams
    * @param {string} configUrl - The Content Fabric configuration URL
    * @param {string} mainObjectId - The top-level Eluvio Live object ID
    */
  constructor({ configUrl, mainObjectId }) {
    this.configUrl = configUrl || ElvClient.main;
    this.mainObjectId = mainObjectId;

    this.debug = false;
  }

  async Init() {
    this.client = await ElvClient.FromConfigurationUrl({
      configUrl: this.configUrl,
    });
    let wallet = this.client.GenerateWallet();
    let signer = wallet.AddAccount({
      privateKey: process.env.PRIVATE_KEY,
    });
    this.client.SetSigner({ signer });
    this.client.ToggleLogging(false);
  }

  /**
     * Call the method allocate of the smart contract Claimer.sol
     * @param {string} address : address to allocate
     * @param {string} amount : amount to allocate
     * @param {string} expirationDate : the expiration date of the new allocation
     */
  async ClaimerAllocate({ address, amount, expirationDate }){
    const abi = fs.readFileSync(
      path.resolve(__dirname, "../contracts/v4/Claimer.abi")
    );

    var res = await this.client.CallContractMethodAndWait({
      contractAddress: Config.consts.main.claimerAddress,
      abi: JSON.parse(abi),
      methodName: "allocate",
      methodArgs: [address, amount, expirationDate],
      formatArguments: true,
    });
        
    return res;
  }

  /**
     * Call the method claim of the smart contract Claimer.sol
     * @param {string} amount : amount to claim
     */
  async ClaimerClaim({ amount }){
    const abi = fs.readFileSync(
      path.resolve(__dirname, "../contracts/v4/Claimer.abi")
    );

        
    var res = await this.client.CallContractMethodAndWait({
      contractAddress: Config.consts.main.claimerAddress,
      abi: JSON.parse(abi),
      methodName: "claim",
      methodArgs: [ amount ],
      formatArguments: true,
    });
        
    return res;
  }

  /**
     * Call the method burn of the smart contract Claimer.sol
     * @param {string} amount : amount to burn
     */
  async ClaimerBurn({ amount }){
    const abi = fs.readFileSync(
      path.resolve(__dirname, "../contracts/v4/Claimer.abi")
    );
        

    var res = await this.client.CallContractMethodAndWait({
      contractAddress: Config.consts.main.claimerAddress,
      abi: JSON.parse(abi),
      methodName: "burn",
      methodArgs: [ amount ],
      formatArguments: true,
    });
        
    return res;
  }

  /**
     * Call the method clearAllocations of the smart contract Claimer.sol
     * @param {string} address : clear the allocations of this address
     */
  async ClaimerClearAllocations({ address }){
    const abi = fs.readFileSync(
      path.resolve(__dirname, "../contracts/v4/Claimer.abi")
    );
        

    var res = await this.client.CallContractMethodAndWait({
      contractAddress: Config.consts.main.claimerAddress,
      abi: JSON.parse(abi),
      methodName: "clearAllocations",
      methodArgs: [ address ],
      formatArguments: true,
    });
        
    return res;
  }

  //question for list allocations



}

exports.ElvContracts = ElvContracts;