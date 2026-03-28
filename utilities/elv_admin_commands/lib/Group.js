const { ElvAccount } = require("../../../src/ElvAccount");
const { Config } = require("../../../src/Config");
const yaml = require("js-yaml");
const { ElvFabric } = require("../../../src/ElvFabric");

const CmdGroupCreate = async ({ argv }) => {
  console.log("Group Create\n");
  console.log(`name: ${argv.name}`);

  try {
    let elvAccount = new ElvAccount({
      configUrl: Config.networks[Config.net],
      debugLogging: argv.verbose
    });

    await elvAccount.Init({
      privateKey: process.env.PRIVATE_KEY,
    });

    let res = await elvAccount.CreateAccessGroup({
      name: argv.name,
    });
    console.log(yaml.dump(res));
  } catch (e) {
    console.error("ERROR:", e);
  }
};

const CmdGroupAdd = async ({ argv }) => {
  console.log("Group Add\n");
  console.log(`Group address: ${argv.group_address}`);
  console.log(`Account address: ${argv.account_address}`);
  console.log(`Is Manager?: ${argv.is_manager}`);

  try {
    let elvAccount = new ElvAccount({
      configUrl: Config.networks[Config.net],
      debugLogging: argv.verbose
    });

    await elvAccount.Init({
      privateKey: process.env.PRIVATE_KEY,
    });

    let res = await elvAccount.AddToAccessGroup({
      groupAddress: argv.group_address,
      accountAddress: argv.account_address,
      isManager: argv.is_manager,
    });
    console.log(yaml.dump(res));
  } catch (e) {
    console.error("ERROR:", e);
  }
};

const CmdGroupRemove = async ({ argv }) => {
  console.log("Group Remove\n");
  console.log(`Group address: ${argv.group_address}`);
  console.log(`Account address: ${argv.account_address}`);
  console.log(`Is Manager?: ${argv.is_manager}`);

  try {
    let elvAccount = new ElvAccount({
      configUrl: Config.networks[Config.net],
      debugLogging: argv.verbose
    });

    await elvAccount.Init({
      privateKey: process.env.PRIVATE_KEY,
    });

    let res = await elvAccount.RemoveFromAccessGroup({
      groupAddress: argv.group_address,
      accountAddress: argv.account_address,
      isManager: argv.is_manager,
    });
    console.log(yaml.dump(res));
  } catch (e) {
    console.error("ERROR:", e);
  }

};

const CmdAccessGroupMember = async ({ argv }) => {
  console.log("AccessGroupMember",
    `group: ${argv.group}`,
    `addr: ${argv.addr}`);

  try {
    let elvFabric = new ElvFabric({
      configUrl: Config.networks[Config.net],
      debugLogging: argv.verbose
    });

    await elvFabric.Init({
      privateKey: process.env.PRIVATE_KEY
    });

    let res = await elvFabric.AccessGroupMember({
      group: argv.group,
      addr: argv.addr
    });

    console.log(yaml.dump(res));
  } catch (e) {
    console.error("ERROR:", e);
  }
};

const CmdAccessGroupMembers = async ({ argv }) => {
  console.log("AccessGroupMembers",
    `group: ${argv.group}`);

  try {
    let elvFabric = new ElvFabric({
      configUrl: Config.networks[Config.net],
      debugLogging: argv.verbose
    });

    await elvFabric.Init({
      privateKey: process.env.PRIVATE_KEY
    });

    let res = await elvFabric.AccessGroupMembers({
      group: argv.group
    });

    console.log(yaml.dump(res));
  } catch (e) {
    console.error("ERROR:", e);
  }
};

module.exports = {
  CmdGroupCreate,
  CmdGroupAdd,
  CmdGroupRemove,
  CmdAccessGroupMember,
  CmdAccessGroupMembers,
};