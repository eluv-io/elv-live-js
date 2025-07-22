#!/usr/bin/env node

// make new ml config object from tenant
// and generally check if it's up to date

const { ElvClient } = require("@eluvio/elv-client-js");

const CONFIG_URL = "https://main.net955305.contentfabric.io/config"

const getClient = async (privateKey) => {

  var client = await ElvClient.FromConfigurationUrl({
    configUrl: CONFIG_URL,
  });
  const wallet = client.GenerateWallet();
  const signer = wallet.AddAccount({
    privateKey: privateKey,
  });
  client.SetSigner({ signer });
  return client;
};

const getAdminClient = async() => {
  
  if (process.env.ADMIN_PRIVATE_KEY == null) {
    throw new Error("need to set ADMIN_PRIVATE_KEY")
  }
  
  return await getClient(process.env.ADMIN_PRIVATE_KEY)
}

const getRegularClient = async() => {
  
  if (process.env.PRIVATE_KEY == null) {
    throw new Error("need to set PRIVATE_KEY")
  }
  
  return await getClient(process.env.PRIVATE_KEY)
}

// find the "properties" library
async function findPropertiesLib(client) {
  const libs = await client.ContentLibraries();
  let proplib = null;
  for (const lib of libs) {
    const libmeta = await client.ContentObjectMetadata({
      libraryId: lib,
      objectId: lib.replace("ilib", "iq__"),
      resolveLinks: false,
      metadataSubtree: "public"
    });
    //console.log(lib, '---------')
    //console.dir(libmeta, { depth: null });
    if (("" + libmeta?.name).toLowerCase().includes("properties")) {
      if (proplib) {
        throw new Error("multiple libraries matching properties library??")
      }
      proplib = lib;
    }
  }
  return proplib;
}


getRegularClient()
  .then(async (client) => {
    try {
      // convert tenant to iq, and lib is the same as the iq
      const tenant = (await client.userProfileClient.TenantContractId()).replace(/^iten/, "iq__")
      const libraryId = tenant.replace("iq__", "ilib")
      
      console.log(" tenant: " + tenant)      
      console.log("library: " + libraryId)
      
      const pubTenantMeta = await client.ContentObjectMetadata({
        libraryId: libraryId,
        objectId: tenant,
        resolveLinks: false,
        metadataSubtree: "public"
      });
      console.log("--- Tenant object public metadata")
      console.dir(pubTenantMeta, { depth: null });
      console.log("---")

      if (pubTenantMeta.ml_config == null) {
        console.log("no ml_config yet, need to create one")
        let proplib = await findPropertiesLib(client);
        if (proplib == null) {
          throw new Error("Could not find properties library for tenant, don't know where to create ml config object");
        }
        console.log(`Properties library ${proplib}`)
        
        let contentTypeHash = null
        
        if (pubTenantMeta?.content_types?.title != null) {
          contentTypeHash = await client.LatestVersionHashV2({objectId: pubTenantMeta.content_types.title})
          console.log(`content type hash: ${contentTypeHash}`)
        }

        let publicmeta = { 
          "name": "ml-config object",
        }

        if (pubTenantMeta.search) publicmeta.search = pubTenantMeta.search

        const adminClient = await getAdminClient()

        const editResponse = await adminClient.EditContentObject({
          libraryId: libraryId,
          objectId: tenant
        });
        const writeToken = editResponse.write_token;
        console.log(`tenant object editResponse: ${writeToken}`);

        console.log(`create the ml config (non-tenant) object`);
        
        // create the ml config (non-tenant) object
        const mlconfig = await client.CreateContentObject({
          "libraryId": proplib,
          "options": {
            "type": contentTypeHash,
            "meta": {
              "public": publicmeta
            },
            "visibility": 0
          }
        });
        
        console.dir(mlconfig, { depth: null });

        console.log("set ml_config iq in tenant object write token")
        await adminClient.ReplaceMetadata({libraryId: libraryId, objectId: tenant, writeToken, metadataSubtree: "public/ml_config", metadata: mlconfig.id})

        console.log("---- ml config finalize ----")
        finalmlconfig = await client.FinalizeContentObject({
          libraryId: proplib,
          objectId: mlconfig.id,
          writeToken: mlconfig.writeToken,
          commitMessage: `create ml_config from tenant object ${tenant} -- scripted mlconfig creation`,
        });
        console.dir(finalmlconfig, { depth: null})
        
        console.log("---- setting ml config object to public ----")
        
        await client.SetPermission({
          objectId: mlconfig.id,
          permission: "public"
        });
        
        console.dir(finalmlconfig, { depth: null });

        if (pubTenantMeta.search) {
          // delete off existing tenant search config
          await adminClient.DeleteMetadata({libraryId: libraryId, objectId: tenant, writeToken, metadataSubtree: "public/search", metadata: mlconfig.id})
        }
        
        console.log("---- tenant finalize ----")
        finaltenant = await adminClient.FinalizeContentObject({
          libraryId: libraryId, 
          objectId: tenant,
          writeToken,
          commitMessage: `point at ml_config ${mlconfig.id} -- scripted mlconfig creation`,
        });

        console.dir(finaltenant, { depth: null });       
      }
      else {
        console.log("ml_config exists already");
      }
      
    } catch (err) {
      console.log(err);
    }
  })
  .catch((err) => {
    console.log(err);
  });
