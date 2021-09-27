const { ElvClient } = require("elv-client-js")
const Utils = require("elv-client-js/src/Utils.js")

const Ethers = require("ethers");
const fs = require('fs');
const path = require('path');

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

	const abiNft = fs.readFileSync("/Users/serban/ELV/CODE/contracts/dist/ElvTradable.abi");
	const abiTenant = fs.readFileSync("/Users/serban/ELV/CODE/contracts/dist/BaseTenantSpace.abi");

	var tenantInfo = {};

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

	tenantInfo.marketplaces = {};
	var warns = [];

	for (var key in m.marketplaces) {
	  tenantInfo.marketplaces[key] = {};
	  tenantInfo.marketplaces[key].items = {};
	  for (var i in m.marketplaces[key].info.items) {

		const item = m.marketplaces[key].info.items[i];

		const sku = item.sku;

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
		  tenantInfo.marketplaces[key].items[sku].nftTotalSupply = nftInfo.totalSupply;
		  tenantInfo.marketplaces[key].items[sku].nftName = nftInfo.name;
		  if (nftInfo.cap != item.nft_template.nft.total_supply) {
			warns.push("NFT cap mismatch sku: " + sku);
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
   * Add an NFT contract to the tenant's 'nft_templates' group
   *
   * @namedParams
   * @param {string} tenantId - The ID of the tenant (iten***)
   * @param {string} nftAddr = The address of the NFT contract (hex format)
   */
  async TenantAddNft({tenantId, nftAddr}) {

    const abi = fs.readFileSync("/Users/serban/ELV/CODE/contracts/dist/BaseTenantSpace.abi");

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

	// If stages are not specified use 2min for each
	const startMsec = Date.parse(start);
	if (!endVote || endVote == "") {
	  endVote = new Date(startMsec + 2*60*1000);
	}
	if (!startMint || startMint == "") {
	  startMint = new Date(startMsec + 4*60*1000);
	}
	if (!end || end == "") {
	  end = new Date(startMsec + 6*60*1000);
	}

	var dropInfo = {};

	var m = await this.client.ContentObjectMetadata({
	  libraryId,
	  objectId,
	  metadataSubtree: "/public/asset_metadata",
	  resolveLinks: true,
	  resolveIncludeSource: true,
	  resolveIgnoreError: true,
	  linkDepthLimit: 5
	});

	var found = false;
	for (var key in m.info.drops) {
	  const drop = m.info.drops[key];
	  const dropUuid = drop.uuid;

	  if (dropUuid.slice(0, 22) == uuid) {
		console.log("Found drop uuid: ", uuid);
		found = true;

		drop.start_date = start;
		drop.end_date = end;
		drop.event_state_preroll.start_date = "";
		drop.event_state_main.start_date = start;
		drop.event_state_post_vote.start_date = endVote;
		drop.event_state_mint_start.start_date = startMint;

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

		if (update != "") {
		  await this.client.UpdateContentObjectGraph({
			libraryId,
			objectId: update
		  });
		  console.log("Update ", update);
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
   * @param {string} totalSupply - the mint cap for this template (should be called 'cap')
   * @return {Promise<Object>} - New contract address
   */
  async CreateNftContract({
	tenantId,
	mintHelperAddr,
	collectionName,
	collectionSymbol,
	contractUri,
	proxyAddress,
  	totalSupply /* PENDING: should be 'cap' */
  }) {

	const abistr = fs.readFileSync(path.resolve(__dirname, "../contracts/v3/ElvTradable.abi"));
	const bytecode = fs.readFileSync(path.resolve(__dirname, "../contracts/v3/ElvTradable.bin"));

	var c = await this.client.DeployContract({
	  abi: JSON.parse(abistr),
	  bytecode: bytecode.toString('utf8').replace('\n', ''),
	  constructorArgs: [
		collectionName,
		collectionSymbol,
		contractUri || "",
		proxyAddress || "0x0000000000000000000000000000000000000000",
		0,
		totalSupply
	  ]
	});

	console.log("NFT contract address:", c.contractAddress);

	await this.NftAddMinter({addr: c.contractAddress, mintHelperAddr});
	console.log("- minter added", mintHelperAddr);

	await this.TenantAddNft({tenantId, nftAddr: c.contractAddress});
	console.log("- tenant_nfts added", tenantId);

	return c.contractAddress;
  }

  /**
   *  WIP
   */
  async ContractCallMintHelper(client) {

    const addrHelper = "0xf194bBC68369Fb140330570D822071f2A6949A77";
    const abi = fs.readFileSync("/Users/serban/ELV/CODE/contracts/dist/ElvTokenHelper.abi");

    const nft1 = "0xAB27731bb16C0B2cBCdaDD62Fb17e7b09CD387f3"; // beachball
    const user1 = "0xb6de95156c47bfe7f9414420e6e59b25f871f102"; // serban+elvmw@eluv.io

    const nft2 = "0xfC4C73C2b44dcF9e21cdc40a3e135a0e160a44c4";

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

  /**
   * Get the NFT balance for a given user address
   *
   * @namedParams
   * @param {string} addr - The NFT contract address
   * @param {string} ownerAddr - A user address to check the balance of
   * @return {Promise<Object>} - Number of tokens owned
   */
  async NftBalanceOf({addr, ownerAddr}) {

    const abi = fs.readFileSync("/Users/serban/ELV/CODE/contracts/dist/ElvTradable.abi");

    var res = await this.client.CallContractMethod({
      contractAddress: addr,
      abi: JSON.parse(abi),
      methodName: "balanceOf",
      methodArgs: [
		ownerAddr
      ],
      formatArguments: true
    });

	return res;
  }

  /**
   * Show info about this NFT
   *
   * @namedParams
   * @param {string} addr - The NFT contract address
   * @param {string} mintHelper - Warn if this is not a minter for the NFT contract
   * @return {Promise<Object>} - An object containing NFT info, including 'warnings'
   */
  async NftShow({addr, mintHelper}) {

	const abi = fs.readFileSync("/Users/serban/ELV/CODE/contracts/dist/ElvTradable.abi");
	var nftInfo = {};
    nftInfo.name = await this.client.CallContractMethod({
      contractAddress: addr,
      abi: JSON.parse(abi),
      methodName: "name",
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

    const cap = await this.client.CallContractMethod({
	  contractAddress: addr,
	  abi: JSON.parse(abi),
	  methodName: "cap",
	  formatArguments: true
    });
	nftInfo.cap = Number(cap);

	var warns = [];
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

	nftInfo.tokens = [];

	for (var i = 0; i < nftInfo.totalSupply; i ++) {
	  nftInfo.tokens[i] = {};
      nftInfo.tokens[i].tokenId = await this.client.CallContractMethod({
		contractAddress: addr,
		abi: JSON.parse(abi),
		methodName: "tokenByIndex",
		methodArgs: [i],
		formatArguments: true
      });
      nftInfo.tokens[i].owner = await this.client.CallContractMethod({
		contractAddress: addr,
		abi: JSON.parse(abi),
		methodName: "ownerOf",
		methodArgs: [nftInfo.tokens[i].tokenId],
		formatArguments: true
      });
	}

	nftInfo.warns = warns;
	return nftInfo;
  }

  /**
   * Add a minter to this NFT
   *
   * @namedParams
   * @param {string} addr - The NFT contract address
   * @param {string} mintHelperAddr - The address of the minter
   */
  async NftAddMinter({addr, mintHelperAddr}) {

	console.log("Add minter", addr, mintHelperAddr);
    const abi = fs.readFileSync("/Users/serban/ELV/CODE/contracts/dist/ElvTradable.abi");

    var res = await this.client.CallContractMethodAndWait({
      contractAddress: addr,
      abi: JSON.parse(abi),
      methodName: "addMinter",
      methodArgs: [
        mintHelperAddr
      ],
      formatArguments: true
    });
  }

  /**
   * Create a new NFT contract and set it in the NFT Template object's metadata.
   *
   * @namedParams
   * @param {string} libraryId - The 'properties' library ID
   * @param {string} objectId - The ID of the NFT Template
   * @param {string} nftAddr - The NFT contract address (optional; by default create one)
   * @param {string} mintHelperAddr - The address of the minter
   * @param {string} collectionName - Short name for the ERC-721 contract
   * @param {string} collectionSymbol - Short string for the ERC-721 contract
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
	collectionName,
	collectionSymbol,
	contractUri,
	proxyAddress,
  	totalSupply
  }) {

	console.log("Create NFT contract");

	if (nftAddr == null) {
	  nftAddr = await this.CreateNftContract({
		tenantId,
		mintHelperAddr,
		totalSupply,
		collectionName,
		collectionSymbol,
		contractUri,
		proxyAddress
	  });
	};

	// Update object metadata
	console.log("Update object metadata");
	var m = await this.client.ContentObjectMetadata({
	  libraryId,
	  objectId
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

}

exports.EluvioLive = EluvioLive;
