const { Init, elvlv } = require("./Init");
const { ElvToken } = require("../../../src/ElvToken");
const { Config } = require("../../../src/Config");
const yaml = require("js-yaml");

const CmdTokenCreate = async ({ argv }) => {
  console.log("Deploy ElvToken contract");
  try {
    let elvToken = new ElvToken({
      configUrl: Config.networks[Config.net],
      debugLogging: argv.verbose
    });

    await elvToken.Init({
      privateKey: process.env.PRIVATE_KEY,
    });

    res = await elvToken.ElvTokenDeploy({
      name: argv.name,
      symbol: argv.symbol,
      decimals: argv.decimals,
      amount: argv.amount,
    });

    console.log(yaml.dump(res));
  } catch (e) {
    console.error("ERROR:", e);
  }
};

const CmdTokenTransfer = async ({ argv }) => {
  console.log(`token transfer, 
    token_addr=${argv.token_addr}
    to_addr=${argv.to_addr}
    amount=${argv.amount}`);

  try {
    let elvToken = new ElvToken({
      configUrl: Config.networks[Config.net],
      debugLogging: argv.verbose
    });

    await elvToken.Init({
      privateKey: process.env.PRIVATE_KEY,
    });

    let res;
    res = await elvToken.ElvTokenTransfer({
      tokenAddr: argv.token_addr,
      toAddr: argv.to_addr,
      amount: argv.amount,
    });
    var status = await res.status;
    if (status === 1){
      console.log("status: transfer successful");
    } else {
      console.log("status: transfer failed");
    }
  } catch (e) {
    console.error("ERROR:", e);
  }
};

const CmdTokenBalanceOf = async ({ argv }) => {

  console.log(`token_addr: ${argv.token_addr}`);
  console.log(`user_addr: ${argv.user_addr}`);

  try {
    let elvToken = new ElvToken({
      configUrl: Config.networks[Config.net],
      debugLogging: argv.verbose
    });

    await elvToken.Init({
      privateKey: process.env.PRIVATE_KEY,
    });

    let res;
    res = await elvToken.ElvTokenBalance({
      tokenAddr: argv.token_addr,
      userAddr : argv.user_addr,
    });
    console.log("token_balance:",yaml.dump(await res));
  } catch (e) {
    console.error("ERROR:", e);
  }
};

const CmdTokenAddMinter = async ({ argv }) => {
  try {
    await Init({ debugLogging: argv.verbose, asUrl: argv.as_url });

    res = await elvlv.AddMinter({
      addr: argv.addr,
      minterAddr: argv.minter,
    });
    console.log(yaml.dump(res));
  } catch (e) {
    console.error("ERROR:", e);
  }
};

const CmdTokenRenounceMinter= async ({ argv }) => {
  try {
    await Init({ debugLogging: argv.verbose, asUrl: argv.as_url });

    res = await elvlv.RenounceMinter({
      addr: argv.addr,
    });
    console.log(yaml.dump(res));
  } catch (e) {
    console.error("ERROR:", e);
  }
};

const CmdTokenIsMinter= async ({ argv }) => {
  try {
    await Init({ debugLogging: argv.verbose, asUrl: argv.as_url });

    res = await elvlv.IsMinter({
      addr: argv.addr,
      minterAddr: argv.minter,
    });
    console.log(yaml.dump(res));
  } catch (e) {
    console.error("ERROR:", e);
  }
};

module.exports = {
  CmdTokenCreate,
  CmdTokenTransfer,
  CmdTokenBalanceOf,
  CmdTokenAddMinter,
  CmdTokenRenounceMinter,
  CmdTokenIsMinter,
};