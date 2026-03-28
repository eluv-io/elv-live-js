const { Init, elvlv } = require("./Init");
const fs = require("fs");
const path = require("path");
const { Shuffler } = require("../../../src/Shuffler");
const yaml = require("js-yaml");

const CmdShuffle = async ({ argv }) => {
  try {
    let files = [argv.file];
    let isDir = fs.lstatSync(argv.file).isDirectory();
    if (isDir) {
      files = fs.readdirSync(argv.file);
      files.forEach((f, i) => {
        files[i] = path.join(argv.file, f);
      });
    }

    for (let f of files) {
      console.log("\n" + Shuffler.shuffledPath(f) + ":");

      let a = await Shuffler.shuffleFile(f, true, argv.seed, argv.check_dupes);

      if (argv.print_js) {
        console.log(a);
      } else {
        a.forEach((line) => {
          console.log(line);
        });
      }
    }
    console.log("");
  } catch (e) {
    console.error("ERROR:", e);
  }
};

const CmdList = async ({ argv }) => {
  console.log(`list tenant: ${argv.tenant} tenant_slug: ${argv.tenant_slug}`);
  try {
    await Init({ debugLogging: argv.verbose, asUrl: argv.as_url });

    let res = await elvlv.List({
      tenantId: argv.tenant,
      tenantSlug: argv.tenant_slug,
    });

    if (argv.tenant || argv.tenant_slug) {
      let { result, warns } = FilterListTenant({ tenant: res });
      let warnSaved = res.warns || [];
      res = result;
      res.warns = warnSaved.concat(warns);
    } else {
      let keys = Object.keys(res.tenants);
      for (const key of keys) {
        let { result, warns } = FilterListTenant({ tenant: res.tenants[key] });
        res.tenants[key] = result;
        res.warns = res.warns.concat(warns);
      }
    }

    console.log(yaml.dump(res));
  } catch (e) {
    console.error(e);
  }
};

const CmdAdminHealth = async ({ argv }) => {
  console.log("Admin Health");
  console.log(`Host: ${argv.as_url}`);

  try {
    await Init({ debugLogging: argv.verbose, asUrl: argv.as_url });

    res = await elvlv.AdminHealth();

    console.log("\n" + yaml.dump(res));
  } catch (e) {
    console.error("ERROR:", e);
  }
};

const FilterListTenant = ({ tenant }) => {
  let res = {};
  res.result = {};
  res.warns = [];
  let tenantObject = elvlv.FilterTenant({ object: tenant });
  try {
    if (tenantObject.marketplaces) {
      let keys = Object.keys(tenantObject.marketplaces);
      for (const key of keys) {
        let { result, warns } = elvlv.FilterMarketplace({
          object: tenantObject.marketplaces[key],
        });
        let marketplace = result;
        res.warns = res.warns.concat(warns);
        let filteredItems = [];
        for (const item of marketplace.items) {
          let { result, warns } = elvlv.FilterNft({ object: item });
          let filteredItem = result;
          res.warns = res.warns.concat(warns);
          filteredItems.push(filteredItem);
        }
        marketplace.items = filteredItems;
        tenantObject.marketplaces[key] = marketplace;
      }
    }
  } catch (e) {
    res.warns.push(`${tenant.display_title} : ${e}`);
  }

  try {
    if (tenantObject.sites) {
      keys = Object.keys(tenantObject.sites);

      for (const key of keys) {
        let { result, warns } = elvlv.FilterSite({
          object: tenantObject.sites[key],
        });
        let site = result;
        tenantObject.sites[key] = site;
        res.warns = res.warns.concat(warns);
      }
    }
  } catch (e) {
    res.warns.push(`${tenant.display_title} : ${e}`);
  }

  res.result = tenantObject;

  return res;
};

module.exports = {
  CmdShuffle,
  CmdAdminHealth,
  CmdList,
};