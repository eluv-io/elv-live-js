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

  /**
   * Delete versions of target object from startIndex to endIndex
   *
   * @param {string} target Address/Id of the object
   * @param {number} startIndex Starting index (inclusive) for version deletion
   * @param {number} endIndex Ending index (inclusive) for version deletion
   * @returns {Promise<string[]>} Array of failed version hashes, if any or success message
   */
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

    const provider = this.client.ethClient.Provider();
    let nonce = await provider.getTransactionCount(
      await this.client.signer.getAddress(),
      "pending"
    );

    const hashesToDelete = versionsInfo
      .slice(startIndex, endIndex + 1)
      .map((v) => v.hash);

    let results = [];
    let isLastTx;

    for (let i = 0; i < hashesToDelete.length; i++) {
      const hash = hashesToDelete[i];
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

        console.log(
          `Deleted: index=${startIndex + i}, nonce=${nonce}, hash=${hash}`
        );

        // increment nonce when the call succeeds
        nonce++;

        results.push({
          success: true,
          hash,
          tx: res.transactionHash,
          index: startIndex + i,
          nonce,
        });
      } catch (e) {
        console.error(
          `Failed to delete: index=${
            startIndex + i
          }, nonce=${nonce}, hash=${hash}, err=${e.message}`
        );
        results.push({
          success: false,
          hash,
          index: startIndex + i,
          nonce,
          error: e.message,
        });
      }
    }

    const failed = results.filter((r) => !r.success);
    return failed.length > 0 ? failed : "All version deleted successfully!";
  }

  /**
   * Delete list of content objects provided
   *
   * @param {string[]} contentObjects Address/Id of the object
   * @returns {Promise<string[]>} Array of failed objects, if any or success message
   */
  async DeleteContents({ contentObjects }) {
    if (contentObjects.length === 0) {
      throw Error("require contentObjects list to be provided");
    }

    const abiStr = fs.readFileSync(
      path.resolve(__dirname, "../contracts/v3/BaseLibrary.abi")
    );

    let results = [];
    let isLastTx;

    const provider = this.client.ethClient.Provider();
    let nonce = await provider.getTransactionCount(
      await this.client.signer.getAddress(),
      "pending"
    );

    for (let i = 0; i < contentObjects.length; i++) {
      let objectAddress, libraryAddress;
      let objectId, libraryId;
      let contentObject = contentObjects[i];

      isLastTx = i === contentObjects.length - 1;
      try {
        let res;

        if (contentObject.startsWith("0x")) {
          objectAddress = contentObject;
          objectId = Utils.AddressToObjectId(objectAddress);
        } else {
          objectId = contentObject;
          objectAddress = Utils.HashToAddress(contentObject);
        }

        libraryId = await this.client.ContentObjectLibraryId({
          objectId,
        });
        libraryAddress = Utils.HashToAddress(libraryId);

        const canEdit = await this.client.CallContractMethod({
          contractAddress: objectAddress,
          methodName: "canEdit",
        });
        if (!canEdit) {
          throw Error(
            `Current user does not have permission to delete content object ${objectId}`
          );
        }

        if (!isLastTx) {
          res = await this.client.CallContractMethod({
            contractAddress: libraryAddress,
            abi: JSON.parse(abiStr),
            methodName: "deleteContent",
            methodArgs: [objectAddress],
            overrides: { nonce },
          });
        } else {
          res = await this.client.CallContractMethodAndWait({
            contractAddress: libraryAddress,
            abi: JSON.parse(abiStr),
            methodName: "deleteContent",
            methodArgs: [objectAddress],
            overrides: { nonce },
          });
        }

        console.log(`Deleted object: nonce=${nonce}, object=${objectId}`);

        // increment nonce when call succeeds
        nonce++;

        results.push({
          success: true,
          objectId,
          libraryId,
          tx: res.transactionHash,
          nonce,
        });
      } catch (e) {
        console.error(`Failed to delete: ${objectId}, error: ${e.message}`);
        results.push({
          success: false,
          objectId,
          error: e.message,
        });
      }
    }

    const failed = results.filter((r) => !r.success);
    return failed.length > 0
      ? failed
      : "All content objects deleted successfully!";
  }
}

exports.BatchHelper = BatchHelper;
