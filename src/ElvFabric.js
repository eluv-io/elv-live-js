const { ElvClient } = require("@eluvio/elv-client-js");
const { ElvUtils } = require("./Utils");
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

  async Init({ privateKey }) {
    this.client = await ElvClient.FromConfigurationUrl({
      configUrl: this.configUrl,
    });
    let wallet = this.client.GenerateWallet();
    let signer = wallet.AddAccount({
      privateKey,
    });
    this.client.SetSigner({ signer });
    this.client.ToggleLogging(this.debug);
  }

  /**
   * Read list of ids and metadata fields from a CSV file
   * Format:
   *   - id (content ID in `iq__` format)
   *   - all subsequent columns are metadata fields in dotted JSON format
   *     (for example: public.name, public.asset_metadata.title)
   *
   * Substitutions:
   *   - ${UUID} - 16 byte UUID in base 58 format
   *
   * @param {string} csvFile
   */
  async readCsv({ csvFile }) {

    let hdr = true;
    let fields = [];
    let ids = {};

    const csv = fs.readFileSync(csvFile);
    const records = parse(csv, {columns: false});
    await records.forEach(row => {
      if (hdr) {
        row.forEach(elem => {
          // First field is the 'id' (not a real field)
          fields.push(elem);
        });
        hdr = false;
      } else {
        let id;
        row.forEach((elem, idx) => {
          if (idx == 0) {
            id = elem;
            ids[id] = {};
          } else {
            const field = fields[idx];

            // Construct the JSON path from the dot notation of the field
            // For example for public.asset_metadata.title we need to set
            // {"public" : {"asset_metadata": {"title": "value"}}}
            let f = ids[id];
            let a = field.split(".");
            a.forEach((pathElem, idx) => {
              if (idx < a.length - 1) {
                if (!f[pathElem]) {
                  f[pathElem] = {};
                }
                f = f[pathElem];
              } else {
                // Apply substitutions
                switch (elem) {
                  case "${UUID}":
                    elem = ElvUtils.UUID();
                    break;
                }

                f[pathElem] = elem;
              }
            });
          }
        });
      }
    });
    return ids;
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
    console.log("setMeta", objectId, "meta", JSON.stringify(meta));

    const libraryId = await this.client.ContentObjectLibraryId({objectId});
    const editResponse = await this.client.EditContentObject({
      libraryId,
      objectId
    });

    await this.client.MergeMetadata({
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

    let ids = await this.readCsv({csvFile});

    let res;
    if (!duplicate) {
      res = await this.setMetaBatch({ids});
    } else {
      res = await this.copyObjectBatch({ids});
    }
    return res;
  }

}

exports.ElvFabric = ElvFabric;
