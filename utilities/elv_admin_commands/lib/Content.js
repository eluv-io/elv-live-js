const { ElvAccount } = require("../../../src/ElvAccount");
const { Config } = require("../../../src/Config");
const yaml = require("js-yaml");
const Utils = require("../../../../elv-client-js/src/Utils");
const { ElvUtils } = require("../../../src/Utils");
const { ElvContracts } = require("../../../src/ElvContracts");
const { BatchHelper } = require("../../../src/BatchHelper");
const { ElvFabric } = require("../../../src/ElvFabric");

const CmdSetTenantContractId = async ({ argv }) => {
  try {
    const elvAccount = new ElvAccount({
      configUrl: Config.networks[Config.net],
      debugLogging: argv.verbose,
    });
    await elvAccount.Init({ privateKey: process.env.PRIVATE_KEY });

    const { object, tenantContractId } = argv;
    let contractAddress, objectId, versionHash;

    if (object.startsWith("iq")) {
      objectId = object;
    } else if (object.startsWith("hq")) {
      versionHash = object;
    } else if (object.startsWith("0x")) {
      contractAddress = object;
    } else {
      throw new Error(`Invalid object provided: ${object}`);
    }

    console.log("parameters:", {
      contractAddress,
      objectId,
      versionHash,
      tenantContractId,
    });

    const response = await elvAccount.SetTenantContractId({
      contractAddress,
      objectId,
      versionHash,
      tenantContractId,
    });

    console.log(yaml.dump(response));
  } catch (error) {
    console.error("error occurred setting the tenant contract ID:", error.message);
    console.error(error);
  }
};

const CmdGetTenantInfo = async ({ argv }) => {
  try {
    const elvAccount = new ElvAccount({
      configUrl: Config.networks[Config.net],
      debugLogging: argv.verbose,
    });
    await elvAccount.Init({ privateKey: process.env.PRIVATE_KEY });

    const { object } = argv;
    let contractAddress, objectId, versionHash;

    if (object.startsWith("iq")) {
      objectId = object;
    } else if (object.startsWith("hq")) {
      versionHash = object;
    } else if (object.startsWith("0x")) {
      contractAddress = object;
    } else {
      throw new Error(`Invalid object provided: ${object}`);
    }

    console.log("parameters:", {
      contractAddress,
      objectId,
      versionHash,
    });

    const response = await elvAccount.GetTenantInfo({
      contractAddress,
      objectId,
      versionHash
    });

    console.log(yaml.dump(response));
  } catch (error) {
    console.error("error:", error.message);
    console.error(error);
  }
};

const CmdSetObjectGroupPermission = async ({ argv }) => {
  console.log("Set Group Permission");
  console.log(`Object ID: ${argv.object}`);
  console.log(`verbose: ${argv.verbose}`);
  console.log(`group: ${argv.group}`);
  console.log(`permission: ${argv.permission}`);

  let object = argv.object;
  let group = argv.group;
  let permission = argv.permission;
  try {

    if (group.startsWith("igrp")){
      group = Utils.HashToAddress(group);
    }
    if (object.startsWith("0x")){
      object = ElvUtils.AddressToId({prefix:"iq__", address:object});
    }

    let elvContract = new ElvContracts({
      configUrl: Config.networks[Config.net],
      debugLogging: argv.verbose
    });

    await elvContract.Init({
      privateKey: process.env.PRIVATE_KEY,
    });

    await elvContract.SetObjectGroupPermission({
      objectId: object,
      groupAddress: group,
      permission,
    });
    console.log(`The group ${group} has been granted '${permission}' permission for the object ${object}`);
  } catch (e) {
    console.error("ERROR:", e);
  }
};

const CmdDeleteVersionsBatch = async ({ argv }) => {
  try {
    const batchHelper = new BatchHelper({
      configUrl: Config.networks[Config.net],
    });

    await batchHelper.Init({
      debugLogging: argv.verbose,
    });

    const res = await batchHelper.DeleteVersions({
      target: argv.target,
      startIndex: argv.start_index,
      endIndex: argv.end_index,
    });
    console.log(yaml.dump(res));
  } catch (e) {
    console.error("ERROR:", argv.verbose ? e : e.message);
  }
};

const CmdDeleteContentsBatch = async ({ argv }) => {
  try {
    const batchHelper = new BatchHelper({
      configUrl: Config.networks[Config.net],
    });

    await batchHelper.Init({
      debugLogging: argv.verbose,
    });

    const res = await batchHelper.DeleteContents({
      contentObjects: argv.content_objects,
    });
    console.log(yaml.dump(res));
  } catch (e) {
    console.error("ERROR:", argv.verbose ? e : e.message);
  }
};

const CmdCleanupObject = async ({ argv }) => {
  console.log("Parameters:");
  console.log("object", argv.object);
  console.log("object_type", argv.object_type);

  try {

    const object = argv.object;
    const objectType = argv.object_type;

    let objectAddr;
    if (object.startsWith("iq") || object.startsWith("iusr") || object.startsWith("igrp")) {
      objectAddr =  Utils.HashToAddress(object);
    } else if (object.startsWith("0x")) {
      objectAddr = object;
    } else {
      throw new Error(`Invalid object provided: ${object}, require address or id`);
    }

    let elvContract = new ElvContracts({
      configUrl: Config.networks[Config.net],
      debugLogging: argv.verbose
    });

    await elvContract.Init({
      privateKey: process.env.PRIVATE_KEY,
    });

    const res = await elvContract.CleanupObjects({
      objectAddr,
      objectType
    });
    console.log("objects cleaned:", res);
  } catch (e) {
    console.error("ERROR:", argv.verbose ? e : e.message);
  }
};

const CmdListObjects = async ({ argv }) => {
  console.log("Parameters:");
  console.log("object", argv.object);

  try {
    const object = argv.object;
    let objectAddr;
    if (object.startsWith("iusr") || object.startsWith("igrp")) {
      objectAddr =  Utils.HashToAddress(object);
    } else if (object.startsWith("0x")) {
      // can be user address or contract address
      objectAddr = object;
    } else {
      throw new Error(`Invalid object provided: ${object}, require address or id (user/group id)`);
    }

    let elvContract = new ElvContracts({
      configUrl: Config.networks[Config.net],
      debugLogging: argv.verbose
    });
    await elvContract.Init({
      privateKey: process.env.PRIVATE_KEY,
    });

    const res = await elvContract.ListContentObjects({
      objectAddr
    });
    console.log(yaml.dump(res));
  } catch (e) {
    console.error("ERROR:", argv.verbose ? e : e.message);
  }
};

const CmdFabricGetMetaBatch = async ({ argv }) => {
  try {
    let elvFabric = new ElvFabric({
      configUrl: Config.networks[Config.net],
      debugLogging: argv.verbose
    });

    await elvFabric.Init({
      privateKey: process.env.PRIVATE_KEY,
    });

    let res = await elvFabric.GetMetaBatch({
      csvFile: argv.csv_file,
      libraryId: argv.library,
      limit: argv.limit
    });

    console.log(res); // CSV output
  } catch (e) {
    console.error("ERROR:", e);
  }
};

const CmdFabricSetMetaBatch = async ({ argv }) => {
  console.log("Set Meta Batch", "duplicate", argv.duplicate);

  try {
    let elvFabric = new ElvFabric({
      configUrl: Config.networks[Config.net],
      debugLogging: argv.verbose
    });

    await elvFabric.Init({
      privateKey: process.env.PRIVATE_KEY,
      update: true
    });

    let res = await elvFabric.SetMetaBatch({
      csvFile: argv.csv_file,
      duplicate: argv.duplicate
    });

    console.log(yaml.dump(res));
  } catch (e) {
    console.error("ERROR:", e);
  }
};

module.exports = {
  CmdSetTenantContractId,
  CmdGetTenantInfo,
  CmdSetObjectGroupPermission,
  CmdDeleteVersionsBatch,
  CmdDeleteContentsBatch,
  CmdCleanupObject,
  CmdListObjects,
  CmdFabricGetMetaBatch,
  CmdFabricSetMetaBatch
};
