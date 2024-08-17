# EluvioLive CLI


```
EluvioLive CLI

Usage: elv-live <command>

Commands:
  nft_show <addr> [options]                                     Show info on this NFT
  nft_balance_of <addr> <owner>                                 Call NFT ownerOf - determine if this is an owner
  nft_refresh <tenant> <addr>                                   Synchronize backend listings with fabric metadata for a
                                                                specific tenant's NFT. Requires tenant Key.
  nft_transfer <addr> <token_id> <to_addr> [options]            Transfer the specified NFT as the token owner
  transfer_errors <tenant>                                      Show tenant transfer failures. Used to identify payments
                                                                collected on failed transfers.
  nft_proxy_transfer <addr> <token_id> <from_addr> <to_addr>    Tranfer NFT as a proxy owner
  nft_build <library> <object> [options]                        Build the public/nft section based on asset metadata. If
                                                                --nft_dir is specified, will build a generative nft
                                                                based on *.json files inside the dir. See README.md for
                                                                more details.
  nft_set_proxy <addr> [proxy_addr]                             Set a proxy on an NFT contract
  nft_pack_get_dist <hash>                                      Compute pack distribution based on NFT Template spec.
                                                                Saves to file.
  nft_pack_set_dist <hash>                                      Set the pack distribution for an NFT Template. Reads
                                                                distribution from file.
  nft_burn <addr> <token_id>                                    Burn the specified NFT as the owner
  nft_proxy_burn <addr> <token_id>                              Burn the specified NFT
  nft_set_transfer_fee <addr> <fee>                             Decode and look up a local NFT by external token ID
  nft_get_transfer_fee <addr>                                   Decode and look up a local NFT by external token ID
  nft_add_contract <tenant> <object> <cap> <name> <symbol>      Add a new or existing NFT contract to an NFT Template
  [options]                                                     object
  nft_add_offer <addr>                                          Add a redeemable offer to the NFT contract as the
                                                                contract owner or minter
  nft_remove_offer <addr> <offer_id>                            Remove (disable) a redeemable offer from the NFT
                                                                contract as the contract owner or minter
  nft_offer_redeemed <addr> <token_id> <offer_id>               Returns true if offer is redeemed
  nft_offer_active <addr> <offer_id>                            Returns true if offer is active
  nft_redeem_offer <addr> <redeemer> <token_id> <offer_id>      Redeem an nft offer
  as_nft_redeem_offer <addr> <tenant> <mint_helper_addr>        Redeem an nft offer using the authority service
  <token_id> <offer_id>
  nft_get_policy_permissions <object>                           Gets the policy and permissions of a content object.
  nft_set_policy_permissions <object> <policy_path> <addrs..>   Sets the policy and permissions granting NFT owners
                                                                access to a content object. When no addresses are
                                                                specified, only the policy is set.
  tenant_show <tenant> [options]                                Show info on this tenant
  tenant_auth_token <path_or_body>                              Generate a tenant token
  tenant_auth_curl <url_path> [post_body]                       Generate a tenant token and use it to call an authd
                                                                endpoint.
  tenant_set_token_uri <request_type> <tenant>                  Reset the token URI(s) for tenant NFT contract(s)
  <contract_address> <new_token_uri> [options]
  tenant_update_token_uri <tenant> <addr> <hash> [options]      Reset the token URI(s) for tenant NFT contract(s)
  tenant_balance_of <tenant> <owner>                            Show NFTs owned by this owner in this tenant using
                                                                contracts.
  fabric_tenant_balance_of <object> <owner> [options]           Show NFTs owned by this owner in this tenant by using
                                                                the Fabric EluvioLive object tree.
  site_show <library> <object>                                  Show info on this site/event
  site_set_drop <library> <object> <uuid> <start_date>          Set drop dates for a site/event
  [options]
  tenant_tickets_generate <tenant> <otp>                        Generate tickets for a given tenant OTP ID
  tenant_mint <tenant> <marketplace> <sku> <addr>               Mint a marketplace NFT by SKU as tenant admin
  tenant_primary_sales <tenant> <marketplace>                   Show tenant primary sales history
  tenant_secondary_sales <tenant>                               Show tenant secondary sales history
  tenant_sales <tenant>                                         Show tenant sales history
  tenant_wallets <tenant> [options]                             Show the wallets associated with this tenant
  tenant_nft_remove <tenant> <addr>                             Removes the nft address from the tenant contract
  tenant_nft_list <tenant>                                      List all tenant_nfts within a tenant contract
  tenant_has_nft <tenant> <addr>                                Searches tenant_nfts list in tenant contract and returns
                                                                true if exists
  tenant_add_consumers <group_id> [addrs..]                     Adds address(es) to the tenant's consumer group
  tenant_remove_consumer <group_id> <addr>                      Removes consumer from tenant consumer group
  tenant_has_consumer <group_id> <addr>                         Returns true or false if addr is in the tenant consumer
                                                                group
  marketplace_add_item <marketplace> <object> <name> [price]    Adds an item to a marketplace
  [forSale]
  marketplace_add_item_batch <marketplace> <csv>                Adds multiple items to a marketplace
  marketplace_remove_item <marketplace> <object>                Removes an item from a marketplace
  storefront_section_add_item <marketplace> <sku> [section]     Adds an item to a marketplace storefront section
  storefront_section_remove_item <marketplace> <sku>            Removes an item from a marketplace storefront section
  [writeToken]
  tenant_provision <tenant>                                     Provisions a new tenant account with standard media
                                                                libraries and content types. Note this account must be
                                                                created using space_tenant_create.
  tenant_add_consumer_group <tenant>                            Deploys a BaseTenantConsumerGroup and adds it to this
                                                                tenant's contract.
  tenant_get_minter_config <tenant> [options]                   Gets the minter configuration for this tenant key
  tenant_create_minter_config <tenant> [options]                Creates the minter configuration for this tenant key
  tenant_replace_minter_config <tenant> [options]               Creates the minter configuration for this tenant key
  tenant_deploy_helper_contracts <tenant> [options]             Deploys the minter helper and transfer proxy contracts
                                                                using the authority service as the minter. Specify
                                                                option proxy or minthelper to only deploy that specific
                                                                contract.
  tenant_delete_minter_config <tenant> [options]                Creates the minter configuration for this tenant key
  tenant_publish_data <tenant> <content_hash> [options]         Submits the new version hash of the tenant Fabric object
                                                                for validation. The top level Eluvio Live object link
                                                                will be updated if there are no errors.
  notif_send <user_addr> <tenant> <event>                       Sends a notification (using the notification service).
  notif_send_token_update <nft_addr> <tenant>                   Sends a TOKEN_UPDATED notification to all owners of this
                                                                NFT.
  account_create <funds> <account_name> <tenant_admins>         Create a new account -> mnemonic, address, private key
  account_show                                                  Shows current account information.
  payment_contract_create addresses shares                      Deploy a payment contract for revenue split.
  payment_contract_show addr token_addr                         Show status of payment contract stakeholders.
  payment_release addr token_addr                               Retrieve payment from payment splitter contract as a
                                                                payee or for a payee using --payee flag
  token_contract_create <name> <symbol> <decimals> <amount>     Deploy elv token  contract
  [options]
  token_transfer <token_addr> <to_addr> <amount> [options]      Transfer given elv tokens to address provided
  token_balance_of <token_addr> <user_addr> [options]           Get the token balance of a given user
  token_add_minter <addr> <minter>                              Add minter or mint helper address to NFT or Token
  token_renounce_minter <addr>                                  Renounce the minter(msg.sender) from NFT or Token
  token_is_minter <addr> <minter>                               check if minter to NFT or Token
  content_set_policy <object> <policy_path> [data]              Set the policy on an existing content object. This also
                                                                sets the delegate on the object contract to itself.
  content_set_policy_delegate <object> <delegate>               Set the policy delegate on the object contract.
  content_get_policy <object>                                   Get the content object policy from the object metadata
                                                                and the delegate from the object's contract meta
  content_clear_policy <object>                                 Remove content object policy from the object metadata
                                                                and the delegate from the object's contract meta
  list [options]                                                List the Eluvio Live Tenants
  shuffle <file> [options]                                      Sort each line deterministically based on the seed
  admin_health [options]                                        Checks the health of the Authority Service APIs. Note
                                                                the current key must be a system admin configured in the
                                                                AuthD servers.

Options:
      --version  Show version number                                                                           [boolean]
  -v, --verbose  Verbose mode                                                                                  [boolean]
  -n, --network  Network to use                     [choices: "main", "demo", "demov3", "test", "dev"] [default: "main"]
  -o, --output   YAML file to write output to                                                                   [string]
      --as_url   Alternate authority service URL (include '/as/' route if necessary)                            [string]
      --help     Show help                                                                                     [boolean]
```
