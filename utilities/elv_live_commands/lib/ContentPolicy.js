const { Init, elvlv } = require("./Init");
const yaml = require("js-yaml");
const { ElvUtils } = require("../../../src/Utils");

const CmdContentSetPolicy  = async ({ argv }) => {
  console.log("Content Set Policy");
  console.log(`Object: ${argv.object}`);
  console.log(`Policy Path: ${argv.policy_path}`);
  console.log(`Data: ${argv.data}`);

  try {
    await Init({ debugLogging: argv.verbose, asUrl: argv.as_url });

    res = await elvlv.ContentSetPolicy({
      objectId: argv.object,
      policyPath: argv.policy_path,
      data: argv.data
    });

    if (ElvUtils.isTransactionSuccess(res)){
      console.log("Success!");
    } else {
      console.log("Transaction Error: ", yaml.dump(res));
    }

  } catch (e) {
    console.error("ERROR:", e);
  }
};

const CmdContentSetPolicyDelegate  = async ({ argv }) => {
  console.log("Content Set Policy Delegate");
  console.log(`Object: ${argv.object}`);
  console.log(`Policy Path: ${argv.delegate}`);
  console.log(`Data: ${argv.data}`);

  try {
    await Init({ debugLogging: argv.verbose, asUrl: argv.as_url });

    res = await elvlv.ContentSetPolicyDelegate({
      objectId: argv.object,
      delegateId: argv.delegate
    });

    if (ElvUtils.isTransactionSuccess(res)){
      console.log("Success!");
    } else {
      console.log("Transaction Error: ", yaml.dump(res));
    }
  } catch (e) {
    console.error("ERROR:", e);
  }
};

const CmdContentGetPolicy  = async ({ argv }) => {
  console.log("Content Get Policy");
  console.log(`Object: ${argv.object}`);

  try {
    await Init({ debugLogging: argv.verbose, asUrl: argv.as_url });

    res = await elvlv.ContentGetPolicy({
      objectId: argv.object
    });

    console.log("\n" + yaml.dump(res));
  } catch (e) {
    console.error("ERROR:", e);
  }
};

const CmdContentClearPolicy = async ({ argv }) => {
  console.log("Content Clear Policy");
  console.log(`Object: ${argv.object}`);

  try {
    await Init({ debugLogging: argv.verbose, asUrl: argv.as_url });

    res = await elvlv.ContentClearPolicy({
      objectId: argv.object
    });

    if (ElvUtils.isTransactionSuccess(res)){
      console.log("Success!");
    } else {
      console.log("Transaction Error: ", yaml.dump(res));
    }
  } catch (e) {
    console.error("ERROR:", e);
  }
};

module.exports = {
  CmdContentGetPolicy,
  CmdContentSetPolicy,
  CmdContentSetPolicyDelegate,
  CmdContentClearPolicy,
};