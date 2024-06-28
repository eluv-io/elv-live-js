/* Sample Code (Create storyboard of content object)

    export PRIVATE_KEY - set to the private key of an account with
                        rights to the content object.
*/

const { ElvClient } = require("@eluvio/elv-client-js");

/* Sample configuration */
const libraryId = "ilibRJokr4werfSEyyUotKsHYUsm2Rh";
const objectId = "iq__2nSwW1dmjsBirgjamv5tPuvsKs5e";
const configUrl = "https://demov3.net955210.contentfabric.io/config";

const Run = async ({}) => {

  try {

    const client = await ElvClient.FromConfigurationUrl({ configUrl });

    let wallet = client.GenerateWallet();
    let signer = wallet.AddAccount({
      privateKey: process.env.PRIVATE_KEY
    });
    client.SetSigner({signer});

    client.ToggleLogging(true);

    const edt = await client.EditContentObject({libraryId, objectId});

    await client.CallBitcodeMethod({
      libraryId,
      objectId,
      writeToken: edt.writeToken,
      method: "/media/thumbnails/create",
      body: {
        "generate_storyboards": true,
        "target_thumb_count": 10,
        "thumb_height": 180
      },
      constant: false
    });

    const fin = await client.FinalizeContentObject({
      libraryId,
      objectId,
      writeToken: edt.writeToken,
      commitMessage: "Create thumbs/storyboard"
    });

    console.log(fin);

  } catch(error) {
    console.error(error);
  }

}

Run({});