/* eslint-disable no-console */
const fs = require("fs");
const path = require("path");
const { ElvUtils } = require("../src/Utils");
const Utils = require("@eluvio/elv-client-js/src/Utils.js");
const { ElvAccount } = require("../src/ElvAccount.js");
const {Config} = require("./Config");

const TYPE_LIVE_DROP_EVENT_SITE = "Media Wallet Drop Event Site";
const TYPE_LIVE_TENANT = "Media Wallet Tenant";
const TYPE_LIVE_MARKETPLACE = "Media Wallet Marketplace";
const TYPE_LIVE_NFT_COLLECTION = "NFT Collection";
const TYPE_LIVE_NFT_TEMPLATE = "NFT Template";

const liveTypes = [
  { name: TYPE_LIVE_DROP_EVENT_SITE, spec: require("@eluvio/elv-client-js/typeSpecs/DropEventSite") },
  { name: TYPE_LIVE_MARKETPLACE, spec: require("@eluvio/elv-client-js/typeSpecs/Marketplace") },
  { name: TYPE_LIVE_TENANT, spec: require("@eluvio/elv-client-js/typeSpecs/EventTenant") },
  { name: TYPE_LIVE_NFT_COLLECTION, spec: require("@eluvio/elv-client-js/typeSpecs/NFTCollection") },
  { name: TYPE_LIVE_NFT_TEMPLATE, spec: require("@eluvio/elv-client-js/typeSpecs/NFTTemplate") }
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

const EXPECTED_SENDER_BALANCE=1;
// This value must be greater than 0.1 Elv
// (checked by elv-client-js when adding as an access group member)
const OPS_AMOUNT=0.2;

// ===================================================================

const isEmptyParams = (value) => {
  return value === null || value === "" || value === false || value === "none";
};

const writeConfigToFile= (config) => {
  fs.writeFileSync(OUTPUT_FILE, JSON.stringify(config, null, 2));
};

const checkSignerTenantAccess = async ({client, tenantId}) => {
  let tenantAdminId = await client.userProfileClient.TenantId();
  let tenantContractId = await client.userProfileClient.TenantContractId();

  if (!tenantAdminId) {
    throw Error("No tenant admin group set for account.");
  }
  if (tenantId !== tenantContractId) {
    throw Error(`Signer associated with different tenant.\n expected_tenant:${tenantId}\n actual_tenant:${tenantContractId}`);
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
  if (isEmptyParams(t.mediaWallet.liveTypes[TYPE_LIVE_TENANT])){
    throw Error(`require t.mediaWallet.liveTypes.'${TYPE_LIVE_TENANT}' to be set`);
  }
  if (isEmptyParams(t.base.tenantTypes.titleTypeId)){
    throw Error("require t.base.tenantTypes.titleTypeId to be set");
  }
  if (isEmptyParams(t.base.tenantTypes.masterTypeId)){
    throw Error("require t.base.tenantTypes.masterTypeId to be set");
  }
  if (isEmptyParams(t.base.tenantTypes.streamTypeId)){
    throw Error("require t.base.tenantTypes.streamTypeId to be set");
  }
  if (isEmptyParams(t.liveStreaming.siteId)){
    throw Error("require t.liveStreaming.siteId to be set");
  }

  const tenantAddr = Utils.HashToAddress(t.base.tenantId);
  const libraryId = ElvUtils.AddressToId({prefix: "ilib", address: tenantAddr});
  const objectId = ElvUtils.AddressToId({prefix: "iq__", address: tenantAddr});

  var e = await client.EditContentObject({
    libraryId,
    objectId,
  });

  await client.ReplaceMetadata({
    libraryId,
    objectId,
    writeToken: e.write_token,
    metadataSubtree: "public/eluvio_live_id",
    metadata: t.mediaWallet.liveTypes[TYPE_LIVE_TENANT],
  });

  await client.ReplaceMetadata({
    libraryId,
    objectId,
    writeToken: e.write_token,
    metadataSubtree: "public/content_types",
    metadata: {
      "title": t.base.tenantTypes.titleTypeId,
      "title_master": t.base.tenantTypes.masterTypeId,
      "live_stream": t.base.tenantTypes.streamTypeId
    },
  });

  await client.ReplaceMetadata({
    libraryId,
    objectId,
    writeToken: e.write_token,
    metadataSubtree: "public/sites",
    metadata: {
      "live_streams": t.liveStreaming.siteId
    },
  });

  const res = await client.FinalizeContentObject({
    libraryId,
    objectId,
    writeToken: e.write_token,
    commitMessage: "Set content types and sites",
  });
  return res;
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
  writeConfigToFile(t);

  console.log("\nAccess Groups:\n");
  console.log(JSON.stringify(t.base.groups, null, 2));

  if (!t.base.groups.tenantAdminGroupAddress) {
    throw Error(`t.base.groups.tenantAdminGroupAddress not set for ${tenantId}`);
  }
  if (!t.base.groups.contentAdminGroupAddress) {
    throw Error(`t.base.groups.contentAdminGroupAddress not set for ${tenantId}`);
  }
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
    t.base.tenantTypes.titleTypeId = await createContentTypeAndSetPermissions({client, name:`${t.base.tenantName} - Title`, metadata:typeMetadata, t});
    writeConfigToFile(t);
  }

  if (!t.base.tenantTypes.titleCollectionTypeId) {
    t.base.tenantTypes.titleCollectionTypeId = await createContentTypeAndSetPermissions({client, name:`${t.base.tenantName} - Title Collection`, metadata: typeMetadata, t});
    writeConfigToFile(t);
  }

  if (!t.base.tenantTypes.masterTypeId) {
    t.base.tenantTypes.masterTypeId = await createContentTypeAndSetPermissions({client, name:`${t.base.tenantName} - Title Master`, metadata: masterMetadata, t });
    writeConfigToFile(t);
  }

  if (!t.base.tenantTypes.permissionsTypeId) {
    t.base.tenantTypes.permissionsTypeId = await createContentTypeAndSetPermissions({client, name:`${t.base.tenantName} - Permissions`, metadata: { ...typeMetadata, public: { "eluv.manageApp": "avails-manager" } }, t });
    writeConfigToFile(t);
  }

  if (!t.base.tenantTypes.channelTypeId) {
    t.base.tenantTypes.channelTypeId = await createContentTypeAndSetPermissions({client, name:`${t.base.tenantName} - Channel`, metadata:{
      ...typeMetadata,
      public: {
        ...typeMetadata.public,
        title_configuration: {
          "controls": ["credits", "playlists", "gallery", "channel"],
        },
      },
    }, t });
    writeConfigToFile(t);
  }

  if (!t.base.tenantTypes.streamTypeId) {
    t.base.tenantTypes.streamTypeId = await createContentTypeAndSetPermissions({client, name:`${t.base.tenantName} - Live Stream`, metadata:{
      bitcode_flags: "playout_live",
      bitcode_format: "builtin",
      public: {
        ...typeMetadata.public,
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

    const typeId = await createContentTypeAndSetPermissions({client, name:`${t.base.tenantName} - ${liveTypes[i].name}`, metadata:{
      ...typeMetadata,
      public: {
        ...typeMetadata.public,
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

  if (t.mediaWallet.objects.marketplaceId) {
    t.mediaWallet.objects.marketplaceHash = await client.LatestVersionHash({objectId: t.mediaWallet.objects.marketplaceId});
    writeConfigToFile(t);
  }

  console.log("\nMaketplace Object: \n");
  console.log(`\t${objectName}: ${t.mediaWallet.objects.marketplaceId}\n\n`);
};

const createDropEventId = async ({client, t}) => {

  if (!t.mediaWallet.objects.dropEventId) {

    if (isEmptyParams(t.base.tenantName)){
      throw Error("require t.base.tenantName to be set");
    }
    if (isEmptyParams(t.base.tenantId)){
      throw Error("require t.base.tenantId to be set");
    }
    if (isEmptyParams(t.base.tenantSlug)){
      throw Error("require t.base.tenantSlug to be set");
    }
    if (isEmptyParams(t.base.libraries.propertiesLibraryId)){
      throw Error("require t.base.libraries.propertiesLibraryId to be set");
    }

    if (isEmptyParams(t.mediaWallet.liveTypes[TYPE_LIVE_DROP_EVENT_SITE])){
      throw Error(`require t.mediaWallet.liveTypes.'${TYPE_LIVE_DROP_EVENT_SITE}' to be set`);
    }

    objectName = `${TYPE_LIVE_DROP_EVENT_SITE} - ${t.base.tenantName}`;

    publicMetadata = {
      name: objectName,
      asset_metadata: {
        info: {
          tenant_id: t.base.tenantId,
          tenant_slug: t.base.tenantSlug,
          marketplace_info: {
            tenant_slug: t.base.tenantSlug,
            marketplace_slug: `${t.base.tenantSlug}-marketplace`
          }
        }
      }
    };

    t.mediaWallet.objects.dropEventId = await CreateFabricObject({client,
      libraryId: t.base.libraries.propertiesLibraryId,
      typeId: t.mediaWallet.liveTypes[TYPE_LIVE_DROP_EVENT_SITE],
      publicMetadata, t });

    writeConfigToFile(t);
  }

  if (t.mediaWallet.objects.dropEventId){
    t.mediaWallet.objects.dropEventHash = await client.LatestVersionHash({objectId: t.mediaWallet.objects.dropEventId});
    writeConfigToFile(t);
  }

  console.log("\nDrop Event Site Object: \n");
  console.log(`\t${objectName}: ${t.mediaWallet.objects.dropEventId}\n\n`);
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
    if (isEmptyParams(t.mediaWallet.objects.dropEventHash)){
      throw Error("require t.mediaWallet.objects.dropEventHash to be set");
    }
    if (isEmptyParams(t.base.libraries.propertiesLibraryId)){
      throw Error("require t.base.libraries.propertiesLibraryId to be set");
    }
    if (isEmptyParams(t.mediaWallet.liveTypes[TYPE_LIVE_TENANT])){
      throw Error(`require t.mediaWallet.liveTypes.'${TYPE_LIVE_TENANT}' to be set`);
    }

    objectName = `${TYPE_LIVE_TENANT} - ${t.base.tenantName}`;

    publicMetadata = {
      name: objectName,
      asset_metadata: {
        info: {
          tenant_id: t.base.tenantId
        },
        slug: t.base.tenantSlug,
        marketplaces:{
          [`${t.base.tenantSlug}-marketplace`]: {
            "/":`/qfab/${t.mediaWallet.objects.marketplaceHash}/meta/public/asset_metadata`,
            "order": 0
          }
        },
        sites: {
          [`${t.base.tenantSlug}-drop-event`]: {
            "/":`/qfab/${t.mediaWallet.objects.dropEventHash}/meta/public/asset_metadata`,
            "order": 0
          }
        }
      }
    };

    t.mediaWallet.objects.tenantObjectId = await CreateFabricObject({client,
      libraryId: t.base.libraries.propertiesLibraryId,
      typeId: t.mediaWallet.liveTypes[TYPE_LIVE_TENANT],
      publicMetadata, t });

    writeConfigToFile(t);

    console.log("\nDrop Event Site Object: \n");
    console.log(`\t${objectName}: ${t.mediaWallet.objects.tenantObjectId}\n\n`);

    /* Add ids of services to tenant fabric metadata */
    console.log("Tenant content object - set types and sites");
    res = await SetTenantEluvioLiveId({client, t});
    console.log(`\tTenantEluvioLiveId: ${t.mediaWallet.objects.tenantObjectId}`);
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

const createOpsKey = async ({groupAddress, opsKeyType, t, debug})=>{
  let opsKey = "";
  if (opsKeyType === TENANT_OPS_KEY){
    opsKey = t.base.tenantOpsKey;
  } else {
    opsKey = t.base.contentOpsKey;
  }

  if (opsKey === "none") {
    return;
  }
  if (opsKey === "" || opsKey === null) {
    if (isEmptyParams(t.base.tenantName)) {
      throw Error("require t.base.tenantName to be set");
    }

    let elvAccount = new ElvAccount({
      configUrl: Config.networks[Config.net],
      debugLogging: debug
    });

    await elvAccount.Init({
      privateKey: process.env.PRIVATE_KEY,
    });
    const signerBalance = await elvAccount.GetBalance();
    if (signerBalance < EXPECTED_SENDER_BALANCE) {
      throw Error(`${await elvAccount.signer.getAddress()} have balance < ${EXPECTED_SENDER_BALANCE}\nCurrent balance: ${signerBalance}`);
    }

    let res = await elvAccount.Create({
      funds: OPS_AMOUNT,
      accountName: `${t.base.tenantName}-${opsKeyType}`,
      tenantId: t.base.tenantId,
    });
    console.log(`\n${t.base.tenantName}-${opsKeyType}:\n`);
    console.log(`address:${res.address}`);
    console.log(`privateKey:${res.privateKey}`);

    if (opsKeyType === TENANT_OPS_KEY){
      t.base.tenantOpsKey = res.privateKey;
    } else {
      t.base.contentOpsKey = res.privateKey;
    }
    writeConfigToFile(t);

    // add the user as manager to provided group address
    await elvAccount.AddToAccessGroup({
      groupAddress: groupAddress,
      accountAddress: res.address,
      isManager: true,
    });
  }
};

let readJsonFile = (filepath) => {
  let data = fs.readFileSync(filepath, "utf-8");
  if (data.trim() === "") {
    throw Error ("status JSON file is empty");
  }
  return JSON.parse(data);
};

// ===============================================================================================

const InitializeTenant = async ({client, kmsId, tenantId, statusFile, debug=false}) => {

  let t;
  if (!statusFile) {
    t = {
      base: {
        groups: {},
        libraries: {},
        tenantTypes: {},
      },
      liveStreaming: {},
      mediaWallet: {
        liveTypes: {},
        objects: {},
      },
    };
  } else {
    t = readJsonFile(statusFile);
    OUTPUT_FILE = statusFile;
  }

  await ProvisionBase({client, kmsId, tenantId, t});
  await ProvisionLiveStreaming({client, tenantId, t});
  await ProvisionMediaWallet({client, tenantId, t});
  await ProvisionOps({client, tenantId, t, debug});

  console.log(`JSON OUTPUT AT: ${OUTPUT_FILE}\n`);

  return t;
};

const ProvisionBase = async ({client, kmsId, tenantId, t}) => {
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

  await getTenantGroups({client,tenantId, t});
  await createLibrariesAndSetPermissions({client, kmsId, t});
  await createTenantTypes({client, t});
};

const ProvisionLiveStreaming = async({client, tenantId, t}) => {
  await checkSignerTenantAccess({client, tenantId});
  await createSiteId({client, t});
};

const ProvisionMediaWallet = async({client, tenantId, t}) => {
  await checkSignerTenantAccess({client, tenantId});
  await createLiveTypes({client, t});
  await createMarketplaceId({client, t});
  await createDropEventId({client, t});
  await createTenantObjectId({client, t});
};

const ProvisionOps = async({client, tenantId, t, debug= false}) => {
  await checkSignerTenantAccess({client, tenantId});

  if (!t.base.groups.tenantAdminGroupAddress) {
    throw Error("require t.base.groups.tenantAdminGroupAddress to be set");
  }
  await createOpsKey({
    groupAddress: t.base.groups.tenantAdminGroupAddress,
    opsKeyType: TENANT_OPS_KEY,
    t: t,
    debug
  });


  if (!t.base.groups.contentAdminGroupAddress) {
    throw Error("require t.base.groups.contentAdminGroupAddress to be set");
  }
  await createOpsKey({
    groupAddress: t.base.groups.contentAdminGroupAddress,
    opsKeyType: CONTENT_OPS_KEY,
    t: t,
    debug
  });
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

