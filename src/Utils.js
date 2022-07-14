const fs = require("fs");
const path = require("path");
const keccak256 = require("keccak256");

class ElvUtils {
  static async DeployContractFile({ client, fileName, args = [] }) {
    const tenantAbi = fs.readFileSync(
      path.resolve(__dirname, `../contracts/v3/${fileName}.abi`)
    );
    const tenantBytecode = fs.readFileSync(
      path.resolve(__dirname, `../contracts/v3/${fileName}.bin`)
    );

    var contract = await client.DeployContract({
      abi: JSON.parse(tenantAbi),
      bytecode: tenantBytecode.toString("utf8").replace("\n", ""),
      constructorArgs: args,
    });
    return {
      address: contract.contractAddress,
      abi: tenantAbi,
    };
  }

  static GetFunc4Bytes(funcSig) {
    var id = keccak256(funcSig).subarray(0, 4);
    return id;
  }
}

exports.ElvUtils = ElvUtils;
