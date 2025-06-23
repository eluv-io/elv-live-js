#!/usr/bin/env node

// make new ml config object from tenant
// and generally check if it's up to date

const { ElvClient } = require("@eluvio/elv-client-js");

var args = [...process.argv]
var finalize = true

args.shift()

tasks = {}
for (arg of args) {
  if (arg.startsWith("-")) {
    if(arg == "--no-finalize") {
      finalize = false
    }
    else {
      throw new Error(`invalid option ${arg}`)
    }
  }
  else if (arg.startsWith("iq__")) {
    tasks[arg] = arg
  }
  else {
    console.log(`ignoring argument ${arg}`)
  }
}

const getClient = async (privateKey) => {
  
  var client = await ElvClient.FromConfigurationUrl({
    configUrl: "https://main.net955305.contentfabric.io/config",
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
    console.error("need to set ADMIN_PRIVATE_KEY")
    process.exitCode = 1
    return null
  }
  
  return await getClient(process.env.ADMIN_PRIVATE_KEY)
}


getClient(process.env.PRIVATE_KEY)
  .then(async (client) => {
    try {
      const tenant = (await client.userProfileClient.TenantContractId()).replace(/^iten/, "iq__")
      const libraryId = tenant.replace("iq__", "ilib")
      
      console.log(tenant)
      
      console.log("library ID??? " + libraryId)
      const pub = await client.ContentObjectMetadata({
        libraryId: libraryId,
        objectId: tenant,
        resolveLinks: false,
        metadataSubtree: "public"
      });

      console.dir(pub, { depth: null });

      if (pub.ml_config == null) {
        console.log("no ml_config yet, need to create one")
        const libs = await client.ContentLibraries();
        //console.dir(libs, { depth: null });
        let proplib = null
        for (const lib of libs) {
          const libmeta = await client.ContentObjectMetadata({
            libraryId: lib,
            objectId: lib.replace("ilib", "iq__"),
            resolveLinks: false,
            metadataSubtree: "public"
          });
          //console.log(lib, '---------')
          console.dir(libmeta, { depth: null });
          if ( ("" + libmeta?.name).toLowerCase().includes("properties") ) {
            proplib = lib
            break
          }
        }
        if (proplib == null) {
          console.log("Could not find properties library for tenant");
          process.exitCode = 1
          return
        }
        console.log(`Properties library ${proplib}`)
        
        let contentTypeHash = null
        
        if (pub?.content_types?.title != null) {
          contentTypeHash = await client.LatestVersionHashV2({objectId: pub.content_types.title})
          console.log(`content type hash: ${contentTypeHash}`)
        }

        let publicmeta = { 
          "name": "ml-config object",
        }

        if (pub.search) publicmeta.search = pub.search

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

        console.dir(mlconfig, { depth: null });

        console.log("---- tenant finalize ----")
        finaltenant = await adminClient.FinalizeContentObject({
          libraryId: libraryId, 
          objectId: tenant,
          writeToken,
          commitMessage: `point at ml_config ${mlconfig.id} -- scripted mlconfig creation`,
        });

        console.dir(finaltenant, { depth: null });

        //const libraryId = await client.ContentObjectLibraryId({
        //  objectId: tenant,
        //});
        
      }
      else {
        console.log("ml_config exists, checking");
      }
      
      return
      
      
      for (let objectId in tasks) {

        files = await client.ContentObjectMetadata({
          libraryId: libraryId,
          objectId: objectId,
          metadataSubtree: "files/assets"
        });
        
        console.dir(files, {depth: null});
        console.log("--------------------------");
        
        assets = await client.ContentObjectMetadata({
          libraryId: libraryId,
          objectId: objectId,
          metadataSubtree: "assets",
          resolveLinks: true

        });

        if (!assets) assets = {}
        
        console.dir(assets, {depth: null});

        verhash = await client.LatestVersionHashV2({objectId: objectId})
        console.log(`VERSION ${verhash}`)

        // create an inverted index from file fields under existing assets
        // this way we know if it's REALLY linked
        inverted = {}
        for (asset of Object.values(assets)) {
          container = asset?.file?.['.']?.container
          slash = asset?.file?.['/']
          //console.log(asset)
          decode =  client.utils.DecodeVersionHash(container).objectId;
          console.log(`${container} ${slash} and object ${decode}`)
          if (decode !== objectId) {
            console.log(`Some other object ${decode}`)
            continue
          }
          if (!slash.startsWith("./files/assets/")) {
            console.log(`Some other path ${slash}`)
            continue
          }

          filename = slash.split("/").slice(-1)

          inverted[filename] = true                    
        }

        let redo = false
        if (process.env.ASSET_REDO === "redo") {
          redo = true
        }
        
        changed = false
        for (file in files) {
          if (file === ".") {
            continue
          }
          else if (!redo && inverted[file] != null) {
            console.log(`${file} is linked as an asset`)
          }
          else if (!redo && assets[file] != null) {
            throw new Error(`hey ${file} can't be created because it already exists as an asset key`)
          }
          else {
            console.log(`${file} DOES NOT exist in assets`)
            assets[file] = {
              asset_type: "Image",
              attachment_content_type: "image/jpeg",
              file: {
                '.': {
                  auto_update: { tag: 'latest' },
                  container: verhash
                },
                '/': `./files/assets/${file}`
              },
            }
            changed = true
            
          }          
        }

        console.log(`----newfiles----changed:${changed}---------`);
        console.dir(assets, {depth: null});

        if (!changed) continue;

        const editResponse = await client.EditContentObject({
          libraryId,
          objectId,
        });
        const writeToken = editResponse.write_token;
        console.log(objectId);
        console.log(writeToken);
        await client.ReplaceMetadata({libraryId, objectId, writeToken, metadataSubtree: "assets", metadata: assets})
        
        if (finalize) {
          await client.FinalizeContentObject({
            libraryId,
            objectId,
            writeToken,
            commitMessage: process.env.COMMIT_MESSAGE || "assetize the assets (joe)",
          });
        }
        else {
          console.log(`not finalizing ${objectId} -- write token is: ${writeToken}`)
        }
      }
    } catch (err) {
      console.log(err);
    }
  })
  .catch((err) => {
    console.log(err);
  });
