/* eslint-disable no-console */
const fs = require("fs");
const path = require("path");
const { ElvUtils } = require("../src/Utils");
const Utils = require("@eluvio/elv-client-js/src/Utils.js");
const constants = require("Constants");

const TYPE_LIVE_DROP_EVENT_SITE = "Eluvio LIVE Drop Event Site";
const TYPE_LIVE_TENANT = "Eluvio LIVE Tenant";
const TYPE_LIVE_MARKETPLACE = "Eluvio LIVE Marketplace";
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

const SetLibraryPermissions = async (client, libraryId, tenantAdmins, contentAdmins, contentViewers) => {
  const promises = [
    // Tenant admins
    client.AddContentLibraryGroup({libraryId, groupAddress: tenantAdmins, permission: "accessor"}),
    client.AddContentLibraryGroup({libraryId, groupAddress: tenantAdmins, permission: "contributor"}),

    // Content admins
    client.AddContentLibraryGroup({libraryId, groupAddress: contentAdmins, permission: "accessor"}),
    client.AddContentLibraryGroup({libraryId, groupAddress: contentAdmins, permission: "contributor"}),

    // Content viewers
    client.AddContentLibraryGroup({libraryId, groupAddress: contentViewers, permission: "accessor"})
  ];

  await Promise.all(promises);
};

const SetObjectPermissions = async (client, objectId, tenantAdmins, contentAdmins, contentViewers) => {
  let promises = [
    // Tenant admins
    client.AddContentObjectGroupPermission({objectId, groupAddress: tenantAdmins, permission: "manage"}),

    // Content admins
    client.AddContentObjectGroupPermission({objectId, groupAddress: contentAdmins, permission: "manage"}),

    // Content viewers
    client.AddContentObjectGroupPermission({objectId, groupAddress: contentViewers, permission: "access"})
  ];

  await Promise.all(promises);
};

const SetTenantEluvioLiveId = async (client, tenantId, eluvioLiveId) => {
  const tenantAddr = Utils.HashToAddress(tenantId);
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
    metadata: eluvioLiveId,
  });

  const res = await client.FinalizeContentObject({
    libraryId,
    objectId,
    writeToken: e.write_token,
    commitMessage: "Set Eluvio Live object ID " + eluvioLiveId,
  });

  return res;
};

const InitializeTenant = async ({client, kmsId, tenantId, debug=false}) => {
  let tenantAdminId = await client.userProfileClient.TenantId();
  let tenantContractId = await client.userProfileClient.TenantContractId();
  let tenantAdminSigner = client.signer;

  if (!tenantAdminId){
    throw Error("No tenant admin group set for account.");
  }

  if (tenantId !== tenantContractId) {
    throw Error("Signer associated with different tenant", tenantId, tenantContractId);
  }

  const tenantContractAddr = Utils.HashToAddress(tenantId);
  const abi = fs.readFileSync(
    path.resolve(__dirname, "../contracts/v3/BaseTenantSpace.abi")
  );

  const tenantName = await client.CallContractMethod({
    contractAddress: tenantContractAddr,
    abi: JSON.parse(abi),
    methodName: "name",
    methodArgs: [],
    formatArguments: true,
  });

  let groupList = await client.TenantGroup({
    tenantContractId: tenantContractId,
  })
  const tenantAdminGroupAddress = groupList[constants.TENANT_ADMIN]
  const contentAdminGroupAddress = groupList[constants.CONTENT_ADMIN]
  const tenantUserGroupAddress = groupList[constants.TENANT_USER_GROUP]

  const contentViewersGroupAddress = await client.CreateAccessGroup({
    name: `${tenantName} Content Viewers`
  });

  const tenantSlug = tenantName.toLowerCase().replace(/ /g, "-");

  await client.AddAccessGroupManager({
    contractAddress: contentViewersGroupAddress,
    memberAddress: tenantAdminSigner.address
  });


  if (debug){
    console.log("\nTenant Admin Groups ID:\n");
    console.log("\t", await client.userProfileClient.TenantId());

    console.log("\nAccess Groups:\n");
    console.log(`\tOrganization Admins Group: ${tenantAdminGroupAddress}`);
    console.log(`\tContent Admins Group: ${contentAdminGroupAddress}`);
    console.log(`\tContent Viewers Group: ${contentViewersGroupAddress}`);
  }

  let groups = {
    tenantAdminGroupAddress,
    contentAdminGroupAddress,
    tenantUserGroupAddress,
    contentViewersGroupAddress
  };

  /* Content Types - Create Title, Title Collection and Production Master and add each to the groups */

  const typeMetadata = {
    bitcode_flags: "abrmaster",
    bitcode_format: "builtin",
    public: {
      "eluv.displayApp": "default",
      "eluv.manageApp": "default",
    }
  };

  const masterMetadata = {
    bitcode_flags: "abrmaster",
    bitcode_format: "builtin",
    public: {
      "eluv.manageApp": "default",
    }
  };


  const titleTypeId = await client.CreateContentType({
    name: `${tenantName} - Title`,
    metadata: {...typeMetadata}
  });

  await SetObjectPermissions(client, titleTypeId, tenantAdminGroupAddress, contentAdminGroupAddress, contentViewersGroupAddress);

  const titleCollectionTypeId = await client.CreateContentType({
    name: `${tenantName} - Title Collection`,
    metadata: {...typeMetadata}
  });

  await SetObjectPermissions(client, titleCollectionTypeId, tenantAdminGroupAddress, contentAdminGroupAddress, contentViewersGroupAddress);

  const masterTypeId = await client.CreateContentType({
    name: `${tenantName} - Title Master`,
    metadata: {...masterMetadata}
  });

  await SetObjectPermissions(client, masterTypeId, tenantAdminGroupAddress, contentAdminGroupAddress, contentViewersGroupAddress);

  const permissionsTypeId = await client.CreateContentType({
    name: `${tenantName} - Permissions`,
    metadata: {...typeMetadata, public: {"eluv.manageApp": "avails-manager"}}
  });

  await SetObjectPermissions(client, permissionsTypeId, tenantAdminGroupAddress, contentAdminGroupAddress, contentViewersGroupAddress);

  const channelTypeId = await client.CreateContentType({
    name: `${tenantName} - Channel`,
    metadata: {
      ...typeMetadata,
      public: {
        ...typeMetadata.public,
        title_configuration: {
          "controls": [
            "credits",
            "playlists",
            "gallery",
            "channel"
          ],
        }
      }
    }
  });

  await SetObjectPermissions(client, channelTypeId, tenantAdminGroupAddress, contentAdminGroupAddress, contentViewersGroupAddress);

  const streamTypeId = await client.CreateContentType({
    name: `${tenantName} - Live Stream`,
    metadata: {
      bitcode_flags: "playout_live",
      bitcode_format: "builtin",
      public: {
        ...typeMetadata.public,
        title_configuration: {
          "controls":[
            "credits",
            "playlists",
            "gallery",
            "live_stream"
          ]
        }
      }
    }
  });

  await SetObjectPermissions(client, streamTypeId, tenantAdminGroupAddress, contentAdminGroupAddress, contentViewersGroupAddress);
  if (debug) {
    console.log("\nTenant Types:\n");
    console.log(`\t${tenantName} - Title: ${titleTypeId}`);
    console.log(`\t${tenantName} - Title Collection: ${titleCollectionTypeId}`);
    console.log(`\t${tenantName} - Title Master: ${masterTypeId}`);
    console.log(`\t${tenantName} - Permissions: ${permissionsTypeId}`);
    console.log(`\t${tenantName} - Channel: ${channelTypeId}`);
    console.log(`\t${tenantName} - Live Stream: ${streamTypeId}`);
  }

  let tenantTypes = {
    titleTypeId,
    titleCollectionTypeId,
    masterTypeId,
    permissionsTypeId,
    channelTypeId,
    streamTypeId
  };

  let liveTypeIds = {};

  for (let i = 0; i < liveTypes.length; i++) {
    const typeId = await client.CreateContentType({
      name: `${tenantName} - ${liveTypes[i].name}`,
      metadata: {
        ...typeMetadata,
        public: {
          ...typeMetadata.public,
          title_configuration: liveTypes[i].spec
        }
      }
    });

    await SetObjectPermissions(client, typeId, tenantAdminGroupAddress, contentAdminGroupAddress, contentViewersGroupAddress);

    if (debug) {
      console.log(`\t${tenantName} - ${liveTypes[i].name}: ${typeId}`);
    }
    liveTypeIds[liveTypes[i].name] = typeId;
  }

  /* Add ids of services to tenant fabric metadata */
  await SetTenantEluvioLiveId(client, tenantId, liveTypeIds[TYPE_LIVE_TENANT]);

  /* Create libraries - Properties, Title Masters, Title Mezzanines and add each to the groups */

  const propertiesLibraryId = await client.CreateContentLibrary({
    name: `${tenantName} - Properties`,
    kmsId
  });

  await SetLibraryPermissions(client, propertiesLibraryId, tenantAdminGroupAddress, contentAdminGroupAddress, contentViewersGroupAddress);

  const mastersLibraryId = await client.CreateContentLibrary({
    name: `${tenantName} - Title Masters`,
    kmsId
  });

  await SetLibraryPermissions(client, mastersLibraryId, tenantAdminGroupAddress, contentAdminGroupAddress, contentViewersGroupAddress);

  const mezzanineLibraryId = await client.CreateContentLibrary({
    name: `${tenantName} - Title Mezzanines`,
    kmsId,
    metadata: STANDARD_DRM_CERT
  });

  // NFT Templates library not used for now
  /*
  const nftLibraryId = await client.CreateContentLibrary({
    name: `${tenantName} - NFT Templates`,
    kmsId,
    metadata: STANDARD_DRM_CERT
  });

  await SetLibraryPermissions(client, nftLibraryId, tenantAdminGroupAddress, contentAdminGroupAddress, contentViewersGroupAddress);
*/
  if (debug) {
    console.log("\nTenant Libraries:\n");
    console.log(`\t${tenantName} - Properties: ${propertiesLibraryId}`);
    console.log(`\t${tenantName} - Title Masters: ${mastersLibraryId}`);
    console.log(`\t${tenantName} - Title Mezzanines: ${mezzanineLibraryId}`);
    //console.log(`\t${tenantName} - NFT Templates: ${nftLibraryId}`);
  }

  let libraries = {
    propertiesLibraryId,
    mastersLibraryId,
    mezzanineLibraryId,
    //nftLibraryId
  };

  /* Create a site object */

  let objectName = `Site - ${tenantName}`;

  publicMetadata = {
    name: objectName,
    asset_metadata: {
      title: objectName,
      display_title: objectName,
      slug: `site-${tenantSlug}`,
      title_type: "site",
      asset_type: "primary"
    }
  };

  let siteId = await CreateFabricObject({client,
    libraryId: propertiesLibraryId,
    typeId: titleCollectionTypeId,
    publicMetadata,
    tenantAdminGroupAddress,
    contentAdminGroupAddress,
    contentViewersGroupAddress});

  if (debug) {
    console.log("\nSite Object: \n");
    console.log(`\t${objectName}: ${siteId}\n\n`);
  }

  /* Create a marketplace object */

  objectName = `${TYPE_LIVE_MARKETPLACE} - ${tenantName}`;

  publicMetadata = {
    name: objectName,
    asset_metadata: {
      slug: `${tenantSlug}-marketplace`,
      info: {
        tenant_id: tenantId,
        tenant_slug: tenantSlug,
        tenant_name: tenantName,
        branding: {
          color_scheme: "Dark"
        }
      }
    }
  };

  let marketplaceId = await CreateFabricObject({client,
    libraryId: propertiesLibraryId,
    typeId: liveTypeIds[TYPE_LIVE_MARKETPLACE],
    publicMetadata,
    tenantAdminGroupAddress,
    contentAdminGroupAddress,
    contentViewersGroupAddress});

  if (debug) {
    console.log("\nMaketplace Object: \n");
    console.log(`\t${objectName}: ${marketplaceId}\n\n`);
  }

  let marketplaceHash = await client.LatestVersionHash({objectId: marketplaceId});

  /* Create a drop event object */

  objectName = `${TYPE_LIVE_DROP_EVENT_SITE} - ${tenantName}`;

  publicMetadata = {
    name: objectName,
    asset_metadata: {
      info: {
        tenant_id: tenantId,
        tenant_slug: tenantSlug,
        marketplace_info: {
          tenant_slug: tenantSlug,
          marketplace_slug: `${tenantSlug}-marketplace`
        }
      }
    }
  };

  let dropEventId = await CreateFabricObject({client,
    libraryId: propertiesLibraryId,
    typeId: liveTypeIds[TYPE_LIVE_DROP_EVENT_SITE],
    publicMetadata,
    tenantAdminGroupAddress,
    contentAdminGroupAddress,
    contentViewersGroupAddress});

  let dropEventHash = await client.LatestVersionHash({objectId: dropEventId});

  if (debug) {
    console.log("\nDrop Event Site Object: \n");
    console.log(`\t${objectName}: ${dropEventId}\n\n`);
  }

  /* Create the tenant object */

  objectName = `${TYPE_LIVE_TENANT} - ${tenantName}`;

  publicMetadata = {
    name: objectName,
    asset_metadata: {
      info: {
        tenant_id: tenantId
      },
      slug: tenantSlug,
      marketplaces:{
        [`${tenantSlug}-marketplace`]: {
          "/":`/qfab/${marketplaceHash}/meta/public/asset_metadata`,
          "order": 0
        }
      },
      sites: {
        [`${tenantSlug}-drop-event`]: {
          "/":`/qfab/${dropEventHash}/meta/public/asset_metadata`,
          "order": 0
        }
      }
    }
  };

  let tenantObjectId = await CreateFabricObject({client,
    libraryId: propertiesLibraryId,
    typeId: liveTypeIds[TYPE_LIVE_TENANT],
    publicMetadata,
    tenantAdminGroupAddress,
    contentAdminGroupAddress,
    contentViewersGroupAddress});

  if (debug) {
    console.log("\nDrop Event Site Object: \n");
    console.log(`\t${objectName}: ${tenantObjectId}\n\n`);
  }


  return {
    tenantTypes,
    libraries,
    groups,
    siteId,
    marketplaceId,
    dropEventId,
    tenantObjectId
  };
};

const CreateFabricObject = async ({client, libraryId, typeId, publicMetadata, tenantAdminGroupAddress, contentAdminGroupAddress, contentViewersGroupAddress}) => {
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

  await SetObjectPermissions(client, id, tenantAdminGroupAddress, contentAdminGroupAddress, contentViewersGroupAddress);

  return id;
};

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
