const { ElvClient, Utils } = require("@eluvio/elv-client-js");
const { Config } = require("./Config.js");
const fs = require("fs");
const path = require("path");

class BatchHelper {
  constructor({ configUrl }) {
    this.configUrl = configUrl || ElvClient.main;
    this.spaceAddress = Config.consts[Config.net].spaceAddress;
    this.debug = false;
  }

  async Init({ debugLogging = false } = {}) {
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

  async DeleteVersions({ target, startIndex, endIndex }) {
    console.log("target:", target);
    console.log("startIndex:", startIndex);
    console.log("endIndex:", endIndex);

    let targetAddress;
    if (target.startsWith("0x")) {
      targetAddress = target;
    } else {
      targetAddress = Utils.HashToAddress(target);
    }

    if (startIndex < 0 || endIndex < 0) {
      throw Error(
        `invalid indices: startIndex=${startIndex}, endIndex=${endIndex}`
      );
    }

    if (startIndex >= endIndex) {
      throw Error(
        `invalid range: start_index (${startIndex}) must be less than end_index (${endIndex})`
      );
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

    if (
      startIndex >= countVersionHashes.toNumber() ||
      endIndex >= countVersionHashes.toNumber()
    ) {
      throw Error(
        `invalid indices: startIndex=${startIndex}, endIndex=${endIndex}, versionsCount=${countVersionHashes.toNumber()}`
      );
    }

    let versionsInfo = [];
    let count = 0;
    for (let i = 0; i < countVersionHashes.toNumber(); i++) {
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

      const version = { hash, timestamp };
      versionsInfo.push(version);
      count++;
      if (count % 10 === 0) {
        console.log(`Done processing ${count} version hashes...`);
      }
      if (count === countVersionHashes.toNumber() - 1) {
        console.log("Done processing ALL version hashes!");
      }
    }

    console.log("sorting versions...");
    versionsInfo.sort((a, b) => a.timestamp - b.timestamp);

    let baseNonce = await this.client.ethClient.provider.getTransactionCount(
      this.client.signer.getAddress(),
      "pending"
    );

    const hashesToDelete = versionsInfo
      .slice(startIndex, endIndex + 1)
      .map((v) => v.hash);

    let results = [];
    let isLastTx;

    for (let i = 0; i < hashesToDelete.length; i++) {
      const hash = hashesToDelete[i];
      const nonce = baseNonce + i;
      isLastTx = i === hashesToDelete.length - 1;

      try {
        let res;

        if (!isLastTx) {
          res = await this.client.CallContractMethod({
            contractAddress: targetAddress,
            abi: JSON.parse(abiStr),
            methodName: "deleteVersion",
            methodArgs: [hash],
            formatArguments: true,
            overrides: { nonce },
          });
        } else {
          res = await this.client.CallContractMethodAndWait({
            contractAddress: targetAddress,
            abi: JSON.parse(abiStr),
            methodName: "deleteVersion",
            methodArgs: [hash],
            formatArguments: true,
            overrides: { nonce },
          });
        }

        console.log(`Deleted: nonce=${nonce}, hash=${hash}`);
        results.push({
          hash,
          success: true,
          tx: res.transactionHash,
          nonce,
          error: "",
        });
      } catch (e) {
        console.error(`Failed to delete: ${hash}`, e.message);
        results.push({ hash, success: false, tx: "", error: e.message, nonce });

        // stop creating new tx if an error occurs
        break;
      }
    }

    const failed = results.filter((r) => !r.success);
    return failed.length > 0 ? failed : "All version deleted successfully!";
  }
}

exports.BatchHelper = BatchHelper;
