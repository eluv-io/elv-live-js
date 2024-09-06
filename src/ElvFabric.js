const { ElvClient } = require("@eluvio/elv-client-js");
const { ElvUtils } = require("./Utils");
const dot = require("dot-object");
const fs = require("fs");
const { parse } = require("csv-parse");
const path = require("path");
const Ethers = require("ethers");

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
   * @param {boolean} merge Merge == true will merge instead of replace
   */
  async setMeta({objectId, meta, merge=false}) {
    if (this.debug){
      console.log("Set Meta", objectId, "meta", JSON.stringify(meta));
    }

    const libraryId = await this.client.ContentObjectLibraryId({objectId});

    if (this.debug){
      console.log("Library ID Found ", libraryId);
    }

    const editResponse = await this.client.EditContentObject({
      libraryId,
      objectId
    });

    if (!merge) {
      await this.client.ReplaceMetadata({
        libraryId,
        objectId,
        writeToken: editResponse.write_token,
        metadata: meta,
        metadataSubtree: "/"
      });
    } else {
      await this.client.MergeMetadata({
        libraryId,
        objectId,
        writeToken: editResponse.write_token,
        metadata: meta,
        metadataSubtree: "/"
      });
    }

    await this.client.FinalizeContentObject({
      libraryId,
      objectId,
      writeToken: editResponse.write_token
    });
  }

  /**
   * Get content metadata for an object
   * @param {string} objectId
   */
  async getMeta({objectId, select, includeHash=false}) {

    const libraryId = await this.client.ContentObjectLibraryId({objectId});
    const meta = await this.client.ContentObjectMetadata({
      libraryId,
      objectId,
      select
    });

    if (includeHash){
      meta["hash"] = await this.client.LatestVersionHash({
        objectId
      });
    }
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

    let ignore = ["eluv."];
    let ids = await this.ReadCsvObjectsMerged({csvFile,ignore});

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
      let row = "";
      try {
        const meta = await this.getMeta({objectId: id, includeHash:true});

        row = await ElvUtils.MakeCsv({fields, meta});
      } catch (error) {
        row = "ERROR: " + error.message;
      }
      row = id + "," + row;
      csvOut = csvOut + row + "\n";
    }
    return csvOut;
  }

  /**
   * Read a CSV file and parse into a JSON object merging with the object's existing fabric metadata.
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
   * @param {Array} ignore a list of prefixes to ignore eg "eluv."
   * @returns object Map of object IDs to metadata
   */
  async ReadCsvObjectsMerged({csvFile, ignore=[]}) {
    let ids = {};

    const csv = fs.readFileSync(csvFile);
    const records = parse(csv, {columns: true,
      skip_records_with_empty_values: true});

    await records.forEach(async row => {
      const id = row.id;
      delete row.id;
      delete row.hash;

      // Apply substitutions
      let rowProcessed = await this.getMeta({objectId: id});

      //Remove ignore keys and save [key,val] in a list for later
      let ignoredList = {};

      for (const [key,val] of Object.entries(rowProcessed)) {
        for (const item of ignore){
          if (!key || key.startsWith(item)){
            ignoredList[key] = val;
            delete rowProcessed[key];
          }
        }
      }

      console.log("ignored: ", ignoredList);

      for (const [key,val] of Object.entries(row)) {
        switch (val) {
          case "${UUID}":
            rowProcessed[key] = ElvUtils.UUID();
            break;
          case "":
            rowProcessed[key] = null;
            break;
          default:
            rowProcessed[key] = val;
        }
      }

      let meta = dot.object(rowProcessed);
      //Add back ignored list
      meta = {...meta,...ignoredList};

      ids[id] = meta;
    });

    return ids;
  }

  /**
   * GetContractMeta
   * @param {string} address  contract address
   * @param {string} key  metadata key
   * @returns value stored in the contract metadata
   */
  async GetContractMeta({address, key}) {
    const abi = fs.readFileSync(
      path.resolve(__dirname, "../contracts/v3/BaseContent.abi")
    );

    if (address.startsWith("iq")){
      address = this.client.utils.HashToAddress(address);
    }

    if (this.debug){
      console.log("Address", address);
    }

    var res = await this.client.CallContractMethod({
      contractAddress: address,
      abi: JSON.parse(abi),
      methodName: "getMeta",
      methodArgs: [key],
      formatArguments: true,
    });

    if (this.debug){
      console.log("Raw response: ", res);
    }

    return Ethers.utils.toUtf8String(res);
  }

  /**
   * SetContractMeta
   * @param {string} address  contract address
   * @param {string} key  metadata key
   * @returns result of contract method call
   */
  async SetContractMeta({address, key, value}) {
    const abi = fs.readFileSync(
      path.resolve(__dirname, "../contracts/v3/BaseContent.abi")
    );

    if (address.startsWith("iq")){
      address = this.client.utils.HashToAddress(address);
    }

    if (this.debug){
      console.log("Address", address);
    }

    var res = await this.client.CallContractMethodAndWait({
      contractAddress: address,
      abi: JSON.parse(abi),
      methodName: "putMeta",
      methodArgs: [key, value],
      formatArguments: true,
    });

    return res;
  }

  /**
   * AccessGroupMemeber
   * Check if an address is a member of the access group
   * @param {string} group  Group ID (hex or igrp format)
   * @param {string} addr  User address
   * @returns result of contract method call
   */
  async AccessGroupMember({group, addr}) {
    var members = await this.AccessGroupMembers({group});

    for (let i = 0; i < members.length; i++) {
      if (this.client.utils.EqualAddress(members[i], addr)){
        return true;
      }
    }
    return false;
  }

  /**
   * AccessGroupMembers
   * Returns a list of group members
   * @param {string} group  Group ID (hex or igrp format)
   * @returns {Array} group members
   */
  async AccessGroupMembers({group}) {

    if (group.startsWith("igrp")){
      group = this.client.utils.HashToAddress(group);
    }

    if (this.debug){
      console.log("Group", group);
    }

    return await this.client.AccessGroupMembers({contractAddress:group});
  }

  /**
   * AccessGroupManager
   * Check if an address is a manager of the access group
   * @param {string} group  Group ID (hex or igrp format)
   * @param {string} addr  User address
   * @returns result of contract method call
   */
  async AccessGroupManager({group, addr}) {
    var managers = await this.AccessGroupManagers({group});
    for (let i = 0; i < managers.length; i++) {
      if (this.client.utils.EqualAddress(managers[i], addr)){
        return true;
      }
    }
    return false;
  }

  /**
   * AccessGroupManagers
   * Returns a list of group managers
   * @param {string} group  Group ID (hex or igrp format)
   * @returns {Array} group members
   */
  async AccessGroupManagers({group}) {

    if (group.startsWith("igrp")){
      group = this.client.utils.HashToAddress(group);
    }

    if (this.debug){
      console.log("Group", group);
    }
    return await this.client.AccessGroupManagers({contractAddress:group});
  }


}


exports.ElvFabric = ElvFabric;
