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
  nft_add_contract <tenant> <object> <cap>  Add a new or existing NFT contract
  <name> <symbol> [options]                 to an NFT Template object
  token_add_minter <addr> <minter>          Add minter or mint helper address to
                                            NFT or Token
  token_renounce_minter <addr>              Renounce the minter(msg.sender) from
                                            NFT or Token
  token_is_minter <addr> <minter>           check if minter to NFT or Token
  nft_set_proxy <addr> [proxy_addr]         Set a proxy on an NFT contract
  nft_balance_of <addr> <owner>             Call NFT ownerOf - determine if this
                                            is an owner
  nft_show <addr> [options]                 Show info on this NFT
  nft_transfer <addr> <token_id> <to_addr>  Transfer the specified NFT as the
  [options]                                 token owner
  nft_proxy_transfer <addr> <token_id>      Tranfer NFT as a proxy owner
  <from_addr> <to_addr>
  nft_build <library> <object> [options]    Build the public/nft section based
                                            on asset metadata. If --nft_dir is
                                            specified, will build a generative
                                            nft based on *.json files inside the
                                            dir. See README.md for more details.
  nft_burn <addr> <token_id>                Burn the specified NFT as the owner
  nft_proxy_burn <addr> <token_id>          Burn the specified NFT
  nft_set_transfer_fee <addr> <fee>         Decode and look up a local NFT by
                                            external token ID
  nft_get_transfer_fee <addr>               Decode and look up a local NFT by
                                            external token ID
  nft_add_offer <addr>                      Add a redeemable offer to the NFT
                                            contract as the contract owner or
                                            minter
  nft_remove_offer <addr> <offer_id>        Remove (disable) a redeemable offer
                                            from the NFT contract as the
                                            contract owner or minter
  nft_offer_redeemed <addr> <token_id>      Returns true if offer is redeemed
  <offer_id>
  nft_offer_active <addr> <offer_id>        Returns true if offer is active
  nft_redeem_offer <addr> <redeemer>        Redeem an nft offer
  <token_id> <offer_id>
  as_nft_redeem_offer <addr> <tenant>       Redeem an nft offer using the
  <mint_helper_addr> <token_id> <offer_id>  authority service
  tenant_show <tenant> [options]            Show info on this tenant
  tenant_set_token_uri <request_type>       Reset the token URI(s) for tenant
  <tenant> <contract_address>               NFT contract(s)
  <new_token_uri> [options]
  tenant_balance_of <tenant> <owner>        Show NFTs owned by this owner in
                                            this tenant using contracts.
  fabric_tenant_balance_of <object>         Show NFTs owned by this owner in
  <owner> [options]                         this tenant by using the Fabric
                                            EluvioLive object tree.
  site_show <library> <object>              Show info on this site/event
  site_set_drop <library> <object> <uuid>   Set drop dates for a site/event
  <start_date> [options]
  shuffle <file> [options]                  Sort each line deterministically
                                            based on the seed
  tenant_tickets_generate <tenant> <otp>    Generate tickets for a given tenant
                                            OTP ID
  tenant_mint <tenant> <marketplace> <sku>  Mint a marketplace NFT by SKU as
  <addr>                                    tenant admin
  tenant_wallets <tenant> [options]         Show the wallets associated with
                                            this tenant
  nft_refresh <tenant> <addr>               Synchronize backend listings with
                                            fabric metadata for a specific
                                            tenant's NFT. Requires tenant Key.
  list [options]                            List the Eluvio Live Tenants
  tenant_primary_sales <tenant>             Show tenant primary sales history
  <marketplace> <processor>
  tenant_secondary_sales <tenant>           Show tenant secondary sales history
  <processor>
  tenant_sales <tenant> <processor>         Show tenant sales history
  transfer_errors <tenant>                  Show tenant transfer failures. Used
                                            to identify payments collected on
                                            failed transfers.
  account_create <funds> <account_name>     Create a new account -> mnemonic,
  <tenant_admins>                           address, private key
  account_show                              Shows current account information.
  tenant_nft_remove <tenant> <addr>         Removes the nft address from the
                                            tenant contract
  tenant_nft_list <tenant>                  List all tenant_nfts within a tenant
                                            contract
  tenant_has_nft <tenant> <addr>            Searches tenant_nfts list in tenant
                                            contract and returns true if exists
  tenant_add_consumers <group_id>           Adds address(es) to the tenant's
  [addrs..]                                 consumer group
  tenant_remove_consumer <group_id> <addr>  Removes consumer from tenant
                                            consumer group
  tenant_has_consumer <group_id> <addr>     Returns true or false if addr is in
                                            the tenant consumer group
  marketplace_add_item <marketplace>        Adds an item to a marketplace
  <object> <name> [price] [forSale]
  marketplace_add_item_batch <marketplace>  Adds multiple items to a marketplace
  <csv>
  marketplace_remove_item <marketplace>     Removes an item from a marketplace
  <object>
  storefront_section_add_item               Adds an item to a marketplace
  <marketplace> <sku> [section]             storefront section
  storefront_section_remove_item            Removes an item from a marketplace
  <marketplace> <sku> [writeToken]          storefront section
  tenant_provision <tenant>                 Provisions a new tenant account with
                                            standard media libraries and content
                                            types. Note this account must be
                                            created using space_tenant_create.
  tenant_add_consumer_group <tenant>        Deploys a BaseTenantConsumerGroup
                                            and adds it to this tenant's
                                            contract.
  nft_get_policy_permissions <object>       Gets the policy and permissions of a
                                            content object.
  nft_set_policy_permissions <object>       Sets the policy and permissions
  <policy_path> [addrs..]                   granting NFT owners access to a
                                            content object.
  tenant_get_minter_config <tenant>         Gets the minter configuration for
  [options]                                 this tenant key
  tenant_create_minter_config <tenant>      Creates the minter configuration for
  [options]                                 this tenant key
  tenant_replace_minter_config <tenant>     Creates the minter configuration for
  [options]                                 this tenant key
  tenant_deploy_helper_contracts <tenant>   Deploys the minter helper and
  [options]                                 transfer proxy contracts using the
                                            authority service as the minter.
                                            Specify option proxy or minthelper
                                            to only deploy that specific
                                            contract.
  tenant_delete_minter_config <tenant>      Creates the minter configuration for
  [options]                                 this tenant key
  tenant_publish_data <tenant>              Submits the new version hash of the
  <content_hash> [options]                  tenant Fabric object for validation.
                                            The top level Eluvio Live object
                                            link will be updated if there are no
                                            errors.
  notif_send <user_addr> <tenant> <event>   Sends a notification (using the
                                            notification service).
  notif_send_token_update <nft_addr>        Sends a TOKEN_UPDATED notification
  <tenant>                                  to all owners of this NFT.
  admin_health [options]                    Checks the health of the Authority
                                            Service APIs. Note the current key
                                            must be a system admin configured in
                                            the AuthD servers.
  payment_contract_create addresses shares  Deploy a payment contract for
                                            revenue split.
  payment_contract_show addr token_addr     Show status of payment contract
                                            stakeholders.
  payment_release addr token_addr           Retrieve payment from payment
                                            splitter contract as a payee
  token_contract_create <name> <symbol>     Deploy elv token  contract
  <decimals> <amount> [options]

Options:
      --version  Show version number                                   [boolean]
  -v, --verbose  Verbose mode                                          [boolean]
      --host     Alternate URL endpoint                                 [string]
      --help     Show help                                             [boolean]
```
# Usage Examples

Environment variables required:

```bash
export PRIVATE_KEY=0x11...11
```

## Tenant commands

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

### Set up an NFT contract 
Set up an NFT contract and associate it with an NFT Template object:

```
./elv-live nft_add_contract  ilib3ErteXJcCoTapj2ZhEvMKWau6jET iq__QrxLAAJ8V1xbdPzGVMwjHTpoFKP itenYQbgk66W1BFEqWr95xPmHZEjmdF --minthelper 0x59e79eFE007F5208857a646Db5cBddA82261Ca81 --cap 100 --name "TEST NFT SERIES A" --symbol "TESTA"
```

### Set Token URI for NFT contract:
elv-live tenant_set_token_uri <request_type> <tenant> <contract_address> <new_token_uri> [options]

Single:
```
PRIVATE_KEY=0x00...ZZZ ./elv-live tenant_set_token_uri single itenKGHd3iedqtA39krJUPkBTCNoTeX 0x43842733179fa1c38560a44f1d9067677461c8ca https://host-76-74-28-227.contentfabric.io/s/demov3/q/hq__E4PqmoR2raU3eJe93nLPJ8DAuPtJ7jsRnA1MRkwXmifToqqQH9cN6sXkqFpGuHVHepneqYjTTc/meta/public/nft --token_id 128 --host http://127.0.0.1:6546
```

Batch:
```
PRIVATE_KEY=0x00...ZZZ ./elv-live tenant_set_token_uri batch itenKGHd3iedqtA39krJUPkBTCNoTeX 0x43842733179fa1c38560a44f1d9067677461c8ca - --host http://127.0.0.1:6546 --csv ../test/testdata/settokenuri_testlist.csv
```

All:
```
PRIVATE_KEY=0x00...ZZZ ./elv-live tenant_set_token_uri all itenKGHd3iedqtA39krJUPkBTCNoTeX 0x43842733179fa1c38560a44f1d9067677461c8ca https://host-76-74-28-227.contentfabric.io/s/demov3/q/hq__E4PqmoR2raU3eJe93nLPJ8DAuPtJ7jsRnA1MRkwXmifToqqQH9cN6sXkqFpGuHVHepneqYjTTc/meta/public/nft --host http://127.0.0.1:6546
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
