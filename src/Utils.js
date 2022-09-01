const fs = require("fs");
const { parse } = require("csv-parse");
const path = require("path");
const keccak256 = require("keccak256");
const UUID = require("uuid");
const dot = require("dot-object");
const Utils = require("@eluvio/elv-client-js/src/Utils.js");

class ElvUtils {
  static async DeployContractFile({ client, fileName, args = [] }) {
    const tenantAbi = fs.readFileSync(
      path.resolve(__dirname, `../contracts/v3/${fileName}.abi`)
    );
    const tenantBytecode = fs.readFileSync(
      path.resolve(__dirname, `../contracts/v3/${fileName}.bin`)
    );

    var contract = await client.DeployContract({
      abi: JSON.parse(tenantAbi),
      bytecode: tenantBytecode.toString("utf8").replace("\n", ""),
      constructorArgs: args,
    });
    return {
      address: contract.contractAddress,
      abi: tenantAbi,
    };
  }

  static GetFunc4Bytes(funcSig) {
    var id = keccak256(funcSig).subarray(0, 4);
    return id;
  }

  static AddressToId({prefix, address}){
    return prefix + Utils.AddressToHash(address);
  }

  static async epochToDate(epoch){
    let response = await fetch("https://showcase.api.linx.twenty57.net/UnixTime/fromunix?timestamp=" + epoch);
    let data = await response.json();
    return data;
  }

  static async dateToEpoch(date){
    let response = await fetch("https://showcase.api.linx.twenty57.net/UnixTime/tounix?date=" + date);
    let data = await response.json();
    return data;
  }

  static UUID() {
    return Utils.B58(UUID.parse(UUID.v4()));
  }

  /**
   * Read a CSV file and parse into a JSON object
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
  static async ReadCsvObjects({csvFile}) {
    let ids = {};

    const csv = fs.readFileSync(csvFile);
    const records = parse(csv, {columns: true,
      skip_records_with_empty_values: true});

    await records.forEach(row => {
      const id = row.id;
      delete row.id;
      delete row.hash;

      // Apply substitutions
      let rowProcessed = {};
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

  /**
   * Create a CSV row with the specified fields with values from the metadata
   *
   * @param {array} fields Array of fields in dot notation eg. ["public.name","public.nfts[0]"]
   * @param {object} full object metadata JOSN
   * @returns string A CSV row
   */
  static async MakeCsv({fields, meta}) {
    let row = "";
    fields.forEach( (field, idx) => {
      let v = dot.pick(field, meta);
      if (v instanceof(Object)) {
        v = JSON.stringify(v);
      }

      if (v && typeof v == "string" && v.includes(",")){
        v = `"${v}"`;
      }
      row = (idx > 0 ? row + "," : "") + v;
    });
    return row;
  }

}


exports.ElvUtils = ElvUtils;
