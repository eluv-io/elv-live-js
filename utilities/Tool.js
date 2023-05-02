const { EluvioLive } = require("../src/EluvioLive.js");
const { ElvUtils } = require("../src/Utils");
const Utils = require("@eluvio/elv-client-js/src/Utils.js");
const { InitializeTenant, AddConsumerGroup } = require("../src/Provision");
const { Config } = require("../src/Config.js");
const { Marketplace } = require("../src/Marketplace");
const { ElvToken } = require ("../src/ElvToken.js");
const { ElvContracts } = require ("../src/ElvContracts.js");

const { parse } = require("csv-parse");

const yaml = require("js-yaml");
const fs = require("fs");
const path = require("path");
const prompt = require("prompt-sync")({ sigint: true });

let elvlv;
let marketplace;

const Init = async ({debugLogging = false}={}) => {
  console.log("Network: " + Config.net);

  const config = {
    configUrl: Config.networks[Config.net],
    mainObjectId: Config.mainObjects[Config.net],
  };
  elvlv = new EluvioLive(config);
  await elvlv.Init({ debugLogging });

  marketplace = new Marketplace(config);
  await marketplace.Init({ debugLogging });
};


const DoSomething = async () => {

  const imgUrl = "https://main.net955305.contentfabric.io/s/main/q/hq__MEVmc7JjRnWuPX26o6NVbZ9QM8qwjvAUrMS6TTPGfnpyy5GYcZtMJsEgVEuxnfPefyp1pVeRcs/files/ETU-Vote-NFT-v2-f.jpg";

  try {
    let elvToken = new ElvToken({
      configUrl: Config.networks[Config.net],
      debugLogging: false
    });

    let m = await ElvUtils.ReadCsvObjects({csvFile: "x.csv"});
    //console.log(JSON.stringify(m[Object.keys(m)[0]], null, 2));

    let count = 0;
    for (let k in m) {
      let n = {}
      let votes = parseInt(m[k].votes, 10);
      n.count = votes + 3 + (votes > 14 ? 1 : 0);
      n.name = m[k]["new public"].asset_metadata.nft.name;
      n.display_name = n.name;
      n.rich_text = m[k]["new public"].asset_metadata.nft.description_rich_text;
      n.embed_url = m[k]["public"].asset_metadata.nft.embed_url;
      n.image = imgUrl;

      //console.log(n);
      fs.writeFileSync(path.join("/Users/serban/ELV/TNT/TMP/ETU", k + ".json"), JSON.stringify(n));
    }
    console.log("count", count);

  } catch (e) {
    console.error("ERROR:", e);
  }
}
