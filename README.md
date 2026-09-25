# elv-live-js

Eluvio Live JavaScript SDK and CLI

A collection of libraries and utilities for managing media, live streams, NFT marketplaces,
tenant administration, and other content on the [Eluvio Content Fabric](https://contentfabric.io).

Includes `elv-live`, `elv-stream`, and `elv-admin`.

## Dependencies

You'll need the latest current Nodejs and NPM (Node 17.5.0+ or npm 8.5.1+): <https://nodejs.org/en/download/current/>

## Build

From the elv-live-js directory, simply run:

```bash
npm install
```

to install the binaries `elv-live`, `elv-stream`, `elv-admin` globally in your path
(eg, /opt/homebrew/bin/ on mac), use:

```bash
npm install -g
```

---

## EluvioLive CLI

The EluvioLive CLI (`elv-live`) provides tenant, token, and marketplace management commands.

```bash
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

```bash
./elv-live tenant_create_minter_config itenKGHd3iedqtA39krJUPkBTCNoTeX
```

To retrieve an existing tenant minter configuration:

```bash
./elv-live tenant_get_minter_config itenKGHd3iedqtA39krJUPkBTCNoTeX
```

To replace one or more minter resources, first get the minter configuration and then call the `elv-live tenant_replace_minter_config` command, passing in all the existing values that you don't want changed (or else they will be regenerated).

For example to set the 'legacy\_shuffle\_seed' and not change any of the other settings, pass in the existing values as options:

```bash
./elv-live tenant_replace_minter_config itenKGHd3iedqtA39krJUPkBTCNoTeX --minter ikms37TNyoqBKqjbAPS7HMv4gzvkJzTa --mint_helper 0x3AEA63e14e084A87Cf2588Fd0987e12db71f81C1 --proxy 0x41899355fE869c370ED92eaA9f791289c4Da9F9D --proxy_owner ikms4DgAcxHqMyv6pJYqdb8wqUrmUmLk --legacy_shuffle_seed 1000

```


##### Marketplace info

To show tenant-level marketplace information (including validation of correct NFT configuration):

```bash
./elv-live tenant_show itenYQbgk66551FEqWr95xPmHZEjmdF --check_nfts
```

To show items minted in a given tenant in a given wallet for a specific NFT contract:
```bash
./elv-live tenant_balance_of iten3RmQEH7LUZdjagr68xPASnKxL 0x31d979d8fcc4bfd55a081535c7aa816b67bd40c8
```

To show all wallets that have purchases in the tenancy and their corresponding email addresses (if shared by the wallet owners):
```bash
./elv-live tenant_wallets iten3RmAAA7LUZdjC55agr68xPASnKxL
```


#### NFT commands

##### Set up an NFT contract

Set up a tradeable NFT contract and associate it with an NFT Template object:
```bash
./elv-live nft_add_contract iten3h6Eo3NT3JKZss6crss9quGPdKyS iq__QrxLAAJ8V1xbdPzGVMwjHTpoFKP 100 MYTENANCY-MYNFTNAME MYTENANCY-MYNFTSYMBOL --hold 1
```

The NFT name and NFT symbol cannot contain spaces (even if enclosed in quotes).

The hold option should be specified explicitly as 1 (i.e. 1 second) if it is desired that the NFT tokens be immediately tradeable upon minting.

##### Build NFT metadata

It is necessary to build NFT-specific metadata prior to minting in order for metadata changes made in the Fabric Browser to be visible for the NFT in the user's wallet. If changes are made to metadata outside of additional media, the build step should be run and changes published prior to making the NFT available for minting or setting token URIs.

Example command:
```bash
./elv-live nft_build ilib3ErteXJcCoTapj2ZhEvMKWau6jET iq__QrxLAAJ8V1xbdPzGVMwjHTpoFKP
```

###### Build NFT for generative images or videos

The `./elv-live nft_build` command for generative NFTs assumes the NFT Template object has been created and source images and videos have been ingested into the fabric such that image and embedded video URLs have been generated and are working.

Refer to this repo/branch for ingesting generative NFT videos:
https://github.com/eluv-io/elv-client-js/blob/simple-ingest-wayne/utilities/NFTIngest.js

Example command:
```bash
./elv-live nft_build ilib3ErteXJcCoTapj2ZhEvMKWau6jET iq__9dMPeAjFqxCp5Ck6BZBuy3BcA1f --nft_dir /Users/test/nftsTest
```

For generative NFTs we use the following convention: `--nft_dir` must specify one or more JSON files with a '.json' extension (for example: nft001.json, nft002.json).

Example JSON File:
```json
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
```bash
./elv-live tenant_set_token_uri single itenKGHd3iedqtA39krJUPkBTCNoTeX 0x43842733179fa1c38560a44f1d9067677461c8ca https://host-76-74-28-227.contentfabric.io/s/demov3/q/hq__E4PqmoR2raU3eJe93nLPJ8DAuPtJ7jsRnA1MRkwXmifToqqQH9cN6sXkqFpGuHVHepneqYjTTc/meta/public/nft --token_id 128 --as_url http://127.0.0.1:6546
```

Batch:
```bash
./elv-live tenant_set_token_uri batch itenKGHd3iedqtA39krJUPkBTCNoTeX 0x43842733179fa1c38560a44f1d9067677461c8ca - --csv ../test/testdata/settokenuri_testlist.csv
```
[Sample Batch CSV file](test/testdata/settokenuri_testlist.csv)

All:
```bash
./elv-live tenant_set_token_uri all itenKGHd3iedqtA39krJUPkBTCNoTeX 0x43842733179fa1c38560a44f1d9067677461c8ca https://host-76-74-28-227.contentfabric.io/s/demov3/q/hq__E4PqmoR2raU3eJe93nLPJ8DAuPtJ7jsRnA1MRkwXmifToqqQH9cN6sXkqFpGuHVHepneqYjTTc/meta/public/nft
```


---

## EluvioStream CLI

The EluvioStream CLI (`elv-stream`) provides commands for managing live streams.

The general flow for managing a live stream is:

1. **Create and configure a live stream content object**

   A live stream content object can be created in the Fabric Browser. Configuration can be performed with `elv-stream config`.

2. **Create a 'stream'**

   A live stream content object is only active once a 'stream' is created with `elv-stream create`.

3. **Start the 'stream'**

   Running `elv-stream start` will initiate listening for input. Once it is received, streaming begins.

4. **Stop or Reset the 'stream'**

   During streaming, you can stop (pause) or reset the stream which will discontinue playout until the stream is restarted. The respective commands are `elv-stream stop` and `elv-stream reset`.

5. **Terminate the stream**

   After `elv-stream terminate` is run, the stream is ended and can no longer be restarted. You can create a new stream within the same content object.

### Offerings

An offering decides which of the recorded streams a viewer can select, and under
which playout formats. There are two models:

- **Legacy** — playout is built from `ladder_specs`, and the single offering
  exists only to carry DRM keys. Its track keys must be the generic `audio` and
  `video`.
- **Offerings-based** — `play_mode: "avtest_live"`. Playout is built from the
  offering itself, so one object can expose several named offerings, each
  selecting a different subset of the recorded streams. Track keys appear in the
  playout URL.

Three terms are used throughout, because the metadata overloads the word
"stream":

| term | what it is | where it lives |
|---|---|---|
| **source stream** | one audio or video program the recorder produces | `ladder_specs[].stream_name` — what `media_struct_stream_key` points at |
| **track** | one selectable rendition group in an offering | `offerings.<key>.playout.streams.<trackKey>` |
| **representation** | one rendition of a track — a playout target the fabric transcodes to on request, not a description of the recording | `…streams.<trackKey>.representations.<repKey>` |

> These commands are a **client-side stopgap**. Creating and editing live
> offerings belongs server-side, in the content-fabric `/rep/live/offerings/`
> API; until that ships, this is how it is done.

#### `list_offerings <object_id>`

Prints JSON: the object's source streams, and for each offering its `type`,
whether it is `valid`, any `errors` and `warnings`, its tracks, and the selection
that would reproduce it.

It is also a validator, and **sets an exit code** — unlike the other `elv-stream`
commands, which always exit 0:

| code | meaning |
|---|---|
| `0` | success; every offering is valid |
| `1` | the command failed — bad arguments, network, state gate, or a write refused |
| `2` | it ran, but at least one offering is invalid |

Two classes of error are worth knowing, because the fabric reports them poorly.
A wrong **video** `media_struct_stream_key` produces a perfectly well-formed
master playlist and then fails every segment request; and representations within
one track that disagree on `media_struct_stream_key` validate on the first one
and emit `CHANNELS="0",NAME=""` for the rest.

Source stream names are checked against `ladder_specs`. Whether the ingest
actually delivers them is only known once recording starts.

#### `enable_offerings <object_id>`

Converts legacy offerings to offerings-based playout: one track per audio source
stream, keyed by the source stream's name, labels taken from the ladder's
`stream_label`, and the ladder's default audio stream propagated.

**Representations are generated from `ladder_specs`**, one per rung, keyed by the
rung's own `representation` field. Both `ladder_specs` and an offering's
representations are playout specifications — the renditions the fabric will
serve — and `play_mode` decides which of the two is authoritative. Since the
offering's were built by `create` from a fabricated source rather than from this
object's ladder, generating them is what keeps conversion observationally
neutral: the converted offering advertises exactly the rungs `ladder_specs`
declares — no more, and in particular no fewer.

Offerings already in `avtest_live` are left untouched — they are deliberate
presentations, possibly partial ones. Nothing is written when nothing converts,
so a second run creates no new version.

The write is gated on a stopped stream, and it reuses the stream's existing edge
write token rather than opening a second draft — two drafts on one live object
would conflict when both are committed.

Audio source streams with an empty `stream_label` are **skipped**: that is how
the ladder records "not for playout", and the fabric leaves such a stream out of
the legacy master playlist. They are reported in `changes.skipped_source_streams`.

#### `add_offering <object_id> <offering_key>`

Copies a base offering (`--base_offering`, default `default`) and applies
`--offering_selection` as a **filter** — absent means keep everything, present
means keep only what is listed. Nothing is renamed or repointed; every surviving
field keeps the value it had in the base.

```json
{
  "default_audio_key": "audio_3",
  "formats": ["hls-clear", "dash-widevine"],
  "tracks": {
    "audio_3": ["audioaudio_aac@128000"],
    "video":   ["videovideo_1920x1080_h264@9500000"]
  }
}
```

| field | absent | present |
|---|---|---|
| `tracks` | all tracks kept | only the listed track keys kept |
| `tracks.<key>` | `null` keeps all its representations | only the listed representation keys kept |
| `formats` | all playout formats kept | only the listed formats kept |

`default_audio_key` is the one non-filter key: which track is the default is only
answerable after filtering, since a selection may exclude the base's default.

Naming a track, representation or format the base does not have is an error that
lists what is available. `list_offerings` emits a ready-made selection per
offering, so the quickest way to write one is to copy that and delete from it.

#### `delete_offering <object_id> <offering_key>`

Removes one offering. Deleting the last remaining offering is refused — an object
with none loses its DRM keys. There is no `--force`: replacing an offering is a
delete followed by an add, which with `--write_token` lands in a single commit.

#### Drafts

All four commands accept `--write_token`, so several changes can be staged in one
draft and committed once. The three that write also accept `--finalize`, which
defaults to false when a write token is supplied.

```bash
elv-stream create --object_id iq__... --no-finalize          # prints writeToken
elv-stream enable_offerings iq__... --write_token tq__...
elv-stream add_offering iq__... commentary \
    --offering_selection selection.json --write_token tq__...
elv-stream list_offerings iq__... --write_token tq__...      # inspect before committing
node <elv-utils-js>/utilities/DraftFinalize.js \
    --writeToken tq__... --commitMsg "add commentary offering"
```

Nothing is committed until that last step. `--dry_run` on `enable_offerings` and
`add_offering` computes and prints the result without touching the fabric at all.

Run these commands sequentially against one draft — there is no concurrency
guard, so parallel writes to overlapping metadata are last-write-wins.

#### Notes

- The three writing commands require the stream to be stopped, the same gate as
  `config` and `init`.
- `list_offerings` may warn that DASH playout will fail for audio track keys
  other than the literal `audio`. That is a limitation of deployed fabric, not of
  the offering; HLS is unaffected.
- `live_recording_config.playout_config.playout_formats` does **not** drive
  playout. Formats come from the offering's own `playout.playout_formats`.

---

## EluvioAdmin CLI

The EluvioAdmin CLI (`elv-admin`) provides lower-level account, group, tenant, and fabric administration commands.

```bash
EluvioLive Admin CLI

Usage: elv-admin <command>
```

Key command areas include:

- **Account management** — create accounts, show balances, send funds, generate fabric and signed tokens
- **Group management** — create access groups, add or remove members
- **Tenant administration** — show, fix, and configure tenant contracts; manage content admins and tenant users; deploy tenant contracts; set up faucets and sharing keys
- **Object/contract utilities** — set or get tenant contract IDs for wallets, content types, libraries, and groups

