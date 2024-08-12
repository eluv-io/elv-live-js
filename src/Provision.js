/* eslint-disable no-console */
const fs = require("fs");
const path = require("path");
const { ElvUtils } = require("../src/Utils");
const Utils = require("@eluvio/elv-client-js/src/Utils.js");

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

const SetLibraryPermissions = async (client, libraryId, tenantAdmins, contentAdmins) => {
  const promises = [
    // Tenant admins
    client.AddContentLibraryGroup({libraryId, groupAddress: tenantAdmins, permission: "accessor"}),
    client.AddContentLibraryGroup({libraryId, groupAddress: tenantAdmins, permission: "contributor"}),

    // Content admins
    client.AddContentLibraryGroup({libraryId, groupAddress: contentAdmins, permission: "accessor"}),
    client.AddContentLibraryGroup({libraryId, groupAddress: contentAdmins, permission: "contributor"}),

  ];

  await Promise.all(promises);
};

const SetObjectPermissions = async (client, objectId, tenantAdmins, contentAdmins) => {
  let promises = [
    // Tenant admins
    client.AddContentObjectGroupPermission({objectId, groupAddress: tenantAdmins, permission: "manage"}),

    // Content admins
    client.AddContentObjectGroupPermission({objectId, groupAddress: contentAdmins, permission: "manage"}),
  ];

  await Promise.all(promises);
};

const SetTenantEluvioLiveId = async (client, tenantId, t) => {
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
    metadata: t.liveTypes[TYPE_LIVE_TENANT],
  });

  await client.ReplaceMetadata({
    libraryId,
    objectId,
    writeToken: e.write_token,
    metadataSubtree: "public/content_types",
    metadata: {
      "title": t.tenantTypes.titleTypeId,
      "title_master": t.tenantTypes.masterTypeId,
      "live_stream": t.tenantTypes.streamTypeId
    },
  });

  await client.ReplaceMetadata({
    libraryId,
    objectId,
    writeToken: e.write_token,
    metadataSubtree: "public/sites",
    metadata: {
      "live_streams": t.siteId
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

const InitializeTenant = async ({client, kmsId, tenantId, debug=false}) => {
  let tenantAdminId = await client.userProfileClient.TenantId();
  let tenantContractId = await client.userProfileClient.TenantContractId();
  let tenantAdminSigner = client.signer;

  if (!tenantAdminId){
    throw Error("No tenant admin group set for account.");
  }

  if (tenantId != tenantContractId) {
    throw Error("Signer associated with different tenant", tenantId, tenantContractId);
  }

  const tenantAddr = Utils.HashToAddress(tenantId);
  const abi = fs.readFileSync(
    path.resolve(__dirname, "../contracts/v3/BaseTenantSpace.abi")
  );

  // A record of all the objects that are provisioned or need to be provisioned for this tenant
  // Object that have been previously created can be set here to avoid recreating (good for
  // resuming interrputed provisioning runs)
  var t  = {
    groups : {
      "tenantAdminGroupAddress": null,
      "contentAdminGroupAddress": null
    },
    tenantTypes: {
      "titleTypeId": "",
      "titleCollectionTypeId": null,
      "masterTypeId": null,
      "permissionsTypeId": null,
      "channelTypeId": null,
      "streamTypeId": null
    },
    liveTypes: {
      "Eluvio LIVE Drop Event Site": null,
      "Eluvio LIVE Marketplace": null,
      "Eluvio LIVE Tenant": null,
      "NFT Collection": null,
      "NFT Template": null
    },
    libraries: {
      "mastersLibraryId": null,
      "mezzanineLibraryId": null,
      "propertiesLibraryId": null
    },
    siteId: null,
    marketplaceId: null,
    dropEventId: null
  };

  t.tenantName = await client.CallContractMethod({
    contractAddress: tenantAddr,
    abi: JSON.parse(abi),
    methodName: "name",
    methodArgs: [],
    formatArguments: true,
  });

  t.tenantSlug = t.tenantName.toLowerCase().replace(/ /g, "-");

  t.groups.tenantAdminGroupAddress = await client.CallContractMethod({
    contractAddress: tenantAddr,
    abi: JSON.parse(abi),
    methodName: "groupsMapping",
    methodArgs : ["tenant_admin", 0],
    formatArguments: true,
  });

  t.groups.contentAdminGroupAddress = await client.CallContractMethod({
    contractAddress: tenantAddr,
    abi: JSON.parse(abi),
    methodName: "groupsMapping",
    methodArgs: ["content_admin", 0],
    formatArguments: true,
  });

  if (debug){
    console.log("\nAccess Groups:\n");
    console.log(JSON.stringify(t.groups, null, 2));
  }

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

  if (!t.tenantTypes.titleTypeId) {
    t.tenantTypes.titleTypeId = await client.CreateContentType({
      name: `${t.tenantName} - Title`,
      metadata: {...typeMetadata}
    });
    await SetObjectPermissions(client, t.tenantTypes.titleTypeId, t.groups.tenantAdminGroupAddress, t.groups.contentAdminGroupAddress);
  }

  if (!t.tenantTypes.titleCollectionTypeId) {
    t.tenantTypes.titleCollectionTypeId = await client.CreateContentType({
      name: `${t.tenantName} - Title Collection`,
      metadata: {...typeMetadata}
    });

    await SetObjectPermissions(client, t.tenantTypes.titleCollectionTypeId, t.groups.tenantAdminGroupAddress, t.groups.contentAdminGroupAddress);
  }

  if (!t.tenantTypes.masterTypeId) {
    t.tenantTypes.masterTypeId = await client.CreateContentType({
      name: `${t.tenantName} - Title Master`,
      metadata: {...masterMetadata}
    });

    await SetObjectPermissions(client, t.tenantTypes.masterTypeId, t.groups.tenantAdminGroupAddress, t.groups.contentAdminGroupAddress);
  }

  if (!t.tenantTypes.permissionsTypeId) {
    t.tenantTypes.permissionsTypeId = await client.CreateContentType({
      name: `${t.tenantName} - Permissions`,
      metadata: {...typeMetadata, public: {"eluv.manageApp": "avails-manager"}}
    });

    await SetObjectPermissions(client, t.tenantTypes.permissionsTypeId, t.groups.tenantAdminGroupAddress, t.groups.contentAdminGroupAddress);
  }

  if (!t.tenantTypes.channelTypeId) {
    t.tenantTypes.channelTypeId = await client.CreateContentType({
      name: `${t.tenantName} - Channel`,
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

    await SetObjectPermissions(client, t.tenantTypes.channelTypeId, t.groups.tenantAdminGroupAddress, t.groups.contentAdminGroupAddress);
  }

  if (!t.tenantTypes.streamTypeId) {
    t.tenantTypes.streamTypeId = await client.CreateContentType({
      name: `${t.tenantName} - Live Stream`,
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

    await SetObjectPermissions(client, t.tenantTypes.streamTypeId, t.groups.tenantAdminGroupAddress, t.groups.contentAdminGroupAddress);
  }

  if (debug) {
    console.log("\nTenant Types:\n");
    console.log(JSON.stringify(t.tenantTypes, null, 2));
  }

  for (let i = 0; i < liveTypes.length; i++) {
    if (t.liveTypes[liveTypes[i].name]) continue;
    const typeId = await client.CreateContentType({
      name: `${t.tenantName} - ${liveTypes[i].name}`,
      metadata: {
        ...typeMetadata,
        public: {
          ...typeMetadata.public,
          title_configuration: liveTypes[i].spec
        }
      }
    });

    await SetObjectPermissions(client, typeId, t.groups.tenantAdminGroupAddress, t.groups.contentAdminGroupAddress);

    if (debug) {
      console.log(`\t${t.tenantName} - ${liveTypes[i].name}: ${typeId}`);
    }
    t.liveTypes[liveTypes[i].name] = typeId;
  }

  console.log(JSON.stringify(t.liveTypes, null, 2));

  /* Create libraries - Properties, Title Masters, Title Mezzanines and add each to the groups */

  if (!t.libraries.propertiesLibraryId) {
    t.libraries.propertiesLibraryId = await client.CreateContentLibrary({
      name: `${t.tenantName} - Properties`,
      kmsId
    });

    await SetLibraryPermissions(client, t.libraries.propertiesLibraryId, t.groups.tenantAdminGroupAddress, t.groups.contentAdminGroupAddress);
  }

  if (!t.libraries.mastersLibraryId) {
    t.libraries.mastersLibraryId = await client.CreateContentLibrary({
      name: `${t.tenantName} - Title Masters`,
      kmsId
    });

    await SetLibraryPermissions(client, t.libraries.mastersLibraryId, t.groups.tenantAdminGroupAddress, t.groups.contentAdminGroupAddress);
  }

  if (!t.libraries.mezzanineLibraryId) {
    t.libraries.mezzanineLibraryId = await client.CreateContentLibrary({
      name: `${t.tenantName} - Title Mezzanines`,
      kmsId,
      metadata: STANDARD_DRM_CERT
    });

    await SetLibraryPermissions(client, t.libraries.mezzanineLibraryId, t.groups.tenantAdminGroupAddress, t.groups.contentAdminGroupAddress);
  }

  if (debug) {
    console.log("\nTenant Libraries:\n");
    console.log(JSON.stringify(t.libraries, null, 2));
  }

  /* Create a site object */
  // TODO name this siteLiveStreamsId
  if (!t.siteId) {
    let objectName = `Site - Live Streams`;

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

    t.siteId = await CreateFabricObject({client,
      libraryId: t.libraries.propertiesLibraryId,
      typeId: t.tenantTypes.titleCollectionTypeId,
      publicMetadata,
      tenantAdminGroupAddress: t.groups.tenantAdminGroupAddress,
      contentAdminGroupAddress: t.groups.contentAdminGroupAddress});
    if (debug) {
      console.log("\nSite Live Streams Object", t.siteId);
    }
  }

  /* Create a marketplace object */
  if (!t.marketplaceId) {
    objectName = `${TYPE_LIVE_MARKETPLACE} - ${t.tenantName}`;

    publicMetadata = {
      name: objectName,
      asset_metadata: {
        slug: `${t.tenantSlug}-marketplace`,
        info: {
          tenant_id: t.tenantId,
          tenant_slug: t.tenantSlug,
          tenant_name: t.tenantName,
          branding: {
            color_scheme: "Dark"
          }
        }
      }
    };

    t.marketplaceId = await CreateFabricObject({client,
      libraryId: t.libraries.propertiesLibraryId,
      typeId: t.liveTypes[TYPE_LIVE_MARKETPLACE],
      publicMetadata,
      tenantAdminGroupAddress: t.groups.tenantAdminGroupAddress,
      contentAdminGroupAddress: t.groups.contentAdminGroupAddress});

    if (debug) {
      console.log("\nMaketplace Object: \n");
      console.log(`\t${objectName}: ${t.marketplaceId}\n\n`);
    }
  }

  t.marketplaceHash = await client.LatestVersionHash({objectId: t.marketplaceId});

  /* Create a drop event object */
  if (!t.dropEventId) {
    objectName = `${TYPE_LIVE_DROP_EVENT_SITE} - ${t.tenantName}`;

    publicMetadata = {
      name: objectName,
      asset_metadata: {
        info: {
          tenant_id: t.tenantId,
          tenant_slug: t.tenantSlug,
          marketplace_info: {
            tenant_slug: t.tenantSlug,
            marketplace_slug: `${t.tenantSlug}-marketplace`
          }
        }
      }
    };

    t.dropEventId = await CreateFabricObject({client,
      libraryId: t.libraries.propertiesLibraryId,
      typeId: t.liveTypes[TYPE_LIVE_DROP_EVENT_SITE],
      publicMetadata,
      tenantAdminGroupAddress: t.groups.tenantAdminGroupAddress,
      contentAdminGroupAddress: t.groups.contentAdminGroupAddress});

    if (debug) {
      console.log("\nDrop Event Site Object: \n");
      console.log(`\t${objectName}: ${t.dropEventId}\n\n`);
    }
  }

  t.dropEventHash = await client.LatestVersionHash({objectId: t.dropEventId});


  /* Create the tenant object */
  if (!t.tenantObjectId) {
    objectName = `${TYPE_LIVE_TENANT} - ${t.tenantName}`;

    publicMetadata = {
      name: objectName,
      asset_metadata: {
        info: {
          tenant_id: t.tenantId
        },
        slug: t.tenantSlug,
        marketplaces:{
          [`${t.tenantSlug}-marketplace`]: {
            "/":`/qfab/${t.marketplaceHash}/meta/public/asset_metadata`,
            "order": 0
          }
        },
        sites: {
          [`${t.tenantSlug}-drop-event`]: {
            "/":`/qfab/${t.dropEventHash}/meta/public/asset_metadata`,
            "order": 0
          }
        }
      }
    };

    t.tenantObjectId = await CreateFabricObject({client,
      libraryId: t.libraries.propertiesLibraryId,
      typeId: t.liveTypes[TYPE_LIVE_TENANT],
      publicMetadata,
      tenantAdminGroupAddress: t.groups.tenantAdminGroupAddress,
      contentAdminGroupAddress: t.groups.contentAdminGroupAddress});

    if (debug) {
      console.log("\nDrop Event Site Object: \n");
      console.log(`\t${objectName}: ${t.tenantObjectId}\n\n`);
    }

    /* Add ids of services to tenant fabric metadata */
    console.log("Tenant content object - set types and sites");
    await SetTenantEluvioLiveId(client, tenantId, t);
  }

  return t;
};

const CreateFabricObject = async ({client, libraryId, typeId, publicMetadata, tenantAdminGroupAddress, contentAdminGroupAddress}) => {
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

  await SetObjectPermissions(client, id, tenantAdminGroupAddress, contentAdminGroupAddress);

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
