/* Sample Code 
    - List offerings of object
    - List available DRM options  
    - List Bitmovin playout options
    - List playout options

    export PRIVATE_KEY - set to the private key of an account with
                        rights to the content object.
*/
const { ElvClient } = require("@eluvio/elv-client-js");

var client;

/* Sample configuration */
const tenant = "iten4TXq2en3qtu3JREnE5tSLRf9zLod";
const libraryId = 'ilibkfVcNydZyXB7HNsfrAbYTQuaaQ9';
const objectId = 'iq__2CGFUR4eVwqawai2VC7cMm2Xh12F';

const Run = async ({}) => {
    try {

        // Initialize client using environment variable PRIVATE_KEY
        client = await ElvClient.FromNetworkName({networkName: "main"}); // "demov3" "main"

        let wallet = client.GenerateWallet();
        let signer = wallet.AddAccount({
        privateKey: process.env.PRIVATE_KEY
        });
        client.SetSigner({signer});
        client.ToggleLogging(false);

        // Will return available DRMs dependent on browser environment
        // If browser not specified, will return ["clear", "aes-128"]
        const drm = await client.AvailableDRMs({ objectId });
        console.log("AVAILABLE DRMs: ", drm);

        const offs = await client.AvailableOfferings({ objectId });
        console.log("OFFERINGS: ", offs);
        const offerings = Object.keys(offs);
        const protocols = ["dash", "hls"];
        const drms = ["clear", "aes-128", "widevine"];

        if (offerings.length >= 2) {
            for (let offering of offerings) {
                const bitmovin = await client.BitmovinPlayoutOptions({ objectId, offering, protocols, drms });
                console.log(`BITMOVIN PLAYOUT OPTIONS OF ${offering}: `, bitmovin);

                const playouts = await client.PlayoutOptions({ objectId, offering, protocols, drms });
                console.log(`PLAYOUT OPTIONS OF ${offering}: `, playouts);
            }
        } else {
            const bitmovin = await client.BitmovinPlayoutOptions({ objectId });
            const playouts = await client.PlayoutOptions({ objectId });
            console.log(`PLAYOUT OPTIONS: `, playouts);
            console.log(`BITMOVIN PLAYOUT OPTIONS: `, bitmovin);
        }

    } catch (e) {
        console.error("ERROR:", e);
    }
}

Run({});