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
  nft_add_contract <library> <object>       Add a new or existing NFT contract
  <tenant> [minthelper] [cap] [name]        to an NFT Template object
  [symbol] [nftaddr] [hold]
  nft_add_minter <addr> <minter>            Add a new or existing NFT contract
                                            to an NFT Template object
  nft_set_proxy <addr> [proxy_addr]         Set a proxy on an NFT contract
  nft_balance_of <addr> <owner>             Call NFT ownerOf - determine if this
                                            is an owner
  nft_show <addr>                           Show info on this NFT
  nft_proxy_transfer <addr> <token_id>      Tranfer NFT as a proxy owner
  <from_addr> <to_addr>
  nft_build <library> <object>              Build the public/nft section based
                                            on asset metadata
  nft_lookup <addr> <token_id>              Decode and look up a /local NFT by
                                            external token ID
  tenant_show <tenant> <library> <object>   Show info on this tenant
  [event] [marketplace]
  tenant_balance_of <tenant> <owner>        Show NFTs owned by this owner in
                                            this tenant
  fabric_tenant_balance_of <object>         Show NFTs owned by this owner in
  <owner> [options]                         this tenant
  site_show <library> <object>              Show info on this site/event
  site_set_drop <library> <object> <uuid>   Set drop dates for a site/event
  <start_date> [options]
  shuffle <file> [options]                  Sort each line deterministically
                                            based on the seed
  tenant_mint <tenant> <marketplace> <sku>  Mint a marketplace NFT by SKU as
  <addr>                                    tenant admin
  tenant_wallets <tenant> [options]         Show the wallets associated with
                                            this tenant
  list [options]                            List the Eluvio Live Tenants
  tenant_primary_sales <tenant>             Show tenant primary sales history
  <marketplace> <processor>
  tenant_secondary_sales <tenant>           Show tenant secondary sales history
  <processor>
  
  marketplace_add_item <marketplace>        Add an item to a marketplace
  <object> <price> [forSale]
  
  marketplace_remove_item <marketplace>     Remove an item from a
  <object>                                  marketplace
  
  storefront_section_add_item               Add an item to a marketplace
  <marketplace> <sku> [section]             storefront section

Options:
  --version  Show version number                                       [boolean]
  --help     Show help                                                 [boolean]
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

Set up an NFT contract and associate it with an NFT Template object:

```
./elv-live nft_add_contract  ilib3ErteXJcCoTapj2ZhEvMKWau6jET iq__QrxLAAJ8V1xbdPzGVMwjHTpoFKP itenYQbgk66W1BFEqWr95xPmHZEjmdF --minthelper 0x59e79eFE007F5208857a646Db5cBddA82261Ca81 --cap 100 --name "TEST NFT SERIES A" --symbol "TESTA"
```
