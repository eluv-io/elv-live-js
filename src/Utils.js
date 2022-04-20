class ElvUtils {
  async DeployContractFile({fileName, args=[]}) {
    console.log("DeployTenant");
    const tenantAbistr = fs.readFileSync(
      path.resolve(__dirname, `../contracts/v3/${fileName}.abi`)
    );
    const tenantBytecode = fs.readFileSync(
      path.resolve(__dirname, `../contracts/v3/${fileName}.bin`)
    );

    var contract = await this.client.DeployContract({
      abi: JSON.parse(tenantAbistr),
      bytecode: tenantBytecode.toString("utf8").replace("\n", ""),
      constructorArgs: args,
    });
    return {address:contract.contractAddress};
  }
}

exports.ElvUtils = ElvUtils;
