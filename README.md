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

``` bash
./elv-live --help
```

# Usage Examples

Environment variables required:

``` bash
export PRIVATE_KEY=0x11...11
```

## Tenant commands

Show tenant-level marketplace information (including validation):

``` bash
./elv-live tenant_show itenYQbgk66W1BFEqWr95xPmHZEjmdF ilib3Drbefo7VPfWvY1NVup4VZFzDJ68  iq__21pxPgnpyYkVnW6nZ2RhNGYGYdwC --check_cauth ikms2BxjJaireMQXHSgAiWkuugU5gsjx --check_minter 0x59e79eFE007F5208857a646Db5cBddA82261Ca81
```

## NFT commands

Set up an NFT contract and associate it with an NFT Template object:

```
./elv-live nft_add_contract  ilib3ErteXJcCoTapj2ZhEvMKWau6jET iq__QrxLAAJ8V1xbdPzGVMwjHTpoFKP itenYQbgk66W1BFEqWr95xPmHZEjmdF --minthelper 0x59e79eFE007F5208857a646Db5cBddA82261Ca81 --cap 100 --name "TEST NFT SERIES A" --symbol "TESTA"
```
