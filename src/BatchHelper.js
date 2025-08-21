const { ElvClient, Utils } = require("@eluvio/elv-client-js");
const { Config } = require("./Config.js");
const fs = require("fs");
const path = require("path");
const plimit = require("p-limit");

class BatchHelper {
  constructor({ configUrl }){
    this.configUrl = configUrl || ElvClient.main;
    this.spaceAddress = Config.consts[Config.net].spaceAddress;
    this.debug = false;
  }

  async Init({debugLogging = false}={}) {
    this.client = await ElvClient.FromConfigurationUrl({
      configUrl: this.configUrl,
    });

    let wallet = this.client.GenerateWallet();
    let signer = wallet.AddAccount({
      privateKey: process.env.PRIVATE_KEY,
    });
    this.client.SetSigner({ signer });
    this.client.ToggleLogging(debugLogging);
    this.debug = debugLogging;
  }


  async DeleteVersions({targetAddress,startIndex,endIndex}) {
    console.log("targetAddress:", targetAddress);
    console.log("startIndex:",startIndex);
    console.log("endIndex:",endIndex);

    if (!Utils.ValidAddress(targetAddress)){
      throw Error (`require valid target address:${targetAddress}`);
    }

    if (startIndex < 0 || endIndex < 0 ){
      throw Error (`invalid indices: startIndex=${startIndex}, endIndex=${endIndex}`);
    }

    if (startIndex >= endIndex) {
      throw Error (`invalid range: start_index (${startIndex}) must be less than end_index (${endIndex})`);
    }

    const abiStr = fs.readFileSync(
      path.resolve(__dirname, "../contracts/v3/Editable.abi")
    );

    const countVersionHashes = await this.client.CallContractMethod({
      contractAddress: targetAddress,
      abi: JSON.parse(abiStr),
      methodName: "countVersionHashes",
      formatArguments: true,
    });
    console.log("Total Version:", countVersionHashes.toNumber());

    if (startIndex >= countVersionHashes.toNumber() || endIndex >= countVersionHashes.toNumber() ){
      throw Error(`invalid indices: startIndex=${startIndex}, endIndex=${endIndex}, versionsCount=${countVersionHashes.toNumber()}`)
    }

    let versionsInfo = [];
    let count = 0;
    for (let i=0; i < countVersionHashes.toNumber(); i++){
      const hash = await this.client.CallContractMethod({
        contractAddress: targetAddress,
        abi: JSON.parse(abiStr),
        methodName: "versionHashes",
        methodArgs: [i],
        formatArguments: true,
      });
      const timestampBN = await this.client.CallContractMethod({
        contractAddress: targetAddress,
        abi: JSON.parse(abiStr),
        methodName: "versionTimestamp",
        methodArgs: [i],
        formatArguments: true,
      });
      const timestamp = timestampBN.toNumber();

      const version = {hash, timestamp};
      versionsInfo.push(version);
      count++;
      if (count%5===0){
        console.log(`Done proceesing ${count+1} version hashes...`);
      }
      if (count === countVersionHashes.toNumber() - 1){
        console.log("Done processing ALL version hashes!");
      }
    }

    console.log("sorting versions...");
    versionsInfo.sort((a,b) => a.timestamp - b.timestamp);

    const limit = plimit(3); // at most 3 tasks run at once
    const hashesToDelete = versionsInfo
      .slice(startIndex,endIndex + 1)
      .map(v => v.hash);

    const results = await Promise.all(
      hashesToDelete.map(hash =>
        limit(async () => {
          try {
            const res = await this.client.CallContractMethodAndWait({
              contractAddress: targetAddress,
              abi: JSON.parse(abiStr),
              methodName: "deleteVersion",
              methodArgs: [hash],
              formatArguments: true
            });
            console.log(`Deleted: ${hash}`);
            return {hash, success: true, tx: res.transactionHash};
          } catch(e) {
            console.error(`Failed to delete: ${hash}`, err.message);
            return {hash, success: false, error: err.message};
          }
        }))
    );

    const failed = results.filter(r => !r.success);
    return failed.length > 0? failed : "All version deleted successfully!";
  }
}

exports.BatchHelper = BatchHelper;
