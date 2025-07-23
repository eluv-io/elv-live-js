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

// get the content admin group
function getContentAdminGroup(groups) {

  const filtered = groups.filter((g) => g.meta?.name?.toLowerCase().includes("content admin"))

  if (filtered.length != 1) {
    console.log("Access Groups:")
    console.log(groups)
    console.log("")
    throw new Error("did not find exactly one content admin group")    
  }

  return filtered[0].address
}

getRegularClient()
  .then(async (client) => {
    try {
      // convert tenant to iq
      const iten = await client.userProfileClient.TenantContractId()
      const tenantObject = iten.replace(/^iten/, "iq__")
      
      console.log(" tenant: " + tenantObject)      

      const conf = await client.Configuration({configUrl: CONFIG_URL})
      const spaceId = conf.contentSpaceId
      console.log(spaceId);

      let libraryId = await client.ContentObjectLibraryId({objectId: tenantObject})
      console.log("libraryId according to ecjs: " + libraryId)
      
      if (libraryId != spaceId.replace("ispc", "ilib")) {
        if (process.argv.slice(-1)[0] == libraryId) {
          console.warn(`libraryId is NOT the space ID, it is ${libraryId}.  still pausing 4 seconds so you may reconsider...\n`)
          await new Promise(resolve => setTimeout(resolve, 4000))
        }
        else {
          throw new Error(`libraryId is NOT the space ID, it is ${libraryId}.  this might be okay but you should check with serban.\n` +
                          `To proceed anyway, run the script with ${libraryId} as an argument to allow this.`)
        }
      }

      const pubTenantMeta = await client.ContentObjectMetadata({
        libraryId: libraryId,
        objectId: tenantObject,
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
          contentTypeHash = await client.LatestVersionHash({objectId: pubTenantMeta.content_types.title})
        }

        console.log(`content type hash: ${contentTypeHash}`)

        const agroups = await client.ListAccessGroups()
        //console.dir(agroups, {depth: null})
        const contentAdminGroup = getContentAdminGroup(agroups)
        console.log(`content admin group: ${contentAdminGroup}`);        
        
        let publicmeta = { 
          "name": `ML Settings`,
        }

        if (pubTenantMeta.search) publicmeta.search = pubTenantMeta.search

        const adminClient = await getAdminClient()
        const itenAdmin = await adminClient.userProfileClient.TenantContractId()

        if (itenAdmin != iten) {
          throw new Error(`tenant of ADMIN_PRIVATE_KEY (${itenAdmin}) != tenant of PRIVATE_KEY (${iten})`)
        }

        const editResponse = await adminClient.EditContentObject({
          libraryId: libraryId,
          objectId: tenantObject
        });
        const writeToken = editResponse.write_token;
        console.log(`tenant: tenantObject object editResponse: ${writeToken}`);

        console.log(`create the ml config (non-tenantObject) object`);
        
        // create the ml config (non-tenant) object
        // future: use existing object, open write token
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
        await adminClient.ReplaceMetadata({libraryId: libraryId, objectId: tenantObject, writeToken, metadataSubtree: "public/ml_config", metadata: mlconfig.id})


        console.log("---- setting ml config object to public ----")
        
        await client.SetPermission({
          objectId: mlconfig.id,
          permission: "public",
          writeToken: mlconfig.writeToken
        });        

        console.log("---- ml config finalize ----")
        finalmlconfig = await client.FinalizeContentObject({
          libraryId: proplib,
          objectId: mlconfig.id,
          writeToken: mlconfig.writeToken,
          commitMessage: `create ml_config from tenantObject object ${tenantObject} -- scripted mlconfig creation`,
        });
        console.dir(finalmlconfig, { depth: null})
        
        console.log("---- setting content admin group write permission on ml config object ----")
        await client.AddContentObjectGroupPermission({
          objectId: mlconfig.id,
          groupAddress: contentAdminGroup,
          permission: "manage"
        })
        
        if (pubTenantMeta.search) {
          // delete off existing tenant search config
          await adminClient.DeleteMetadata({libraryId: libraryId, objectId: tenantObject, writeToken, metadataSubtree: "public/search", metadata: mlconfig.id})
        }
        
        console.log("---- tenant object finalize ----")
        finaltenant = await adminClient.FinalizeContentObject({
          libraryId: libraryId, 
          objectId: tenantObject,
          writeToken,
          commitMessage: `point at ml_config ${mlconfig.id} -- scripted mlconfig creation`,
        });

        console.dir(finaltenant, { depth: null });       
      }
      else {
        console.log("ml_config exists already, not doing anything");
      }
      
    } catch (err) {
      console.log(err);
    }
  })
  .catch((err) => {
    console.log(err);
  });
