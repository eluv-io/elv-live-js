/* Sample Code (upload video media file to newly created media library)
    - Create Content Library
    - Create Master Object 
    - Create Mezzanine (playable) Object

    export PRIVATE_KEY - set to the private key of an account with
                        rights to the content object.
*/
const { ElvClient } = require("@eluvio/elv-client-js");
const { runUtility } = require('@eluvio/elv-utils-js');
const MasterCreate = require('@eluvio/elv-utils-js/MasterCreate.js');
const MezCreate = require('@eluvio/elv-utils-js/MezCreate.js');

var client;

/* Sample configuration */
const tenant = "iten4TXq2en3qtu3JREnE5tSLRf9zLod";
const masterType = 'iq__21UX3VvHrDz6Mt79ZiHd3VnfE6b5';
const mezType = 'iq__3Qjj532LXGUKFe896QAFY4HAAH67';
const mediaTitle = "Title of Test Media Object";

// Can set configUrl as additional additionalEnvVars (export CONFIG_URL='') or as command flag
const configUrl = "https://demov3.net955210.contentfabric.io/config";



/**
 * Create Content Library
 *  
 * @param {string} name - Given library name
 * @param {string} description - Given library description (optional)
 * @param {string} tenant - tenant ID in 'iten' format (optional)
 * @param {Object} metadata - metadata of library object (optional)
 * @returns {Promise<Object>} - Library Object ID (ilib...)
 */

const CreateContentLibrary = async({name, description, tenant, metadata}) => {

    const lib =  await client.CreateContentLibrary({
        name,
        description,
        tenantId: tenant,
        metadata
    });

    return lib;
}




/**
 * Create Playable Media Object (using elv-utils-js)
 *
 * @param {string} title - Given media object title (Sample uses same title for both Mez and Master objects)
 * @param {string} masterLibId - Master Objects library ID (ilib...)
 * @param {string} mezLibId - Mezzanine Objects library ID (ilib...)
 * @param {string} masterType - Master object content type (iq_...)
 * @param {string} mezType - Mezzanine object content type (iq_...)
 * @param {Array} files - path to media files
 * @param {string} abrProfilePath - path to ABR profile file (json)
 */

const CreateMediaObject = async(
    {
        title, 
        masterLibId,
        mezLibId,
        files, 
        masterType, 
        mezType,
        abrProfilePath,
        additionalEnvVars = {}
    }) => {
        
    if (files.constructor !== Array) {
        throw Error('master Files must be an array')
    }

    const masterObject = await runUtility(
        MasterCreate,
        [
            '--title', title,
            '--files', ...files,
            '--libraryId', masterLibId,
            '--type', masterType,
            '--configUrl', configUrl
        ],
        {
            env: additionalEnvVars
        }
    )

    const masterHash = masterObject.data.version_hash;

    const mezObject = await runUtility(
        MezCreate,
        [
            '--libraryId', mezLibId,
            '--type', mezType,
            '--title', title,
            '--masterHash', masterHash,
            '--abrProfile', abrProfilePath,
            '--configUrl', configUrl,
            '--wait'
        ],
        {
            env: additionalEnvVars
        }
    )

    return mezObject;
}




const Run = async ({}) => {
    try {

        // Initialize client using environment variable PRIVATE_KEY
        client = await ElvClient.FromNetworkName({networkName: "demov3"}); // "demov3" "main"

        let wallet = client.GenerateWallet();
        let signer = wallet.AddAccount({
        privateKey: process.env.PRIVATE_KEY
        });
        client.SetSigner({signer});
        client.ToggleLogging(false);

        // Create Library Objects for each type of object
        const masterLibId = await CreateContentLibrary({
                name: "Title Master - test library ii", 
                description: "Creating master library for master objects test",
                tenant: tenant,
                metadata: 'samples/example_files/library_metadata_simple_ingest.json'
            });
        console.log("NEW MASTER LIB", masterLibId);

        const mezLibId = await CreateContentLibrary({
                name: "Titles - test library ii", 
                description: "Creating mezzanine library for mezzanine objects test",
                tenant: tenant,
                metadata: 'samples/example_files/library_metadata_simple_ingest.json'
            });
        console.log("NEW MEZ LIB", mezLibId);

        // Create Media Object
        await CreateMediaObject(
            {
                title: mediaTitle, 
                masterLibId,
                mezLibId,
                files: [
                    "/Users/Desktop/NACDA BOOTH TV VIDEO_4K.mp4"
                ],
                masterType, 
                mezType,
                abrProfilePath: "samples/example_files/abr_profile_no_drm_store_clear.json"
            }
        )

        console.log("ALL DONE");

    } catch (e) {
        console.error("ERROR:", e);
    }
}

Run({});

