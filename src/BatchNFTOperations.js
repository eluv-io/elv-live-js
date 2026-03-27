const { ethers } = require("ethers");
const fs = require("fs");
const path = require("path");
const { parse } = require("csv-parse");
const pLimit = require("p-limit");
const { Mutex } = require("async-mutex");


class BatchNFTOperations {

  constructor({configUrl}) {
    this.configUrl = `${configUrl}/config`;
    this.nftAbi = JSON.parse(fs.readFileSync(
      path.resolve(__dirname, "../contracts/v3/ElvTradableLocal.abi")
    ));
    this.proxyAbi = JSON.parse(fs.readFileSync(
      path.resolve(__dirname, "../contracts/v3/TransferProxyRegistry.abi")
    ));
    this.nonce = null;
    this.nonceMutex = new Mutex();
  }

  async Init({debugLogging = false}={}) {
    const res = await fetch(this.configUrl);
    if (!res.ok) throw new Error(`HTTP error ${res.status}`);
    const cfgOut = await res.json();

    const ethUrl = cfgOut?.network?.seed_nodes?.ethereum_api?.[0];
    if (!ethUrl) {
      throw new Error("No eth url found");
    }
    console.log("ETH URL", ethUrl);

    if (!process.env.PRIVATE_KEY) {
      throw new Error("require env PRIVATE_KEY to be set");
    }
    this.privKey = process.env.PRIVATE_KEY;

    this.debug = debugLogging;

    this.provider = new ethers.providers.JsonRpcProvider(ethUrl);
    this.signer = new ethers.Wallet(this.privKey, this.provider);

    this.nonce = await this.provider.getTransactionCount(
      this.signer.address,
      "pending"
    );
  }

  async getNextNonce() {
    return this.nonceMutex.runExclusive(() => {
      const n = this.nonce;
      this.nonce++;
      return n;
    });
  }

  async SyncNonce() {
    const newNonce = await this.provider.getTransactionCount(
      this.signer.address,
      "pending"
    );

    await this.nonceMutex.runExclusive(() => {
      if (this.debug) {
        console.log(`Resyncing nonce: local=${this.nonce}, chain=${newNonce}`);
      }

      if (newNonce > this.nonce) {
        this.nonce = newNonce;
      }
    });
  }


  async BatchNftTransfer({inputFile, concurrency = 5, batchSize = 20, outputFolder = ""}) {
    // --- read data from csv file ---
    const inputData = [];
    await new Promise((resolve, reject) => {
      fs.createReadStream(inputFile)
        .pipe(parse({columns:true, trim: true}))
        .on("data", (row)=>{
          inputData.push({
            addr: row.addr,
            tokenId: row.tokenId,
            fromAddr: row.fromAddr,
            toAddr: row.toAddr
          });
        })
        .on("end", () => resolve(inputData))
        .on("error", reject);
    });
    console.log(`Loaded ${inputData.length} data from CSV file`);

    // perform nft proxy transfer in batch
    const results = await this.batchProcessor(inputData, async (item) => {
      return await this.NftProxyTransferFrom({
        addr: item.addr,
        toAddr: item.toAddr,
        fromAddr: item.fromAddr,
        tokenId: item.tokenId,
      });
    }, { concurrency, batchSize });

    const successTxs = [];
    const failed = [];
    const ownerMismatch = [];

    // Separate results
    results.forEach(res => {
      if (!res) return;
      if (res.status === "success") successTxs.push(res);
      else if (res.status === "failed") failed.push(res);
      else if (res.status === "owner_mismatch") ownerMismatch.push(res);
    });


    // --- output files ---

    const outputDir = path.resolve(outputFolder || process.cwd());
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }
    const successFilePath = path.join(outputDir, "output_success_list.csv");
    const failedFilePath = path.join(outputDir, "output_failed_list.csv");
    const ownerMismatchFilePath = path.join(outputDir, "output_owner_mismatch_list.csv");

    if (successTxs.length > 0) {
      const header = "status,tokenId,addr,fromAddr,toAddr,tx\n";

      const rows = successTxs.map(({ tokenId, addr, fromAddr, toAddr, tx }) => {
        return `success,${tokenId},${addr},${fromAddr},${toAddr},${tx}`;
      }).join("\n");

      fs.writeFileSync(successFilePath, header + rows + "\n", "utf8");
      console.log(`Written ${successTxs.length} records to ${successFilePath}`);

    }


    if (failed.length > 0) {
      const header = "status,tokenId,addr,fromAddr,toAddr,error\n";

      const rows = failed.map(({ tokenId, addr, fromAddr, toAddr, e }) => {
        const errorMsg = e?.message || e || "";
        const safeError = `"${String(errorMsg).replace(/"/g, "\"\"")}"`;

        return `failed,${tokenId},${addr},${fromAddr},${toAddr},${safeError}`;
      }).join("\n");

      fs.writeFileSync(failedFilePath, header + rows + "\n", "utf8");
      console.log(`Written ${failed.length} failed records to ${failedFilePath}`);
    }

    if (ownerMismatch.length > 0) {
      const header = "status,tokenId,addr,fromAddr,toAddr,actualOwner\n";

      const rows = ownerMismatch.map(({ tokenId, addr, fromAddr, toAddr, actualOwner }) => {
        return `owner_mismatch,${tokenId},${addr},${fromAddr},${toAddr},${actualOwner}`;
      }).join("\n");

      fs.writeFileSync(ownerMismatchFilePath, header + rows + "\n", "utf8");
      console.log(`Written ${ownerMismatch.length}  records to ${ownerMismatchFilePath}`);
    }

    console.log("All Txs processed!");
    return {
      success: {
        count: successTxs.length,
        filepath: successTxs.length>0? successFilePath: "",
      },
      failed: {
        count: failed.length,
        filepath: failed.length>0? failedFilePath: "",
      },
      owner_mismatch: {
        count: ownerMismatch.length,
        filepath: ownerMismatch.length>0? ownerMismatchFilePath: "",
      },
    };
  }

  // Get nft proxy owner address
  async NftProxyOwner({proxyAddr}) {
    const proxyContract = new ethers.Contract(proxyAddr, this.proxyAbi, this.signer);
    const owner = await proxyContract.owner();
    return owner;
  }

  // Get nft proxy address
  async CheckNftProxy({addr}) {
    const nftInstance = new ethers.Contract(addr, this.nftAbi, this.signer);
    const proxyAddr = await nftInstance.proxyRegistryAddress();
    if (proxyAddr === "0x0000000000000000000000000000000000000000") {
      throw new Error("NFT has no proxy");
    }

    const proxyOwner = await this.NftProxyOwner({proxyAddr});
    if (proxyOwner.toLowerCase() !== this.signer.address.toLowerCase()) {
      throw new Error(`Bad key - not proxy owner (should be: ${proxyOwner})`);
    }
    return proxyAddr;
  }

  // Transfer an NFT as a proxy owner
  async NftProxyTransferFrom({addr, tokenId, fromAddr, toAddr}){

    const nftContract = new ethers.Contract(addr, this.nftAbi, this.signer);
    const tknId = ethers.BigNumber.from(tokenId);

    // check if owner of the tokenId matches 'from' address
    const ownerOf = await nftContract.ownerOf(tknId);
    if (ownerOf.toLowerCase() !==  fromAddr.toLowerCase()){
      if (this.debug) {
        console.log(`Not owner of token ${tokenId} (owner: ${ownerOf})`);
      }
      return { status: "owner_mismatch", tokenId, addr, fromAddr, toAddr, actualOwner: ownerOf };
    }

    // get proxy addr
    const proxyAddr = await this.CheckNftProxy({ addr });
    const proxyContract = new ethers.Contract(proxyAddr, this.proxyAbi, this.signer);

    if (this.debug) {
      console.log("Executing proxyTransferFrom");
    }

    const executeTx = async() => {
      const nonce = await this.getNextNonce();
      const tx = await proxyContract.proxyTransferFrom(
        addr,
        fromAddr,
        toAddr,
        tknId,
        {
          nonce,
          gasLimit: 200000,
          maxFeePerGas: ethers.utils.parseUnits("80", "gwei"),
          maxPriorityFeePerGas: ethers.utils.parseUnits("5", "gwei"),
        }
      );

      let cancel;
      const timeout = new Promise((_, reject) => {
        const id = setTimeout(() => {
          reject(new Error("tx.wait() timed out"));
        }, 60000);

        cancel = () => clearTimeout(id);
      });

      const receipt = await Promise.race([tx.wait(), timeout])
        .finally(() => cancel && cancel());
      return receipt.transactionHash;
    };

    for (let attempt = 1; attempt <= 2; attempt++) {
      try {
        if (this.debug) {
          console.log(`Attempt ${attempt}: Sending tx for token ${tokenId}`);
        }
        const txHash = await executeTx();
        return { status: "success", tx: txHash, tokenId, addr, fromAddr, toAddr };
      } catch (e) {
        if (["NONCE_EXPIRED", "REPLACEMENT_UNDERPRICED", "TRANSACTION_REPLACED"].includes(e.code)) {
          if (attempt === 1) {
            if (this.debug) {
              console.log("Nonce collision detected, resyncing nonce...");
            }
            await this.SyncNonce();
            // Short delay before retrying
            await new Promise(resolve => setTimeout(resolve, 200));
            continue; // Retry once
          }
        }
        // Any other error or second failure
        return { status: "failed", tokenId, addr, fromAddr, toAddr, e };
      }
    }
  }

  // The batchProcessor expects each jobFn to return an object with a `status` field.
  // Items are processed in batches based on the configured batchSize.
  async batchProcessor(items, jobFn, {
    batchSize = 20,
    batchDelayMs = 2000,
    concurrency = 5,
  } = {}) {
    const limit = pLimit(concurrency);
    const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

    const results = [];

    for (let i = 0; i < items.length; i += batchSize) {
      const batch = items.slice(i, i + batchSize);
      console.log(`Processing batch ${Math.floor(i / batchSize) + 1} (${batch.length} items)...`);

      // Map each item to a retried job
      const batchResults = await Promise.all(
        batch.map(item =>
          limit(async () => {
            try {
              return await jobFn(item);
            } catch (e) {
              return {
                status: "failed",
                tokenId: item.tokenId,
                addr: item.addr,
                fromAddr: item.fromAddr,
                toAddr: item.toAddr,
                e
              };
            }
          })
        )
      );
      results.push(...batchResults);

      if (i + batchSize < items.length && batchDelayMs > 0) {
        if (this.debug) {
          console.log(`Waiting ${batchDelayMs}ms before next batch...`);
        }
        await sleep(batchDelayMs);
      }
    }

    return results;
  }
}

exports.BatchNFTOperations = BatchNFTOperations;