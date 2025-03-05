const { ElvClient } = require("@eluvio/elv-client-js");
const Utils = require("@eluvio/elv-client-js/src/Utils.js");
const { Config } = require("./Config.js");
const fs = require("fs");
const path = require("path");
const Ethers = require("ethers");

class ElvContracts {

  /**
    * Instantiate the ElvContract SDK
    *
    * @namedParams
    * @param {string} configUrl - The Content Fabric configuration URL
    * @param {string} mainObjectId - The top-level Eluvio Live object ID
    * @param
    */
  constructor({ configUrl, mainObjectId, debugLogging = false }) {
    this.configUrl = configUrl || ElvClient.main;
    this.mainObjectId = mainObjectId;

    this.debug = debugLogging;
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

    var epochTime = new Date(String(expirationDate).replaceAll("_", "/")).getTime() / 1000;

    var res = await this.client.CallContractMethodAndWait({
      contractAddress: Config.consts[Config.net].claimerAddress,
      abi: JSON.parse(abi),
      methodName: "allocate",
      methodArgs: [address, amount, epochTime],
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
  async ClaimerAddAuthAddr({ address }){
    const abi = fs.readFileSync(
      path.resolve(__dirname, "../contracts/v4/Claimer.abi")
    );

    var res = await this.client.CallContractMethodAndWait({
      contractAddress: Config.consts[Config.net].claimerAddress,
      abi: JSON.parse(abi),
      methodName: "addAuthorizedAddr",
      methodArgs: [ address ],
      formatArguments: true,
    });

    return res;
  }

  /**
   * Call the method rmAuthorizedAdr of the smart contract Claimer.sol
   * @param {string} address : the address to remove from the list
   */
  async ClaimerRmAuthAddr({ address }){
    const abi = fs.readFileSync(
      path.resolve(__dirname, "../contracts/v4/Claimer.abi")
    );

    var res = await this.client.CallContractMethodAndWait({
      contractAddress: Config.consts[Config.net].claimerAddress,
      abi: JSON.parse(abi),
      methodName: "rmAuthorizedAddr",
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
      methodName: "getNumAllocations",
      methodArgs: [ address ],
      formatArguments: true,
    });
    lengthList = Ethers.BigNumber.from(lengthList._hex).toNumber();

    let listAllocations = [];
    for (let i = 0 ; i<lengthList; i++){
      var idx = i.toString();
      try {
        var elemAmount = await this.client.CallContractMethod({
          contractAddress: Config.consts[Config.net].claimerAddress,
          abi: JSON.parse(abi),
          methodName: "getAllocationAmount",
          methodArgs: [ address, idx ],
          formatArguments: true,
        });

        var elemExpirationDate = await this.client.CallContractMethod({
          contractAddress: Config.consts[Config.net].claimerAddress,
          abi: JSON.parse(abi),
          methodName: "getAllocationExpirationDate",
          methodArgs: [ address, idx ],
          formatArguments: true,
        });
        elemExpirationDate = new Date(Ethers.BigNumber.from(elemExpirationDate).toNumber() * 1000).toString();
        listAllocations.push({amount: Ethers.BigNumber.from(elemAmount._hex).toNumber(), expiration: elemExpirationDate});
      } catch (e){
        break;
      }
    }

    return listAllocations;
  }

  /**
     * Call the method getClaim of the smart contract Claimer.sol
     * @param {string} address : get the balance of this address
     */
  async ClaimerBalanceOf({ address }){
    const abi = fs.readFileSync(
      path.resolve(__dirname, "../contracts/v4/Claimer.abi")
    );

    var res = await this.client.CallContractMethod({
      contractAddress: Config.consts[Config.net].claimerAddress,
      abi: JSON.parse(abi),
      methodName: "balanceOf",
      methodArgs: [ address ],
      formatArguments: true,
    });

    return {balance: Ethers.BigNumber.from(res._hex).toNumber()};
  }

  /**
     * Call the method getBurn of the smart contract Claimer.sol
     * @param {string} address : get the burn balance of this address
     */
  async ClaimerBurnOf({ address }){
    const abi = fs.readFileSync(
      path.resolve(__dirname, "../contracts/v4/Claimer.abi")
    );

    var res = await this.client.CallContractMethod({
      contractAddress: Config.consts[Config.net].claimerAddress,
      abi: JSON.parse(abi),
      methodName: "burnOf",
      methodArgs: [ address ],
      formatArguments: true,
    });

    return {total: Ethers.BigNumber.from(res._hex).toNumber()};
  }

  /**
   * Deploy Payment contract (revenue splitter - commerce/Payment.sol)
   * @param {string} addresses : list of stakeholder addresses
   * @param {string} shares: list of stakeholder shares, in the order of addresses
   */
  async PaymentDeploy({ addresses, shares }){
    const abistr = fs.readFileSync(
      path.resolve(__dirname, "../contracts/v4/Payment.abi")
    );
    const bytecode = fs.readFileSync(
      path.resolve(__dirname, "../contracts/v4/Payment.bin")
    );

    if (addresses.length != shares.length) {
      throw Error("Bad arguments - address and share lists have different lenghts");
    }
    for (let i = 0; i < shares.length; i ++) {
      if (!Number.isInteger(parseFloat(shares[i]))) {
        throw Error("Bad arguments - shares must be integers");
      }
      if (!Utils.ValidAddress(addresses[i])) {
        throw Error("Bad arguments - invalid address");
      }
    }

    var c = await this.client.DeployContract({
      abi: JSON.parse(abistr),
      bytecode: bytecode.toString("utf8").replace("\n", ""),
      constructorArgs: [
        addresses,
        shares,
      ],
    });

    var res = await this.client.CallContractMethod({
      contractAddress: c.contractAddress,
      abi: JSON.parse(abistr),
      methodName: "totalShares",
      methodArgs: [],
      formatArguments: true,
    });

    return {
      contract_address: c.contractAddress,
      shares: Ethers.BigNumber.from(res._hex).toNumber()
    };
  }

  /**
   * Show status of payment contract stakeholders
   * @param {string} addr: address of the payment contract
   * @param {string} tokenContractAddress: address of the token contract (ERC20)
   */
  async PaymentShow({ contractAddress, tokenContractAddress }){
    const abistr = fs.readFileSync(
      path.resolve(__dirname, "../contracts/v4/Payment.abi")
    );
    const abistrToken = fs.readFileSync(
      path.resolve(__dirname, "../contracts/v4/IERC20Metadata.abi")
    );

    const decimals = await this.client.CallContractMethod({
      contractAddress: tokenContractAddress,
      abi: JSON.parse(abistrToken),
      methodName: "decimals",
      methodArgs: [],
      formatArguments: true,
    });

    const totalShares = await this.client.CallContractMethod({
      contractAddress: contractAddress,
      abi: JSON.parse(abistr),
      methodName: "totalShares",
      methodArgs: [],
      formatArguments: true,
    });

    const totalReleased = await this.client.CallContractMethod({
      contractAddress: contractAddress,
      abi: JSON.parse(abistr),
      methodName: "totalReleased(address)",
      methodArgs: [tokenContractAddress],
      formatArguments: false,
    });

    var total = Ethers.BigNumber.from(0);
    var payees = {};

    // Number of stakeholders is not available - try up to 10
    const maxPayees = 10;
    for (var i = 0; i < maxPayees; i++) {
      try {
        const payeeAddr = await this.client.CallContractMethod({
          contractAddress: contractAddress,
          abi: JSON.parse(abistr),
          methodName: "payee",
          methodArgs: [Ethers.BigNumber.from(i)],
          formatArguments: false,
        });
        payees[payeeAddr] = {};

        const shares = await this.client.CallContractMethod({
          contractAddress: contractAddress,
          abi: JSON.parse(abistr),
          methodName: "shares",
          methodArgs: [payeeAddr],
          formatArguments: true,
        });
        payees[payeeAddr].shares = Ethers.BigNumber.from(shares._hex).toNumber();

        const released = await this.client.CallContractMethod({
          contractAddress: contractAddress,
          abi: JSON.parse(abistr),
          methodName: "released(address,address)",
          methodArgs: [tokenContractAddress, payeeAddr],
          formatArguments: false,
        });
        payees[payeeAddr].released = Ethers.utils.formatUnits(released, decimals);

        const releasable = await this.client.CallContractMethod({
          contractAddress: contractAddress,
          abi: JSON.parse(abistr),
          methodName: "releasable(address,address)",
          methodArgs: [tokenContractAddress, payeeAddr],
          formatArguments: false,
        });
        payees[payeeAddr].releasable = Ethers.utils.formatUnits(releasable, decimals);

        let payeeTotal = Ethers.BigNumber.from(released);
        payeeTotal = payeeTotal.add(Ethers.BigNumber.from(releasable));
        payees[payeeAddr].total = Ethers.utils.formatUnits(payeeTotal, decimals);
        total = total.add(payeeTotal);
      } catch (e) {

        // Stop here when we reach the end of the payee list
        // These codes are empiric based on two different ethers versions
        if (e.code == 3 || e.code == "CALL_EXCEPTION") {
          break;
        } else {
          console.log(e);
        }
      }
    }

    return {
      contract_address: contractAddress,
      shares: Ethers.BigNumber.from(totalShares._hex).toNumber(),
      released: Ethers.utils.formatUnits(totalReleased, decimals),
      total: Ethers.utils.formatUnits(total, decimals),
      payees
    };

  }

  /**
   * Retrieve funds from payment splitter contract, as a payee or for payee address provided
   * @param {string} addr: address of the payment contract
   * @param {string} tokenContractAddress: address of the token contract (ERC20)
   * @param {string} payeeAddress: address of the payee
   */
  async PaymentRelease({ addr, tokenContractAddress, payeeAddress }){
    const abistr = fs.readFileSync(
      path.resolve(__dirname, "../contracts/v4/Payment.abi")
    );

    let payee;
    if (payeeAddress != "") {
      payee = payeeAddress;
    } else {
      payee = await this.client.signer.address;
    }

    const res = await this.client.CallContractMethod({
      contractAddress: addr,
      abi: JSON.parse(abistr),
      methodName: "release(address,address)",
      methodArgs: [
        tokenContractAddress,
        payee
      ],
      formatArguments: false,
    });

    return res;
  }

  async SetObjectGroupPermission({ objectId, groupAddress, permission }){
    return await this.client.AddContentObjectGroupPermission({
      objectId,
      groupAddress,
      permission,
    });
  }

  /**
   * cleanUp objects to remove references to dead objects
   * @param {string} objectAddr: address of the object
   * @param {string} objectType: object type (library | content_object | group | content_type)
   */
  async CleanupObjects({objectAddr, objectType}) {
    const abiStr = fs.readFileSync(
      path.resolve(__dirname, "../contracts/v3/AccessIndexor.abi")
    );
    const abi = JSON.parse(abiStr);

    if (!objectAddr) {
      throw Error("objectAddr not provided");
    }

    try {
      await this.client.CallContractMethod({
        contractAddress: objectAddr,
        abi,
        methodName: "getLibrariesLength",
        formatArguments: false,
      });
    } catch (e) {
      try {
        objectAddr = await this.client.userProfileClient.UserWalletAddress({ address: objectAddr });
      } catch (walletError) {
        throw new Error(`Invalid object: ${walletError}`);
      }
    }

    const allowedTypes = ["library", "content_object", "group", "content_type"];
    if (!allowedTypes.includes(objectType)) {
      throw Error(`Invalid objectType '${objectType}'. Allowed types: ${allowedTypes.join(", ")}`);
    }

    let res = {
      beforeCleanup: {},
      afterCleanup: {}
    };

    try {
      switch (objectType) {
        case "library": {
          let libLen = await this.client.CallContractMethod({
            contractAddress: objectAddr,
            abi: abi,
            methodName: "getLibrariesLength",
            formatArguments: false,
          });
          res.beforeCleanup.librariesLength = libLen.toNumber();

          await this.client.CallContractMethodAndWait({
            contractAddress: objectAddr,
            abi: abi,
            methodName: "cleanUpLibraries",
            formatArguments: true,
          });

          libLen = await this.client.CallContractMethod({
            contractAddress: objectAddr,
            abi: abi,
            methodName: "getLibrariesLength",
            formatArguments: false,
          });
          res.afterCleanup.librariesLength = libLen.toNumber();
          break;
        }
        case "content_object": {
          let contentObjLen = await this.client.CallContractMethod({
            contractAddress: objectAddr,
            abi: abi,
            methodName: "getContentObjectsLength",
            formatArguments: false,
          });
          res.beforeCleanup.contentObjectsLength = contentObjLen.toNumber();

          await this.client.CallContractMethodAndWait({
            contractAddress: objectAddr,
            abi: abi,
            methodName: "cleanUpContentObjects",
            formatArguments: true,
          });

          contentObjLen = await this.client.CallContractMethod({
            contractAddress: objectAddr,
            abi: abi,
            methodName: "getContentObjectsLength",
            formatArguments: false,
          });
          res.afterCleanup.contentObjectsLength = contentObjLen.toNumber();
          break;
        }
        case "group": {
          let groupsLen = await this.client.CallContractMethod({
            contractAddress: objectAddr,
            abi: abi,
            methodName: "getAccessGroupsLength",
            formatArguments: false,
          });
          res.beforeCleanup.accessGroupsLength = groupsLen.toNumber();

          await this.client.CallContractMethodAndWait({
            contractAddress: objectAddr,
            abi: abi,
            methodName: "cleanUpAccessGroups",
            formatArguments: true,
          });

          groupsLen = await this.client.CallContractMethod({
            contractAddress: objectAddr,
            abi: abi,
            methodName: "getAccessGroupsLength",
            formatArguments: false,
          });
          res.afterCleanup.accessGroupsLength = groupsLen.toNumber();
          break;
        }
        case "content_type": {
          let contentTypeLen = await this.client.CallContractMethod({
            contractAddress: objectAddr,
            abi: abi,
            methodName: "getContentTypesLength",
            formatArguments: false,
          });
          res.beforeCleanup.contentTypesLength = contentTypeLen.toNumber();

          await this.client.CallContractMethodAndWait({
            contractAddress: objectAddr,
            abi: abi,
            methodName: "cleanUpContentTypes",
            formatArguments: true,
          });

          contentTypeLen = await this.client.CallContractMethod({
            contractAddress: objectAddr,
            abi: abi,
            methodName: "getContentTypesLength",
            formatArguments: false,
          });
          res.afterCleanup.contentTypesLength = contentTypeLen.toNumber();
          break;
        }
        default:
          throw Error(`Unsupported objectType: ${objectType}`);
      }
    } catch (error) {
      throw Error(`Error during cleanup: ${error.message}`);
    }

    return res;
  }

  /**
   * delete library and to remove references to dead objects for the signer and groups
   * @param {string} libraryAddr: address of the library
   */
  async DeleteLibrary({libraryAddr}){

    const abiStr = fs.readFileSync(
      path.resolve(__dirname, "../contracts/v3/BaseLibrary.abi")
    );
    const abi = JSON.parse(abiStr);

    if (!libraryAddr){
      throw Error("libraryAddr is not provided");
    }
    const libraryId = Utils.AddressToLibraryId(libraryAddr);
    if (this.debug) {
      console.log("library_id:", libraryId);
    }

    // check the signer is the owner of the library
    let owner = await this.client.CallContractMethod({
      contractAddress: libraryAddr,
      abi: abi,
      methodName: "owner",
      methodArgs: [],
    });
    if (this.client.signer.address !== owner) {
      throw Error(`signer is not the owner of the library: ${libraryAddr}`);
    }

    // list of content objects
    const contentObjectsRes = await this.client.ContentObjects({
      libraryId: libraryId,
      filterOptions: {
        limit: 100000
      }
    });
    const objectIds = contentObjectsRes.contents.map(x => x.id);

    // the library id is stored as content object in the content object lists
    // ignoring the library object
    const libraryObjId = Utils.AddressToObjectId(libraryAddr);
    let objectIdsCount = objectIds.length;
    if (objectIds.includes(libraryObjId)){
      objectIdsCount--;
    }

    if (this.debug){
      console.log(`\nList of contents in the given library ${libraryId}:`);
      console.log(JSON.stringify(objectIds, null, 2));
    }

    if (objectIdsCount > 0){
      throw new Error(`The library ${libraryId} has ${objectIds.length} content objects,
      Please delete them before deleting the library`);
    }

    // delete the library contract
    console.log(`deleting library ${libraryAddr}...`);
    try {
      await this.client.CallContractMethodAndWait({
        contractAddress: libraryAddr,
        abi: abi,
        methodName: "kill",
        formatArguments: false,
      });
    } catch (e) {
      throw Error(`error executing 'kill' method on library ${libraryAddr}`);
    }

    let res = {
      [libraryAddr]: "deleted",
      cleanup: {
        user: null,
        groups: {}
      }
    };

    // cleanup the user indexer
    console.log("cleaning up the user indexers...");
    res.cleanup.user = await this.CleanupObjects({
      objectAddr: this.client.signer.address,
      objectType: "library"
    });

    // cleanup the groups indexer
    console.log("cleaning up the group indexers...");
    const groupsList =  await this.client.ListAccessGroups();
    let groupAddress = groupsList.map(x => x.address);
    for (let i=0;i<groupAddress.length;i++){
      res.cleanup.groups[groupAddress[i]] = await this.CleanupObjects({
        objectAddr: groupAddress[i],
        objectType: "library"
      });
    }
    return res;
  }

  /**
   * list content objects for user or group address provided
   * @param {string} objectAddr: address of the user or group
   */
  async ListContentObjects({objectAddr}) {
    const abiStr = fs.readFileSync(
      path.resolve(__dirname, "../contracts/v3/AccessIndexor.abi")
    );
    const abi = JSON.parse(abiStr);

    if (!objectAddr) {
      throw Error("objectAddr is not provided");
    }

    let contentObjLen;
    try {
      contentObjLen = await this.client.CallContractMethod({
        contractAddress: objectAddr,
        abi: abi,
        methodName: "getContentObjectsLength",
        formatArguments: false,
      });
    } catch (e) {
      // the object address can be user address
      let walletContractAddress = await this.client.userProfileClient.UserWalletAddress({
        address: objectAddr
      });
      if (!walletContractAddress) {
        throw new Error("Invalid object provided, not a user or group object");
      }

      console.log(`user wallet address: ${walletContractAddress}`);
      objectAddr = walletContractAddress;

      contentObjLen = await this.client.CallContractMethod({
        contractAddress: objectAddr,
        abi: abi,
        methodName: "getContentObjectsLength",
        formatArguments: false,
      });
    }

    contentObjLen = Number(contentObjLen);
    console.log("content_objects length", contentObjLen);

    let contentObjects = [];
    for (let i=0;i<contentObjLen;i++){
      let res = await this.client.CallContractMethod({
        contractAddress: objectAddr,
        abi: abi,
        methodName: "getContentObject",
        methodArgs: [i],
        formatArguments: true,
      });
      contentObjects.push(Utils.AddressToObjectId(res));
    }
    return {content_objects: contentObjects};
  }
}

exports.ElvContracts = ElvContracts;
