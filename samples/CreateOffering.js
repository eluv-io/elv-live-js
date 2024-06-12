/* Sample Code (Create new media offering for given mezzanine object ID)
    - Copy 'default' offering to create new one
    - Add image watermark
    - Add subtitle files

    export PRIVATE_KEY - set to the private key of an account with
                        rights to the content object.
*/
const { ElvClient } = require("@eluvio/elv-client-js");
const { runUtility } = require('@eluvio/elv-utils-js');
const MezCopyOffering = require('@eluvio/elv-utils-js/MezCopyOffering.js');
const OfferingSetTextWatermark = require('@eluvio/elv-utils-js/OfferingSetTextWatermark.js');
const OfferingSetImageWatermark = require('@eluvio/elv-utils-js/OfferingSetImageWatermark.js');
const OfferingAddSubtitles = require('@eluvio/elv-utils-js/OfferingAddSubtitles.js')

var client;

/* Sample configuration */
const objectId = 'iq__45ACcWVMjcwpQCCLBvfGyWRFjkCj';
const libraryId = 'ilibkfVcNydZyXB7HNsfrAbYTQuaaQ9';

// Can set configUrl as additional additionalEnvVars (export CONFIG_URL='') or as command flag
const configUrl = "https://demov3.net955210.contentfabric.io/config";




/**
 * Create new media offering from 'default' offering
 *  
 * @param {string} objectId - Id of object (iq_...)
 * @param {string} offeringKey - Offering key to copy (i.e. 'default')
 * @param {string} newOfferingKey - New offering being created
 * @returns {Promise<Object>} - New version of Object ID (iq...)
 */

const createNewOffering = async (
    {
        objectId,
        offeringKey,
        newOfferingKey,
        additionalEnvVars = {}
    }
) => {

    const copyOffering = await runUtility(
        MezCopyOffering, 
        [
            '--objectId', objectId,
            '--offeringKey', offeringKey,
            '--newOfferingKey', newOfferingKey,
            '--configUrl', configUrl
        ],
        {
            env: additionalEnvVars
        }
    )

    return copyOffering;
}





/**
 * Add text watermark to newly created media offering ('offering-2')
 *  
 * @param {string} objectId - Id of object (iq_...)
 * @param {string} offeringKey - Offering key where watermarks will be added to
 * @param {string} libraryId - Library ID
 * @param {string} textWatermark - Either a JSON string for watermark settings, or the path to JSON file containing the watermark settings
 * @returns {Promise<Object>} - New version of Object ID (iq...)
 */

const addTextWatermarks = async (
    {
        objectId,
        offeringKey,
        libraryId,
        textWatermark,
        additionalEnvVars = {}
    }
) => {

    const setTextWatermark = await runUtility(
        OfferingSetTextWatermark,
        [
            '--objectId', objectId,
            '--offeringKey', offeringKey,
            '--libraryId', libraryId,
            '--watermark', textWatermark,
            '--configUrl', configUrl
        ],
        {
            env: additionalEnvVars
        }
    )

    return setTextWatermark
}





/**
 * Add image watermark to newly created media offering ('offering-2')
 *  
 * @param {string} objectId - Id of object (iq_...)
 * @param {string} offeringKey - Offering key where watermarks will be added to
 * @param {string} libraryId - Library ID
 * @param {string} imageWatermark - Either a JSON string for watermark settings, or the path to JSON file containing the watermark settings
 * @returns {Promise<Object>} - New version of Object ID (iq...)
 */

const addImageWatermarks = async (
    {
        objectId,
        offeringKey,
        libraryId,
        imageWatermark,
        additionalEnvVars = {}
    }
) => {
    const setImageWatermark = await runUtility(
        OfferingSetImageWatermark,
        [
            '--objectId', objectId,
            '--offeringKey', offeringKey,
            '--libraryId', libraryId,
            '--watermark', imageWatermark,
            '--configUrl', configUrl
        ],
        {
            env: additionalEnvVars
        }
    )

    return setImageWatermark
}





/**
 * Adds a subtitle stream to a newly created offering ('offering-2')
 *  
 * @param {string} objectId - ID of object (iq_...)
 * @param {string} streamKey - Will become part of the URL that is used to retrieve the subtitle stream (e.g. subtitles-en or subtitles-en-forced)
 * @param {string} language - Specific language code for the stream
 * @param {string} label - How stream will be listed in player subtitle menus
 * @param {string} file - Path to file in WebVTT format
 * @param {string} offeringKey - Key for the mezzanine offering to add subtitle stream to (If not specified, will be added to 'default' offering) 
 * @returns {Promise<Object>} - New version of Object ID (iq...)
 */

const addSubtitles = async (
    {
        objectId,
        streamKey,
        language,
        label,
        file,
        offeringKey
    }
) => {
    const addStreamResult = await runUtility(
        OfferingAddSubtitles,
        [
            '--objectId', objectId,
            '--streamKey', streamKey,
            '--language', language,
            '--label', label,
            '--file', file,
            '--offeringKey', offeringKey
        ],
        {
            env: additionalEnvVars
        }
    )

    return addStreamResult
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


    // Create new Offering by copying 'default' offering
    const newOffering = await createNewOffering({
        objectId: objectId,
        offeringKey: 'default',
        newOfferingKey: 'offering-2'
    });
    console.log("NEW OFFERING", newOffering);


    // Add image or text watermarks to newly created offering
    // ONLY ONE TYPE OF WATERMARK CAN BE ADDED PER OFFERING
    const textWatermark = await addTextWatermarks({
        objectId,
        offeringKey: "offering-2",
        libraryId,
        textWatermark: "samples/example_files/text_watermark.json"
    })
    console.log("TEXT WATERMARK", textWatermark);
    // const imageWatermark = await addImageWatermarks({
    //     objectId,
    //     offeringKey: "offering-2",
    //     libraryId,
    //     imageWatermark: "samples/example_files/image_watermark.json"
    // })
    // console.log("IMAGE WATERMARK", imageWatermark);


    // Upload .vtt files to object and add subtitle info
    const subtitles = await addSubtitles({
        objectId: objectId,
        streamKey: 'subtitles-fr',
        language: 'French',
        label: 'Français',
        file: '/french__converted.vtt',
        offeringKey: 'offering-2'

    });
    console.log("ADDED SUBTITLES", subtitles);


    console.log("ALL DONE");    

    } catch (e) {
        console.error("ERROR:", e);
    }
}

Run({});
