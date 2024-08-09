# EluvioLive CLI


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
  -n, --network  Network to use
            [choices: "main", "demo", "demov3", "test", "dev"] [default: "main"]
      --host     Alternate URL endpoint                                 [string]
      --help     Show help                                             [boolean]
```
