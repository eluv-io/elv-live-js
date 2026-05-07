const axios = require("axios");
const fs = require("fs");
const path = require("path");
const { ElvClient } = require("@eluvio/elv-client-js");

class ElvIssuer {

  constructor({configUrl, debugLogging = false}) {
    this.configUrl = configUrl;
    this.debug = debugLogging;
  }

  async Init() {
    this.client = await ElvClient.FromConfigurationUrl({
      configUrl: this.configUrl,
    });
    this.client.ToggleLogging(this.debug);
  }

  async fetchAllOktaUsersAndGroups({client, url}) {
    let results = [];
    let nextUrl = url;

    while (nextUrl) {
      console.log("Fetching:", nextUrl);

      const res = await client.get(nextUrl);

      results = results.concat(res.data);

      // Parse Link header for pagination
      const linkHeader = res.headers?.link;

      if (linkHeader) {
        const match = linkHeader.match(/<([^>]+)>;\s*rel="next"/);
        nextUrl = match ? match[1] : null;
      } else {
        nextUrl = null;
      }
    }

    return results;
  }

  formatUsers(users) {
    const formatted = {};

    users.forEach(user => {
      formatted[user.id] = {
        type: "oauthUser",
        address: user.id,
        name: `${user.profile.firstName || ""} ${user.profile.lastName || ""} (${user.profile.email || ""})`.trim()
      };
    });
    return formatted;
  }

  formatGroups(groups) {
    const formatted = {};

    groups.forEach(group => {
      formatted[group.id] = {
        type: "oauthGroup",
        address: group.id,
        name: group.profile.name || group.id,
        description: group.profile.description || ""
      };
    });
    return formatted;
  }

  async GetOktaGroupsAndUsers({oktaDomain, adminToken, out}) {
    if (!oktaDomain) {
      throw new Error("require okta-domain to be set");
    }
    if (!adminToken) {
      throw new Error("require env ADMIN_TOKEN to be set");
    }

    let filePath;
    if (out) {
      filePath = path.isAbsolute(out)? out : path.join(process.cwd(), out);
    }

    const client = axios.create({
      baseURL: oktaDomain,
      headers: {
        Authorization: `SSWS ${adminToken}`,
        Accept: "application/json"
      }
    });

    const oktaUsers = await this.fetchAllOktaUsersAndGroups({client, url:"/api/v1/users"});
    const users = this.formatUsers(oktaUsers);

    const oktaGroups = await this.fetchAllOktaUsersAndGroups({client, url:"/api/v1/groups"});
    const groups = this.formatGroups(oktaGroups);

    const res = {users, groups};
    if (filePath) {
      fs.writeFileSync(filePath, JSON.stringify(res, null, 2), "utf-8");
      return `JSON written to: ${filePath}`;
    }
    return res;
  }


  async SyncOktaIssuer({policyId, oktaDomain, adminToken, privateKey, keepExistingPart, userGroupList}) {

    if (!privateKey) {
      throw new Error("require env PRIVATE_KEY to be set");
    }
    if (!policyId) {
      throw new Error("require policyId to be set");
    }

    let wallet = this.client.GenerateWallet();
    let signer = wallet.AddAccount({privateKey: privateKey});
    this.client.SetSigner({signer});

    let oauthInfo;
    if (!userGroupList) {
      oauthInfo = this.GetOktaGroupsAndUsers({oktaDomain, adminToken});
    } else {
      const raw = fs.readFileSync(userGroupList, "utf-8");
      oauthInfo = JSON.parse(raw);

      const userCount = Object.keys(oauthInfo.users || {}).length;
      const groupCount = Object.keys(oauthInfo.groups || {}).length;

      console.log("total users:", userCount);
      console.log("total groups:", groupCount);

      if (userCount === 0 || groupCount === 0) {
        throw new Error(`Invalid oauthInfo: users=${userCount}, groups=${groupCount}. Ensure user_group_list file is populated.`);
      }
    }

    const libraryId = await this.client.ContentObjectLibraryId({objectId: policyId});

    const editResponse = await this.client.EditContentObject({
      libraryId,
      objectId: policyId
    });
    const writeToken = editResponse.write_token;
    console.log("write_token created:", writeToken);

    const existingPart = await this.client.ContentObjectMetadata({
      libraryId,
      objectId: policyId,
      metadataSubtree: "oauth_settings"
    });
    if (existingPart){
      console.log("existing oauth_settings part:", existingPart);
    }

    const partInfo = await this.client.UploadPart({
      libraryId,
      objectId: policyId,
      writeToken,
      encryption: "cgck",
      data: Buffer.from(JSON.stringify(oauthInfo))
    });
    const partHash = partInfo.part.hash;
    console.log("new oauth_settings part:", partHash);

    await this.client.ReplaceMetadata({
      libraryId,
      objectId: policyId,
      writeToken,
      metadataSubtree: "oauth_settings",
      metadata: partHash
    });

    if (existingPart && !keepExistingPart) {
      console.log("Deleting existing OAuth part hash...");
      try {
        await this.client.DeletePart({
          libraryId,
          objectId: policyId,
          writeToken,
          partHash: existingPart
        });
      } catch (e) {
        console.log("Unable to delete existing part", e);
      }
    }

    await this.client.FinalizeContentObject({
      libraryId,
      objectId: policyId,
      writeToken: editResponse.write_token,
      commitMessage: "OAuth sync"
    });

    return "Successfully synced with OAuth";

  }

}

exports.ElvIssuer = ElvIssuer;