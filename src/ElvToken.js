const { ElvClient } = require("@eluvio/elv-client-js");
const fs = require("fs");
const path = require("path");

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
   * Deploy ElvToken contract (tradable/elv_token.sol)
   * @param {number} cap : elv_token cap
   * @param {string} name: elv_token name
   * @param {string} symbol: elv_token symbol
   * @param {number} decimals: elv_token decimals
   */
  async ElvTokenDeploy({
    cap,
    name,
    symbol,
    decimals }){

    const abistr = fs.readFileSync(
      path.resolve(__dirname, "../contracts/v3/ElvToken.abi")
    );
    const bytecode = fs.readFileSync(
      path.resolve(__dirname, "../contracts/v3/ElvToken.bin")
    );

    var c = await this.client.DeployContract({
      abi: JSON.parse(abistr),
      bytecode: bytecode.toString("utf8").replace("\n", ""),
      constructorArgs: [
        cap,
        name,
        symbol,
        decimals
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



}

exports.ElvToken = ElvToken;
