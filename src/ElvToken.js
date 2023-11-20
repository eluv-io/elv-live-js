const { ElvClient } = require("@eluvio/elv-client-js");
const fs = require("fs");
const path = require("path");
const Ethers = require("ethers");

class ElvToken {

  /**
   * Instantiate the ElvToken SDK
   *
   * @namedParams
   * @param {string} configUrl - The Content Fabric configuration URL
   */
  constructor({ configUrl }) {
    this.configUrl = configUrl || ElvClient.main;

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
   * Deploy ElvToken contract (src/token/elv_token.sol)
   * @param {string} name: elv_token name
   * @param {string} symbol: elv_token symbol
   * @param {number} decimals: elv_token decimals
   * @param {number} amount : elv_token premint amount
   */
  async ElvTokenDeploy({
    name,
    symbol,
    decimals,
    amount ,
  }){

    const abistr = fs.readFileSync(
      path.resolve(__dirname, "../contracts/v4/ElvToken.abi")
    );
    const bytecode = fs.readFileSync(
      path.resolve(__dirname, "../contracts/v4/ElvToken.bin")
    );

    var c = await this.client.DeployContract({
      abi: JSON.parse(abistr),
      bytecode: bytecode.toString("utf8").replace("\n", ""),
      constructorArgs: [
        name,
        symbol,
        decimals,
        amount
      ],
    });
    console.log("ElvToken contract address:", c.contractAddress);

    var res = await this.client.CallContractMethod({
      contractAddress: c.contractAddress,
      abi: JSON.parse(abistr),
      methodName: "name",
      methodArgs: [],
      formatArguments: true,
    });
    var n = res.toString();

    res = await this.client.CallContractMethod({
      contractAddress: c.contractAddress,
      abi: JSON.parse(abistr),
      methodName: "symbol",
      methodArgs: [],
      formatArguments: true,
    });
    var s = res.toString();

    res = await this.client.CallContractMethod({
      contractAddress: c.contractAddress,
      abi: JSON.parse(abistr),
      methodName: "decimals",
      methodArgs: [],
      formatArguments: true,
    });
    var d = res.toString();

    return {
      contract_address: c.contractAddress,
      name: n,
      symbol: s,
      decimals: d,
    };
  }

  /**
   * Transfer the token to the given address
   *
   * @namedParams
   * @param {string} tokenAddr - Token address
   * @param {string} toAddr - To address
   * @param {integer} amount - Token amount
   * @return {Promise<Object>} - Token Transfer Info JSON
   */
  async ElvTokenTransfer({ tokenAddr, toAddr, amount }) {
    const abi = fs.readFileSync(
      path.resolve(__dirname, "../contracts/v4/IERC20.abi")
    );

    return await this.client.CallContractMethodAndWait({
      contractAddress: tokenAddr,
      abi: JSON.parse(abi),
      methodName: "transfer",
      methodArgs: [toAddr, amount],
      formatArguments: true,
    });
  }

  /**
   * Get the Token balance for a given user address
   *
   * @namedParams
   * @param {string} tokenAddr - Token address
   * @param {string} userAddr - Token address
   * @return {integer} - Token balance
   */
  async ElvTokenBalance({ tokenAddr, userAddr }) {
    const abi = fs.readFileSync(
      path.resolve(__dirname, "../contracts/v4/IERC20.abi")
    );

    let res = await this.client.CallContractMethod({
      contractAddress: tokenAddr,
      abi: JSON.parse(abi),
      methodName: "balanceOf",
      methodArgs: [userAddr],
      formatArguments: true,
    });
    return Ethers.BigNumber.from(res).toNumber();
  }

}

exports.ElvToken = ElvToken;
