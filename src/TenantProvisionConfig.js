// A record of all the objects that are provisioned or need to be provisioned for this tenant
// Object that have been previously created can be set here to avoid recreating (good for
// resuming interrputed provisioning runs)
const tenantProvisionConfig  = {
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

exports.TenantProvisionConfig = { tenantProvisionConfig };