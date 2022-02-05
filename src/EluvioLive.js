const { ElvClient } = require("elv-client-js")
const Utils = require("elv-client-js/src/Utils.js")
const { Config } = require("./Config.js")

const Ethers = require("ethers");
const fs = require('fs');
const path = require('path');
const BigNumber = require('big-number');


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
   * @param {string} tenantObjectId - The ID of the tenant specific EluvioLive object (optional)
   * @return {EluvioLive} - New EluvioLive object connected to the specified content fabric and blockchain
   */
  constructor({
	configUrl,
	mainObjectId,
	tenantObjectId
  }) {

    this.configUrl = configUrl || ElvClient.main;
	this.mainObjectId = mainObjectId;

    this.debug = false;
  }

  async Init() {
	this.client = await ElvClient.FromConfigurationUrl({
      configUrl: this.configUrl
    });
	let wallet = this.client.GenerateWallet();
    let signer = wallet.AddAccount({
      privateKey: process.env.PRIVATE_KEY
    });
    this.client.SetSigner({signer});
	this.client.ToggleLogging(false);
  }

  /**
   * Show info about this tenant.
   * Currently only listing NFT marketplaces.
   *
   * @namedParams
   * @param {string} tenantId - The ID of the tenant (iten***)
   * @param {string} libraryId - The 'properties' library ID
   * @param {string} objectId - The ID of the tenant specific EluvioLive object
   * @param {string} eventId - The specific event to list (optional)
   * @param {string} marketplaceId - The specific marketplace to list (optional)
   * @cauth {string} cauth - Warn if any NFTs have a different cauth ID (optional)
   * @cauth {string} mintHelper - Warn if any NFTs don't have this as minter
   * @return {Promise<Object>} - An object containing tenant info, including 'warnings'
   */
  async TenantShow({tenantId, libraryId, objectId, eventId, marketplaceId, cauth, mintHelper}) {

	const abiNft = fs.readFileSync(path.resolve(__dirname, "../contracts/v3/ElvTradable.abi"));
	const abiTenant = fs.readFileSync(path.resolve(__dirname, "../contracts/v3/BaseTenantSpace.abi"));

	var tenantInfo = {};

	var m = await this.client.ContentObjectMetadata({
	  libraryId,
	  objectId,
	  metadataSubtree: "/public/asset_metadata",
	  resolveLinks: true,
	  resolveIncludeSource: true,
	  resolveIgnoreErrors: true,
	  linkDepthLimit: 5
	});

	tenantInfo.marketplaces = {};
	var warns = [];

	for (var key in m.marketplaces) {
	  tenantInfo.marketplaces[key] = {};
	  tenantInfo.marketplaces[key].items = {};
	  for (var i in m.marketplaces[key].info.items) {

		const item = m.marketplaces[key].info.items[i];

		const sku = item.sku;

		if (item.nft_template == "") {
		  warns.push("No NFT Template sku: " + sku);
		  continue;
		}

		tenantInfo.marketplaces[key].items[sku] = {};
		tenantInfo.marketplaces[key].items[sku].name = item.name;
		tenantInfo.marketplaces[key].items[sku].description = item.description;
		tenantInfo.marketplaces[key].items[sku].mint_cauth = item.nft_template.mint.cauth_id;
		tenantInfo.marketplaces[key].items[sku].nft_addr = item.nft_template.nft.address;
		tenantInfo.marketplaces[key].items[sku].templateTotalSupply = item.nft_template.nft.total_supply;
		tenantInfo.marketplaces[key].items[sku].nft_template = item.nft_template["."].source;

		if (cauth && cauth != item.nft_template.mint.cauth_id) {
		  warns.push("Wrong cauth_id sku: " + sku);
		}

		if (item.nft_template.nft.address === "") {
		  warns.push("No NFT address sku: " + sku);
		} else {
		  // Check NFT contract parameters
		  const nftInfo = await this.NftShow({addr: item.nft_template.nft.address, mintHelper});
		  tenantInfo.marketplaces[key].items[sku].nftCap = nftInfo.cap;
		  tenantInfo.marketplaces[key].items[sku].nftMinted = nftInfo.minted;
		  tenantInfo.marketplaces[key].items[sku].nftTotalSupply = nftInfo.totalSupply;
		  tenantInfo.marketplaces[key].items[sku].nftName = nftInfo.name;
		  tenantInfo.marketplaces[key].items[sku].proxy = nftInfo.owner;
		  tenantInfo.marketplaces[key].items[sku].proxy = nftInfo.proxy;
		  tenantInfo.marketplaces[key].items[sku].firstTokenUri = nftInfo.firstTokenUri;
		  tenantInfo.marketplaces[key].items[sku].defHoldSecs = nftInfo.defHoldSecs;

		  if (nftInfo.cap != item.nft_template.nft.total_supply) {
			warns.push("NFT cap mismatch sku: " + sku);
		  }
		  if (nftInfo.proxyInfo != null && (nftInfo.owner != nftInfo.proxyInfo.owner)) {
			warns.push("NFT owner not proxy owner: " + sku);
		  }
		  if (nftInfo.warns.length > 0) {
			warns.push(...nftInfo.warns);
		  }
		}
	  }
	}

	tenantInfo.sites = {};
	tenantInfo.warns = warns;

	return tenantInfo;

  }

  /**
   * Get a list of the NFTs of this tenant owned by 'ownerAddr'
   *
   * @namedParams
   * @param {string} objectId - The ID of the tenant specific EluvioLive object
   * @param {string} ownerAddr - A user address to check the balance of
   * @return {Promise<Object>} - Number of tokens owned
   */
  async FabricTenantBalanceOf({objectId, ownerAddr}) {
		var nftInfo = {};

		const libraryId = await this.client.ContentObjectLibraryId({
			objectId
		});

		var m = await this.client.ContentObjectMetadata({
			libraryId,
			objectId,
			metadataSubtree: "/public/asset_metadata",
			resolveLinks: true,
			resolveIncludeSource: true,
			resolveIgnoreErrors: true,
			linkDepthLimit: 5
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

			const nftAddr = item.nft_template.nft.address;
			const info = await this.NftBalanceOf({addr:nftAddr, ownerAddr});

			if(info.isZero()){
				continue;
			}
			const nft = await this.NftShow({addr: nftAddr});
			
			nftInfo.marketplaces[key].nfts[nftAddr] = nft
			}
		}

		nftInfo.warns = warns;

		return nftInfo;
	}


	//WIP
  /**
   * Get a list of the NFTs of this tenant owned by 'ownerAddr'
   *
   * @namedParams
   * @param {string} tenantId - The ID of the tenant (iten***)
   * @param {string} ownerAddr - A user address to check the balance of
   * @return {Promise<Object>} - Number of tokens owned
   */
	 async TenantBalanceOf({tenantId, ownerAddr, maxNumber=Number.MAX_SAFE_INTEGER}) {
		if(maxNumber < 1){
			maxNumber = Number.MAX_SAFE_INTEGER
		}
		const abiTenant = fs.readFileSync(path.resolve(__dirname, "../contracts/v3/BaseTenantSpace.abi"));
		const tenantAddr = Utils.HashToAddress(tenantId);
		var arg = 'tenant_nfts';

		var nftInfo = {};
		nftInfo.nfts = {};

		var num = 0;
		for(var i = 0; i < Number.MAX_SAFE_INTEGER && num < maxNumber; i++){
			var ordinal = BigNumber(i).toString(16);
			try {
				var nftAddr = await this.client.CallContractMethod({
					contractAddress: tenantAddr,
					abi: JSON.parse(abiTenant),
					methodName: "groupsMapping",
					methodArgs: [
						arg,
						ordinal
					],
					formatArguments: true
				});

				const info = await this.NftBalanceOf({addr:nftAddr, ownerAddr});

				if(info.isZero()){
					continue;
				}
				const nft = await this.NftShow({addr: nftAddr});
				
				nftInfo.nfts[nftAddr] = nft;
				num++;
			}catch(e){
				//We don't know the length so just stop on error and return
				console.log(e);
				break;
			}
		}

		return nftInfo;
	}


  /**
   * Add an NFT contract to the tenant's 'tenant_nfts' group
   *
   * @namedParams
   * @param {string} tenantId - The ID of the tenant (iten***)
   * @param {string} nftAddr = The address of the NFT contract (hex format)
   */
  async TenantAddNft({tenantId, nftAddr}) {

    const abi = fs.readFileSync(path.resolve(__dirname, "../contracts/v3/BaseTenantSpace.abi"));

		const addr = Utils.HashToAddress(tenantId);

    var res = await this.client.CallContractMethodAndWait({
      contractAddress: addr,
      abi: JSON.parse(abi),
      methodName: "addGroup",
      methodArgs: [
        "tenant_nfts",
				nftAddr
      ],
      formatArguments: true
    });
  }

  /**
   * Show info about this site (event)
   *
   * @namedParams
   * @param {string} libraryId - The 'properties' library ID
   * @param {string} objectId - The ID of the site object
   * @return {Promise<Object>} - An object containing site info, including 'warnings'
   */
  async SiteShow({libraryId, objectId}) {

	var siteInfo = {};

	var m = await this.client.ContentObjectMetadata({
	  libraryId,
	  objectId,
	  metadataSubtree: "/public/asset_metadata",
	  select: "",
	  resolveLinks: true,
	  resolveIncludeSource: true,
	  resolveIgnoreError: true,
	  linkDepthLimit: 5
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
	  siteInfo.drops[uuid].stages["preroll"].start_date = drop.event_state_preroll.start_date;

	  siteInfo.drops[uuid].stages["main"] = {};
	  siteInfo.drops[uuid].stages["main"].start_date = drop.event_state_main.start_date;

	  siteInfo.drops[uuid].stages["vote_end"] = {};
	  siteInfo.drops[uuid].stages["vote_end"].start_date = drop.event_state_post_vote.start_date;

	  siteInfo.drops[uuid].stages["mint_start"] = {};
	  siteInfo.drops[uuid].stages["mint_start"].start_date = drop.event_state_mint_start.start_date;

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
  async SiteSetDrop({libraryId, objectId, uuid, start, end, endVote, startMint, newUuid, update}) {

	const defaultStageDurationMin = 2;

	// If stages are not specified use 2min for each
	const startMsec = Date.parse(start);
	if (!endVote || endVote == "") {
	  endVote = new Date(startMsec + defaultStageDurationMin*60*1000);
	}
	if (!startMint || startMint == "") {
	  startMint = new Date(startMsec + 2*defaultStageDurationMin*60*1000);
	}
	if (!end || end == "") {
	  end = new Date(startMsec + 3*defaultStageDurationMin*60*1000);
	}

	var dropInfo = {};

	var m = await this.client.ContentObjectMetadata({
	  libraryId,
	  objectId,
	  metadataSubtree: "/public/asset_metadata",
	  resolveLinks: false
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
		  drop.uuid = uuid.slice(0, 22) + (startMsec / 1000);
		}
		dropInfo.uuid = drop.uuid;

		// Set new metadata
		m.info.drops[key] = drop;

		const dryRun = false;
		if (!dryRun) {
		  var e = await this.client.EditContentObject({
			libraryId,
			objectId
		  });

		  await this.client.ReplaceMetadata({
			libraryId,
			objectId,
			writeToken: e.write_token,
			metadataSubtree: "/public/asset_metadata",
			metadata: m
		  });

		  var f = await this.client.FinalizeContentObject({
			libraryId,
			objectId,
			writeToken: e.write_token,
			commitMessage: "Set drop start " + uuid + " " + start
		  });

		  dropInfo.hash = f.hash;
		  console.log("Finalized: ", f);

		  if (update != null && update != "") {
			await this.client.UpdateContentObjectGraph({
			  libraryId,
			  objectId: update
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
   * @param {string} mintHelperAddr - Address of the mint helper (hex format)
   * @param {string} collectionName - Short name for the ERC-721 contract
   * @param {string} collectionSymbol - Short string for the ERC-721 contract
   * @param {string} contractUri - URI for the ERC-721 contract
   * @param {string} proxyAddress - Proxy address for the ERC721 contract
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
	totalSupply, /* PENDING: should be 'cap' */
	hold
  }) {

	const abistr = fs.readFileSync(path.resolve(__dirname, "../contracts/v3/ElvTradableLocal.abi"));
	const bytecode = fs.readFileSync(path.resolve(__dirname, "../contracts/v3/ElvTradableLocal.bin"));

	if (proxyAddress == null || proxyAddress == "") {
	  proxyAddress = await this.CreateNftTransferProxy({});
	}
	console.log("TransferProxy addr:", proxyAddress);

	if (hold == null || hold == 0) {
	  hold = 604800;
	}

	var c = await this.client.DeployContract({
	  abi: JSON.parse(abistr),
	  bytecode: bytecode.toString('utf8').replace('\n', ''),
	  constructorArgs: [
		collectionName,
		collectionSymbol,
		contractUri || "",
		proxyAddress,
		0,
		totalSupply, /* this is the 'cap' */
		hold
	  ]
	});

	console.log("NFT contract address:", c.contractAddress);

	await this.NftAddMinter({addr: c.contractAddress, minterAddr:mintHelperAddr});
	console.log("- mint helper added", mintHelperAddr);

	await this.NftAddMinter({addr: c.contractAddress, minterAddr: minterAddr});
	console.log("- minter added", minterAddr);

	await this.TenantAddNft({tenantId, nftAddr: c.contractAddress});
	console.log("- tenant_nfts added", tenantId);

	return c.contractAddress;
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
  async NftSetTransferProxy({addr, proxyAddr}) {

	if (proxyAddr == null || proxyAddr.length() == 0) {
	  proxyAddr = await this.CreateNftTransferProxy({});
	}

    const abi = fs.readFileSync(path.resolve(__dirname, "../contracts/v3/ElvTradableLocal.abi"));
    var res = await this.client.CallContractMethod({
      contractAddress: addr,
      abi: JSON.parse(abi),
      methodName: "setProxyRegistryAddress",
      methodArgs: [
		proxyAddr
      ],
      formatArguments: true
    });

	return proxyAddr;
  }

  /**
   * Create a new NFT TransferProxy contract
   *
   * @namedParams
   * @return {Promise<Object>} - New contract address
   */
  async CreateNftTransferProxy({}) {

	const abistr = fs.readFileSync(path.resolve(__dirname, "../contracts/v3/TransferProxyRegistry.abi"));
	const bytecode = fs.readFileSync(path.resolve(__dirname, "../contracts/v3/TransferProxyRegistry.bin"));

	var c = await this.client.DeployContract({
	  abi: JSON.parse(abistr),
	  bytecode: bytecode.toString('utf8').replace('\n', ''),
	  constructorArgs: [
	  ]
	});

	return c.contractAddress;
  }

  /**
   * Show NFT Transfer Proxy info
   *
   * @namedParams
   * @param {string} addr - The NFT Transfer Proxy contract address
   * @return {Promise<Object>} - New contract address
   */
  async ShowNftTransferProxy({addr}) {

	const abistr = fs.readFileSync(path.resolve(__dirname, "../contracts/v3/TransferProxyRegistry.abi"));

	var info = {};

    info.owner = await this.client.CallContractMethod({
      contractAddress: addr,
      abi: JSON.parse(abistr),
      methodName: "owner",
      formatArguments: true
    });

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
  async NftBalanceOf({addr, ownerAddr}) {

	var balance = [];
    const abi = fs.readFileSync(path.resolve(__dirname, "../contracts/v3/ElvTradableLocal.abi"));
    var res = await this.client.CallContractMethod({
      contractAddress: addr,
      abi: JSON.parse(abi),
      methodName: "balanceOf",
      methodArgs: [
		ownerAddr
      ],
      formatArguments: true
    });

	// List all tokens
	for (var i = 0; i < res; i ++) {
	  var tokenId = await this.client.CallContractMethod({
		contractAddress: addr,
		abi: JSON.parse(abi),
		methodName: "tokenOfOwnerByIndex",
		methodArgs: [
		  ownerAddr,
		  i
		],
		formatArguments: true
      });
	balance[i] = {tokenId: tokenId.toString(), hold: holdSecs.toString(), holdEnd: holdEnd};
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
  async NftShowToken({addr, tokenId}) {

	const abi = fs.readFileSync(path.resolve(__dirname, "../contracts/v3/ElvTradableLocal.abi"));

	var tokenInfo = {};
	tokenInfo.warns = [];
	tokenInfo.tokenId = tokenId.toString();

	tokenInfo.owner = await this.client.CallContractMethod({
	  contractAddress: addr,
	  abi: JSON.parse(abi),
	  methodName: "ownerOf",
	  methodArgs: [tokenId],
	  formatArguments: true
	});

	try {
	  const ordinal = await this.client.CallContractMethod({
		contractAddress: addr,
		abi: JSON.parse(abi),
		methodName: "ordinalOfToken",
		methodArgs: [tokenId],
		formatArguments: true
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
	  formatArguments: true
	});

	try {
	  const holdSecs = await this.client.CallContractMethod({
		contractAddress: addr,
		abi: JSON.parse(abi),
		methodName: "_allTokensHolds",
		methodArgs: [tokenId],
		formatArguments: true
	  });
	  tokenInfo.holdSecs = holdSecs.toString();
	  tokenInfo.holdEnd = new Date(tokenInfo.holdSecs * 1000);

	} catch(e) {
	  tokenInfo.warns.push("Failed to get token hold: " + addr);
	}

	return tokenInfo;
  }

  /**
   * Show info about this NFT
   *
   * @namedParams
   * @param {string} addr - The NFT contract address
   * @param {string} mintHelper - Warn if this is not a minter for the NFT contract
   * @return {Promise<Object>} - An object containing NFT info, including 'warnings'
   */
  async NftShow({addr, mintHelper, showOwners}) {

	const abi = fs.readFileSync(path.resolve(__dirname, "../contracts/v3/ElvTradableLocal.abi"));
	var nftInfo = {};
	var warns = [];

    nftInfo.name = await this.client.CallContractMethod({
      contractAddress: addr,
      abi: JSON.parse(abi),
      methodName: "name",
      formatArguments: true
    });
    nftInfo.owner = await this.client.CallContractMethod({
      contractAddress: addr,
      abi: JSON.parse(abi),
      methodName: "owner",
      formatArguments: true
    });
    nftInfo.symbol = await this.client.CallContractMethod({
      contractAddress: addr,
      abi: JSON.parse(abi),
      methodName: "symbol",
      formatArguments: true
    });
    const totalSupply = await this.client.CallContractMethod({
      contractAddress: addr,
      abi: JSON.parse(abi),
      methodName: "totalSupply",
      formatArguments: true
    });
	nftInfo.totalSupply = Number(totalSupply);

    try {
      const minted = await this.client.CallContractMethod({
		contractAddress: addr,
		abi: JSON.parse(abi),
		methodName: "minted",
		formatArguments: true
      });
      nftInfo.minted = Number(minted);
    } catch(e) {
	  nftInfo.minted = -1; // Older contract
    }
    const cap = await this.client.CallContractMethod({
	  contractAddress: addr,
	  abi: JSON.parse(abi),
	  methodName: "cap",
	  formatArguments: true
    });
	nftInfo.cap = Number(cap);

	const proxy = await this.client.CallContractMethod({
	  contractAddress: addr,
	  abi: JSON.parse(abi),
	  methodName: "proxyRegistryAddress",
	  formatArguments: true
    });
	nftInfo.proxy = proxy;

	if (proxy == "0x0000000000000000000000000000000000000000") {
	  warns.push("No proxy: " + addr);
	} else {
	  nftInfo.proxyInfo = await this.ShowNftTransferProxy({addr: proxy});
	}

	if (mintHelper) {
	  const isMinter = await this.client.CallContractMethod({
		contractAddress: addr,
		abi: JSON.parse(abi),
		methodName: "isMinter",
		methodArgs: [mintHelper],
		formatArguments: true
	  });
	  if (!isMinter) {
		warns.push("Minter not set up addr: " + addr);
	  }
	}

	try {
	  const defHoldSecs = await this.client.CallContractMethod({
		contractAddress: addr,
		abi: JSON.parse(abi),
		methodName: "defHoldSecs",
		formatArguments: true
	  });
	  nftInfo.defHoldSecs = defHoldSecs.toString();
	} catch(e) {
	  nftInfo.defHoldSecs = "not supported";
	  warns.push("Bad local tradable hold: " + addr);
	}

	nftInfo.tokens = [];

	var maxWarnsTokenUri = 1;

	if (showOwners && showOwners > 0) {
	  var maxShowOwners = showOwners;

	  for (var i = 0; i < maxShowOwners && i < nftInfo.totalSupply; i ++) {

		nftInfo.tokens[i] = {};

		var tokenId;
		try {
		  tokenId = await this.client.CallContractMethod({
			contractAddress: addr,
			abi: JSON.parse(abi),
			methodName: "tokenByIndex",
			methodArgs: [i],
			formatArguments: true
		  });
		  nftInfo.tokens[i].tokenId = tokenId.toString();
		} catch(e) {
		  warns.push("Failed to get token ID (index: " + i + "): " + addr);
		  continue;
		}

		var tokenInfo = await this.NftShowToken({addr, tokenId});

		if (tokenInfo.warns.length > 0) {
		  warns.push(...tokenInfo.warns);
		}

		nftInfo.tokens[i] = tokenInfo;

		if (i == 0) {
		  nftInfo.firstTokenUri = nftInfo.tokens[i].tokenURI;
		}
		if ((maxWarnsTokenUri --) > 0 &&
			(!nftInfo.tokens[i].tokenURI.startsWith(Config.consts[Config.net].tokenUriStart) ||
			 !nftInfo.tokens[i].tokenURI.endsWith(Config.consts[Config.net].tokenUriEnd))) {
		  warns.push("Bad tokenURI: " + addr);
		}

	  }
	}

	nftInfo.warns = warns;
	return nftInfo;
  }

  /**
   * Add a minter to this NFT
   *
   * @namedParams
   * @param {string} addr - The NFT contract address
   * @param {string} mintAddr - The address of the minter (key or helper contract)
   */
  async NftAddMinter({addr, minterAddr}) {

	console.log("Add minter", addr, minterAddr);
    const abi = fs.readFileSync(path.resolve(__dirname, "../contracts/v3/ElvTradable.abi"));

    var res = await this.client.CallContractMethodAndWait({
      contractAddress: addr,
      abi: JSON.parse(abi),
      methodName: "addMinter",
      methodArgs: [
        minterAddr
      ],
      formatArguments: true
    });
  }

  /**
   * Create a new NFT contract and set it in the NFT Template object's metadata.
   *
   * @namedParams
   * @param {string} libraryIgd - The 'properties' library ID
   * @param {string} objectId - The ID of the NFT Template
   * @param {string} nftAddr - The NFT contract address (optional; by default create one)
   * @param {string} mintHelperAddr - The address of the mint helper contract (for batch mint)
   * @param {string} minterAddr - The address of the minter
   * @param {string} collectionName - Short name for the ERC-721 contract
   * @param {string} collectionSymbol - Short string for the ERC-721 contract
   * @param {string} hold - Hold period in seconds
   * @param {string} contractUri - URI for the ERC-721 contract
   * @param {string} proxyAddress - Proxy address for the ERC721 contract
   * @param {string} totalSupply - the mint cap for this template (should be called 'cap')
   * @return {Promise<Object>} - An object containing info about the new NFT
   */
  async NftTemplateAddNftContract({
	libraryId,
	objectId,
	nftAddr,
	tenantId,
	mintHelperAddr,
	minterAddr,
	collectionName,
	collectionSymbol,
	hold,
	contractUri,
	proxyAddress,
  	totalSupply
  }) {

	console.log("Create NFT contract");

	if (nftAddr == null) {
	  nftAddr = await this.CreateNftContract({
		tenantId,
		mintHelperAddr,
		minterAddr,
		totalSupply,
		collectionName,
		collectionSymbol,
		hold,
		contractUri,
		proxyAddress
	  });
	};

	// Update object metadata
	console.log("Update object metadata");
	var m = await this.client.ContentObjectMetadata({
	  libraryId,
	  objectId,
	  resolveLinks: false
	});

	m.permissioned.mint_private.address = nftAddr;
	m.public.asset_metadata.nft.address = nftAddr;
	m.public.asset_metadata.nft.total_supply = totalSupply;

	var e = await this.client.EditContentObject({
	  libraryId,
	  objectId
	});

	await this.client.ReplaceMetadata({
	  libraryId,
	  objectId,
	  writeToken: e.write_token,
	  metadata: m
	});

	var f = await this.client.FinalizeContentObject({
	  libraryId,
	  objectId,
	  writeToken: e.write_token,
	  commitMessage: "Set NFT contract address " + nftAddr
	});

	console.log("Finalized", f);

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
  async NftMake({
	assetMetadata,
	hash
  }) {

	const m = assetMetadata;
	var pnft = {};

	/* Add this to description */
	const addtlInfo = `

Lookup NFT: https://wallet.contentfabric.io/lookup/`;

	pnft.name = m.nft.name;
	pnft.display_name = m.nft.display_name;
	pnft.description = m.nft.description; // + addtlInfo;
	pnft.edition_name = m.nft.edition_name;
	pnft.rich_text = m.nft.rich_text;

	pnft.address = m.nft.address;
	pnft.total_supply = m.nft.total_supply;
	pnft.template_id = m.nft.template_id;

	pnft.copyright = m.nft.copyright;
	pnft.created_at = m.nft.created_at;
	pnft.creator = m.nft.creator;

	pnft.embed_url = m.nft.embed_url;
	pnft.external_url = m.nft.external_url;
	pnft.youtube_url = m.nft.marketplace_attributes.opensea.youtube_url;
	pnft.image = m.nft.image;
	pnft.playable = m.nft.playable;

	// pnft.addtl_info = addtlInfo;

	pnft.attributes = [
      {
		trait_type: "Creator",
		value: "Eluvio NFT Central"
      },
      {
		trait_type: "Total Minted Supply",
		value: m.nft.total_supply.toString()
      },
      {
		trait_type: "Content Fabric Hash",
		value: hash
      }
	];

	return pnft;
  }

  /**
   * Set the public/nft section based on asset metadata
   *
   * @namedParams
   * @param {string} hash - The NFT Template hash or id
   * @return {Promise<Object>} - The public/nft JSON
   */
  async NftBuild({
	libraryId,
	objectId
  }) {

	var hash = await this.client.LatestVersionHash({
	  objectId
	});

	var m = await this.client.ContentObjectMetadata({
	  libraryId,
	  objectId,
	  metadataSubtree: "public/asset_metadata",
	  resolveLinks: false
	});

	var pnft = await this.NftMake({assetMetadata: m, hash});
	console.log(pnft);

	var e = await this.client.EditContentObject({
	  libraryId,
	  objectId
	});

	await this.client.ReplaceMetadata({
	  libraryId,
	  objectId,
	  writeToken: e.write_token,
	  metadataSubtree: "public/nft",
	  metadata: pnft
	});

	var f = await this.client.FinalizeContentObject({
	  libraryId,
	  objectId,
	  writeToken: e.write_token,
	  commitMessage: "Set NFT public/nft"
	});

	const nftPath = "/meta/public/nft";
	const tokenUri = Config.networks[Config.net] + "/s/" + Config.net + "/q/" + f.hash + nftPath;

	console.log("Token URI: ", tokenUri);

	// Set the token URI - edit the object one more time
	var e = await this.client.EditContentObject({
	  libraryId,
	  objectId
	});

	await this.client.ReplaceMetadata({
	  libraryId,
	  objectId,
	  writeToken: e.write_token,
	  metadataSubtree: "public/asset_metadata/nft/token_uri",
	  metadata: tokenUri
	});

	var f2 = await this.client.FinalizeContentObject({
	  libraryId,
	  objectId,
	  writeToken: e.write_token,
	  commitMessage: "Set NFT token URI"
	});

	return f2;
  }

  /**
   * Set the public/nft section based on asset metadata
   *
   * @namedParams
   * @param {string} addr - Local NFT contract address
   * @param {integer} tokenId - External NFT token ID
   * @return {Promise<Object>} - NFT info JSON
   */
  async NftLookup({
	addr,
	tokenId
  }) {

	console.log("tokenId", tokenId);

	var x = new BigNumber(tokenId, 10);
	console.log(x.toString(16));

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
  async NftProxyTransferFrom({addr, tokenId, fromAddr, toAddr}) {

	console.log("NFT Transfer", "from: ", fromAddr);
    const abi = fs.readFileSync(path.resolve(__dirname, "../contracts/v3/ElvTradableLocal.abi"));
	const pxabi = fs.readFileSync(path.resolve(__dirname, "../contracts/v3/TransferProxyRegistry.abi"));

    var ownerOf = await this.client.CallContractMethod({
      contractAddress: addr,
      abi: JSON.parse(abi),
      methodName: "ownerOf",
      methodArgs: [tokenId],
      formatArguments: true
    });

	if (ownerOf.toLowerCase() != fromAddr.toLowerCase()) {
	  console.log("Not owner", "(owner: " + ownerOf + ")");
	  return;
	}

	const proxy = await this.client.CallContractMethod({
	  contractAddress: addr,
	  abi: JSON.parse(abi),
	  methodName: "proxyRegistryAddress",
	  formatArguments: true
    });

	if (proxy == "0x0000000000000000000000000000000000000000") {
	  console.log("NFT has no proxy");
	  return;
	}
	console.log("Proxy: ", proxy);

	var proxyInfo = await this.ShowNftTransferProxy({addr: proxy});
	if (proxyInfo.owner != this.client.signer.address) {
	  console.log("Bad key - not proxy owner (should be: " + proxyInfo.owner + ")");
	  return;
	}

	console.log("Executing proxyTransferFrom");
	var res = await this.client.CallContractMethod({
      contractAddress: proxy,
      abi: JSON.parse(pxabi),
      methodName: "proxyTransferFrom",
      methodArgs: [
		addr,
		fromAddr,
		toAddr,
		tokenId
      ],
      formatArguments: true
    });

	res.wait(1);
	return res;
  }


}


exports.EluvioLive = EluvioLive;
