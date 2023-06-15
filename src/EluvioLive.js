const { ElvClient } = require("@eluvio/elv-client-js");
const Utils = require("@eluvio/elv-client-js/src/Utils.js");
const { Config } = require("./Config.js");
const { ElvAccount } = require("./ElvAccount");
const { ElvFabric } = require("../src/ElvFabric.js");
const { ElvUtils } = require("./Utils");
const Ethers = require("ethers");
const fs = require("fs");
const path = require("path");
const BigNumber = require("big-number");
const urljoin = require("url-join");
const url = require("url");

const crypto = require("crypto");
const ethers = require("ethers");
const { parse } = require("csv-parse");

/**
 * EluvioLive is an application platform built on top of the Eluvio Content Fabric.
 * It provides a consumer-facing marketplace for digital content: live performances,
 * digital collectibles, etc.
 *
 * This SDK provides tools for working with EluvioLive APIs and services.
 */
class EluvioLive {
  /**
   * Instantiate the EluvioLive SDK
   *
   * @namedParams
   * @param {string} configUrl - The Content Fabric configuration URL
   * @param {string} mainObjectId - The top-level Eluvio Live object ID
   * @return {EluvioLive} - New EluvioLive object connected to the specified content fabric and blockchain
   */
  constructor({ configUrl, mainObjectId }) {
    this.configUrl = configUrl || ElvClient.main;
    this.mainObjectId = mainObjectId;

    this.debug = false;
  }

  async Init({debugLogging = false, asUrl}={}) {
    this.client = await ElvClient.FromConfigurationUrl({
      configUrl: this.configUrl,
    });

    if (asUrl) {
      // elv-client-js strips the path and only stores the host - save it here
      this.asUrlPath = url.parse(asUrl).path;
      this.client.SetNodes({
        authServiceURIs:[
          asUrl
        ]
      });
    } else {
      this.asUrlPath = "as";
    }

    let wallet = this.client.GenerateWallet();
    let signer = wallet.AddAccount({
      privateKey: process.env.PRIVATE_KEY,
    });
    this.client.SetSigner({ signer });
    this.client.ToggleLogging(debugLogging);
    this.debug = debugLogging;
  }

  /**
   * Show group info about this tenant.
   */
  async TenantGroupInfo({ tenantId }) {
    const abi = fs.readFileSync(
      path.resolve(__dirname, "../contracts/v3/BaseTenantSpace.abi")
    );

    const tenantAddr = Utils.HashToAddress(tenantId);

    var tenant_admin_address = await this.client.CallContractMethod({
      contractAddress: tenantAddr,
      abi: JSON.parse(abi),
      methodName: "groupsMapping",
      methodArgs: ["tenant_admin", 0],
      formatArguments: true,
    });

    return {tenant_admin_address,
      tenant_admin_id: ElvUtils.AddressToId({prefix:"igrp", address:tenant_admin_address})
    };
  }

  /**
   * Set the Token URI for an NFT.
   * Currently only setting one and a time. Will support types, single, batch and all.
   *
   * @namedParams
   * @param {string} requestType - The type of request: single, batch, all
   * @param {string} tenantId - The ID of the tenant (iten***)
   * @param {string} contractAddress - The NFT contract address
   * @param {string} tokenURI - The new token URI
   * @param {int} tokenId - The NFT token ID
   * @param {string} host - The host to use for the request, undefined to use config
   * @param {string} csv - The CSV file to use for the request, undefined to use config
   * @return {Promise<Object>} - An object containing tenant info, including 'warnings'
   */
  async TenantSetTokenURI({ requestType, tenantId, contractAddress, tokenURI, tokenId, host, csv }) {

    let body = {};
    body.request_type = requestType;
    body.contract_address = contractAddress;
    body.tokens = [];
  
    switch (requestType) {
      case "batch":
        if (!csv) {
          console.log("Error: CSV file required for batch request");
          return;
        }
        let csvFile;
        try {
          csvFile = fs.readFileSync(path.resolve(__dirname, csv));
        } catch (e) {
          console.log("Error reading CSV file: ", e);
          return;
        }
        // transform CSV to array for JSON request
        const records = parse(csvFile, {columns: true,
          skip_records_with_empty_values: true});

        // rows should be tokenURI, tokenId
        // tokenId should always exist
        await records.forEach(row => {
          body.tokens.push({
            "token_id": Number(row.tokenId),
            "token_id_str":  row.tokenId.toString(),
            "token_uri": row.tokenURI
          });
        });

        break;
      case "all":
        body.tokens.push({
          "token_id": null,
          "token_id_str": "",
          "token_uri": tokenURI
        });
        break;
      case "single":
        body.tokens.push({
          "token_id": tokenId,
          "token_id_str": tokenId.toString(),
          "token_uri": tokenURI
        });
        break;
      default:
        console.log("Error: Invalid request type");
        return;
    }

    let res = await this.PostServiceRequest({
      path: urljoin("/tnt/nft/stu", tenantId),  // /tnt/nft/stu/:tid/
      body, 
      host 
    });

    let tenantConfigResult = await res.json();
    if (this.debug){
      console.log("Create response: ", tenantConfigResult);
    }
    return tenantConfigResult;

  }

  /**
   * Show info about this tenant.
   * Currently only listing NFT marketplaces.
   *
   * @namedParams
   * @param {string} tenantId - The ID of the tenant (iten***)
   * @return {Promise<Object>} - An object containing tenant info, including 'warnings'
   */
  async TenantShow({ tenantId, checkNft = false }) {
    var tenantInfo = {};

    let m = await this.List({ tenantId });

    tenantInfo.marketplaces = {};
    var warns = [];

    let tenantNftList = [];
    if (checkNft) {
      tenantNftList = await this.TenantNftList({ tenantId });
    }

    let minterConfigResp = {};
    let minterAddr = null;
    let minterID = null;
    let mintHelper = null;
    let proxyAddr = null;

    try {
      minterConfigResp = await this.TenantGetMinterConfig({tenant: tenantId});
      console.log("minterConfig: ", minterConfigResp);

      try {
        minterAddr = minterConfigResp.config.minter_address;
        minterID = minterConfigResp.config.minter;
      } catch (e){
        console.warn("tenant config minter_address error: ", e);
      }

      try {
        mintHelper = minterConfigResp.config.minter_helper;
      } catch (e){
        console.warn("tenant config minter_helper error: ", e);
      }

      try {
        proxyAddr = minterConfigResp.config.proxy_owner_address;
      } catch (e){
        console.warn("tenant config proxy_owner_address error: ", e);
      }

    } catch (e) {
      console.log("Warning: ", e);
    }


    for (var key in m.marketplaces) {
      tenantInfo.marketplaces[key] = {};
      tenantInfo.marketplaces[key].items = {};
      tenantInfo.marketplaces[key].summary = {};
      var totalNfts = m.marketplaces[key].info.items.length || 0;
      tenantInfo.marketplaces[key].summary.total_nfts = totalNfts;

      var totalMinted = 0;
      var totalCap = 0;
      var totalSupply = 0;
      var topMintedValue = 0;
      var topMintedList = [];

      for (var i in m.marketplaces[key].info.items) {
        const item = m.marketplaces[key].info.items[i];

        const sku = item.sku;

        if (item.nft_template == "") {
          warns.push("No NFT Template sku: " + sku);
          continue;
        }

        if (!item.nft_template.mint){
          warns.push("No nft_template.mint: " + sku);
          continue;
        }

        if (!item.nft_template.mint){
          warns.push("No nft_template.mint sku: " + sku);
          continue;
        }

        if (!item.nft_template.nft){
          warns.push("No nft_template.nft sku: " + sku);
          continue;
        }

        tenantInfo.marketplaces[key].items[sku] = {};
        tenantInfo.marketplaces[key].items[sku].name = item.name;
        tenantInfo.marketplaces[key].items[sku].description = item.description;
        tenantInfo.marketplaces[key].items[sku].mint_cauth =
          item.nft_template.mint.cauth_id;
        tenantInfo.marketplaces[key].items[sku].nft_addr =
          item.nft_template.nft.address;
        tenantInfo.marketplaces[key].items[sku].templateTotalSupply =
          item.nft_template.nft.total_supply;
        tenantInfo.marketplaces[key].items[sku].nft_template =
          item.nft_template["."].source;

        if (minterID && item.nft_template.mint.cauth_id && minterID != item.nft_template.mint.cauth_id) {
          warns.push("Wrong cauth_id for sku: " + sku + ". Config minter Id: " + minterID + ", item nft_template.mint.cauth_id: " + item.nft_template.mint.cauth_id);
        }

        if (item.nft_template.nft.address === "") {
          warns.push("No NFT address sku: " + sku);
        } else {
          // Check NFT contract parameters
          const nftInfo = await this.NftShow({
            addr: item.nft_template.nft.address,
            mintHelper,
            minterAddr,
            proxyAddr
          });

          if (checkNft) {
            let isInContract = tenantNftList.includes(
              item.nft_template.nft.address
            );

            tenantInfo.marketplaces[key].items[sku].isValid = checkNft;
            if (!isInContract) {
              warns.push(
                `${item.nft_template.nft.address} is not in the tenant contract.`
              );
            }
          }
          tenantInfo.marketplaces[key].items[sku].nftCap = nftInfo.cap;
          tenantInfo.marketplaces[key].items[sku].nftMinted = nftInfo.minted;
          tenantInfo.marketplaces[key].items[sku].nftTotalSupply =
            nftInfo.totalSupply;
          tenantInfo.marketplaces[key].items[sku].nftName = nftInfo.name;
          tenantInfo.marketplaces[key].items[sku].owner = nftInfo.owner;
          tenantInfo.marketplaces[key].items[sku].proxy = nftInfo.proxy;
          tenantInfo.marketplaces[key].items[sku].firstTokenUri =
            nftInfo.firstTokenUri;
          tenantInfo.marketplaces[key].items[sku].defHoldSecs =
            nftInfo.defHoldSecs;

          //Some nfts had -1 for some reason
          totalMinted += nftInfo.minted > 0 ? nftInfo.minted : 0;
          totalCap += nftInfo.cap > 0 ? nftInfo.cap : 0;
          totalSupply += nftInfo.totalSupply > 0 ? nftInfo.totalSupply : 0;

          if (topMintedValue <= nftInfo.minted) {
            topMintedList.unshift({
              name: nftInfo.name,
              minted: nftInfo.minted,
              sku: sku,
              address: item.nft_template.nft.address,
            });
            topMintedValue = nftInfo.minted;
          }

          if (nftInfo.cap != item.nft_template.nft.total_supply) {
            warns.push("NFT cap mismatch sku: " + sku);
          }
          if (nftInfo.warns.length > 0) {
            warns.push(...nftInfo.warns);
          }
        }
      }
      tenantInfo.marketplaces[key].summary.total_minted = totalMinted;
      tenantInfo.marketplaces[key].summary.total_cap = totalCap;
      tenantInfo.marketplaces[key].summary.total_supply = totalSupply;
      tenantInfo.marketplaces[key].summary.top_minted = topMintedList.slice(
        0,
        3
      );
    }

    tenantInfo.groups = await this.TenantGroupInfo({tenantId});
    tenantInfo.sites = {};
    tenantInfo.warns = warns;


    return tenantInfo;
  }

  /**
   * Return tenant admins group and content admins group corresponding to this tenant.
   * @param {string} ojbectId - The ID of the tenant (iten***)
   */
  async TenantShowNew({ tenantId }) {
    const tenantAddr = Utils.HashToAddress(tenantId);
    const abi = fs.readFileSync(
      path.resolve(__dirname, "../contracts/v3/BaseTenantSpace.abi")
    );

    let tenantAdminAddr = await this.client.CallContractMethod({
      contractAddress: tenantAddr,
      abi: JSON.parse(abi),
      methodName: "groupsMapping",
      methodArgs: ["tenant_admin", 0],
      formatArguments: true,
    });

    let contentAdminAddresses = [];
    
    for (let i = 0; i < Number.MAX_SAFE_INTEGER; i++) {
      let ordinal = BigNumber(i).toString(16);
      try {
        let addr = await this.client.CallContractMethod({
          contractAddress: tenantAddr,
          abi: JSON.parse(abi),
          methodName: "groupsMapping",
          methodArgs: ["content_admin", ordinal], 
          formatArguments: true,
        });

        contentAdminAddresses.push(addr);
      } catch (e) {
        if (contentAdminAddresses.length == 0) {
          contentAdminAddresses = null;
        }
        break;
      }
    }

    return {tenant_admin_address: tenantAdminAddr,
      content_admin_addresses: contentAdminAddresses};
  }

  /**
   * Set a new content admin corresponding to this tenant.
   * @param {string} tenantId - The ID of the tenant (iten***)
   * @param {string} contentAdminsAddress - Address of content admin we want to add.
   */
  async TenantAddContentAdmin({ tenantId, contentAdminsAddress }) {
    const abi = fs.readFileSync(
      path.resolve(__dirname, "../contracts/v3/BaseTenantSpace.abi")
    );

    const tenantAddr = Utils.HashToAddress(tenantId);

    let res = await this.client.CallContractMethodAndWait({
      contractAddress: tenantAddr,
      abi: JSON.parse(abi),
      methodName: "addGroup",
      methodArgs: ["content_admin", contentAdminsAddress],
      formatArguments: true,
    });

    console.log(res);

    return res;
  }

  /**
   * Remove a content admin from this tenant.
   * @param {string} tenantId - The ID of the tenant (iten***)
   * @param {string} contentAdminsAddress - Address of content admin we want to remove.
   */
  async TenantRemoveContentAdmin({ tenantId, contentAdminsAddress }) {
    const abi = fs.readFileSync(
      path.resolve(__dirname, "../contracts/v3/BaseTenantSpace.abi")
    );

    const tenantAddr = Utils.HashToAddress(tenantId);

    let res = await this.client.CallContractMethodAndWait({
      contractAddress: tenantAddr,
      abi: JSON.parse(abi),
      methodName: "removeGroup",
      methodArgs: ["content_admin", contentAdminsAddress],
      formatArguments: true,
    });

    console.log(res);

    return res;
  }

  /**
   * Get a list of the NFTs of this tenant owned by 'ownerAddr'
   *
   * @namedParams
   * @param {string} objectId - The ID of the tenant specific EluvioLive object
   * @param {string} ownerAddr - A user address to check the balance of
   * @return {Promise<Object>} - Number of tokens owned
   */
  async FabricTenantBalanceOf({ objectId, ownerAddr }) {
    var nftInfo = {};

    const libraryId = await this.client.ContentObjectLibraryId({
      objectId,
    });

    var m = await this.client.ContentObjectMetadata({
      libraryId,
      objectId,
      metadataSubtree: "/public/asset_metadata",
      resolveLinks: true,
      resolveIncludeSource: true,
      resolveIgnoreErrors: true,
      linkDepthLimit: 5,
    });

    nftInfo.marketplaces = {};
    var warns = [];

    for (var key in m.marketplaces) {
      nftInfo.marketplaces[key] = {};
      nftInfo.marketplaces[key].nfts = {};
      for (var i in m.marketplaces[key].info.items) {
        const item = m.marketplaces[key].info.items[i];

        const sku = item.sku;

        if (item.nft_template == "") {
          warns.push("No NFT Template sku: " + sku);
          continue;
        }
        try {
          const nftAddr = item.nft_template.nft.address;
          const info = await this.NftBalanceOf({ addr: nftAddr, ownerAddr });

          if (info.length == 0) {
            continue;
          }
          var nft = await this.NftShow({ addr: nftAddr });
          nft.tokens = info;

          nftInfo.marketplaces[key].nfts[nftAddr] = nft;
        } catch (e) {
          warns.push(`Error parsing marketplace ${key}, item sku ${sku}. ${e}`);
        }
      }
    }

    nftInfo.warns = warns;

    return nftInfo;
  }

  /**
   * Get a list of the NFTs of this tenant owned by 'ownerAddr'
   *
   * @namedParams
   * @param {string} tenantId - The ID of the tenant (iten***)
   * @param {string} ownerAddr - A user address to check the balance of
   * @param {integer} maxNumber - Max number of NFTs returned
   * @return {Promise<Object>} - Number of tokens owned
   */
  async TenantBalanceOf({
    tenantId,
    ownerAddr,
    maxNumber = Number.MAX_SAFE_INTEGER,
  }) {
    if (maxNumber < 1) {
      maxNumber = Number.MAX_SAFE_INTEGER;
    }
    const abiTenant = fs.readFileSync(
      path.resolve(__dirname, "../contracts/v3/BaseTenantSpace.abi")
    );
    const tenantAddr = Utils.HashToAddress(tenantId);
    var arg = "tenant_nfts";

    var nftInfo = {};
    nftInfo.nfts = {};
    nftInfo.summary = {};

    var totalMinted = 0;
    var totalCap = 0;
    var totalSupply = 0;
    var topMintedValue = 0;
    var topMintedList = [];

    var num = 0;
    for (var i = 0; i < Number.MAX_SAFE_INTEGER && num < maxNumber; i++) {
      var ordinal = BigNumber(i).toString(16);
      try {
        var nftAddr = await this.client.CallContractMethod({
          contractAddress: tenantAddr,
          abi: JSON.parse(abiTenant),
          methodName: "groupsMapping",
          methodArgs: [arg, ordinal],
          formatArguments: true,
        });

        const info = await this.NftBalanceOf({ addr: nftAddr, ownerAddr });

        if (info.length == 0) {
          continue;
        }

        var nft = await this.NftShow({ addr: nftAddr });
        nft.tokens = info;

        nftInfo.nfts[nftAddr] = nft;
        num++;

        totalMinted += nft.minted > 0 ? nft.minted : 0;
        totalCap += nft.cap > 0 ? nft.cap : 0;
        totalSupply += nft.totalSupply > 0 ? nft.totalSupply : 0;

        if (topMintedValue <= nft.minted) {
          topMintedList.unshift({
            name: nft.name,
            minted: nft.minted,
            address: nftAddr,
          });
          topMintedValue = nft.minted;
        }
      } catch (e) {
        //We don't know the length so just stop on error and return
        break;
      }
    }

    nftInfo.summary.total_nfts = num;
    nftInfo.summary.total_minted = totalMinted;
    nftInfo.summary.total_cap = totalCap;
    nftInfo.summary.total_supply = totalSupply;
    nftInfo.summary.top_minted = topMintedList.slice(0, 3);

    return nftInfo;
  }

  /**
   * Add an NFT contract to the tenant's 'tenant_nfts' group
   *
   * @namedParams
   * @param {string} tenantId - The ID of the tenant (iten***)
   * @param {string} nftAddr = The address of the NFT contract (hex format)
   */
  async TenantAddNft({ tenantId, nftAddr }) {
    const abi = fs.readFileSync(
      path.resolve(__dirname, "../contracts/v3/BaseTenantSpace.abi")
    );

    const addr = Utils.HashToAddress(tenantId);

    var res = await this.client.CallContractMethodAndWait({
      contractAddress: addr,
      abi: JSON.parse(abi),
      methodName: "addGroup",
      methodArgs: ["tenant_nfts", nftAddr],
      formatArguments: true,
    });

    return res;
  }

  /**
   * Remove an NFT contract from the tenant's 'tenant_nfts' group
   *
   * @namedParams
   * @param {string} tenantId - The ID of the tenant (iten***)
   * @param {string} nftAddr = The address of the NFT contract (hex format)
   */
  async TenantRemoveNft({ tenantId, nftAddr }) {
    const abi = fs.readFileSync(
      path.resolve(__dirname, "../contracts/v3/BaseTenantSpace.abi")
    );

    const addr = Utils.HashToAddress(tenantId);

    var res = await this.client.CallContractMethodAndWait({
      contractAddress: addr,
      abi: JSON.parse(abi),
      methodName: "removeGroup",
      methodArgs: ["tenant_nfts", nftAddr],
      formatArguments: true,
    });

    return res;
  }

  /**
   * Returns true if an NFT contract is in the tenant's 'tenant_nfts' group
   *
   * @namedParams
   * @param {string} tenantId - The ID of the tenant (iten***)
   * @param {string} nftAddr = The address of the NFT contract (hex format)
   */
  async TenantHasNft({ tenantId, nftAddr }) {
    const abi = fs.readFileSync(
      path.resolve(__dirname, "../contracts/v3/BaseTenantSpace.abi")
    );

    const tenantAddr = Utils.HashToAddress(tenantId);
    var arg = "tenant_nfts";

    for (var i = 0; i < Number.MAX_SAFE_INTEGER; i++) {
      var ordinal = BigNumber(i).toString(16);
      try {
        var currNftAddr = await this.client.CallContractMethod({
          contractAddress: tenantAddr,
          abi: JSON.parse(abi),
          methodName: "groupsMapping",
          methodArgs: [arg, ordinal],
          formatArguments: true,
        });

        if (currNftAddr.toLowerCase() != nftAddr.toLowerCase()) {
          continue;
        } else {
          return true;
        }
      } catch (e) {
        //We don't know the length so just stop on error and return
        break;
      }
    }

    return false;
  }

  /**
   * Returns list of NFT contracts in the tenant's 'tenant_nfts' group
   *
   * @namedParams
   * @param {string} tenantId - The ID of the tenant (iten***)
   */
  async TenantNftList({ tenantId }) {
    const abi = fs.readFileSync(
      path.resolve(__dirname, "../contracts/v3/BaseTenantSpace.abi")
    );

    let result = [];
    const tenantAddr = Utils.HashToAddress(tenantId);
    var arg = "tenant_nfts";

    for (var i = 0; i < Number.MAX_SAFE_INTEGER; i++) {
      var ordinal = BigNumber(i).toString(16);
      try {
        var nftAddr = await this.client.CallContractMethod({
          contractAddress: tenantAddr,
          abi: JSON.parse(abi),
          methodName: "groupsMapping",
          methodArgs: [arg, ordinal],
          formatArguments: true,
        });

        result.push(nftAddr.toLowerCase());
      } catch (e) {
        //We don't know the length so just stop on error and return
        break;
      }
    }

    return result;
  }

  /**
   * Show info about this site (event)
   *
   * @namedParams
   * @param {string} libraryId - The 'properties' library ID
   * @param {string} objectId - The ID of the site object
   * @return {Promise<Object>} - An object containing site info, including 'warnings'
   */
  async SiteShow({ libraryId, objectId }) {
    var siteInfo = {};

    var m = await this.client.ContentObjectMetadata({
      libraryId,
      objectId,
      metadataSubtree: "/public/asset_metadata",
      select: "",
      resolveLinks: true,
      resolveIncludeSource: true,
      resolveIgnoreError: true,
      linkDepthLimit: 5,
    });

    siteInfo.drops = {};
    for (var key in m.info.drops) {
      const drop = m.info.drops[key];
      const uuid = drop.uuid;

      siteInfo.drops[uuid] = {};

      siteInfo.drops[uuid].event_header = drop.event_header;

      siteInfo.drops[uuid].start_date = drop.start_date;
      siteInfo.drops[uuid].end_date = drop.end_date;

      siteInfo.drops[uuid].stages = {};
      siteInfo.drops[uuid].stages["preroll"] = {};
      siteInfo.drops[uuid].stages["preroll"].start_date =
        drop.event_state_preroll.start_date;

      siteInfo.drops[uuid].stages["main"] = {};
      siteInfo.drops[uuid].stages["main"].start_date =
        drop.event_state_main.start_date;

      siteInfo.drops[uuid].stages["vote_end"] = {};
      siteInfo.drops[uuid].stages["vote_end"].start_date =
        drop.event_state_post_vote.start_date;

      siteInfo.drops[uuid].stages["mint_start"] = {};
      siteInfo.drops[uuid].stages["mint_start"].start_date =
        drop.event_state_mint_start.start_date;

      siteInfo.drops[uuid].nfts = {};
      for (var i in drop.nfts) {
        const nft = drop.nfts[i];
        siteInfo.drops[uuid].nfts[nft.sku] = nft.label;
      }
    }

    return siteInfo;
  }

  /**
   * Set start dates for a drop event (all stages)
   *
   * @namedParams
   * @param {string} libraryId - The 'properties' library ID
   * @param {string} objectId - The ID of the site object
   * @param {string} uuid - UUID of the drop (a site may contain multiple)
   * @param {string} start - the start date of the event
   * @param {string} end - the end date of the event (optional)
   * @param {string} endVote - the start date of the post vote stage (optional)
   * @param {string} startMint - the start date of the mint stage (optional)
   * @param {boolean} newUuid - create a new UUID for the drop (optional)
   * @param {string} update - Tenant-level EluvioLive object ID, to update
   * @return {Promise<Object>} - An object containing new drop info
   */
  async SiteSetDrop({
    libraryId,
    objectId,
    uuid,
    start,
    end,
    endVote,
    startMint,
    newUuid,
    update,
  }) {
    const defaultStageDurationMin = 2;

    // If stages are not specified use 2min for each
    const startMsec = Date.parse(start);
    if (!endVote || endVote == "") {
      endVote = new Date(startMsec + defaultStageDurationMin * 60 * 1000);
    }
    if (!startMint || startMint == "") {
      startMint = new Date(startMsec + 2 * defaultStageDurationMin * 60 * 1000);
    }
    if (!end || end == "") {
      end = new Date(startMsec + 3 * defaultStageDurationMin * 60 * 1000);
    }

    var dropInfo = {};

    var m = await this.client.ContentObjectMetadata({
      libraryId,
      objectId,
      metadataSubtree: "/public/asset_metadata",
      resolveLinks: false,
    });

    var found = false;
    for (var key in m.info.drops) {
      const drop = m.info.drops[key];
      const dropUuid = drop.uuid;

      if (dropUuid.slice(0, 22) == uuid) {
        console.log("Found drop uuid: ", uuid);
        console.log(drop);
        found = true;

        drop.start_date = start;
        drop.end_date = end;
        drop.event_state_preroll.start_date = "";
        drop.event_state_main.start_date = start;
        drop.event_state_post_vote.start_date = endVote;
        drop.event_state_mint_start.start_date = startMint;
        drop.event_state_event_end.start_date = end;

        dropInfo.start = start;
        dropInfo.end = end;
        dropInfo.endVote = endVote;
        dropInfo.startMint = startMint;

        if (newUuid) {
          drop.uuid = uuid.slice(0, 22) + startMsec / 1000;
        }
        dropInfo.uuid = drop.uuid;

        // Set new metadata
        m.info.drops[key] = drop;

        const dryRun = false;
        if (!dryRun) {
          var e = await this.client.EditContentObject({
            libraryId,
            objectId,
          });

          await this.client.ReplaceMetadata({
            libraryId,
            objectId,
            writeToken: e.write_token,
            metadataSubtree: "/public/asset_metadata",
            metadata: m,
          });

          var f = await this.client.FinalizeContentObject({
            libraryId,
            objectId,
            writeToken: e.write_token,
            commitMessage: "Set drop start " + uuid + " " + start,
          });

          dropInfo.hash = f.hash;
          console.log("Finalized: ", f);

          if (update != null && update != "") {
            await this.client.UpdateContentObjectGraph({
              libraryId,
              objectId: update,
            });
            console.log("Update ", update);
          }
        } else {
          console.log("New drop:", drop);
          console.log("New metadata:", m);
        }
        break;
      }
    }

    if (!found) {
      console.log("Drop not found - uuid: ", uuid);
    }

    return dropInfo;
  }

  /**
   * Create a new NFT contract (ElvTradable, ERC-721-based) and set it up for this tenant
   * - create a new contract
   * - add minter
   * - add NFT address to tenant 'tenant_nfts' group
   *
   * TODO: preflight - ensure signer is a tenant admin
   *
   * @namedParams
   * @param {string} tenantId - The tenant ID
   * @param {string} minterAddr - Address of the minter (hex format) (Optional, Default uses tenant minter config)
   * @param {string} mintHelperAddr - Address of the mint helper (hex format) (Optional,  Default uses tenant minter config)
   * @param {string} collectionName - Short name for the ERC-721 contract
   * @param {string} collectionSymbol - Short string for the ERC-721 contract
   * @param {string} contractUri - URI for the ERC-721 contract
   * @param {string} proxyAddress - Proxy address for the ERC721 contract (Optional, Default uses tenant minter config)
   * @param {number} totalSupply - the mint cap for this template (should be called 'cap')
   * @param {number} hold - the hold period (seconds)
   * @return {Promise<Object>} - New contract address
   */
  async CreateNftContract({
    tenantId,
    mintHelperAddr,
    minterAddr,
    collectionName,
    collectionSymbol,
    contractUri,
    proxyAddress,
    totalSupply /* PENDING: should be 'cap' */,
    hold,
  }) {
    const abistr = fs.readFileSync(
      path.resolve(__dirname, "../contracts/v3/ElvTradableLocal.abi")
    );
    const bytecode = fs.readFileSync(
      path.resolve(__dirname, "../contracts/v3/ElvTradableLocal.bin")
    );

    let minterConfigResp = {};

    try {
      minterConfigResp = await this.TenantGetMinterConfig({tenant: tenantId});

      if (this.debug){
        console.log("minterConfig: ", minterConfigResp);
      }
    } catch (e) {
      console.log("Warning: ", e);
    }

    if (!proxyAddress || proxyAddress == "") {
      proxyAddress = minterConfigResp.config.transfer_proxy_address;
      if (proxyAddress == ""){
        throw Error("Tenant configuration has no proxy_owner_address");
      }
      if (this.debug){
        console.log("Using tenant config proxy address: ", proxyAddress);
      }
    }

    //Create new Transfer Proxy if config and command line does not exist.
    if (!proxyAddress || proxyAddress == "") {
      proxyAddress = await this.CreateNftTransferProxy({});
    }
    console.log("TransferProxy addr:", proxyAddress);

    if (!minterAddr || minterAddr == "") {
      minterAddr = minterConfigResp.config.minter_address;
      if (minterAddr == ""){
        throw Error("Tenant configuration has no minter_address");
      }
      if (this.debug){
        console.log("Using tenant config minter address: ", minterAddr);
      }
    }

    if (!mintHelperAddr || mintHelperAddr == "") {
      mintHelperAddr = minterConfigResp.config.minter_helper;
      if (mintHelperAddr == ""){
        throw Error("Tenant configuration has no minter_helper");
      }
      if (this.debug){
        console.log("Using tenant config minter helper address: ", mintHelperAddr);
      }
    }

    if (hold == null || hold == 0) {
      hold = 604800;
    }

    var c = await this.client.DeployContract({
      abi: JSON.parse(abistr),
      bytecode: bytecode.toString("utf8").replace("\n", ""),
      constructorArgs: [
        collectionName,
        collectionSymbol,
        contractUri || "",
        proxyAddress,
        0,
        totalSupply /* this is the 'cap' */,
        hold,
      ],
    });

    console.log("NFT contract address:", c.contractAddress);

    await this.AddMinter({
      addr: c.contractAddress,
      minterAddr: mintHelperAddr,
    });
    console.log("- mint helper added", mintHelperAddr);

    await this.AddMinter({
      addr: c.contractAddress,
      minterAddr: minterAddr,
    });
    console.log("- minter added", minterAddr);

    await this.TenantAddNft({ tenantId, nftAddr: c.contractAddress });
    console.log("- tenant_nfts added", tenantId);

    return {
      nftAddr: c.contractAddress,
      mintShuffleKeyId: minterConfigResp.config.mint_shuffle_key_id
    };
  }

  /**
   * Set a TransferProxy for this NFT contract.  If no proxy address is specified, create a new one.
   * Must be run as the NFT contract owner.
   *
   * @namedParams
   * @param {string} addr - The NFT Transfer Proxy contract address
   * @param {string} proxyAddress - The address of the proxy contract (optional)
   * @return {Promise<Object>} - New contract address
   */
  async NftSetTransferProxy({ addr, proxyAddr }) {
    if (proxyAddr == null || proxyAddr.length == 0) {
      proxyAddr = await this.CreateNftTransferProxy({});
    }

    const abi = fs.readFileSync(
      path.resolve(__dirname, "../contracts/v3/ElvTradableLocal.abi")
    );

    await this.client.CallContractMethod({
      contractAddress: addr,
      abi: JSON.parse(abi),
      methodName: "setProxyRegistryAddress",
      methodArgs: [proxyAddr],
      formatArguments: true,
    });

    return proxyAddr;
  }

  /**
   * Create a new NFT TransferProxy contract
   *
   * @namedParams
   * @return {Promise<Object>} - New contract address
   */
  async CreateNftTransferProxy() {
    const abistr = fs.readFileSync(
      path.resolve(__dirname, "../contracts/v3/TransferProxyRegistry.abi")
    );
    const bytecode = fs.readFileSync(
      path.resolve(__dirname, "../contracts/v3/TransferProxyRegistry.bin")
    );

    var c = await this.client.DeployContract({
      abi: JSON.parse(abistr),
      bytecode: bytecode.toString("utf8").replace("\n", ""),
      constructorArgs: [],
    });

    return c.contractAddress;
  }

  /**
   * Show NFT Transfer Proxy info
   *
   * @namedParams
   * @param {string} addr - The NFT Transfer Proxy contract address
   * @return {Promise<Object>} - Proxy info object
   */
  async ShowNftTransferProxy({ addr }) {
    const abistr = fs.readFileSync(
      path.resolve(__dirname, "../contracts/v3/TransferProxyRegistry.abi")
    );

    var info = {};

    info.owner = await this.client.CallContractMethod({
      contractAddress: addr,
      abi: JSON.parse(abistr),
      methodName: "owner",
      formatArguments: true,
    });

    return info;
  }

  /**
   * Show NFT mint helper info
   *
   * @namedParams
   * @param {string} addr - The mint helper contract address
   * @return {Promise<Object>} - Mint helper info object
   */
  async ShowMintHelper({ addr }) {
    const abistr = fs.readFileSync(
      path.resolve(__dirname, "../contracts/v3/ElvTokenHelper.abi")
    );

    var info = {};
    try {
      info.owner = await this.client.CallContractMethod({
        contractAddress: addr,
        abi: JSON.parse(abistr),
        methodName: "owner",
        formatArguments: true,
      });
    } catch (e) {
      info.warns = "Bad mint helper address " + addr;
    }
    return info;
  }

  /**
   *  WIP
   */
  /*
  async ContractCallMintHelper(client) {

    const abi = fs.readFileSync(path.resolve(__dirname, "../contracts/v3/ElvTokenHelper.abi"));

    var res = await client.CallContractMethodAndWait({
      contractAddress: addrHelper,
      abi: JSON.parse(abi),
      methodName: "mintWithTokenURIMany",
      methodArgs: [
        [nft2],
        [user1],
        [770],
        [""]
      ],
      formatArguments: true
    });

    console.log(res);
  }
*/

  /**
   * Get the NFT balance for a given user address
   *
   * @namedParams
   * @param {string} addr - The NFT contract address
   * @param {string} ownerAddr - A user address to check the balance of
   * @return {Promise<Object>} - Number of tokens owned
   */
  async NftBalanceOf({ addr, ownerAddr }) {
    var balance = [];
    const abi = fs.readFileSync(
      path.resolve(__dirname, "../contracts/v3/ElvTradableLocal.abi")
    );
    var res = await this.client.CallContractMethod({
      contractAddress: addr,
      abi: JSON.parse(abi),
      methodName: "balanceOf",
      methodArgs: [ownerAddr],
      formatArguments: true,
    });

    // List all tokens
    for (var i = 0; i < res; i++) {
      var tokenId = await this.client.CallContractMethod({
        contractAddress: addr,
        abi: JSON.parse(abi),
        methodName: "tokenOfOwnerByIndex",
        methodArgs: [ownerAddr, i],
        formatArguments: true,
      });

      var holdSecs = -1;
      var holdEnd = -1;
      try {
        holdSecs = await this.client.CallContractMethod({
          contractAddress: addr,
          abi: JSON.parse(abi),
          methodName: "_allTokensHolds",
          methodArgs: [tokenId],
          formatArguments: true,
        });
        holdEnd = new Date(holdSecs * 1000);
      } catch (e) {
        //FIXME: Do we want to print error?
        //console.error(e);
      }

      balance[i] = {
        tokenId: tokenId.toString(),
        hold: holdSecs.toString(),
        holdEnd: holdEnd,
      };
    }

    return balance;
  }

  /**
   * Show info on one token in the NFT contract
   *
   * @namedParams
   * @param {string} addr - The NFT contract address
   * @param {integer} tokenId - The token ID
   * @return {Promise<Object>} - An object containing token info, including 'warnings'
   */
  async NftShowToken({ addr, tokenId }) {
    const abi = fs.readFileSync(
      path.resolve(__dirname, "../contracts/v3/ElvTradableLocal.abi")
    );

    var tokenInfo = {};
    tokenInfo.warns = [];
    tokenInfo.tokenId = tokenId.toString();

    tokenInfo.owner = await this.client.CallContractMethod({
      contractAddress: addr,
      abi: JSON.parse(abi),
      methodName: "ownerOf",
      methodArgs: [tokenId],
      formatArguments: true,
    });

    try {
      const ordinal = await this.client.CallContractMethod({
        contractAddress: addr,
        abi: JSON.parse(abi),
        methodName: "ordinalOfToken",
        methodArgs: [tokenId],
        formatArguments: true,
      });
      tokenInfo.ordinal = ordinal.toString();
    } catch (e) {
      tokenInfo.ordinal = -1;
      tokenInfo.warns.push("Failed to get ordinal: " + addr);
    }

    tokenInfo.tokenURI = await this.client.CallContractMethod({
      contractAddress: addr,
      abi: JSON.parse(abi),
      methodName: "tokenURI",
      methodArgs: [tokenId],
      formatArguments: true,
    });

    try {
      const holdSecs = await this.client.CallContractMethod({
        contractAddress: addr,
        abi: JSON.parse(abi),
        methodName: "_allTokensHolds",
        methodArgs: [tokenId],
        formatArguments: true,
      });
      tokenInfo.holdSecs = holdSecs.toString();
      tokenInfo.holdEnd = new Date(tokenInfo.holdSecs * 1000);
    } catch (e) {
      tokenInfo.warns.push("Failed to get token hold: " + addr);
    }

    return tokenInfo;
  }

  /**
   * Show info about this NFT
   *
   * @namedParams
   * @param {string} addr - The NFT contract address
   * @param {string} mintHelper - Warn if this is not a minter for the NFT contract (hex)
   * @param {string} minter - Warn if this is not the owner of the mint helper contract (hex)
   * @param {string} proxyAddr - proxy owner address
   * @param {integer} showOwners - Also enumerate all token info up to showOwners amount. Only used if tokenId is undefined.
   * @param {integer} tokenId - The token ID to show info for. This will take precedence over showOwners
   * @return {Promise<Object>} - An object containing NFT info, including 'warnings'
   */
  async NftShow({ addr, mintHelper, minterAddr, proxyAddr, showOwners, tokenId }) {
    const abi = fs.readFileSync(
      path.resolve(__dirname, "../contracts/v3/ElvTradableLocal.abi")
    );
    var nftInfo = {};
    var warns = [];

    nftInfo.name = await this.client.CallContractMethod({
      contractAddress: addr,
      abi: JSON.parse(abi),
      methodName: "name",
      formatArguments: true,
    });
    nftInfo.owner = await this.client.CallContractMethod({
      contractAddress: addr,
      abi: JSON.parse(abi),
      methodName: "owner",
      formatArguments: true,
    });
    nftInfo.symbol = await this.client.CallContractMethod({
      contractAddress: addr,
      abi: JSON.parse(abi),
      methodName: "symbol",
      formatArguments: true,
    });
    const totalSupply = await this.client.CallContractMethod({
      contractAddress: addr,
      abi: JSON.parse(abi),
      methodName: "totalSupply",
      formatArguments: true,
    });
    nftInfo.totalSupply = Number(totalSupply);

    nftInfo.transferFee = await this.NftGetTransferFee({address: addr});


    try {
      const minted = await this.client.CallContractMethod({
        contractAddress: addr,
        abi: JSON.parse(abi),
        methodName: "minted",
        formatArguments: true,
      });
      nftInfo.minted = Number(minted);
    } catch (e) {
      nftInfo.minted = -1; // Older contract
    }
    const cap = await this.client.CallContractMethod({
      contractAddress: addr,
      abi: JSON.parse(abi),
      methodName: "cap",
      formatArguments: true,
    });
    nftInfo.cap = Number(cap);

    const proxy = await this.client.CallContractMethod({
      contractAddress: addr,
      abi: JSON.parse(abi),
      methodName: "proxyRegistryAddress",
      formatArguments: true,
    });
    nftInfo.proxy = proxy;

    if (proxy == "0x0000000000000000000000000000000000000000") {
      warns.push("No proxy registered for nft address: " + addr);
    } else {
      nftInfo.proxyInfo = await this.ShowNftTransferProxy({ addr: proxy });
      // proxyAddr is the proxy owner address
      const actualProxyOwner = nftInfo.proxyInfo.owner;
      if (proxyAddr && actualProxyOwner.toLowerCase() != proxyAddr.toLowerCase()){
        warns.push("Bad proxy owner address for nft address: " + addr + ". expected: " + proxyAddr + " registered: " + proxy);
      }
    }

    if (mintHelper) {
      const isMinter = await this.client.CallContractMethod({
        contractAddress: addr,
        abi: JSON.parse(abi),
        methodName: "isMinter",
        methodArgs: [mintHelper],
        formatArguments: true,
      });
      if (!isMinter) {
        warns.push("Mint helper not set up for nft address: " + addr);
      }

      nftInfo.mintHelperInfo = await this.ShowMintHelper({ addr: mintHelper });
      if (nftInfo.warns && nftInfo.warns.length > 0) {
        warns.push(...nftInfo.warns);
      }

      if (!nftInfo.mintHelperInfo.owner || nftInfo.mintHelperInfo.owner == "") {
        warns.push("Bad mint helper - owner not available " + addr);
      } else if (
        minterAddr &&
        nftInfo.mintHelperInfo.owner.toLowerCase() != minterAddr.toLowerCase()
      ) {
        warns.push("Bad mint helper owner for nft address: " + addr
        + " config mint helper: " + mintHelper
        + " config minter address: " + minterAddr
        + " mint helper owner: " + nftInfo.mintHelperInfo.owner);
      }
    }

    if (minterAddr) {
      const isMinter = await this.client.CallContractMethod({
        contractAddress: addr,
        abi: JSON.parse(abi),
        methodName: "isMinter",
        methodArgs: [minterAddr],
        formatArguments: true,
      });
      if (!isMinter) {
        warns.push("Minter not set up for nft address: " + addr
        + " config minter address: " + minterAddr
        );
      }
    }

    try {
      const defHoldSecs = await this.client.CallContractMethod({
        contractAddress: addr,
        abi: JSON.parse(abi),
        methodName: "defHoldSecs",
        formatArguments: true,
      });
      nftInfo.defHoldSecs = defHoldSecs.toString();
    } catch (e) {
      nftInfo.defHoldSecs = "not supported";
      warns.push("Bad local tradable hold: " + addr);
    }

    nftInfo.tokens = [];

    var maxWarnsTokenUri = 1;
    if (tokenId != undefined) {
      try {
        var tokenInfo = await this.NftShowToken({ addr, tokenId });
        nftInfo.token = tokenInfo;
        if (tokenInfo.warns && tokenInfo.warns.length > 0) {
          warns.push(...tokenInfo.warns);
        }
      } catch (e){
        warns.push(`Could not get token info for addr: ${addr} - ${e}`);
      }

    } else if (showOwners && showOwners > 0) {
      var maxShowOwners = showOwners;

      for (var i = 0; i < maxShowOwners && i < nftInfo.totalSupply; i++) {
        nftInfo.tokens[i] = {};

        try {
          tokenId = await this.client.CallContractMethod({
            contractAddress: addr,
            abi: JSON.parse(abi),
            methodName: "tokenByIndex",
            methodArgs: [i],
            formatArguments: true,
          });
          nftInfo.tokens[i].tokenId = tokenId.toString();
        } catch (e) {
          warns.push("Failed to get token ID (index: " + i + "): " + addr);
          continue;
        }

        tokenInfo = await this.NftShowToken({ addr, tokenId });

        if (tokenInfo.warns.length > 0) {
          warns.push(...tokenInfo.warns);
        }

        nftInfo.tokens[i] = tokenInfo;

        if (i == 0) {
          nftInfo.firstTokenUri = nftInfo.tokens[i].tokenURI;
        }
        if (
          maxWarnsTokenUri-- > 0 &&
          (!nftInfo.tokens[i].tokenURI.startsWith(
            Config.consts[Config.net].tokenUriStart
          ) ||
            !nftInfo.tokens[i].tokenURI.endsWith(
              Config.consts[Config.net].tokenUriEnd
            ))
        ) {
          warns.push("Bad tokenURI: " + addr);
        }
      }
    }

    nftInfo.warns = warns;
    return nftInfo;
  }

  /**
   * Add a minter to NFT or ElvToken
   *
   * @namedParams
   * @param {string} addr - The NFT/ElvToken contract address
   * @param {string} mintAddr - The address of the minter (key or helper contract)
   */
  async AddMinter({ addr, minterAddr }) {
    console.log("Add minter, contract_addr=%s, minter_addr=%s", addr, minterAddr);
    const abi = fs.readFileSync(
      path.resolve(__dirname, "../contracts/v3/MinterRole.abi")
    );

    await this.client.CallContractMethodAndWait({
      contractAddress: addr,
      abi: JSON.parse(abi),
      methodName: "addMinter",
      methodArgs: [minterAddr],
      formatArguments: true,
    });

    var res = await this.IsMinter({addr, minterAddr});
    if (!res.is_minter) {
      throw new Error("minter address is not set");
    }
    return res;
  }

  /**
   * Renounce the minter(msg.sender) from NFT or ElvToken
    */
  async RenounceMinter({addr}) {
    console.log("Renounce minter, contract_addr=%s, user_addr=%s", addr.toString(), this.client.CurrentAccountAddress());
    const abi = fs.readFileSync(
      path.resolve(__dirname, "../contracts/v3/MinterRole.abi")
    );

    await this.client.CallContractMethodAndWait({
      contractAddress: addr,
      abi: JSON.parse(abi),
      methodName: "renounceMinter",
      methodArgs: [],
      formatArguments: true,
    });

    var minterAddr = this.client.CurrentAccountAddress();
    var res = await this.IsMinter({addr, minterAddr});
    if (res.is_minter) {
      throw Error("minter address is not removed");
    }
    return res;
  }

  /**
   * check if minter to NFT or ElvToken
   *
   * @namedParams
   * @param {string} addr - The NFT/ElvToken contract address
   * @param {string} mintAddr - The address of the minter (key or helper contract)
   */
  async IsMinter({ addr, minterAddr }) {
    console.log("Check minter, contract_addr=%s, minter_addr=%s", addr, minterAddr);
    const abi = fs.readFileSync(
      path.resolve(__dirname, "../contracts/v3/MinterRole.abi")
    );

    var res = await this.client.CallContractMethod({
      contractAddress: addr,
      abi: JSON.parse(abi),
      methodName: "isMinter",
      methodArgs: [minterAddr],
      formatArguments: true,
    });

    return {
      is_minter: res,
    };
  }

  /**
   * Add a redeemable offer to the NFT contract
   *
   * @namedParams
   * @param {string} addr - The NFT contract address
   */
  async NFTAddRedeemableOffer({addr}){
    const abi = fs.readFileSync(
      path.resolve(__dirname, "../contracts/v3/ElvTradableLocal.abi")
    );

    var res = await this.client.CallContractMethodAndWait({
      contractAddress: addr,
      abi: JSON.parse(abi),
      methodName: "addRedeemableOffer",
      formatArguments: true,
    });

    return res;
  }

  /**
   * Remove a redeemable offer from the NFT contract
   *
   * @namedParams
   * @param {string} addr - The NFT contract address
   */
  async NFTRemoveRedeemableOffer({addr, offerId}){
    const abi = fs.readFileSync(
      path.resolve(__dirname, "../contracts/v3/ElvTradableLocal.abi")
    );

    var res = await this.client.CallContractMethodAndWait({
      contractAddress: addr,
      abi: JSON.parse(abi),
      methodName: "removeRedeemableOffer",
      methodArgs: [offerId],
      formatArguments: true,
    });

    return res;
  }

  /**
   * Returns true if offer is active (has not been removed)
   *
   * @namedParams
   * @param {string} addr - The NFT contract address
   * @param {string} offerId - The Offer ID
   */
  async NFTIsOfferActive({addr, offerId}){
    const abi = fs.readFileSync(
      path.resolve(__dirname, "../contracts/v3/ElvTradableLocal.abi")
    );

    var res = await this.client.CallContractMethod({
      contractAddress: addr,
      abi: JSON.parse(abi),
      methodName: "isOfferActive",
      methodArgs: [offerId],
      formatArguments: true,
    });

    return res;
  }

  /**
   * Returns true if offer is redeemed
   *
   * @namedParams
   * @param {string} addr - The NFT contract address
   * @param {string} offerId - The Offer ID
   */
  async NFTIsOfferRedeemed({addr, tokenId, offerId}){
    const abi = fs.readFileSync(
      path.resolve(__dirname, "../contracts/v3/ElvTradableLocal.abi")
    );

    var res = await this.client.CallContractMethod({
      contractAddress: addr,
      abi: JSON.parse(abi),
      methodName: "isOfferRedeemed",
      methodArgs: [tokenId, offerId],
      formatArguments: true,
    });

    return res;
  }

  /**
   * Redeem an nft offer using the contract directly
   *
   * @namedParams
   * @param {string} addr - The NFT contract address
   * @param {string} offerId - The Offer ID
   */
  async NFTRedeemOffer({addr, redeemerAddr, tokenId, offerId}){
    const abi = fs.readFileSync(
      path.resolve(__dirname, "../contracts/v3/ElvTradableLocal.abi")
    );

    var res = await this.client.CallContractMethodAndWait({
      contractAddress: addr,
      abi: JSON.parse(abi),
      methodName: "redeemOffer",
      methodArgs: [redeemerAddr, tokenId, offerId],
      formatArguments: true,
    });

    return res;
  }

  /**
   * Redeem an nft offer using the Authority Service
   *
   * @namedParams
   * @param {string} addr - The NFT contract address
   * @param {string} offerId - The Offer ID
   */
  async ASNFTRedeemOffer({addr, tenantId, tokenId, offerId, mintHelperAddr}){

    let elvAccount = new ElvAccount({configUrl:this.configUrl, debugLogging: this.debug});
    elvAccount.InitWithClient({elvClient:this.client});
    let sig = await elvAccount.CreateOfferSignature({nftAddress:addr, mintHelperAddress:mintHelperAddr,tokenId,offerId});

    let address = Ethers.utils.verifyMessage(sig.messageHashBytes, sig.signature);
    if (this.debug){
      console.log("Recovered address: ", address);
      console.log("Signed return value: ", sig);
    }

    let refId = crypto.randomUUID();

    let body = {
      "op": "nft-offer-redeem",
      "client_reference_id": refId,
      "tok_addr": addr,
      "tok_id": `${tokenId}`,
      "offer_id": offerId,
      "sig_hex": sig.signedData,
    };

    let res = await this.PostServiceRequest({
      path: `/wlt/act/${tenantId}`,
      body,
      useFabricToken:true
    });

    return {request_id: refId, status: res.status};
  }


  /**
   * Sets the nft policy and permissions for a given object
   * throws error if something goes wrong.
   *
   * @namedParams
   * @param {string} objectId - The NFT object ID
   * @param {string} policyPath - Path to the policy file (eg. nft_owner_minter.yaml). Note that the policy must contain the minter address
   * @param {[string]} addresses - Array of addresses to set the policy permissions
   * @param {bool} clear - Clear
   */
  async NftSetPolicyAndPermissions({ objectId, policyPath, addresses=[], clearAddresses=false}) {
    let elvFabric = new ElvFabric({
      configUrl: this.configUrl,
      debugLogging: this.debug
    });

    await elvFabric.Init({
      privateKey: process.env.PRIVATE_KEY
    });

    // Policy can only be set by object owner
    const objectOwner = await this.client.authClient.Owner({id: objectId});
    if (objectOwner.toLowerCase() != this.client.signer.address.toLowerCase()) {
      throw Error("Policy must be set by object owner " + objectOwner);
    }

    //Set Policy
    const policyString = fs.readFileSync(
      policyPath
    ).toString();

    if (!policyString){
      throw Error("Policy file contents is empty.");
    }

    if (this.debug){
      console.log("Policy file contents: ", policyString);
    }

    let account = new ElvAccount({configUrl:this.configUrl, debugLogging: this.debug});
    account.InitWithClient({elvClient: this.client});

    let policyFormat = await ElvUtils.parseAndSignPolicy({policyString, configUrl:this.configUrl, elvAccount:account});

    if (this.debug){
      console.log("Policy Value To Set: ", policyFormat);
    }

    let res = await elvFabric.SetContractMeta({
      address: objectId,
      key: "_ELV",
      value: JSON.stringify(policyFormat)
    });

    if (!ElvUtils.isTransactionSuccess(res)) {
      throw res;
    }

    if (!clearAddresses && addresses.length == 0) {
      return;
    }

    if (clearAddresses){
      addresses = [];
    }

    for (const address of addresses){
      if (!ethers.utils.isAddress(address)){
        throw Error(`"${address}" is not a valid ethereum address.`);
      }
    }

    let addressesString = JSON.stringify(addresses);

    let res2 = await elvFabric.SetContractMeta({
      address: objectId,
      key: "_NFT_ACCESS",
      value: addressesString
    });

    if (this.debug){
      console.log("Set Policy response: ", res);
    }

    if (!ElvUtils.isTransactionSuccess(res)) {
      throw res2;
    }
  }

  /**
   * Gets the nft policy and permissions for a given contract
   *
   * @namedParams
   * @param {string} nftAddress - The NFT contract address. Can also be iqXXX format.
   * @return {object} object containing the policy string and the list of addresses from nft metadata
   */
  async NftGetPolicyAndPermissions({ address }) {

    if (address.startsWith("iq")){
      address =  Utils.HashToAddress(address);
    }

    let elvFabric = new ElvFabric({
      configUrl: this.configUrl,
      debugLogging: this.debug
    });

    await elvFabric.Init({
      privateKey: process.env.PRIVATE_KEY
    });


    let policy = await elvFabric.GetContractMeta({
      address: address,
      key: "_ELV"
    });

    if (this.debug){
      console.log("Get _ELV response: ", policy);
    }

    let addressesString = await elvFabric.GetContractMeta({
      address: address,
      key: "_NFT_ACCESS"
    });

    if (this.debug){
      console.log("Get _NFT_ACCESS response: ", addressesString);
    }

    let addresses = [];
    try {
      addresses = JSON.parse(addressesString);
    } catch (e){
      if (this.debug){
        console.error("Couldn't parse _NFT_ACCESS response ", e);
      }
    }

    return {"policy": policy, "permissions": addresses};
  }

  /**
   * Sets the content object policy
   *
   * @namedParams
   * @param {string} objectId - The NFT object ID
   * @param {string} policyPath - Path to the content policy file (eg. policy.yaml).
   * @param {string} data - Metadata path within the policy object to link to
   */
  async ContentSetPolicy({ objectId, policyPath, data}) {
    console.log("ContentSetPolicy ", policyPath);
    let elvFabric = new ElvFabric({
      configUrl: this.configUrl,
      debugLogging: this.debug
    });

    await elvFabric.Init({
      privateKey: process.env.PRIVATE_KEY,
      update:true
    });

    const policyString = fs.readFileSync(
      policyPath
    ).toString();

    if (!policyString){
      throw Error("Policy file contents is empty.");
    }

    //TODO: Parse and validate policy

    if (this.debug){
      console.log("Policy file contents: ", policyString);
    }

    let account = new ElvAccount({configUrl:this.configUrl, debugLogging: this.debug});
    account.InitWithClient({elvClient: this.client});
    var policyFormat = await ElvUtils.parseAndSignPolicy({policyString, data, configUrl:this.configUrl, elvAccount:account});
    
    if (this.debug){
      console.log("Policy format: ", policyFormat);
    }

    // Set policy in object metadata
    await elvFabric.setMeta({objectId,meta:policyFormat, merge:true});

    let contractResp = await this.ContentSetPolicyDelegate({objectId,delegateId:objectId});
    return contractResp;
  }

  /**
   * Sets the content object policy
   *
   * @namedParams
   * @param {string} objectId - The NFT object ID
   * @param {string} delegateId - Path to the content policy file (eg. policy.yaml).
   */
  async ContentSetPolicyDelegate({ objectId, delegateId}) {
    let elvFabric = new ElvFabric({
      configUrl: this.configUrl,
      debugLogging: this.debug
    });

    await elvFabric.Init({
      privateKey: process.env.PRIVATE_KEY,
      update:true
    });
    var authContext = {"elv:delegation-id":delegateId};

    //Set delegate in object contract
    let res = await elvFabric.SetContractMeta({
      address: objectId,
      key: "_AUTH_CONTEXT",
      value: JSON.stringify(authContext)
    });

    return res;
  }

  /**
   * Get the content object policy from the Object metadata and the delegate from the Object's contract meta
   *
   * @namedParams
   * @param {string} objectId - The NFT object ID
   */
  async ContentGetPolicy({ objectId }) {
    let elvFabric = new ElvFabric({
      configUrl: this.configUrl,
      debugLogging: this.debug
    });

    await elvFabric.Init({
      privateKey: process.env.PRIVATE_KEY,
      update:true
    });

    let contentPolicyResponse = await elvFabric.getMeta({objectId, select:"auth_policy"});

    //Get delegate from the object contract
    let delegateResp = await elvFabric.GetContractMeta({
      address: objectId,
      key: "_AUTH_CONTEXT"
    });

    return {contentPolicyResponse,delegateResp};
  }

  /**
 * Get the content object policy from the Object metadata and the delegate from the Object's contract meta
 *
 * @namedParams
 * @param {string} objectId - The NFT object ID
 */
  async ContentClearPolicy({ objectId }) {
    let elvFabric = new ElvFabric({
      configUrl: this.configUrl,
      debugLogging: this.debug
    });

    await elvFabric.Init({
      privateKey: process.env.PRIVATE_KEY,
      update:true
    });

    const libraryId = await this.client.ContentObjectLibraryId({objectId});

    const editResponse = await this.client.EditContentObject({
      libraryId,
      objectId
    });

    await elvFabric.client.DeleteMetadata({libraryId, objectId, writeToken:editResponse.write_token,metadataSubtree:"/auth_policy"});
    await this.client.FinalizeContentObject({
      libraryId,
      objectId,
      writeToken: editResponse.write_token
    });

    let deleteDelegateResp = await elvFabric.SetContractMeta({
      address: objectId,
      key: "_AUTH_CONTEXT",
      value: ""
    });

    return deleteDelegateResp;
  }

  /**
   * Create a new NFT contract and set it in the NFT Template object's metadata.
   *
   * @namedParams
   * @param {string} objectId - The ID of the NFT Template
   * @param {string} nftAddr - The NFT contract address (optional; by default create one)
   * @param {string} collectionName - Short name for the ERC-721 contract
   * @param {string} collectionSymbol - Short string for the ERC-721 contract
   * @param {string} hold - Hold period in seconds
   * @param {string} contractUri - URI for the ERC-721 contract
   * @param {string} totalSupply - the mint cap for this template (should be called 'cap')
   * @return {Promise<Object>} - An object containing info about the new NFT
   */
  async NftTemplateAddNftContract({
    objectId,
    tenantId,
    collectionName,
    collectionSymbol,
    hold,
    contractUri,
    totalSupply,
  }) {

    const nftInfo = await this.CreateNftContract({
      tenantId,
      totalSupply,
      collectionName,
      collectionSymbol,
      hold,
      contractUri,
    });

    const nftAddr = nftInfo.nftAddr;

    const libraryId = await this.client.ContentObjectLibraryId({objectId});

    // Update object metadata
    var m = await this.client.ContentObjectMetadata({
      libraryId,
      objectId,
      resolveLinks: false,
    });

    m.permissioned.mint_private.address = nftAddr;
    m.public.asset_metadata.nft.address = nftAddr;
    m.public.asset_metadata.nft.total_supply = totalSupply;
    m.public.asset_metadata.mint.mint_shuffle_key_id = nftInfo.mintShuffleKeyId;

    var e = await this.client.EditContentObject({
      libraryId,
      objectId,
    });

    await this.client.ReplaceMetadata({
      libraryId,
      objectId,
      writeToken: e.write_token,
      metadata: m,
    });

    await this.client.FinalizeContentObject({
      libraryId,
      objectId,
      writeToken: e.write_token,
      commitMessage: "Set NFT contract address " + nftAddr,
    });

    return nftAddr;
  }

  /**
   * Make the public/nft section based on asset metadata
   * Prerequisites:
   * - NFT contract set
   *
   * @namedParams
   * @param {Object} assetMetadata - The NFT Template asset metadata
   * @return {Promise<Object>} - The public/nft JSON
   */
  async NftMake({ assetMetadata, hash }) {
    const m = assetMetadata;
    var pnft = {};

    pnft.test = m.nft.test;
    pnft.name = m.nft.name;
    pnft.display_name = m.nft.display_name;
    pnft.description = m.nft.description; // + addtlInfo;
    pnft.edition_name = m.nft.edition_name;
    pnft.rich_text = m.nft.rich_text;

    pnft.address = m.nft.address;
    pnft.total_supply = m.nft.total_supply;
    pnft.template_id = m.nft.template_id;
    pnft.id_format = m.nft.id_format;

    pnft.copyright = m.nft.copyright;
    pnft.created_at = m.nft.created_at;
    pnft.creator = m.nft.creator;

    pnft.embed_url = m.nft.embed_url;
    pnft.external_url = m.nft.external_url;
    pnft.youtube_url = m.nft.marketplace_attributes.opensea.youtube_url;
    pnft.image = m.nft.image;
    pnft.playable = m.nft.playable;

    pnft.style = m.nft.style;

    let total_supply = pnft.total_supply.toString();

    // pnft.addtl_info = addtlInfo;

    pnft.attributes = [
      {
        trait_type: "Creator",
        value: "Eluvio NFT Central",
      },
      {
        trait_type: "Total Minted Supply",
        value: total_supply,
      },
      {
        trait_type: "Content Fabric Hash",
        value: hash,
      },
    ];

    return pnft;
  }

  /**
   * Read image and attributes info from a directory
   *
   * Required format:
   * - the directory should contain a list of '*.json' files (flat, not in a hierarchy)

   * Returns an array of objects containing:
   * - imgFile - file name (no path)
   * - imgFilePath - full path to source file
   * - attrs - attributes object (optional)
   *
   * @namedParams
   * @param {string} nftDir - the directory containing the nft json files
   * @return {Promise<Object>} - The 'images' object and calculated rarity
   */
  async readNftDir({ nftDir }) {
    let nftMetas = [];
    let files;
    let rarity = {};

    files = await fs.promises.readdir(nftDir);
    files.forEach(function (file) {
      // Only considering jpg files
      if (path.extname(file) == ".json") {
        let attrsBuf = fs.readFileSync(path.join(nftDir, file));
        let nftMeta = JSON.parse(attrsBuf);
        let count = 1;
        if (nftMeta.count && nftMeta.count > 1) {
          count = nftMeta.count;
        }

        for (var i = 0; i < count; i++) {
          // Calculate rarity
          if (nftMeta.attributes != null) {
            //console.log("attributes ", nftMeta.attributes);
            nftMeta.attributes.forEach((elem) => {
              // Fix up attributes - replace 'type' wit 'trait_type'
              if (elem.type != null) {
                elem.trait_type = elem.type;
                delete elem.type;
              }

              if (rarity[elem.trait_type]) {
                rarity[elem.trait_type].total =
                  rarity[elem.trait_type].total + 1;
              } else {
                rarity[elem.trait_type] = {};
                rarity[elem.trait_type].total = 1;
              }

              if (rarity[elem.trait_type][elem.value]) {
                rarity[elem.trait_type][elem.value] =
                  rarity[elem.trait_type][elem.value] + 1;
              } else {
                rarity[elem.trait_type][elem.value] = 1;
              }
            });
          }
          nftMetas.push(nftMeta);
        }
      }
    });

    return { nftMetas, rarity };
  }

  /**
   * Make a single element of the public/nfts section of a generative,
   * multi image/video token based on asset metadata and input parameters.
   * The public/nfts key is an array of objects, each equivalent to
   * the single NFT public/nft section.
   *
   * Prerequisites:
   * - NFT contract set
   *
   * @namedParams
   * @param {Object} assetMetadata - The NFT Template asset metadata
   * @param {string} hash - NFT Template hash
   * @param {string} imagePath - Local file path to the image
   * @param {Object} attrs - Extra attributes for this token
   * @param {Object} rarity - Stats for each trait and value
   * @return {Promise<Object>} - The public/nfts JSON array element
   */
  async NftMakeGenerative({ assetMetadata, hash, nftMeta, rarity }) {
    const m = assetMetadata;
    var pnft = {};

    pnft.test = m.nft.test;
    pnft.name = nftMeta.name || m.nft.name;
    pnft.display_name = nftMeta.display_name || m.nft.display_name;
    pnft.description = nftMeta.description || m.nft.description;
    pnft.edition_name = nftMeta.edition_name || m.nft.edition_name;
    pnft.rich_text = nftMeta.rich_text || m.nft.rich_text;

    pnft.address = m.nft.address;
    pnft.total_supply = m.nft.total_supply;
    pnft.template_id = m.nft.template_id;
    pnft.id_format = m.nft.id_format;

    pnft.copyright = m.nft.copyright;
    pnft.created_at = m.nft.created_at;
    pnft.creator = m.nft.creator;

    pnft.embed_url = nftMeta.embed_url;
    pnft.external_url = nftMeta.embed_url;
    pnft.youtube_url = nftMeta.embed_url;
    pnft.image = nftMeta.image;
    pnft.playable = m.nft.playable;

    pnft.style = m.nft.style;

    if (!pnft.total_supply) {
      throw Error("No Total supply found");
    }

    let total_supply = pnft.total_supply.toString();

    pnft.attributes = [
      {
        trait_type: "Creator",
        value: "Eluvio NFT Central",
      },
      {
        trait_type: "Total Minted Supply",
        value: total_supply,
      },
      {
        trait_type: "Content Fabric Hash",
        value: hash,
      },
    ];

    // Insert rarity if doesn't exist
    for (const i in nftMeta.attributes) {
      if (nftMeta.attributes[i].rarity !== undefined){
        continue;
      }
      if (rarity && rarity[nftMeta.attributes[i].trait_type]) {
        let r = rarity[nftMeta.attributes[i].trait_type];
        nftMeta.attributes[i].rarity =
          r[nftMeta.attributes[i].value] + "/" + total_supply;
      }
    }
    pnft.attributes = pnft.attributes.concat(nftMeta.attributes);

    return pnft;
  }

  /**
   * Set the public/nft section based on asset metadata
   *
   * For generative NFTs we use the following convention - nftDir must contain:
   * One or more json files with a '.json' extension (for example: nft001.json, nft002.json)
   * Example JSON File:
   *
   * {
   *   "count":3,                                   (OPTIONAL, Default: 1)
   *   "name": "Example NFT",                       (OPTIONAL, Default: from Content Object)
   *   "display_name": "Example NFT",               (OPTIONAL, Default: from Content Object)
   *   "description" : "This is an example NFT.",   (OPTIONAL, Default: from Content Object)
   *   "rich_text" : "",                            (OPTIONAL, Default: from Content Object)
   *   "image": "https://image003",
   *   "embed_url":"https://videoURL003",
   *   "attributes:":
   *   [
   *     {
   *       "trait_type":"trait01",
   *       "value": "test1",
   *       "rarity": 0.2                            (OPTIONAL, If not present, it will be calculated)
   *     }
   *   ]
   * }
   *
   * The 'count' is an optional parameter to generate copies of this nft element inside
   * the /public/nfts array
   *
   * All other optional keys (name, display_name, description, etc) will override the
   * NFT content object's value from /asset_metadata/nft if present.
   *
   * The required key 'attributes' is an array of objects {"trait_type": "", "value": ""}
   * and is used to calculate trait rarity. If rarity is already present in the attribute,
   * it will be used instead.
   *
   * @namedParams
   * @param {string} library ID
   * @param {string} hash - The NFT Template hash or id
   * @param {string} nftDir - Directory containing nft json file(s) for building nfts
   * @return {Promise<Object>} - The public/nft or public/nfts JSON
   */
  async NftBuild({ libraryId, objectId, nftDir }) {
    var hash = await this.client.LatestVersionHash({
      objectId,
    });

    var m = await this.client.ContentObjectMetadata({
      libraryId,
      objectId,
      metadataSubtree: "public/asset_metadata",
      resolveLinks: false,
    });

    var pnft;
    var pnfts = [];

    // Determine if this is a single or multi-image NFT

    if (nftDir && nftDir.length > 0) {
      // Generative NFT - build an nft array

      // Read image and attributes info from directory
      let { nftMetas, rarity } = await this.readNftDir({ nftDir });
      for (const nftMeta of nftMetas) {
        pnft = await this.NftMakeGenerative({
          assetMetadata: m,
          hash,
          nftMeta,
          rarity,
        });
        pnfts.push(pnft);
      }
    } else {
      // Single media NFT - build an nft object
      pnft = await this.NftMake({ assetMetadata: m, hash });
    }

    var e = await this.client.EditContentObject({
      libraryId,
      objectId,
    });

    if (nftDir && nftDir.length > 0) {
      // Merge the nft array
      await this.client.ReplaceMetadata({
        libraryId,
        objectId,
        writeToken: e.write_token,
        metadataSubtree: "public/nfts",
        metadata: pnfts,
      });
    } else {
      // Merge the single nft object
      await this.client.ReplaceMetadata({
        libraryId,
        objectId,
        writeToken: e.write_token,
        metadataSubtree: "public/nft",
        metadata: pnft,
      });
    }

    var f = await this.client.FinalizeContentObject({
      libraryId,
      objectId,
      writeToken: e.write_token,
      commitMessage: "Set NFT public/nft",
    });

    return f;
  }

  /**
   * Set the public/nft section based on asset metadata
   *
   * @namedParams
   * @param {string} addr - Local NFT contract address
   * @param {integer} tokenId - External NFT token ID
   * @return {Promise<Object>} - NFT info JSON
   */
  async NftLookup(/* addr, */ tokenId) {

    console.log("tokenId", tokenId);

    var x = new BigNumber(tokenId, 10);
    console.log(x.toString(16));
  }

  /**
   * Burn the specified NFT token as the owner
   *
   * @namedParams
   * @param {string} addr - Local NFT contract address
   * @param {integer} tokenId - External NFT token ID
   * @return {Promise<Object>} - NFT info JSON
   */
  async NftBurn({ addr, tokenId }) {
    const abi = fs.readFileSync(
      path.resolve(__dirname, "../contracts/v3/ElvTradableLocal.abi")
    );

    await this.CheckIsOwner({addr, tokenId});

    var res = await this.client.CallContractMethodAndWait({
      contractAddress: addr,
      abi: JSON.parse(abi),
      methodName: "burn",
      methodArgs: [tokenId],
      formatArguments: true,
    });

    return res;
  }

  /**
   * Burn the specified NFT token as a proxy owner
   *
   * @namedParams
   * @param {string} addr - Local NFT contract address
   * @param {integer} tokenId - External NFT token ID
   * @return {Promise<Object>} - NFT info JSON
   */
  // eslint-disable-next-line no-unused-vars
  async NftProxyBurn({ addr, tokenId }) {
    return "Sorry, not yet implemented.";
  }

  /**
   * Checks if the current signer address owns the NFT token. Throws error if not owner.
   *
   * @namedParams
   * @param {string} addr - Local NFT contract address
   * @param {integer} tokenId - External NFT token ID
   */
  async CheckIsOwner({ addr, tokenId}) {
    const abi = fs.readFileSync(
      path.resolve(__dirname, "../contracts/v3/ElvTradableLocal.abi")
    );

    let signerAddr = this.client.signer.address;

    var owner = await this.client.CallContractMethod({
      contractAddress: addr,
      abi: JSON.parse(abi),
      methodName: "ownerOf",
      methodArgs: [tokenId],
      formatArguments: true
    });

    if (signerAddr.toLowerCase() != owner.toLowerCase()){
      throw Error(`Not owner. (signer: ${signerAddr} owner: ${owner})`);
    }
  }

  /**
   * Transfer the specified NFT token as the owner through contract
   *
   * @namedParams
   * @param {string} addr - Local NFT contract address
   * @param {integer} tokenId - External NFT token ID
   * @return {Promise<Object>} - NFT info JSON
   */
  async NftTransfer({ addr, tokenId, toAddr }) {
    const abi = fs.readFileSync(
      path.resolve(__dirname, "../contracts/v3/ElvTradableLocal.abi")
    );

    await this.CheckIsOwner({addr, tokenId});

    let fromAddr = this.client.signer.address;

    var res = await this.client.CallContractMethodAndWait({
      contractAddress: addr,
      abi: JSON.parse(abi),
      methodName: "safeTransferFrom",
      methodArgs: [fromAddr, toAddr, tokenId],
      formatArguments: true,
    });

    return res;
  }

  /**
   * Transfer the specified NFT token as the owner using Authority Service
   *
   * @namedParams
   * @param {string} addr - Local NFT contract address
   * @param {integer} tokenId - External NFT token ID
   * @return {Promise<Object>} - NFT info JSON
   */
  async AsNftTransfer({ addr, tokenId, toAddr }) {

    let body = {
      contract: addr,
      token: tokenId,
      to_addr: toAddr
    };

    let res = await this.PostServiceRequest({
      path: "/wlt/mkt/xfer",
      body,
      useFabricToken:true
    });

    return {status: res.status};
  }

  /**
   * Transfer an NFT as a proxy owner.
   *
   * @namedParams
   * @param {string} addr - The NFT contract address
   * @param {string} fromAddr - The current owner of the token
   * @param {string} toAddr - A user address to tranfer to
   * @param {integer} tokenId - The token ID
   * @return {Promise<Object>} - ?
   */
  async NftProxyTransferFrom({ addr, tokenId, fromAddr, toAddr }) {
    console.log("NFT Transfer", "from: ", fromAddr);
    const abi = fs.readFileSync(
      path.resolve(__dirname, "../contracts/v3/ElvTradableLocal.abi")
    );
    const pxabi = fs.readFileSync(
      path.resolve(__dirname, "../contracts/v3/TransferProxyRegistry.abi")
    );

    var ownerOf = await this.client.CallContractMethod({
      contractAddress: addr,
      abi: JSON.parse(abi),
      methodName: "ownerOf",
      methodArgs: [tokenId],
      formatArguments: true,
    });

    if (ownerOf.toLowerCase() != fromAddr.toLowerCase()) {
      console.log("Not owner", "(owner: " + ownerOf + ")");
      return;
    }

    const proxy = await this.NFTProxyAddress({ addr });

    console.log("Executing proxyTransferFrom");
    var res = await this.client.CallContractMethodAndWait({
      contractAddress: proxy,
      abi: JSON.parse(pxabi),
      methodName: "proxyTransferFrom",
      methodArgs: [addr, fromAddr, toAddr, tokenId],
      formatArguments: true,
    });

    return res;
  }

  async NFTProxyAddress({ addr }) {
    const abi = fs.readFileSync(
      path.resolve(__dirname, "../contracts/v3/ElvTradableLocal.abi")
    );

    const proxy = await this.client.CallContractMethod({
      contractAddress: addr,
      abi: JSON.parse(abi),
      methodName: "proxyRegistryAddress",
      formatArguments: true,
    });

    if (proxy == "0x0000000000000000000000000000000000000000") {
      throw "NFT has no proxy";
    }

    var proxyInfo = await this.ShowNftTransferProxy({ addr: proxy });
    if (proxyInfo.owner != this.client.signer.address) {
      throw `Bad key - not proxy owner (should be: ${proxyInfo.owner}`;
    }

    return proxy;
  }

  /**
   * Synchronize backend listings with fabric metadata for a specific tenant's NFT
   *
   * @namedParams
   * @param {string} tenant - The Tenant ID
   * @param {integer} maxNumber - The address to mint to
   * @return {Promise<Object>} - The API Response containing list of Wallet Info
   */
  async NFTRefresh({ tenant, address}) {
    let res = await this.PutServiceRequest({
      path: urljoin("/mkt/refresh/", tenant, address)
    });
    return await res.json();
  }

  /**
   * Gets the baseTransferFee of the NFT Contract
   *
   * @namedParams
   * @param {string} address - The NFT contract address
   * @return {string} - The fee as a big number sring
   */
  async NftGetTransferFee({address}) {
    const abi = fs.readFileSync(
      path.resolve(__dirname, "../contracts/v3/ElvTradableLocal.abi")
    );

    var res = await this.client.CallContractMethod({
      contractAddress: address,
      abi: JSON.parse(abi),
      methodName: "baseTransferFee",
      formatArguments: true,
    });

    return Number(res);
  }

  /**
   * Sets the baseTransferFee of the NFT Contract
   *
   * @namedParams
   * @param {string} address - The NFT contract address
   * @param {string} fee - Fee in ETH to set as a big number string
   * @return {Promise<Object>} - The Contract transaction logs
   */
  async NftSetTransferFee({address, fee}) {
    const abi = fs.readFileSync(
      path.resolve(__dirname, "../contracts/v3/ElvTradableLocal.abi")
    );

    var res = await this.client.CallContractMethodAndWait({
      contractAddress: address,
      abi: JSON.parse(abi),
      methodName: "setBaseTransferFee",
      methodArgs: [fee],
      formatArguments: true,
    });

    return res;
  }

  async TenantSign({ message }) {
    const signature = await this.client.authClient.Sign(
      Ethers.utils.keccak256(Ethers.utils.toUtf8Bytes(message))
    );
    const multiSig = this.client.utils.FormatSignature(signature);
    return { signature, multiSig };
  }

  async PutServiceRequest({ path, body={}, headers = {}, queryParams={}, useFabricToken=false }) {
    return await this.TenantAuthServiceRequest({path, method: "PUT", queryParams, body, headers, useFabricToken});
  }

  async PostServiceRequest({ path, body={}, headers = {}, queryParams={}, useFabricToken=false }) {
    return await this.TenantAuthServiceRequest({path, method: "POST", queryParams, body, headers, useFabricToken});
  }

  async GetServiceRequest({ path, queryParams={}, headers = {}}) {
    return await this.TenantPathAuthServiceRequest({path, method:"GET", queryParams, headers});
  }

  async DeleteServiceRequest({ path, queryParams={}, headers = {}}) {
    return await this.TenantPathAuthServiceRequest({path, method:"DELETE", queryParams, headers});
  }

  async TenantAuthServiceRequest({ path, method, queryParams={}, body={}, headers = {}, useFabricToken=false }) {
    if (!body) {
      body = {};
    }
    let ts = Date.now();
    body.ts = ts;

    let token = "";
    if ( useFabricToken ) {
      token = await this.client.CreateFabricToken({
        duration:ElvAccount.TOKEN_DURATION
      });

    } else {
      const { multiSig } = await this.TenantSign({
        message: JSON.stringify(body),
      });
      token = multiSig;
    }

    let res;

    path = urljoin(this.asUrlPath, path);

    res = await this.client.authClient.MakeAuthServiceRequest({
      method,
      path,
      body,
      headers: {
        Authorization: `Bearer ${token}`,
        ...headers,
      },
      queryParams,
    });
    return res;
  }

  /**
   * Authority Service API request using path auth. Typically used for GET and DELETE
   *
   * @namedParams
   * @param {string} path - The request endpoint
   * @param {string} method - The rquest method
   * @param {Object} queryParams - The query parameters
   * @param {Object} headers - The headers
   * @return {Promise<Object>} - The API Response
   */
  async TenantPathAuthServiceRequest({ path, method, queryParams={}, headers = {}}) {
    let ts = Date.now();
    let params = { ts, ...queryParams };
    const paramString = new URLSearchParams(params).toString();

    var newPath = path + "?" + paramString;

    const { multiSig } = await this.TenantSign({
      message: newPath,
    });

    if (this.debug) {
      console.log(`Authorization: Bearer ${multiSig}`);
    }

    let res = {};

    path = urljoin(this.asUrlPath, path);

    res = await this.client.authClient.MakeAuthServiceRequest({
      method,
      path,
      headers: {
        Authorization: `Bearer ${multiSig}`,
        ...headers,
      },
      queryParams: { ts, ...queryParams },
    });

    return res;
  }

  /**
   * Mint an NFT using Tenant Auth
   *
   * @namedParams
   * @param {string} tenant - The Tenant ID
   * @param {string} marketplace - Marketplace ID of the NFT
   * @param {string} sku - SKU of the NFTs
   * @param {string} addr - The address to mint to
   * @return {Promise<Object>} - API Response Object
   */
  async TenantMint({ tenant, marketplace, sku, addr, quantity = 1 }) {
    let now = Date.now();

    let body = {
      trans_id: "",
      tickets: null,
      products: [
        {
          prod_name: "",
          sku: sku,
          quant: quantity,
        },
      ],
      ident: "minter@tenant.com",
      email: "minter@tenant.com",
      cust_name: "minter@tenant.com",
      ts: now,
      extra: {
        elv_addr: addr,
      },
    };

    let res = await this.PostServiceRequest({
      path: urljoin("/tnt/trans/base/", tenant, marketplace),
      body,
    });
    return res;
  }

  /**
   * Get the list of wallets bound by the Tenant
   *
   * @namedParams
   * @param {string} tenant - The Tenant ID
   * @param {integer} maxNumber - The address to mint to
   * @return {Promise<Object>} - The API Response containing list of Wallet Info
   */
  async TenantWallets({ tenant, maxNumber = Number.MAX_SAFE_INTEGER }) {
    if (maxNumber < 1) {
      maxNumber = Number.MAX_SAFE_INTEGER;
    }

    let res = await this.GetServiceRequest({
      path: urljoin("/tnt/wlt/", tenant),
      queryParams: { limit: maxNumber },
    });
    return await res.json();
  }

  /**
   * Generate tickets (NTP) as a tenant.
   *
   * @namedParams
   * @param {string} tenant - The Tenant ID
   * @param {string} otp - The OTP ID
   * @param {integer} quantity - Number of tickets to generate
   * @return {Promise<Object>} - Tickets API Response Object
   */
  async TenantTicketsGenerate({ tenant, otp, host, quantity = 1 }) {
    let now = Date.now();

    let body = {
      tickets: {
        quantity: quantity,
      },
      ts: now
    };

    let res = await this.PostServiceRequest({
      path: urljoin("/tnt/tix", tenant, otp),
      host,
      body,
    });
    return await res.json();

  }


  /**
   * Get the list of Tenant marketplaces/sites from the Main Live Object
   * No Tenant ID or Tenant Slug will return all tenants.
   *
   * @namedParams
   * @param {string} tenantId - The Tenant ID (Optional).
   * @param {string} tenantSlug - The Tenant ID (Optional). No Tenant ID will return all tenants.
   * @return {Promise<Object>} - List or single Tenant Info
   */
  async List({ tenantId, tenantSlug }) {
    let results = {};

    let objectId = this.mainObjectId;

    const libraryId = await this.client.ContentObjectLibraryId({
      objectId,
    });

    let staticToken = await this.client.authClient.AuthorizationToken({
      libraryId,
      channelAuth: false,
      noAuth: true,
    });

    //Create a new client using only staticToken
    let client = await ElvClient.FromConfigurationUrl({
      configUrl: this.configUrl,
      staticToken,
    });

    let warns = [];
    let meta = {};
    let metadataSubtree = "/public/asset_metadata/tenants";

    meta = await client.ContentObjectMetadata({
      libraryId,
      objectId,
      metadataSubtree,
      resolveLinks: true,
      resolveIncludeSource: true,
      resolveIgnoreErrors: true,
      linkDepthLimit: 5,
    });

    if (tenantSlug) {
      results = meta[tenantSlug];
    } else if (tenantId) {
      let tenants = meta || {};

      for (const index in tenants) {
        try {
          let tenantObj = tenants[index];
          for (var key in tenantObj.marketplaces) {
            let marketplace = tenantObj.marketplaces[key];
            if (marketplace && marketplace.info) {
              let testTenantId = marketplace.info.tenant_id;
              if (testTenantId === tenantId) {
                results = tenantObj;
                break;
              }
            }
          }
        } catch (e) {
          warns.push(`Error reading tenant: ${index} ${e}`);
        }
      }
    } else {
      results.tenants = meta;
    }

    results.warns = warns;

    return results;
  }

  /**
   * Get primary sales history for the tenant
   *
   * @namedParams
   * @param {string} tenant - The Tenant ID
   * @param {string} marketplace - The marketplace ID
   * @return {Promise<Object>} - The API Response containing primary sales info
   */
  async TenantPrimarySales({ tenant, marketplace, processor, csv, offset }) {
    let headers = {};
    let toJson = true;
    if (csv && csv != "") {
      headers = { Accept: "text/csv" };
      toJson = false;
    }

    let res = await this.GetServiceRequest({
      path: urljoin("/tnt/purchases/", tenant, marketplace),
      queryParams: { offset, processor },
      headers,
    });

    return toJson ? await res.json() : await res.text();
  }

  /**
   * Get secondary sales history for the tenant
   *
   * @namedParams
   * @param {string} tenant - The Tenant ID
   * @return {Promise<Object>} - The API Response containing primary sales info
   */
  async TenantSecondarySales({ tenant, processor, csv, offset }) {
    let headers = {};
    let toJson = true;
    if (csv && csv != "") {
      headers = { Accept: "text/csv" };
      toJson = false;
    }

    let res = await this.GetServiceRequest({
      path: urljoin("/tnt/payments/", tenant),
      queryParams: { offset, processor },
      headers
    });

    return toJson ? await res.json() : await res.text();
  }

  /**
   * Get unified primary&secondary sales history for the tenant
   *
   * @namedParams
   * @param {string} tenant - The Tenant ID
   * @return {Promise<Object>} - The API Response containing primary sales info
   */
  async TenantUnifiedSales({ tenant, processor, csv, offset }) {
    let headers = {};
    let toJson = true;
    if (csv && csv != "") {
      headers = { Accept: "text/csv" };
      toJson = false;
    }

    let res = await this.GetServiceRequest({
      path: urljoin("/tnt/report/", tenant),
      queryParams: { offset, processor },
      headers
    });

    return toJson ? await res.json() : await res.text();
  }

  async TenantAddConsumers({groupId, accountAddresses}){
    const abi = fs.readFileSync(
      path.resolve(__dirname, "../contracts/v3/BaseTenantConsumerGroup.abi")
    );
    const address = Utils.HashToAddress(groupId);

    var response = await this.client.CallContractMethodAndWait({
      contractAddress: address,
      abi: JSON.parse(abi),
      methodName: "grantAccessMany",
      methodArgs: [accountAddresses],
      formatArguments: true,
    });

    return response;
  }


  async TenantHasConsumer({groupId, accountAddress}){
    const abi = fs.readFileSync(
      path.resolve(__dirname, "../contracts/v3/BaseTenantConsumerGroup.abi")
    );
    const address = Utils.HashToAddress(groupId);

    var response = await this.client.CallContractMethod({
      contractAddress: address,
      abi: JSON.parse(abi),
      methodName: "hasAccess",
      methodArgs: [accountAddress],
      formatArguments: true,
    });

    return response;
  }

  async TenantRemoveConsumer({groupId, accountAddress}){
    const abi = fs.readFileSync(
      path.resolve(__dirname, "../contracts/v3/BaseTenantConsumerGroup.abi")
    );
    const address = Utils.HashToAddress(groupId);

    var response = await this.client.CallContractMethodAndWait({
      contractAddress: address,
      abi: JSON.parse(abi),
      methodName: "revokeAccess",
      methodArgs: [accountAddress],
      formatArguments: true,
    });

    return response;
  }

  /**
   * Get failed transfer report for the tenant. Used to identify payments collected on failed transfers.
   *
   * @namedParams
   * @param {string} tenant - The Tenant ID
   * @return {Promise<Object>} - The API Response containing the failed transfers report
   */
  async TenantTransferFailures({ tenant }) {
    let res = await this.GetServiceRequest({
      path: urljoin("/tnt/transfers/failed/", tenant),
    });
    return await res.json();
  }

  /**
   * Deploy minter helper contract using the authority service
   *
   * @namedParams
   * @param {string} tenant - The Tenant ID
   * @return {Promise<Object>} - The API Response for the request
   */
  async TenantDeployHelperContracts({ tenant, host, proxy=false, mintHelper=false }) {
    let res = await this.PostServiceRequest({
      path: urljoin("/tnt/config", tenant, "deploy"),
      host,
      queryParams: {proxy,mint_helper:mintHelper}
    });
    return res;
  }

  /**
   * Get minter configuration from authority service
   *
   * @namedParams
   * @param {string} tenant - The Tenant ID
   * @return {Promise<Object>} - The API Response for the tenant's minter configuration
   */
  async TenantGetMinterConfig({ tenant, host }) {
    let res = await this.GetServiceRequest({
      path: urljoin("/tnt/config", tenant, "minter"),
      host
    });
    return res.json();
  }

  /**
   * Create minter configuration using the authority service
   *
   * @namedParams
   * @param {string} tenant - The Tenant ID
   * @return {Promise<Object>} - The API Response for the request
   */
  async TenantCreateMinterConfig({ tenant, host, funds=0, deploy=false }) {
    let res = await this.PostServiceRequest({
      path: urljoin("/tnt/config", tenant, "minter"),
      host
    });

    let tenantConfigResult = await res.json();

    if (this.debug){
      console.log("Create response: ", tenantConfigResult);
    }

    if (tenantConfigResult.errors && tenantConfigResult.errors.length != 0){
      return res;
    }

    if (funds > 0){
      console.log ("Funding minter and proxy addresses.");
      let minterAddress = tenantConfigResult.config.minter_address;

      let account = new ElvAccount({configUrl:this.configUrl, debugLogging: this.debug});
      account.InitWithClient({elvClient: this.client});

      await account.Send({
        address: minterAddress,
        funds
      });

      console.log("Funds Sent to minter address: ", minterAddress);

      let proxyAddress = tenantConfigResult.config.proxy_owner_address;

      await account.Send({
        address: proxyAddress,
        funds
      });

      console.log("Funds Sent to proxy address: ", proxyAddress);
    }

    if (deploy){
      console.log("Deploying helper contracts");
      res = await this.TenantDeployHelperContracts({tenant, host});
      return await res.json();
    } else {
      return tenantConfigResult;
    }
  }

  /**
   * Replaces minter configuration using the authority service
   *
   * @namedParams
   * @param {string} tenant - The Tenant ID
   * @return {Promise<Object>} - The API Response for the request
   */
  async TenantReplaceMinterConfig({ tenant, host, proxyOwner, minter, mintHelper, proxy, mintShuffleKey, legacyShuffleSeed, purge=false}) {
    let res = await this.PutServiceRequest({
      path: urljoin("/tnt/config", tenant, "minter"),
      host,
      queryParams: {
        proxyowner:proxyOwner,
        minter,
        mint_helper: mintHelper,
        proxy,
        mint_shuffle_key: mintShuffleKey,
        legacy_shuffle_seed: legacyShuffleSeed,
        purge
      }
    });
    return res.json();
  }

  /**
   * Delete minter configuration using the authority service
   *
   * @namedParams
   * @param {string} tenant - The Tenant ID
   * @return {Promise<Object>} - The API Response for the request
   */
  async TenantDeleteMinterConfig({ tenant, host, force=false }) {
    let res = await this.DeleteServiceRequest({
      path: urljoin("/tnt/config", tenant, "minter"),
      host,
      queryParams: {force}
    });
    return res;
  }

  /**
    * Submits a new content version hash of this account's Tenant Object for updating to the Eluvio Live Tree.
    * @namedParams
    * @param {string} tenant - The Tenant ID
    * @param {string} host - Authority Service url (Optional)
    * @param {string} contentHash - Version hash of the new Tenant Object to submit
    * @return {Promise<Object>} - The API Response for the request
    */
  async TenantPublishData({tenant, host, contentHash, updateLinks=false}) {
    let latestVersionHash = contentHash;
    if (updateLinks){
      let objectId = this.client.utils.DecodeVersionHash(contentHash).objectId;
      let libraryId = await this.client.ContentObjectLibraryId({objectId});
      await this.client.UpdateContentObjectGraph({libraryId,objectId});

      latestVersionHash = await this.client.LatestVersionHash({objectId});
      contentHash = latestVersionHash;
      if (this.debug){
        console.log("Update links latest version hash: ", contentHash, " object Id ", objectId, " library Id ", libraryId);
      }
    }

    let tenantConfigResult = null;

    var body = {
      content_hash: contentHash
    };

    let res = await this.PostServiceRequest({
      path: urljoin("/tnt/config", tenant, "metadata"),
      host,
      body
    });

    tenantConfigResult = await res.json();

    if (this.debug){
      console.log("Create response: ", tenantConfigResult);
    }

    return {response:tenantConfigResult, content_hash_updated:contentHash };
  }

  /**
   * Get Admin API status from Authority Service
   *
   * @namedParams
   * @param {string} host - Authority Service url (Optional)
   * @return {Promise<Object>} - The API Response for the adm/health api
   */
  async AdminHealth() {
    let res = await this.GetServiceRequest({
      path: "/adm/health"
    });
    return res.text();
  }

  FilterTenant({ object }) {
    let result = {};
    result.marketplaces = object.marketplaces;
    result.sites = object.sites;
    return result;
  }

  FilterMarketplace({ object }) {
    let result = {};
    let warns = [];

    result.title = object.title;

    result.tenant_id = object.info.tenant_id || null;
    if (!result.tenant_id) {
      warns.push(`No tenant_id for ${object.title}`);
    }

    result.items = object.info.items || null;
    if (!result.items || result.items.length === 0) {
      warns.push(`No Items found for ${object.title}`);
    }

    return { result, warns };
  }

  FilterNft({ object }) {
    let result = {};
    let warns = [];
    result.title = object.nft_template.title;

    result.sku = object.sku || null;
    if (!result.sku) warns.push(`No sku for ${object.title}`);

    result.address = object.nft_template.nft.address;
    if (!result.address) warns.push(`No address for ${object.title}`);

    result.version_hash = object.nft_template["."].source;
    if (!result.version_hash) warns.push(`No versionHash for ${object.title}`);

    return { result, warns };
  }

  FilterSite({ object }) {
    let result = {};
    let warns = [];

    result.title = object.title || null;

    result.tenant_id = object.info.tenant_id || null;
    if (!result.tenant_id) warns.push(`No tenant_id for ${object.title}`);

    result.marketplace_slug = object.info.marketplace_slug || null;
    if (!result.marketplace_slug)
      warns.push(`No marketplace_slug for ${object.title}`);

    return { result, warns };
  }
}

exports.EluvioLive = EluvioLive;
