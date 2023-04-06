# elv-live-js

Eluvio Live JavaScript SDK and CLI

A collection of libraries and utilities for managing content, live performance and NFT marketplaces on [Eluvio Live](https://live.eluv.io)

# Dependencies

You'll need the latest current Nodejs and NPM (Node 17.5.0+ or npm 8.5.1+): https://nodejs.org/en/download/current/

# Build

```
npm install
```

Then:

```
./elv-live --help

EluvioLive CLI

Usage: elv-live <command>

Commands:
  ...
```
# Usage Examples

Environment variables required:

```bash
export PRIVATE_KEY=0x11...11
```

## Tenant commands

### Minter configuration

For a new tenant - set up all required minter keys and helpers wiht one command:

```
./elv-live tenant_create_minter_config itenKGHd3iedqtA39krJUPkBTCNoTeX
```

To retrieve tenant minter configuration:

```
./elv-live tenant_get_minter_config itenKGHd3iedqtA39krJUPkBTCNoTeX

```

To replace one or more minter resources, first get minter configuration and call the 'replace' command passing in all the existing values that you don't want changed (or else they will be regenerated).

For example to set the legacy_shuffle_seed and not change any of the other settings, pass in the existing values as options:

```
./elv-live tenant_replace_minter_config itenKGHd3iedqtA39krJUPkBTCNoTeX --minter ikms37TNyoqBKqjbAPS7HMv4gzvkJzTa --mint_helper 0x3AEA63e14e084A87Cf2588Fd0987e12db71f81C1 --proxy 0x41899355fE869c370ED92eaA9f791289c4Da9F9D --proxy_owner ikms4DgAcxHqMyv6pJYqdb8wqUrmUmLk --legacy_shuffle_seed 1000

```


### Marketplace info

Show tenant-level marketplace information (including validation):

``` bash
./elv-live tenant_show itenYQbgk66551FEqWr95xPmHZEjmdF ilib3Drbefo66PfWvY1NVup4VZFzDJ68  iq__21pxPgnpyYkV666nZ2RhNGYGYdwC --check_cauth ikms2BxjJaireMQXHS55gAiWkuugU5gsjx --check_minter 0x59e79eFE007F5205557a646Db5cBddA82261Ca81
```

Show number of items minted by NFT contract:
```
./elv-live tenant_wallets iten3RmAAA7LUZdjC55agr68xPASnKxL
```

Show all wallets that have purchases in the tenancy and the corresponding email addresses:
```
./elv-live tenant_balance_of iten3RmQEH7LUZdjagr68xPASnKxL 0x31d979d8fcc4bfd55a081535c7aa816b67bd40c8
```
The ids required for the commands are located in the Eluvio fabric browser at:

```
Tenant Id:
Properties > Drop Event > Manage > Tenant Id
```
```
Library Id:
Properties > Library Info > Library Id
```
```
Tenant Object Id *
Properties > Eluvio LIVE Tenant > Object Id
```
## NFT commands

Set up an NFT contract and associate it with an NFT Template object:

```
./elv-live nft_add_contract  ilib3ErteXJcCoTapj2ZhEvMKWau6jET iq__QrxLAAJ8V1xbdPzGVMwjHTpoFKP itenYQbgk66W1BFEqWr95xPmHZEjmdF --minthelper 0x59e79eFE007F5208857a646Db5cBddA82261Ca81 --cap 100 --name "TEST NFT SERIES A" --symbol "TESTA"
```

## NFT Build for generative images or videos

./elv-live nft_build command assumes the nft_template object has been created and source images and videos have been ingested into the fabric such that image and embedded video urls have been generated and working.

Refer to this repo/branch for ingesting gernerative nft videos:
https://github.com/eluv-io/elv-client-js/blob/simple-ingest-wayne/utilities/NFTIngest.js

Note: Video Ingest will soon be brought into elv-live-js in the near future.

eg.
`./elv-live nft_build ilib3ErteXJcCoTapj2ZhEvMKWau6jET iq__9dMPeAjFqxCp5Ck6BZBuy3BcA1f --nft_dir /Users/test/nftsTest`

For generative NFTs we use the following convention --nft_dir must contain:
One or more json files with a '.json' extension (for example: nft001.json, nft002.json)
Example JSON File:
```
{
  "count":3,                                   (OPTIONAL, Default: 1)
  "name": "Example NFT",                       (OPTIONAL, Default: from Content Object)
  "display_name": "Example NFT",               (OPTIONAL, Default: from Content Object)
  "description" : "This is an example NFT.",   (OPTIONAL, Default: from Content Object)
  "rich_text" : "",                            (OPTIONAL, Default: from Content Object)
  "image": "https://image003",
  "embed_url":"https://videoURL003",
  "attributes:":
  [
    {
      "trait_type":"trait01",
      "value": "test1",
      "rarity": 0.2                            (OPTIONAL, If not present, it will be calculated)
    }
  ]
}
```
The 'count' is an optional parameter to generate copies of this nft element inside
the /public/nfts array

For generative images, the "image" attribute must contain a valid url to the image.
For generative videos, the embed_url points to a playable video url.

All other optional keys (name, display_name, description, etc) will override the
NFT content object's value from /asset_metadata/nft if present.

The required key 'attributes' is an array of objects {"trait_type": "", "value": ""}
and is used to calculate trait rarity. If rarity is already present in the attribute,
it will be used instead.
