const {ethers} = require("ethers");

class ElvBlockchain {
  constructor({ethUrl, privateKey}){
    if (!ethUrl || !privateKey) {
      throw new Error("require eth_url and PRIVATE_KEY to be set");
    }

    this.provider = new ethers.providers.JsonRpcProvider(ethUrl);
    this.wallet = new ethers.Wallet(privateKey, this.provider);
  }

  async Init() {
    this.userAddr = await this.wallet.getAddress();
    console.log("Using address:", this.userAddr);
  }

  async getNonces() {
    const latest = await this.provider.getTransactionCount(this.userAddr, "latest");
    const pending = await this.provider.getTransactionCount(this.userAddr, "pending");

    return { latest, pending };
  }

  async sendSelfTx(nonce) {
    const tx = await this.wallet.sendTransaction({
      to: this.userAddr,
      value: 0,
      nonce: nonce,
      gasLimit: 21000,
      maxFeePerGas: ethers.utils.parseUnits("80", "gwei"),
      maxPriorityFeePerGas: ethers.utils.parseUnits("5", "gwei"),
    });

    console.log("Sent tx:", tx.hash, "nonce:", nonce);
    return tx;
  }

  async waitForTx(tx) {
    const receipt = await tx.wait();
    console.log("Mined tx:", receipt.transactionHash);
    return receipt;
  }

  async fixEthNonceGap({targetNonce}) {
    console.log("Starting nonce fix...");

    let { latest, pending } = await this.getNonces();
    console.log(`Initial state, latest: ${latest}, pending: ${pending}`);

    const endNonce = targetNonce>0? targetNonce: pending;
    for (let i = latest; i <= endNonce; i++) {
      latest = await this.provider.getTransactionCount(this.userAddr, "latest");

      console.log("Current latest nonce:", latest);

      const tx = await this.sendSelfTx(latest);
      await this.waitForTx(tx);
    }

    console.log("Nonce gap fix completed.");
  }
}

exports.ElvBlockchain = ElvBlockchain;