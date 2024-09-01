// A record of all the objects that are provisioned or need to be provisioned for this tenant
// Object that have been previously created can be set here to avoid recreating (good for
// resuming interrputed provisioning runs)
// Object that don't want to be created can be set here as "none"
const tenantProvisionConfig = {
  base: {
    tenantOpsKey: "",
    contentOpsKey: "",
    groups : {
      "tenantAdminGroupAddress": "",
      "contentAdminGroupAddress": ""
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
  },
  liveStreaming: {
    siteId: null,
  },
  mediaWallet: {
    liveTypes: {
      "NFT Collection": null,
      "NFT Template": null,
      "Media Wallet Drop Event Site": null,
      "Media Wallet Marketplace": null,
      "Media Wallet Tenant": null,
    },
    objects: {
      marketplaceId: "",
      marketplaceHash: null,
      dropEventId: null,
      dropEventHash: null,
      tenantObjectId: null,
    }
  }
};

exports.TenantProvisionConfig = { tenantProvisionConfig };