const { Init, elvlv } = require("./Init");
const yaml = require("js-yaml");

const CmdSiteShow = async ({ argv }) => {
  console.log("Site - show", argv.object);
  try {
    await Init({ debugLogging: argv.verbose, asUrl: argv.as_url });

    let res = await elvlv.SiteShow({
      libraryId: argv.library,
      objectId: argv.object,
    });

    console.log(yaml.dump(res));
  } catch (e) {
    console.error("ERROR:", e);
  }
};

const CmdSiteSetDrop = async ({ argv }) => {
  console.log("Site - set drop", argv.object, argv.uuid, "update", argv.update);

  try {
    await Init({ debugLogging: argv.verbose, asUrl: argv.as_url });

    let res = await elvlv.SiteSetDrop({
      libraryId: argv.library,
      objectId: argv.object,
      uuid: argv.uuid,
      start: argv.start_date,
      end: argv.end_date,
      endVote: argv.end_vote,
      startMint: argv.start_mint,
      newUuid: argv.new_uuid,
      update: argv.update,
    });

    console.log(yaml.dump(res));
  } catch (e) {
    console.error("ERROR:", e);
  }
};

module.exports = {
  CmdSiteShow,
  CmdSiteSetDrop,
};