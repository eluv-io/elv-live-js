const { ElvClient } = require("@eluvio/elv-client-js");
const { ElvUtils } = require("./Utils");
const dot = require("dot-object");
const fs = require("fs");
const { parse } = require("csv-parse");

/**
 * Tools for operating content on the Content Fabric
 */
class ElvFabric {

  /**
   * Instantiate the ElvFabric Object
   *
   * @namedParams
   * @param {string} configUrl - The Content Fabric configuration URL
   */
  constructor({ configUrl, debugLogging = false }) {
    this.configUrl = configUrl;
    this.debug = debugLogging;
  }

  async Init({ privateKey, update = false,  }) {
    this.client = await ElvClient.FromConfigurationUrl({
      configUrl: this.configUrl,
      noAuth: update ? false : true
    });
    let wallet = this.client.GenerateWallet();
    let signer = wallet.AddAccount({
      privateKey,
    });
    this.client.SetSigner({ signer });
    this.client.ToggleLogging(this.debug);
  }

  /**
   * Set content metadata for a bach of objects.
   * @param {object} ids Map of object IDs to metadata
   */
  async setMetaBatch({ids}) {
    for (const [id, meta] of Object.entries(ids)) {
      this.setMeta({objectId: id, meta});
    }
  }

  /**
   * Set content metadata for an object
   * @param {string} objectId
   * @param {object} meta Metadata tree to merge into the object
   */
  async setMeta({objectId, meta}) {
    console.log("Set Meta", objectId, "meta", JSON.stringify(meta)); // PENDING debug log

    const libraryId = await this.client.ContentObjectLibraryId({objectId});
    const editResponse = await this.client.EditContentObject({
      libraryId,
      objectId
    });

    await this.client.ReplaceMetadata({
      libraryId,
      objectId,
      writeToken: editResponse.write_token,
      metadata: meta,
      metadataSubtree: "/"
    });

    await this.client.FinalizeContentObject({
      libraryId,
      objectId,
      writeToken: editResponse.write_token
    });
  }

  /**
   * Set content metadata for an object
   * @param {string} objectId
   */
  async getMeta({objectId, select}) {

    const libraryId = await this.client.ContentObjectLibraryId({objectId});
    const meta = await this.client.ContentObjectMetadata({
      libraryId,
      objectId,
      select
    });

    meta["hash"] = await this.client.LatestVersionHash({
      objectId
    });
    return meta;
  }

  /**
   * Make a copy of an object and set content metadata on the new object
   * @param {string} objectId
   * @param {object} meta Metadata tree to merge into the object
   */
  async copyObject({objectId, meta}) {

    const libraryId = await this.client.ContentObjectLibraryId({objectId});
    const latestVersionHash = await this.client.LatestVersionHash({
      objectId
    });

    console.log("Copying", objectId, "hash", latestVersionHash); // PENDING debug log
    let res = await this.client.CopyContentObject({
      libraryId,
      originalVersionHash: latestVersionHash,
      options: {
        meta: meta
      }
    });
    return res;
  }

  /**
   * Make a copy of a list of object and set content metadata on the new ones.
   * @param {object} ids Map of object IDs to metadata
   */
  async copyObjectBatch({ids}) {
    let res = {};
    for (const [id, meta] of Object.entries(ids)) {
      let cres = await this.copyObject({objectId: id, meta});
      cres.original_id = id;
      res[cres.id] = cres;
      console.log("Copied", id, "new", cres.id); // PENDING debug log
    }
    return res;
  }

  /**
   * SetMetaBatch
   * @param {string} csvFile  File specifying a list of content IDs and metadata fields
   * @param {boolean} duplicate Clone objects and set metadata on the clone instead
   */
  async SetMetaBatch({csvFile, duplicate}) {

    if (!this.client) {
      throw Error("ElvAccount not intialized");
    }

    let ids = await this.ReadCsvObjects({csvFile});

    console.log("IDS: ", JSON.stringify(ids,0,2));
    let res;
    if (!duplicate) {
      res = await this.setMetaBatch({ids});
    } else {
      res = await this.copyObjectBatch({ids});
    }
    return res;
  }

  /**
   * GetMetaBatch
   * @param {string} csvFile  File specifying a list of content IDs and metadata fields to read. Note that the first two columns has to be id,hash
   */
  async GetMetaBatch({csvFile, libraryId = null, limit = Number.MAX_SAFE_INTEGER}) {

    if (!this.client) {
      throw Error("ElvAccount not intialized");
    }

    let ids = [];
    ids = await ElvUtils.ReadCsvObjects({csvFile});

    if (this.debug){
      console.log("Parsed csv: ", ids);
    }

    // Extract a list of the fields from first object
    let hdr = "id";
    let fields = [];

    if (!libraryId || libraryId.length == 0){
      fields.push("hash");
      for (const [, f] of Object.entries(ids)) {
        const hdrFields = dot.dot(f);

        for (const [field] of Object.entries(hdrFields)) {
          hdr = hdr + "," + field;
          fields.push(field);
        }
        break;
      }
      //Assume we have the hash field.
      //FIXME: See if we an generalize this better so we don't have "fake" fields: id,hash.
    }
    else {
      const csv = fs.readFileSync(csvFile).toString();
      const lines = csv.split("\n");
      fields = lines[0].split(",").map(s=>s.trim());
      hdr = lines[0];
      fields.shift();

      let objects = (await this.client.ContentObjects({libraryId, filterOptions:{limit}}))["contents"].map((obj)=>{
        return obj.id;
      });

      ids = {};
      for (const id of objects){
        ids[id] = {};
      }
    }

    let csvOut = await this.GetMetaByIds({ids, fields});
    return hdr + "\n" + csvOut;
  }

  /**
   * GetMetaByIds
   * @param {[string]} ids  object of id to metadata
   * @param {[string]} fields  array of fields
   */
  async GetMetaByIds({ids,fields}) {

    if (!this.client) {
      throw Error("ElvAccount not intialized");
    }

    if (!ids || ids.length == 0){
      throw Error("No ids given.");
    }

    if (!fields || fields.length == 0){
      throw Error("No fields given.");
    }

    let csvOut = "";
    for (const [id] of Object.entries(ids)) {
      const meta = await this.getMeta({objectId: id});

      let row = await ElvUtils.MakeCsv({fields, meta});
      row = id + "," + row;
      csvOut = csvOut + row + "\n";
    }
    return csvOut;
  }

  /**
   * Read a CSV file and parse into a JSON object merging with the object's existing fabric metadata
   *
   * Applies string substitutions on input:
   *   - ${UUID}
   *
   * CSV file format:
   *   id,field1,field2
   *   iq_1111,value1,value2
   *   iq_2222,value1,value2
   *
   * Output format:
   *   {
   *     "iq_1111" : {
   *       "field1": "value1",
   *       "field2": "value2"
   *     },
   *     "iq_2222" : {
   *       "field1": "value1",
   *       "field2": "value2"
   *     }
   *   }
   *
   * @param {string} csvFile path to CSV file
   * @returns object Map of object IDs to metadata
   */
  async ReadCsvObjectsMerged({csvFile}) {
    let ids = {};

    const csv = fs.readFileSync(csvFile);
    const records = parse(csv, {columns: true});

    await records.forEach(async row => {
      const id = row.id;
      delete row.id;
      delete row.hash;

      // Apply substitutions
      let rowProcessed = await this.getMeta({objectId: id});
      for (const [key,val] of Object.entries(row)) {
        switch (val) {
          case "${UUID}":
            rowProcessed[key] = ElvUtils.UUID();
            break;
          default:
            rowProcessed[key] = val;
        }
      }
      ids[id] = dot.object(rowProcessed);
    });

    return ids;
  }
}

exports.ElvFabric = ElvFabric;
