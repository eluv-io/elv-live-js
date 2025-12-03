const { Config } = require("../../../src/Config");
const { EluvioLive } = require("../../../src/EluvioLive");
const { Marketplace } = require("../../../src/Marketplace");

let elvlv;
let marketplace;

const Init = async ({debugLogging = false, asUrl}={}) => {
  const config = {
    configUrl: Config.networks[Config.net],
    mainObjectId: Config.mainObjects[Config.net],
  };

  elvlv = new EluvioLive(config);
  await elvlv.Init({ debugLogging, asUrl });

  marketplace = new Marketplace(config);
  await marketplace.Init({ debugLogging, asUrl });
};

module.exports = {
  Init,
  elvlv: () => elvlv,
  marketplace: () => marketplace,
};