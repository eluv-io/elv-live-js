# elv-live-js

Eluvio Live JavaScript SDK and CLI

A collection of libraries and utilities for managing content, live performance and NFT marketplaces on [Eluvio Live](https://live.eluv.io)

# Usage Examples

## NFTs

Set up an NFT contract and associate it with an NFT Template object:

```
export PRIVATE_KEY=0x11...11

node utilities/EluvioLiveCli.js  nft_add_contract  ilib3ErteXJcCoTapj2ZhEvMKWau6jET iq__QrxLAAJ8V1xbdPzGVMwjHTpoFKP itenYQbgk66W1BFEqWr95xPmHZEjmdF --minthelper 0x59e79eFE007F5208857a646Db5cBddA82261Ca81 --cap 778 --name "TEST SS004" --symbol "TESTSS004"
```
