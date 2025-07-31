const {Pool} = require("pg");
const {ElvUtils} = require("./Utils");

class ElvIndexer {

  constructor({
    pgUser,
    pgHost,
    pgDatabase,
    pgPassword,
    pgPort,
    debugLogging = false,
    maxConnections = 10,
    idleTimeoutMillis = 30000,
    connectionTimeoutMillis = 2000,
    statementTimeout = 30000
  }){

    this.pool = new Pool({
      user: pgUser,
      host: pgHost,
      database: pgDatabase,
      password: pgPassword,
      port: pgPort,
      max: maxConnections,
      idleTimeoutMillis: idleTimeoutMillis,
      connectionTimeoutMillis: connectionTimeoutMillis,
      statement_timeout: statementTimeout,
    });

    this.debug = debugLogging;

    this.pool.on("error", (err) => {
      console.error("Unexpected error on idle client", err);
    });
  }

  async start(){
    try {
      const client = await this.pool.connect();
      client.release();
      if (this.debug) {
        console.log("Database pool initialized successfully");
        console.log(`Pool config: max=${this.pool.options.max}, idle=${this.pool.options.idleTimeoutMillis}ms`);
      }
    } catch (err) {
      console.error("Failed to initialize database pool:", err);
      throw err;
    }
  }

  async runQuery({query, params}) {
    try {
      if (this.debug) {
        console.log(`Executing query: ${query}`, params);
      }
      const res = await this.pool.query(query, params);
      return res.rows;
    } catch (err) {
      console.error(`Error querying indexer:
query : ${query},
params: ${params},
error: ${err}`);
      throw err;
    }
  }

  async checkLibraryTenant({libraryId, libraryAddress}){
    if (!libraryId && !libraryAddress) {
      throw Error("Library ID/addr not specified");
    }

    if (libraryAddress){
      libraryId = ElvUtils.AddressToId({prefix:"ilib", libraryAddress});
    } else {
      if (!libraryId.toString().startsWith("ilib")){
        libraryId = "ilib" + libraryId.slice(4);
      }
    }

    const res = await this.runQuery({
      query: "SELECT tenant_id FROM libraries WHERE id=$1;",
      params: [libraryId]
    });
    return res.length > 0 ? res[0].tenant_id:null;
  }

  async checkGroupTenant({groupId, groupAddress}){
    if (!groupId && !groupAddress) {
      throw new Error("Group ID/addr not specified");
    }

    if (groupAddress){
      groupId = ElvUtils.AddressToId({prefix:"igrp", address: groupAddress});
    } else {
      if (!groupId.toString().startsWith("igrp")){
        groupId = "igrp" + groupId;
      }
    }

    const res = await this.runQuery({
      query: "SELECT tenant_id FROM user_groups WHERE id=$1;",
      params: [groupId]
    });
    return res.length > 0 ? res[0].tenant_id:null;
  }

  async checkUserTenant({userId, userAddress}){
    if (!userId && !userAddress) {
      throw new Error("User ID/addr not specified");
    }

    if (userAddress){
      userId = ElvUtils.AddressToId({prefix:"iusr", address: userAddress});
    } else {
      if (!userId.toString().startsWith("iusr")){
        userId = "iusr" + userId;
      }
    }

    const res = await this.runQuery({
      query: "SELECT c.tenant_id FROM user_wallets as uw JOIN contents as c ON uw.id=c.id WHERE uw.user_id=$1;",
      params: [userId]
    });
    return res.length > 0? res[0].tenant_id:null;
  }

  async checkObjectTenant({objectId, objectAddress}){
    if (!objectId && !objectAddress) {
      throw new Error("Object ID/addr not specified");
    }

    if (objectAddress){
      objectId = ElvUtils.AddressToId({prefix:"iq__", address: objectAddress});
    } else {
      if (!objectId.toString().startsWith("iq__")){
        objectId = "iq__" + objectId;
      }
    }

    const res = await this.runQuery({
      query: "SELECT tenant_id FROM contents WHERE id=$1;",
      params: [objectId]
    });
    return res.length > 0 ? res[0].tenant_id:null;
  }

  async stop(){
    if (this.debug) {
      console.log("Closing database pool...");
    }
    await this.pool.end();
  }
}

exports.ElvIndexer = ElvIndexer;