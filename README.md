# elv-live-js

Eluvio Live JavaScript SDK and CLI

A collection of libraries and utilities for managing content, live performance and NFT marketplaces on [Eluvio Live](https://live.eluv.io).

## Dependencies

You'll need the latest current Nodejs and NPM (Node 17.5.0+ or npm 8.5.1+): <https://nodejs.org/en/download/current/>

## Build

From the elv-live-js directory, simply run:

```
npm install
```

## EluvioLive CLI

The EluvioLive CLI (`elv-live`) provides tenant, token, and marketplace management commands.

```
EluvioLive CLI

Usage: elv-live <command>

Commands:
  nft_add_contract <tenant> <object> <cap>  Add a new or existing NFT contract
  <name> <symbol> [options]                 to an NFT Template object
  token_add_minter <addr> <minter>          Add minter or mint helper address to
                                            NFT or Token
  token_renounce_minter <addr>              Renounce the minter(msg.sender) from
                                            NFT or Token
  token_is_minter <addr> <minter>           check if minter to NFT or Token

  [...]

Options:
      --version  Show version number                                   [boolean]
  -v, --verbose  Verbose mode                                          [boolean]
      --as_url   Alternate URL endpoint                                 [string]
      --help     Show help                                             [boolean]
```

[Complete Command Line Help](CMDLINE.md)

### Usage Examples


Environment variables required:

```bash
export PRIVATE_KEY=0x11...11
```

Many of the commands require a tenant ID. This starts with the letters `iten` and can be easily found through the Eluvio Fabric Browser (Properties library > Tenant object > Manage > Tenant ID).

#### Tenant commands

##### Minter configuration

For a new tenant, set up all required minter keys and helpers with one command:

```
./elv-live tenant_create_minter_config itenKGHd3iedqtA39krJUPkBTCNoTeX
```

To retrieve an existing tenant minter configuration:

```
./elv-live tenant_get_minter_config itenKGHd3iedqtA39krJUPkBTCNoTeX

```

To replace one or more minter resources, first get the minter configuration and then call the `elv-live tenant_replace_minter_config` command, passing in all the existing values that you don't want changed (or else they will be regenerated).

For example to set the 'legacy\_shuffle\_seed' and not change any of the other settings, pass in the existing values as options:

```
./elv-live tenant_replace_minter_config itenKGHd3iedqtA39krJUPkBTCNoTeX --minter ikms37TNyoqBKqjbAPS7HMv4gzvkJzTa --mint_helper 0x3AEA63e14e084A87Cf2588Fd0987e12db71f81C1 --proxy 0x41899355fE869c370ED92eaA9f791289c4Da9F9D --proxy_owner ikms4DgAcxHqMyv6pJYqdb8wqUrmUmLk --legacy_shuffle_seed 1000

```


##### Marketplace info

To show tenant-level marketplace information (including validation of correct NFT configuration):

``` bash
./elv-live tenant_show itenYQbgk66551FEqWr95xPmHZEjmdF --check_nfts
```

To show items minted in a given tenant in a given wallet for a specific NFT contract:
```
./elv-live tenant_balance_of iten3RmQEH7LUZdjagr68xPASnKxL 0x31d979d8fcc4bfd55a081535c7aa816b67bd40c8
```

To show all wallets that have purchases in the tenancy and their corresponding email addresses (if shared by the wallet owners):
```
./elv-live tenant_wallets iten3RmAAA7LUZdjC55agr68xPASnKxL
```


#### NFT commands

##### Set up an NFT contract 

Set up a tradeable NFT contract and associate it with an NFT Template object:
```
./elv-live nft_add_contract iten3h6Eo3NT3JKZss6crss9quGPdKyS iq__QrxLAAJ8V1xbdPzGVMwjHTpoFKP 100 MYTENANCY-MYNFTNAME MYTENANCY-MYNFTSYMBOL --hold 1
```

The NFT name and NFT symbol cannot contain spaces (even if enclosed in quotes).

The hold option should be specified explicitly as 1 (i.e. 1 second) if it is desired that the NFT tokens be immediately tradeable upon minting.

##### Build NFT metadata

It is necessary to build NFT-specific metadata prior to minting in order for metadata changes made in the Fabric Browser to be visible for the NFT in the user's wallet. If changes are made to metadata outside of additional media, the build step should be run and changes published prior to making the NFT available for minting or setting token URIs.

Example command:
```
./elv-live nft_build ilib3ErteXJcCoTapj2ZhEvMKWau6jET iq__QrxLAAJ8V1xbdPzGVMwjHTpoFKP
```

###### Build NFT for generative images or videos

The `./elv-live nft_build` command for generative NFTs assumes the NFT Template object has been created and source images and videos have been ingested into the fabric such that image and embedded video URLs have been generated and are working.

Refer to this repo/branch for ingesting generative NFT videos:
https://github.com/eluv-io/elv-client-js/blob/simple-ingest-wayne/utilities/NFTIngest.js

Example command:
```
./elv-live nft_build ilib3ErteXJcCoTapj2ZhEvMKWau6jET iq__9dMPeAjFqxCp5Ck6BZBuy3BcA1f --nft_dir /Users/test/nftsTest
```

For generative NFTs we use the following convention: `--nft_dir` must specify one or more JSON files with a '.json' extension (for example: nft001.json, nft002.json).

Example JSON File:
```
{
  "count": 3,                                   (OPTIONAL, Default: 1)
  "name": "Example NFT",                       (OPTIONAL, Default: from Content Object)
  "display_name": "Example NFT",               (OPTIONAL, Default: from Content Object)
  "description" : "This is an example NFT.",   (OPTIONAL, Default: from Content Object)
  "rich_text": "",                             (OPTIONAL, Default: from Content Object)
  "image": "https://image003",
  "embed_url":"https://videoURL003",           (Only for Video content)
  "attributes: "
  [
    {
      "trait_type": "Hair",
      "value": "Black",
      "rarity": 0.2                            (OPTIONAL, Default: null, does not display)
    },
    {
      "trait_type": "Expression",
      "value": "Smiling",
      "rarity": 0.1
    }
  ]
  "
}
```

The 'count' is an optional parameter to generate copies of this nft element inside
the /public/nfts array.

For generative images, the "image" attribute must contain a valid url for the image. For generative videos, the 'embed_url' must point to a playable video URL.

The key 'attributes' is an array of objects `{"trait_type": "[trait name]", "value": "[specific trait]","rarity": [number]}` that defines properties for each. 'attributes' is optional but highly recommended. If 'attributes' is specified, then 'trait_type' and 'value' are required. Rarity must be specified to display a value; it is not calculated automatically.

All other optional keys ('name', 'display\_name', 'description', etc.) will override the
NFT content object's value from /asset\_metadata/nft if present.

##### Set Token URI for an NFT contract

There are three ways to associate an NFT contract with new token URI metadata: setting a URI for a single token ID, setting one or more URIs in batch for a number of token IDs, and setting a URI for all token IDs at once.

Single:
```
./elv-live tenant_set_token_uri single itenKGHd3iedqtA39krJUPkBTCNoTeX 0x43842733179fa1c38560a44f1d9067677461c8ca https://host-76-74-28-227.contentfabric.io/s/demov3/q/hq__E4PqmoR2raU3eJe93nLPJ8DAuPtJ7jsRnA1MRkwXmifToqqQH9cN6sXkqFpGuHVHepneqYjTTc/meta/public/nft --token_id 128 --as_url http://127.0.0.1:6546
```

Batch:
```
./elv-live tenant_set_token_uri batch itenKGHd3iedqtA39krJUPkBTCNoTeX 0x43842733179fa1c38560a44f1d9067677461c8ca - --csv ../test/testdata/settokenuri_testlist.csv
```
[Sample Batch CSV file](test/testdata/settokenuri_testlist.csv)

All:
```
./elv-live tenant_set_token_uri all itenKGHd3iedqtA39krJUPkBTCNoTeX 0x43842733179fa1c38560a44f1d9067677461c8ca https://host-76-74-28-227.contentfabric.io/s/demov3/q/hq__E4PqmoR2raU3eJe93nLPJ8DAuPtJ7jsRnA1MRkwXmifToqqQH9cN6sXkqFpGuHVHepneqYjTTc/meta/public/nft
```


# EluvioStream CLI

The EluvioStream CLI `elv-stream` provides commands for managing live streams.

The general flow for managing a live stream is:

1. Create and configure a live stream content object

  A live stream content object can be created in the Fabric Browser. Configuration can be performed with `elv-stream config`.

2. Create a 'stream'

  A live stream content object is only active once a 'stream' is created with `elv-stream create`.

3. Start the 'stream'

  Running `elv-stream start` will initiate listening for input. Once it is received, streaming begins.
  
4. Stop or Reset the 'stream'

  During streaming, you can stop (pause) or reset the stream which will discontinue playout until the stream is restarted. The respective commands are `elv-stream stop` and `elv-stream reset`.

5. Terminate the stream

  After `elv-stream terminate` is run, the stream is ended and can no longer be restarted.  You can create a new stream within the same content object.

