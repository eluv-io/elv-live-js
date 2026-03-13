const { ethers } = require("ethers");
const fs = require("fs");
const path = require("path");
const { parse } = require("csv-parse");
const { ElvClient } = require("@eluvio/elv-client-js");
const pLimit = require("p-limit");


class BatchNFTOperations {

  constructor({configUrl}) {
    this.configUrl = configUrl || ElvClient.main;
    this.nftAbi = JSON.parse(fs.readFileSync(
      path.resolve(__dirname, "../contracts/v3/ElvTradableLocal.abi")
    ));
    this.proxyAbi = JSON.parse(fs.readFileSync(
      path.resolve(__dirname, "../contracts/v3/TransferProxyRegistry.abi")
    ));

  }

  async Init({debugLogging = false}={}){
    const res = await fetch(this.configUrl);
    if (!res.ok) throw new Error(`HTTP error ${res.status}`);
    const cfgOut = await res.json();

    const ethUrl = cfgOut?.network?.seed_nodes?.ethereum_api?.[0];
    if (!ethUrl) {
      throw new Error("No eth url found");
    }
    this.ethUrl = ethUrl;

    if (!process.env.PRIVATE_KEY) {
      throw new Error("require env PRIVATE_KEY to be set");
    }
    this.privKey = process.env.PRIVATE_KEY;

    this.debug = debugLogging;

    this.provider = new ethers.JsonRpcProvider(ethUrl);
    this.signer = new ethers.Wallet(this.privKey, this.provider);
  }


  async BatchNftTransfer({inputFile, concurrency = 5}) {
    // --- read data from csv file ---
    const inputData = [];
    await new Promise((resolve, reject) => {
      fs.createReadStream(inputFile)
        .pipe(parse({columns:true, trim: true}))
        .on("data", (row)=>{
          inputData.push({
            addr: row.addr,
            tokenId: ethers.BigNumber.from(row.tokenId),
            fromAddr: row.fromAddr,
            toAddr: row.toAddr
          });
        })
        .on("end", () => resolve(inputData))
        .on("error", reject);
    });
    console.log(`Loaded ${inputData.length} data from CSV file`);

    let nonce = await this.provider.getTransactionCount(this.signer.address);
    const getNonce = () => nonce++;

    // perform nft proxy transfer in batch
    const results = await this.batchProcessor(inputData, async (item) => {
      return await this.NftProxyTransferFrom({
        addr: item.addr,
        toAddr: item.toAddr,
        fromAddr: item.fromAddr,
        tokenId: item.tokenId,
        nonce: getNonce(),
      });
    }, { concurrency });

    const submittedTxs = [];
    const failed = [];
    const ownerMismatch = [];

    // Separate results
    results.forEach(res => {
      if (!res) return;
      if (res.status === "submitted") submittedTxs.push(res);
      else if (res.status === "failed") failed.push(res);
      else if (res.status === "owner_mismatch") ownerMismatch.push(res);
    });

    // Wait for all submitted TXs to be mined
    await Promise.all(submittedTxs.map(async ({ tx, tokenId }) => {
      const receipt = await tx.wait();
      console.log(`Token ${tokenId} mined!`);
      if (this.debug) {
        console.log("Receipt:", {
          hash: receipt.transactionHash,
          blockNumber: receipt.blockNumber,
          gasUsed: receipt.gasUsed.toString(),
          status: receipt.status,
        });
        console.log("=========================");
      }
    }));

    console.log("All Txs processed!");
    return { failed, ownerMismatch};
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
      throw new Error(`Bad key - not proxy owner (should be: ${proxyOwner}`);
    }
    return proxyAddr;
  }

  // Transfer an NFT as a proxy owner
  async NftProxyTransferFrom({addr, tokenId, fromAddr, toAddr, nonce}){

    const nftContract = new ethers.Contract(addr, this.nftAbi, this.signer);

    // check if owner of the tokenId matches 'from' address
    const ownerOf = await nftContract.ownerOf(tokenId);
    if (ownerOf.toLowerCase() !==  fromAddr.toLowerCase()){
      if (this.debug) {
        console.log(`Not owner of token ${tokenId} (owner: ${ownerOf})`);
      }
      return { status: "owner_mismatch", tokenId, addr, fromAddr, toAddr, actualOwner: ownerOf };
    }

    // get proxy addr
    const proxyAddr = await this.CheckNftProxy({ addr });

    if (this.debug) {
      console.log("Executing proxyTransferFrom");
    }
    const proxyContract = new ethers.Contract(proxyAddr, this.proxyAbi, this.signer);
    try {
      const tx = await proxyContract.proxyTransferFrom(
        addr, fromAddr, toAddr, tokenId,
        { nonce }
      );
      return { status: "submitted", tx, tokenId };
    } catch (e) {
      return { status: "failed", tokenId, addr, fromAddr, toAddr, e };
    }
  }

  // The batchProcessor expects each jobFn to return an object with a `status` field.
  // Items with `status: "failed"` will be retried up to the retry limit using exponential backoff.
  // Items are processed in batches based on the configured batchSize.
  async batchProcessor(items, jobFn, {
    batchSize = 20,
    batchDelayMs = 2000,
    concurrency = 5,
    retries = 3,
    retryDelayMs = 1000
  } = {}) {
    const limit = pLimit(concurrency);
    const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

    const results = [];

    for (let i = 0; i < items.length; i += batchSize) {
      const batch = items.slice(i, i + batchSize);
      console.log(`Processing batch ${Math.floor(i / batchSize) + 1} (${batch.length} items)...`);

      // Map each item to a retried job
      const batchResults = await Promise.all(batch.map(item => limit(async () => {
        let attempt = 0;
        while (attempt <= retries) {
          const res = await jobFn(item);

          if (res.status !== "failed") {
            // Success or owner_mismatch - no retry
            return res;
          }

          attempt++;
          if (attempt > retries) {
            if (this.debug) {
              console.log(`Failed item after ${retries} retries: ${JSON.stringify(item)}`);
            }
            return res;
          }

          const wait = retryDelayMs * 2 ** (attempt - 1); // exponential backoff
          if (this.debug) {
            console.log(`Retry ${attempt} for failed item: ${JSON.stringify(item)}. Waiting ${wait}ms`);
          }
          await sleep(wait);
        }
      })));

      results.push(...batchResults);

      if (i + batchSize < items.length) {
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