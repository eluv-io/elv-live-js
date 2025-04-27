/* eslint-disable no-console */
const fs = require("fs");
const path = require("path");
const { ElvUtils } = require("../src/Utils");
const Utils = require("@eluvio/elv-client-js/src/Utils.js");
const { ElvAccount } = require("../src/ElvAccount.js");
const {Config} = require("./Config");
const { EluvioLive } = require("../src/EluvioLive.js");
const { ElvFabric } = require("./ElvFabric");
const { ElvTenant } = require("./ElvTenant");

const TYPE_LIVE_TENANT = "Media Wallet Settings";
const TYPE_LIVE_MARKETPLACE = "Media Wallet Marketplace";
const TYPE_LIVE_ITEM_TEMPLATE = "Item Template";

const liveTypes = [
  { name: TYPE_LIVE_MARKETPLACE, spec: require("@eluvio/elv-client-js/typeSpecs/Marketplace") },
  { name: TYPE_LIVE_TENANT, spec: require("@eluvio/elv-client-js/typeSpecs/EventTenant") },
  { name: TYPE_LIVE_ITEM_TEMPLATE, spec: require("@eluvio/elv-client-js/typeSpecs/NFTTemplate") }
];

const STANDARD_DRM_CERT={
  elv: {
    media: {
      drm: {
        fps: {
          cert: "MIIExzCCA6+gAwIBAgIIHyfkXhxLHC4wDQYJKoZIhvcNAQEFBQAwfzELMAkGA1UEBhMCVVMxEzARBgNVBAoMCkFwcGxlIEluYy4xJjAkBgNVBAsMHUFwcGxlIENlcnRpZmljYXRpb24gQXV0aG9yaXR5MTMwMQYDVQQDDCpBcHBsZSBLZXkgU2VydmljZXMgQ2VydGlmaWNhdGlvbiBBdXRob3JpdHkwHhcNMjAwOTEyMDMzMjI0WhcNMjIwOTEzMDMzMjI0WjBgMQswCQYDVQQGEwJVUzETMBEGA1UECgwKRWx1dmlvIEluYzETMBEGA1UECwwKMktIOEtDM01NWDEnMCUGA1UEAwweRmFpclBsYXkgU3RyZWFtaW5nOiBFbHV2aW8gSW5jMIGfMA0GCSqGSIb3DQEBAQUAA4GNADCBiQKBgQDslbBURB6gj07g7VrS7Ojixe7FNZOupomcZt+mtMvyavjg7X7/T4RccmKUQxOoMLKCJcQ6WrdHhIpN8+bciq7lr0mNzaN467zREiUNYOpkVPi13sJLieY2m2MEPOQTbIl52Cu1YyH+4/g1dKPmeguSnzZRo36jsCGHlJBjHq0jkQIDAQABo4IB6DCCAeQwDAYDVR0TAQH/BAIwADAfBgNVHSMEGDAWgBRj5EdUy4VxWUYsg6zMRDFkZwMsvjCB4gYDVR0gBIHaMIHXMIHUBgkqhkiG92NkBQEwgcYwgcMGCCsGAQUFBwICMIG2DIGzUmVsaWFuY2Ugb24gdGhpcyBjZXJ0aWZpY2F0ZSBieSBhbnkgcGFydHkgYXNzdW1lcyBhY2NlcHRhbmNlIG9mIHRoZSB0aGVuIGFwcGxpY2FibGUgc3RhbmRhcmQgdGVybXMgYW5kIGNvbmRpdGlvbnMgb2YgdXNlLCBjZXJ0aWZpY2F0ZSBwb2xpY3kgYW5kIGNlcnRpZmljYXRpb24gcHJhY3RpY2Ugc3RhdGVtZW50cy4wNQYDVR0fBC4wLDAqoCigJoYkaHR0cDovL2NybC5hcHBsZS5jb20va2V5c2VydmljZXMuY3JsMB0GA1UdDgQWBBR4jerseBHEUDC7mU+NQuIzZqHRFDAOBgNVHQ8BAf8EBAMCBSAwOAYLKoZIhvdjZAYNAQMBAf8EJgFuNnNkbHQ2OXFuc3l6eXp5bWFzdmdudGthbWd2bGE1Y212YzdpMC4GCyqGSIb3Y2QGDQEEAQH/BBwBd252bHhlbGV1Y3Vpb2JyZW4yeHZlZmV6N2Y5MA0GCSqGSIb3DQEBBQUAA4IBAQBM17YYquw0soDPAadr1aIM6iC6BQ/kOGYu3y/6AlrwYgAQNFy8DjsQUoqlQWFuA0sigp57bTUymkXEBf9yhUmXXiPafGjbxzsPF5SPFLIciolWbxRCB153L1a/Vh2wg3rhf4IvAZuJpnml6SSg5SjD19bN+gD7zrtp3yWKBKuarLSjDvVIB1SoxEToBs3glAEqoBiA2eZjikBA0aBlbvjUF2gqOmZjZJ7dmG1Tos2Zd4SdGL6ltSpKUeSGSxyv41aqF83vNpymNJmey2t2kPPtC7mt0LM32Ift3AkAl8Za9JbV/pOnc95oAfPhVTOGOI+u2BuB2qaKWjqHwkfqCz4A"
        }
      }
    }
  }
};
let OUTPUT_FILE="./tenant_status.json";

const typeMetadata = {
  bitcode_flags: "abrmaster",
  bitcode_format: "builtin",
  public: {
    "eluv.displayApp": "default",
    "eluv.manageApp": "default",
  }
};

const TENANT_OPS_KEY="tenant-ops";
const CONTENT_OPS_KEY="content-ops";

const EXPECTED_SENDER_BALANCE=10.5;
// This value must be greater than 0.1 Elv for tx fee
// (checked by elv-client-js when adding as an access group member)
const OPS_AMOUNT=10;

// ===================================================================

const isEmptyParams = (value) => {
  return value === null || value === "" || value === false || value === "none";
};

const writeConfigToFile= (config) => {
  fs.writeFileSync(OUTPUT_FILE, JSON.stringify(config, null, 2));
};

const checkSignerTenantAccess = async ({client, tenantId}) => {

  let elvLv = await new EluvioLive({
    configUrl: Config.networks[Config.net],
  });
  await elvLv.Init({
    debugLogging: client.debug,
  });

  let elvFabric = new ElvFabric({
    configUrl: Config.networks[Config.net],
    debugLogging: client.debug
  });
  await elvFabric.Init({
    privateKey: process.env.PRIVATE_KEY
  });

  const tenantAddr = Utils.HashToAddress(tenantId);
  const abi = fs.readFileSync(
    path.resolve(__dirname, "../contracts/v3/BaseTenantSpace.abi")
  );
  let owner = await elvFabric.client.CallContractMethod({
    contractAddress: tenantAddr,
    abi: JSON.parse(abi),
    methodName: "owner",
    methodArgs: [],
  });

  if (elvFabric.client.signer.address !== owner) {
    throw Error(`signer is not the root key for tenant: ${tenantId}`);
  }

  let tenantContractId = await client.userProfileClient.TenantContractId();
  if (tenantId !== tenantContractId) {
    throw Error(`Signer associated with different tenant.\n expected_tenant:${tenantId}\n actual_tenant:${tenantContractId}`);
  }

  // check tenant contract id has tenant admin group set
  let tenantAdminInfo = await elvLv.TenantGroupInfo({tenantId: tenantContractId});
  if (!tenantAdminInfo.tenant_admin_address) {
    throw Error("No tenant admin group set for account.");
  }

  let addr = await client.signer.getAddress();

  // check the user is member of the tenant admin group
  const isManager = await elvFabric.AccessGroupManager({group: tenantAdminInfo.tenant_admin_address, addr});
  if (!isManager) {
    throw Error(`User ${addr} is not a manager for the tenant admin group: ${tenantAdminInfo.tenant_admin_id}`);
  }
};

const SetLibraryPermissions = async (client, libraryId, t) => {

  if (isEmptyParams(t.base.groups.tenantAdminGroupAddress)){
    throw Error("require tenantAdminGroupAddress to be set");
  }
  if (isEmptyParams(t.base.groups.contentAdminGroupAddress)){
    throw Error("require contentAdminGroupAddress to be set");
  }

  const promises = [
    // Tenant admins
    client.AddContentLibraryGroup({libraryId, groupAddress: t.base.groups.tenantAdminGroupAddress, permission: "accessor"}),
    client.AddContentLibraryGroup({libraryId, groupAddress: t.base.groups.tenantAdminGroupAddress, permission: "contributor"}),

    // Content admins
    client.AddContentLibraryGroup({libraryId, groupAddress: t.base.groups.contentAdminGroupAddress, permission: "accessor"}),
    client.AddContentLibraryGroup({libraryId, groupAddress: t.base.groups.contentAdminGroupAddress, permission: "contributor"}),
  ];
  await Promise.all(promises);
};

const SetObjectPermissions = async (client, objectId, t) => {

  if (isEmptyParams(t.base.groups.tenantAdminGroupAddress)){
    throw Error("require t.base.groups.tenantAdminGroupAddress to be set");
  }
  if (isEmptyParams(t.base.groups.contentAdminGroupAddress)){
    throw Error("require t.base.groups.contentAdminGroupAddress to be set");
  }

  const promises = [
    // Tenant admins
    client.AddContentObjectGroupPermission({objectId, groupAddress: t.base.groups.tenantAdminGroupAddress, permission: "manage"}),

    // Content admins
    client.AddContentObjectGroupPermission({objectId, groupAddress: t.base.groups.contentAdminGroupAddress, permission: "manage"}),
  ];
  await Promise.all(promises);
};

const SetTenantEluvioLiveId = async ({client, t}) => {
  if (isEmptyParams(t.base.tenantId)){
    throw Error("require t.base.tenantId to be set");
  }

  // Skip updating metadata if these values are not set
  if (isEmptyParams(t.mediaWallet.liveTypes[TYPE_LIVE_TENANT]) &&
    isEmptyParams(t.base.tenantTypes.titleTypeId) &&
    isEmptyParams(t.base.tenantTypes.masterTypeId) &&
    isEmptyParams(t.base.tenantTypes.streamTypeId) &&
    isEmptyParams(t.liveStreaming.siteId)
  ){
    return;
  }

  const tenantAddr = Utils.HashToAddress(t.base.tenantId);
  const libraryId = ElvUtils.AddressToId({prefix: "ilib", address: tenantAddr});
  const objectId = ElvUtils.AddressToId({prefix: "iq__", address: tenantAddr});

  try {
    const editResponse = await client.EditContentObject({ libraryId, objectId });

    if (!isEmptyParams(t.mediaWallet.liveTypes[TYPE_LIVE_TENANT])) {
      await client.ReplaceMetadata({
        libraryId,
        objectId,
        writeToken: editResponse.write_token,
        metadataSubtree: "public/eluvio_live_id",
        metadata: t.mediaWallet.liveTypes[TYPE_LIVE_TENANT],
      });
    }

    const contentTypesMetadata = {};
    if (!isEmptyParams(t.base.tenantTypes.titleTypeId)) {
      contentTypesMetadata["title"] = t.base.tenantTypes.titleTypeId;
    }
    if (!isEmptyParams(t.base.tenantTypes.masterTypeId)) {
      contentTypesMetadata["title_master"] = t.base.tenantTypes.masterTypeId;
    }
    if (!isEmptyParams(t.base.tenantTypes.streamTypeId)) {
      contentTypesMetadata["live_stream"] = t.base.tenantTypes.streamTypeId;
    }
    if (Object.keys(contentTypesMetadata).length > 0) {
      await client.ReplaceMetadata({
        libraryId,
        objectId,
        writeToken: editResponse.write_token,
        metadataSubtree: "public/content_types",
        metadata: contentTypesMetadata,
      });
    }

    if (!isEmptyParams(t.liveStreaming.siteId)) {
      await client.ReplaceMetadata({
        libraryId,
        objectId,
        writeToken: editResponse.write_token,
        metadataSubtree: "public/sites",
        metadata: { live_streams: t.liveStreaming.siteId },
      });
    }

    const res = await client.FinalizeContentObject({
      libraryId,
      objectId,
      writeToken: editResponse.write_token,
      commitMessage: "Set content types and sites",
    });
    return res;
  } catch (error) {
    console.error("Error setting tenant Eluvio live ID:", error);
    throw error;
  }
};


const getTenantGroups = async ({client,tenantId, t}) => {
  const tenantAddr = Utils.HashToAddress(tenantId);
  const abi = fs.readFileSync(
    path.resolve(__dirname, "../contracts/v3/BaseTenantSpace.abi")
  );

  t.base.groups.tenantAdminGroupAddress = await client.CallContractMethod({
    contractAddress: tenantAddr,
    abi: JSON.parse(abi),
    methodName: "groupsMapping",
    methodArgs : ["tenant_admin", 0],
    formatArguments: true,
  });
  t.base.groups.contentAdminGroupAddress = await client.CallContractMethod({
    contractAddress: tenantAddr,
    abi: JSON.parse(abi),
    methodName: "groupsMapping",
    methodArgs: ["content_admin", 0],
    formatArguments: true,
  });
  t.base.groups.tenantUsersGroupAddress = await client.CallContractMethod({
    contractAddress: tenantAddr,
    abi: JSON.parse(abi),
    methodName: "groupsMapping",
    methodArgs: ["tenant_users", 0],
    formatArguments: true,
  });
  writeConfigToFile(t);

  console.log("\nAccess Groups:\n");
  console.log(JSON.stringify(t.base.groups, null, 2));

  if (!t.base.groups.tenantAdminGroupAddress) {
    throw Error(`t.base.groups.tenantAdminGroupAddress not set for ${tenantId}`);
  }
  if (!t.base.groups.contentAdminGroupAddress) {
    throw Error(`t.base.groups.contentAdminGroupAddress not set for ${tenantId}`);
  }
  if (!t.base.groups.tenantUsersGroupAddress) {
    console.log(`WARN: t.base.groups.tenantUsersGroupAddress not set for ${tenantId}`);
  }
};

const setGroupPermission = async ({client,t}) => {
  if (!t.base.groups.tenantAdminGroupAddress) {
    throw Error(`t.base.groups.tenantAdminGroupAddress not set for ${tenantId}`);
  }

  if (!isEmptyParams(t.base.groups.contentAdminGroupAddress)) {
    const objectId = ElvUtils.AddressToId({prefix: "iq__", address: t.base.groups.contentAdminGroupAddress});
    await client.AddContentObjectGroupPermission({
      objectId,
      groupAddress: t.base.groups.tenantAdminGroupAddress,
      permission: "manage"
    });
    console.log(`tenant_admin_group ${t.base.groups.tenantAdminGroupAddress} has been granted manage permissions for the content_admin_group ${t.base.groups.contentAdminGroupAddress}`);
  }

  if (!isEmptyParams(t.base.groups.tenantUsersGroupAddress)) {
    const objectId = ElvUtils.AddressToId({prefix: "iq__", address: t.base.groups.tenantUsersGroupAddress});
    await client.AddContentObjectGroupPermission({
      objectId,
      groupAddress: t.base.groups.tenantAdminGroupAddress,
      permission: "manage"
    });
    console.log(`tenant_admin_group ${t.base.groups.tenantAdminGroupAddress} has been granted manage permissions for the tenant_users_group ${t.base.groups.tenantUsersGroupAddress}`);
  }
};

const setTenantPublishPrivate = async ({tenantId, asUrl, t, debug}) => {

  if (!t.base.publish) {
    t.base.publish = {};
    return;
  }

  const config = {
    configUrl: Config.networks[Config.net],
    mainObjectId: Config.mainObjects[Config.net],
  };

  const eluvioLive = new EluvioLive(config);
  await eluvioLive.Init({
    debugLogging: debug,
    asUrl
  });

  if (isEmptyParams(t.base.publish.env)){
    t.base.publish.env = "production";
  }

  let res = await eluvioLive.TenantPublishPrivate({
    tenant: tenantId,
    env: t.base.publish.env
  });
  console.log(`tenant_publish_private, response: ${JSON.stringify(res, null, 2)}`);

  t.base.publish.elvLiveWriteResult = res.response.elv_live_write_result;
  if (res.response.updated_tenant_hash) {
    t.base.publish.updatedTenantHash = res.response.updated_tenant_hash;
  }
  if (res.response.warnings && res.response.warnings.length > 0){
    t.base.publish.warnings = res.response.warnings;
  }
  writeConfigToFile(t);
};

const handleTenantFaucet = async ({tenantId, asUrl, t, debug}) => {

  let elvTenant = new ElvTenant({
    configUrl: Config.networks[Config.net],
    debugLogging: debug,
  });
  await elvTenant.Init({ privateKey: process.env.PRIVATE_KEY });

  let amount;
  if (isEmptyParams(t.base.faucet.amount)) {
    amount = undefined;
  } else {
    amount = t.base.faucet.amount;
  }

  let noFunds = false;
  if (!isEmptyParams(t.base.faucet.no_funds)){
    noFunds = true;
  }

  let maxAttempts = 5;
  let baseBackoff = 15 * 1000; // start at 15s

  let res = {};
  for (let attempt = 0; attempt < maxAttempts; attempt++){
    try {
      res = await elvTenant.TenantCreateFaucetAndFund({
        asUrl,
        tenantId,
        ...(amount != null && {amount: amount}),
        noFunds
      });
      console.log(`Success creating faucet for ${tenantId} on attempt ${attempt+1}`);
      break;
    } catch (err) {
      if (attempt < maxAttempts-1) {
        let currentBackoff = baseBackoff * Math.pow(2, attempt); // exp backoff
        console.log(`Waiting ${currentBackoff / 1000} seconds before retrying creation of faucet funding address...`);
        await new Promise(resolve => setTimeout(resolve, currentBackoff));
      } else {
        console.log("All retry attempts failed for faucet funding.");
        throw err;
      }
    }
  }

  t.base.faucet.funding_address = res.faucet.funding_address;
  if ( "amount_transferred" in res ) {
    t.base.faucet.amount_transferred = res.amount_transferred;
  }
  writeConfigToFile(t);
};


/* Create libraries - Properties, Title Masters, Title Mezzanines and add each to the groups */
const createLibrariesAndSetPermissions = async({client, kmsId, t}) => {
  if (isEmptyParams(t.base.tenantName)){
    throw Error("require t.base.tenantName to be set");
  }

  // Create libraries and set permissions
  const createLibrary = async ({name, metadata}) => {
    const libraryId = await client.CreateContentLibrary({ name, kmsId, metadata });
    await SetLibraryPermissions(client, libraryId, t);
    return libraryId;
  };

  if (!t.base.libraries.propertiesLibraryId) {
    t.base.libraries.propertiesLibraryId = await createLibrary({ name: `${t.base.tenantName} - Properties`});
    writeConfigToFile(t);
  }

  if (!t.base.libraries.mastersLibraryId) {
    t.base.libraries.mastersLibraryId = await createLibrary({ name: `${t.base.tenantName} - Title Masters`});
    writeConfigToFile(t);
  }

  if (!t.base.libraries.mezzanineLibraryId) {
    t.base.libraries.mezzanineLibraryId = await createLibrary({name: `${t.base.tenantName} - Title Mezzanines`, metadata: STANDARD_DRM_CERT});
    writeConfigToFile(t);
  }

  console.log("\nTenant Libraries:\n");
  console.log(JSON.stringify(t.base.libraries, null, 2));
};

// helper function to create and set permissions for content types
const createContentTypeAndSetPermissions = async ({client, name, metadata, t}) => {
  const typeId = await client.CreateContentType({ name, metadata });
  await SetObjectPermissions(client, typeId, t);
  return typeId;
};

const createTenantTypes = async ({client, t}) => {

  const masterMetadata = {
    bitcode_flags: "abrmaster",
    bitcode_format: "builtin",
    public: {
      "eluv.manageApp": "default",
    }
  };

  if (isEmptyParams(t.base.tenantName)){
    throw Error("require t.base.tenantName to be set");
  }

  if (!t.base.tenantTypes.titleTypeId) {
    const mdata = JSON.parse(JSON.stringify(typeMetadata));
    t.base.tenantTypes.titleTypeId = await createContentTypeAndSetPermissions({client, name:`${t.base.tenantName} - Title`, metadata: mdata, t});
    writeConfigToFile(t);
  }

  if (!t.base.tenantTypes.titleCollectionTypeId) {
    const mdata = JSON.parse(JSON.stringify(typeMetadata));
    t.base.tenantTypes.titleCollectionTypeId = await createContentTypeAndSetPermissions({client, name:`${t.base.tenantName} - Title Collection`, metadata: mdata, t});
    writeConfigToFile(t);
  }

  if (!t.base.tenantTypes.masterTypeId) {
    t.base.tenantTypes.masterTypeId = await createContentTypeAndSetPermissions({client, name:`${t.base.tenantName} - Title Master`, metadata: masterMetadata, t });
    writeConfigToFile(t);
  }

  if (!t.base.tenantTypes.permissionsTypeId) {
    const mdata = JSON.parse(JSON.stringify(typeMetadata));
    t.base.tenantTypes.permissionsTypeId = await createContentTypeAndSetPermissions({client, name:`${t.base.tenantName} - Permissions`, metadata: { ...mdata, public: { "eluv.manageApp": "avails-manager" } }, t });
    writeConfigToFile(t);
  }

  if (!t.base.tenantTypes.channelTypeId) {
    const mdata = JSON.parse(JSON.stringify(typeMetadata));
    t.base.tenantTypes.channelTypeId = await createContentTypeAndSetPermissions({client, name:`${t.base.tenantName} - Channel`, metadata:{
      ...mdata,
      public: {
        ...mdata.public,
        title_configuration: {
          "controls": ["credits", "playlists", "gallery", "channel"],
        },
      },
    }, t });
    writeConfigToFile(t);
  }

  if (!t.base.tenantTypes.streamTypeId) {
    const mdata = JSON.parse(JSON.stringify(typeMetadata));
    t.base.tenantTypes.streamTypeId = await createContentTypeAndSetPermissions({client, name:`${t.base.tenantName} - Live Stream`, metadata:{
      bitcode_flags: "playout_live",
      bitcode_format: "builtin",
      public: {
        ...mdata.public,
        title_configuration: {
          "controls": ["credits", "gallery", "live_stream"],
        },
      },
    }, t });
    writeConfigToFile(t);
  }

  console.log("\nTenant Types:\n");
  console.log(JSON.stringify(t.base.tenantTypes, null, 2));
};

const createLiveTypes = async ({client, t}) => {
  if (isEmptyParams(t.base.tenantName)){
    throw Error("require t.base.tenantName to be set");
  }
  if (!t.mediaWallet.liveTypes) {
    t.mediaWallet.liveTypes = {};
  }

  for (let i = 0; i < liveTypes.length; i++) {
    if (t.mediaWallet.liveTypes[liveTypes[i].name]) continue;

    const mdata = JSON.parse(JSON.stringify(typeMetadata));
    const typeId = await createContentTypeAndSetPermissions({client, name:`${t.base.tenantName} - ${liveTypes[i].name}`, metadata:{
      ...mdata,
      public: {
        ...mdata.public,
        title_configuration: liveTypes[i].spec
      }
    }, t });

    console.log(`\t${t.base.tenantName} - ${liveTypes[i].name}: ${typeId}`);
    t.mediaWallet.liveTypes[liveTypes[i].name] = typeId;
    writeConfigToFile(t);
  }

  console.log(JSON.stringify(t.mediaWallet.liveTypes, null, 2));
};

const createMarketplaceId = async ({client, t}) => {

  if (isEmptyParams(t.base.tenantName)){
    throw Error("require t.base.tenantName to be set");
  }
  objectName = `${TYPE_LIVE_MARKETPLACE} - ${t.base.tenantName}`;

  /* Create a marketplace object */
  if (!t.mediaWallet.objects.marketplaceId) {

    if (isEmptyParams(t.base.tenantId)){
      throw Error("require t.base.tenantId to be set");
    }
    if (isEmptyParams(t.base.tenantSlug)){
      throw Error("require t.base.tenantSlug to be set");
    }
    if (isEmptyParams(t.base.libraries.propertiesLibraryId)){
      throw Error("require t.base.libraries.propertiesLibraryId to be set");
    }
    if (isEmptyParams(t.mediaWallet.liveTypes[TYPE_LIVE_MARKETPLACE])){
      throw Error(`require t.mediaWallet.liveTypes.'${TYPE_LIVE_MARKETPLACE}' to be set`);
    }
    if (isEmptyParams(t.base.groups.tenantAdminGroupAddress)){
      throw Error("require t.base.groups.tenantAdminGroupAddress to be set");
    }
    if (isEmptyParams(t.base.groups.contentAdminGroupAddress)){
      throw Error("require t.base.groups.contentAdminGroupAddress to be set");
    }

    publicMetadata = {
      name: objectName,
      asset_metadata: {
        slug: `${t.base.tenantSlug}-marketplace`,
        info: {
          tenant_id: t.base.tenantId,
          tenant_slug: t.base.tenantSlug,
          tenant_name: t.base.tenantName,
          branding: {
            color_scheme: "Dark"
          }
        }
      }
    };

    t.mediaWallet.objects.marketplaceId = await CreateFabricObject({client,
      libraryId: t.base.libraries.propertiesLibraryId,
      typeId: t.mediaWallet.liveTypes[TYPE_LIVE_MARKETPLACE],
      publicMetadata, t });

    writeConfigToFile(t);
  }

  if (!isEmptyParams(t.mediaWallet.objects.marketplaceId) && t.mediaWallet.objects.marketplaceId) {
    t.mediaWallet.objects.marketplaceHash = await client.LatestVersionHash({objectId: t.mediaWallet.objects.marketplaceId});
    writeConfigToFile(t);
  }

  console.log("\nMaketplace Object: \n");
  console.log(`\t${objectName}: ${t.mediaWallet.objects.marketplaceId}\n\n`);
};

const CreateFabricObject = async ({client, libraryId, typeId, publicMetadata, t}) => {
  if (isEmptyParams(t.base.groups.tenantAdminGroupAddress)){
    throw Error("require t.base.groups.tenantAdminGroupAddress to be set");
  }
  if (isEmptyParams(t.base.groups.contentAdminGroupAddress)){
    throw Error("require t.base.groups.contentAdminGroupAddress to be set");
  }

  const {id, write_token} = await client.CreateContentObject({
    libraryId,
    options: {type: typeId}
  });

  await client.ReplaceMetadata({
    libraryId,
    objectId: id,
    writeToken: write_token,
    metadataSubtree: "public",
    metadata: publicMetadata
  });

  // set object editable
  await client.SetPermission({
    objectId: id,
    writeToken: write_token,
    permission: "editable"});

  await client.FinalizeContentObject({
    libraryId,
    objectId: id,
    writeToken: write_token
  });

  await SetObjectPermissions(client, id, t);

  return id;
};


const createTenantObjectId = async ({client, t}) => {
  if (!t.mediaWallet.objects.tenantObjectId) {

    if (isEmptyParams(t.base.tenantName)){
      throw Error("require t.base.tenantName to be set");
    }
    if (isEmptyParams(t.base.tenantId)){
      throw Error("require t.base.tenantId to be set");
    }
    if (isEmptyParams(t.base.tenantSlug)){
      throw Error("require t.base.tenantSlug to be set");
    }
    if (isEmptyParams(t.mediaWallet.objects.marketplaceHash)){
      throw Error("require t.mediaWallet.objects.marketplaceHash to be set");
    }
    if (isEmptyParams(t.base.libraries.propertiesLibraryId)){
      throw Error("require t.base.libraries.propertiesLibraryId to be set");
    }
    if (isEmptyParams(t.mediaWallet.liveTypes[TYPE_LIVE_TENANT])){
      throw Error(`require t.mediaWallet.liveTypes.'${TYPE_LIVE_TENANT}' to be set`);
    }
    if (isEmptyParams(t.base.opsKey.tenantOps.key)){
      throw Error("require t.base.opsKey.tenantOps.key set");
    }
    if (isEmptyParams(t.base.opsKey.contentOps.key)){
      throw Error("require t.base.opsKey.contentOps.key set");
    }

    objectName = `${TYPE_LIVE_TENANT} - ${t.base.tenantName}`;
    let rootKeyAddr = await client.signer.getAddress();

    // get ops key address
    let wallet = client.GenerateWallet();
    let tenantOpsSigner = wallet.AddAccount({privateKey: t.base.opsKey.tenantOps.key});
    let tenantOpsAddr = await tenantOpsSigner.getAddress();
    let contentOpsSigner = wallet.AddAccount({privateKey: t.base.opsKey.contentOps.key});
    let contentOpsAddr = await contentOpsSigner.getAddress();


    publicMetadata = {
      name: objectName,
      asset_metadata: {
        info: {
          tenant_id: t.base.tenantId,
          token: {
            owners: [
              `${rootKeyAddr}`,
              `${tenantOpsAddr}`,
              `${contentOpsAddr}`
            ]
          }
        },
        slug: t.base.tenantSlug,
        marketplaces:{
          [`${t.base.tenantSlug}-marketplace`]: {
            "/":`/qfab/${t.mediaWallet.objects.marketplaceHash}/meta/public/asset_metadata`,
            "order": 0
          }
        },
        sites: {}
      }
    };

    t.mediaWallet.objects.tenantObjectId = await CreateFabricObject({client,
      libraryId: t.base.libraries.propertiesLibraryId,
      typeId: t.mediaWallet.liveTypes[TYPE_LIVE_TENANT],
      publicMetadata, t });

    writeConfigToFile(t);

    console.log("\nTenant Object Id: \n");
    console.log(`\t${objectName}: ${t.mediaWallet.objects.tenantObjectId}\n\n`);
  }
};

const createSiteId = async ({client, t}) => {
  if (!t.liveStreaming.siteId) {
    if (isEmptyParams(t.base.libraries.propertiesLibraryId)){
      throw Error("require t.base.libraries.propertiesLibraryId to be set");
    }
    if (isEmptyParams(t.base.tenantTypes.titleCollectionTypeId)){
      throw Error("require t.base.tenantTypes.titleCollectionTypeId to be set");
    }

    let objectName = "Site - Live Streams";

    publicMetadata = {
      name: objectName,
      asset_metadata: {
        title: objectName,
        display_title: objectName,
        slug: "site-live-streams",
        title_type: "site",
        asset_type: "primary",
        live_streams: {}
      }
    };

    t.liveStreaming.siteId = await CreateFabricObject({client,
      libraryId: t.base.libraries.propertiesLibraryId,
      typeId: t.base.tenantTypes.titleCollectionTypeId,
      publicMetadata, t });
    console.log("\nSite Live Streams Object", t.liveStreaming.siteId);
    writeConfigToFile(t);
  }
};

const createOpsKeyAndAddToGroup = async ({groupToRoles, opsKeyType, t, debug})=>{
  let opsKey = "";
  let opsFund = OPS_AMOUNT;
  if (opsKeyType === TENANT_OPS_KEY){
    opsKey = t.base.opsKey.tenantOps.key;
    if (!isEmptyParams(t.base.opsKey.tenantOps.amount)){
      opsFund = t.base.opsKey.tenantOps.amount;
    }
  } else {
    opsKey = t.base.opsKey.contentOps.key;
    if (!isEmptyParams(t.base.opsKey.contentOps.amount)){
      opsFund = t.base.opsKey.contentOps.amount;
    }
  }

  if (opsKey === "none") {
    return;
  }

  let elvAccount = new ElvAccount({
    configUrl: Config.networks[Config.net],
    debugLogging: debug
  });
  await elvAccount.Init({
    privateKey: process.env.PRIVATE_KEY,
  });

  if (!opsKey) {
    if (isEmptyParams(t.base.tenantName)) {
      throw Error("require t.base.tenantName to be set");
    }

    const signerBalance = await elvAccount.GetBalance();
    if (signerBalance < EXPECTED_SENDER_BALANCE) {
      throw Error(`${await elvAccount.signer.getAddress()} have balance < ${EXPECTED_SENDER_BALANCE}\nCurrent balance: ${signerBalance}`);
    }

    let res = await elvAccount.Create({
      funds: opsFund,
      accountName: `${t.base.tenantName}-${opsKeyType}`,
      tenantId: t.base.tenantId,
      skipAddingToTenantUserGroup: true,
      groupToRoles: groupToRoles,
    });
    console.log(`\n${t.base.tenantName}-${opsKeyType}:\n`);
    console.log(`address:${res.address}`);
    console.log(`privateKey:${res.privateKey}`);

    if (opsKeyType === TENANT_OPS_KEY){
      t.base.opsKey.tenantOps.key = res.privateKey;
      t.base.opsKey.tenantOps.amount_transferred = opsFund;
    } else {
      t.base.opsKey.contentOps.key = res.privateKey;
      t.base.opsKey.contentOps.amount_transferred = opsFund;
    }
    writeConfigToFile(t);
  }
};

let readJsonFile = (filepath) => {
  let data = fs.readFileSync(filepath, "utf-8");
  if (data.trim() === "") {
    throw Error ("JSON file is empty");
  }
  return JSON.parse(data);
};

// ===============================================================================================

const InitializeTenant = async ({client, kmsId, tenantId, asUrl, statusFile, initConfig, debug=false}) => {

  let t;
  if (!statusFile) {
    t = {
      base: {
        opsKey : {
          tenantOps: {
            key: "",
            amount: null
          },
          contentOps: {
            key: "",
            amount: null
          },
        },
        groups : {
          "tenantAdminGroupAddress": "",
          "contentAdminGroupAddress": "",
          "tenantUsersGroupAddress": ""
        },
        libraries: {
          "mastersLibraryId": null,
          "mezzanineLibraryId": null,
          "propertiesLibraryId": null
        },
        tenantTypes: {
          "titleTypeId": null,
          "titleCollectionTypeId": null,
          "masterTypeId": null,
          "permissionsTypeId": null,
          "channelTypeId": null,
          "streamTypeId": null
        },
        publish: {
          "env": null,
        },
        faucet: {
          "enable": true,
          "no_funds": false,
          "funding_address": null,
          "amount": null,
        }
      },
      liveStreaming: {
        siteId: null,
      },
      mediaWallet: {
        liveTypes: {
          "Item Template": null,
          "Media Wallet Marketplace": null,
          "Media Wallet Settings": null,
        },
        objects: {
          marketplaceId: "",
          marketplaceHash: null,
          tenantObjectId: null,
        }
      }
    };
  } else {
    console.log("Parsing status JSON file...");
    t = readJsonFile(statusFile);
    OUTPUT_FILE = statusFile;

    timestamp = new Date().toISOString().replace(/[-:.]/g, "");
    backupFile = `${path.parse(statusFile).name}_backup_${timestamp}.json`;
    fs.copyFileSync(statusFile, backupFile);
  }

  if (initConfig) {
    return t;
  }

  // minimum signer balance required
  let expectedSignerBalance = 10;
  // fund content ops key
  if (t.base.opsKey.contentOps.key === "") {
    if (!isEmptyParams(t.base.opsKey.contentOps.key)){
      expectedSignerBalance += t.base.opsKey.contentOps.amount;
    } else {
      expectedSignerBalance += 10;
    }
  }
  // fund tenant ops key
  if (t.base.opsKey.tenantOps.key === "") {
    if (!isEmptyParams(t.base.opsKey.tenantOps.key)){
      expectedSignerBalance += t.base.opsKey.tenantOps.amount;
    } else {
      expectedSignerBalance += 10;
    }
  }

  // fund faucet if enabled
  if (t.base.faucet.enable) {
    if (!isEmptyParams(t.base.faucet.amount)) {
      expectedSignerBalance += t.base.faucet.amount;
    } else {
      expectedSignerBalance += 20;
    }
  }

  let elvAccount = new ElvAccount({
    configUrl: Config.networks[Config.net],
    debugLogging: debug
  });
  await elvAccount.Init({
    privateKey: process.env.PRIVATE_KEY,
  });
  const signerBalance = await elvAccount.GetBalance();
  if (signerBalance < expectedSignerBalance) {
    throw Error(`Admin key ${await elvAccount.signer.getAddress()} have balance < ${expectedSignerBalance}Elv\nCurrent balance: ${signerBalance}`);
  }

  await ProvisionBase({client, kmsId, tenantId, asUrl, t, debug});
  await ProvisionLiveStreaming({client, tenantId, t});
  await ProvisionOps({client, tenantId, t, debug});
  await ProvisionMediaWallet({client, tenantId, t});
  await ProvisionFaucet({tenantId, asUrl, t, debug});

  /* Add ids of services to tenant fabric metadata */
  console.log("Tenant content object - set types and sites");
  res = await SetTenantEluvioLiveId({client, t});
  if (res) {
    console.log(`\tTenantEluvioLiveId: ${JSON.stringify(res, null, 2)}`);
  }

  console.log(`JSON OUTPUT AT: ${OUTPUT_FILE}\n`);

  return t;
};

const ProvisionBase = async ({client, kmsId, tenantId, asUrl, t, debug }) => {
  await checkSignerTenantAccess({client, tenantId});

  const tenantAddr = Utils.HashToAddress(tenantId);
  const abi = fs.readFileSync(
    path.resolve(__dirname, "../contracts/v3/BaseTenantSpace.abi")
  );

  t.base.tenantName = await client.CallContractMethod({
    contractAddress: tenantAddr,
    abi: JSON.parse(abi),
    methodName: "name",
    methodArgs: [],
    formatArguments: true,
  });
  t.base.tenantSlug = t.base.tenantName.toLowerCase().replace(/ /g, "-");
  t.base.tenantId = tenantId;

  // set tenantContractId and tenantId metadata for tenant
  await client.SetTenantContractId({
    objectId: tenantId,
    tenantContractId: tenantId,
  });
  let tenantContractId = await client.TenantContractId({
    objectId: tenantId,
  });
  console.log(`tenant_contract_id: ${tenantContractId} set on tenant metadata`);

  let tenantAdminGroup = await client.TenantId({
    objectId: tenantId,
  });
  console.log(`tenant_id: ${tenantAdminGroup} set on tenant metadata`);

  await getTenantGroups({client,tenantId, t});
  await createLibrariesAndSetPermissions({client, kmsId, t});
  await createTenantTypes({client, t});
  await setGroupPermission({client, t});
  await setTenantPublishPrivate({tenantId, asUrl, t, debug});
};

const ProvisionLiveStreaming = async({client, tenantId, t}) => {
  await checkSignerTenantAccess({client, tenantId});
  await createSiteId({client, t});
};

const ProvisionMediaWallet = async({client, tenantId, t}) => {
  await checkSignerTenantAccess({client, tenantId});
  await createLiveTypes({client, t});
  await createMarketplaceId({client, t});
  await createTenantObjectId({client, t});
};

const ProvisionOps = async({client, tenantId, t, debug= false}) => {
  await checkSignerTenantAccess({client, tenantId});

  if (!t.base.groups.tenantAdminGroupAddress) {
    throw Error("require t.base.groups.tenantAdminGroupAddress to be set");
  }
  if (!t.base.groups.contentAdminGroupAddress) {
    throw Error("require t.base.groups.contentAdminGroupAddress to be set");
  }
  if (!t.base.groups.tenantUsersGroupAddress) {
    throw Error("require t.base.groups.tenantUsersGroupAddress to be set");
  }

  let tenantOpsGroupToRoles = {
    [t.base.groups.tenantAdminGroupAddress]: "manager",
    [t.base.groups.tenantUsersGroupAddress]: "manager"
  };
  // tenant ops added as manager to tenant_admin and tenant_users group
  await createOpsKeyAndAddToGroup({
    groupToRoles: tenantOpsGroupToRoles,
    opsKeyType: TENANT_OPS_KEY,
    t: t,
    debug
  });

  let contentOpsGroupToRoles = {
    [t.base.groups.contentAdminGroupAddress]: "manager",
    [t.base.groups.tenantUsersGroupAddress]: "member"
  };
  // content ops added as manager to content_admin and tenant_users group
  await createOpsKeyAndAddToGroup({
    groupToRoles: contentOpsGroupToRoles,
    opsKeyType: CONTENT_OPS_KEY,
    t: t,
    debug
  });
};

const ProvisionFaucet = async({tenantId, asUrl, t, debug = false}) => {
  if (t.base.faucet.enable) {
    await handleTenantFaucet({tenantId, asUrl, t, debug});
  }
};

// ===============================================================

const AddConsumerGroup = async ({client, tenantAddress, debug = false}) => {
  const tenantAbi = fs.readFileSync(
    path.resolve(__dirname, "../contracts/v3/BaseTenantSpace.abi")
  );

  let consumerGroupContract = await ElvUtils.DeployContractFile({
    client,
    fileName: "BaseTenantConsumerGroup",
    args:[tenantAddress]
  });

  if (debug){
    console.log("ConsumerGroup: ", consumerGroupContract);
  }

  res = await client.CallContractMethodAndWait({
    contractAddress: tenantAddress,
    abi: JSON.parse(tenantAbi),
    methodName: "addGroup",
    methodArgs: ["tenant_consumer", consumerGroupContract.address],
    formatArguments: true,
  });

  return res;
};

exports.InitializeTenant = InitializeTenant;
exports.AddConsumerGroup = AddConsumerGroup;

