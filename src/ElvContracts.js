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
      contractAddress: Config.consts[Config.net].claimerAddress,
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
      contractAddress: Config.consts[Config.net].claimerAddress,
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
      contractAddress: Config.consts[Config.net].claimerAddress,
      abi: JSON.parse(abi),
      methodName: "burn",
      methodArgs: [ amount ],
      formatArguments: true,
    });

    return res;
  }

  /**
   * Call the method addAuthorizedAdr of the smart contract Claimer.sol
   * @param {string} address : the address to add to the list
   */
  async ClaimerAddAuthAdr({ address }){
    const abi = fs.readFileSync(
      path.resolve(__dirname, "../contracts/v4/Claimer.abi")
    );


    var res = await this.client.CallContractMethodAndWait({
      contractAddress: Config.consts[Config.net].claimerAddress,
      abi: JSON.parse(abi),
      methodName: "addAuthorizedAdr",
      methodArgs: [ address ],
      formatArguments: true,
    });

    return res;
  }

  /**
   * Call the method rmAuthorizedAdr of the smart contract Claimer.sol
   * @param {string} address : the address to remove from the list
   */
  async ClaimerRmAuthAdr({ address }){
    const abi = fs.readFileSync(
      path.resolve(__dirname, "../contracts/v4/Claimer.abi")
    );


    var res = await this.client.CallContractMethodAndWait({
      contractAddress: Config.consts[Config.net].claimerAddress,
      abi: JSON.parse(abi),
      methodName: "rmAuthorizedAdr",
      methodArgs: [ address ],
      formatArguments: true,
    });

    return res;
  }




  /**
  * Call the method clearAllocations of the smart contract Claimer.sol
  * @param {string} address : clear the allocations of this address
  * */
  async ClaimerClearAllocations({ address }){
    const abi = fs.readFileSync(
      path.resolve(__dirname, "../contracts/v4/Claimer.abi")
    );

    var res = await this.client.CallContractMethodAndWait({
      contractAddress: Config.consts[Config.net].claimerAddress,
      abi: JSON.parse(abi),
      methodName: "clearAllocations",
      methodArgs: [ address ],
      formatArguments: true,
    });

    return res;
  }

  /**
   * First clear the list and then create a list by pushing all the allocations into it
   * @param {string} address : list the allocations of this list
   */
  async ClaimerListAllocations({ address }){
    const abi = fs.readFileSync(
      path.resolve(__dirname, "../contracts/v4/Claimer.abi")
    );

    await this.ClaimerClearAllocations({address});

    var lengthList = await this.client.CallContractMethod({
      contractAddress: Config.consts[Config.net].claimerAddress,
      abi: JSON.parse(abi),
      methodName: "getNrAllocations",
      methodArgs: [ address ],
      formatArguments: true,
    });

    let listAllocations = [];
    for (let i ; i<lengthList; i++){
      var idx = i.toString();
      try {
        var elemAmount = await this.client.CallContractMethod({
          contractAddress: Config.consts[Config.net].claimerAddress,
          abi: JSON.parse(abi),
          methodName: "getAmount",
          methodArgs: [ address, idx ],
          formatArguments: true,
        });
        var elemExpirationDate = await this.client.CallContractMethod({
          contractAddress: Config.consts[Config.net].claimerAddress,
          abi: JSON.parse(abi),
          methodName: "getExpirationDate",
          methodArgs: [ address, idx ],
          formatArguments: true,
        });
        listAllocations.push("amount : " + elemAmount + " - expiration : " + elemExpirationDate);
      } catch (e){
        break;
      }
    }
    /**
     * questions :
     * -we return a string ?
     */
    return listAllocations.toString();
  }

}

exports.ElvContracts = ElvContracts;
