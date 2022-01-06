const { ElvClient } = require("elv-client-js")
const { EluvioLive } = require("../src/EluvioLive.js")
const { Config } = require("../src/Config.js")

const yargs = require('yargs/yargs')
const { hideBin } = require('yargs/helpers')
const yaml = require('js-yaml');

var elvlv;

const Init = async () => {

  console.log("Network: " + Config.net);

  elvlv = new EluvioLive({
	configUrl: Config.networks[Config.net],
	mainObjectId: Config.mainObjects[Config.net]
  });
  await elvlv.Init();

}

const CmfNftTemplateAddNftContract = async ({argv}) => {

  console.log("NFT Template - set contract",
			  argv.library, argv.object, argv.tenant, argv.minthelper, argv.minter, argv.cap, argv.name, argv.symbol,
			  argv.nftAddress)
  await Init();

  var c = await elvlv.NftTemplateAddNftContract({
	libraryId: argv.library,
	objectId: argv.object,
	//nftAddr,
	tenantId: argv.tenant,
	mintHelperAddr: argv.minthelper, //"0x59e79eFE007F5208857a646Db5cBddA82261Ca81",
	minterAddr: argv.minter,
	totalSupply: argv.cap,
	collectionName: argv.name,
	collectionSymbol: argv.symbol,
	hold: argv.hold,
	contractUri: "",
	proxyAddress: ""
  })

}

const CmfNftAddMintHelper = async ({argv}) => {

  console.log("NFT - add mint helper",
			  argv.addr, argv.minter)
  await Init();

  var c = await elvlv.NftAddMinter({
	addr: argv.addr,
	minterAddr: argv.minter
  })

}

const CmdNftBalanceOf = async ({argv}) => {

  console.log("NFT - call", argv.addr, argv.owner);

  await Init();

  var res = await elvlv.NftBalanceOf({
	addr: argv.addr,
	ownerAddr: argv.owner
  })

  console.log(yaml.dump(res));
}

const CmdNftShow = async ({argv}) => {

  console.log("NFT - show", argv.addr, argv.show_owners);

  await Init();

  var res = await elvlv.NftShow({
	addr: argv.addr,
	mintHelper: argv.check_minter,
	showOwners: argv.show_owners
  })

  console.log(yaml.dump(res));
}

const CmdNftBuild = async ({argv}) => {

  console.log("NFT - build public/nft", argv.object);

  await Init();

  var res = await elvlv.NftBuild({
	libraryId: argv.library,
	objectId: argv.object
  })

  console.log(yaml.dump(res));
}

const CmdNftLookup = async ({argv}) => {

  console.log("NFT - lookup", argv.addr, argv.token_id);

  await Init();

  var res = await elvlv.NftLookup({
	addr: argv.addr,
	tokenId: argv.token_id
  })

  console.log(yaml.dump(res));
}

const CmdNftProxyTransfer = async ({argv}) => {

  console.log("NFT - transer as proxy owner", argv.addr, argv.from_addr, argv.to_addr);

  await Init();

  var res = await elvlv.NftProxyTransferFrom({
	addr: argv.addr,
	tokenId: argv.token_id,
	fromAddr: argv.from_addr,
	toAddr: argv.to_addr
  })

  console.log(yaml.dump(res));
}

const CmdTenantShow = async ({argv}) => {

  console.log("Tenant - show", argv.tenant);

  await Init();

  var res = await elvlv.TenantShow({
	tenantId: argv.tenant,
	libraryId: argv.library,
	objectId: argv.object,
	marketplaceId: argv.marketplace,
	eventId: argv.event,
	cauth: argv.check_cauth,
	mintHelper: argv.check_minter
  })

  console.log(yaml.dump(res));
}

const CmdSiteShow = async ({argv}) => {

  console.log("Site - show", argv.object);

  await Init();

  var res = await elvlv.SiteShow({
	libraryId: argv.library,
	objectId: argv.object,
  })

  console.log(yaml.dump(res));
}

const CmdSiteSetDrop = async ({argv}) => {

  console.log("Site - set drop", argv.object, argv.uuid, "update", argv.update);

  await Init();

  var res = await elvlv.SiteSetDrop({
	libraryId: argv.library,
	objectId: argv.object,
	uuid: argv.uuid,
	start: argv.start_date,
	end: argv.end_date,
	endVote: argv.end_vote,
	startMint: argv.start_mint,
	newUuid: argv.new_uuid,
	update: argv.update
  })

  console.log(yaml.dump(res));
}

const CmdTenantBalanceOf = async ({argv}) => {

  console.log("Tenant - balanceOf", argv.tenant, argv.ownerAddr);

  await Init();

  var res = await elvlv.TenantShow({
	tenantId: argv.tenant,
	libraryId: argv.library,
	objectId: argv.object,
	ownerAddr: argv.owner
  })

  console.log(yaml.dump(res));
}

yargs(hideBin(process.argv))

  .command('nft_add_contract <library> <object> <tenant> [minthelper] [cap] [name] [symbol] [nftaddr] [hold]',
		   'Add a new or existing NFT contract to an NFT Template object', (yargs) => {
			 yargs
			   .positional('library', {
				 describe: 'NFT Template library ID',
				 type: 'string'
			   })
			   .positional('object', {
				 describe: 'NFT Template object ID',
				 type: 'string'
			   })
			   .positional('tenant', {
				 describe: "Tenant ID",
				 type: 'string'
			   })
			   .option('minthelper', {
				 describe: "Mint helper address (hex)",
				 type: 'string'
			   })
			   .option('minter', {
				 describe: "Minter address (hex)",
				 type: 'string'
			   })
			   .option('cap', {
				 describe: "NFT total supply cap",
				 type: 'number'
			   })
			   .option('name', {
				 describe: "NFT collection name",
				 type: 'string'
			   })
			   .option('symbol', {
				 describe: "NFT collection symbol",
				 type: 'string'
			   })
			   .option('nftaddr', {
				 describe: "NFT contract address (will not create a new one)",
				 type: 'string'
			   })
			   .option('hold', {
				 describe: "Hold period in seconds (default 7 days)",
				 type: 'number'
			   })
		   }, (argv) => {

			 CmfNftTemplateAddNftContract({argv});

		   })

  .command('nft_add_minter <addr> <minter>',
		   'Add a new or existing NFT contract to an NFT Template object', (yargs) => {
			 yargs
			   .positional('addr', {
				 describe: 'NFT address (hex)',
				 type: 'string'
			   })
			   .option('minter', {
				 describe: "Minter or mint helper address (hex)",
				 type: 'string'
			   })
		   }, (argv) => {

			 CmfNftAddMintHelper({argv});

		   })


  .command('nft_balance_of <addr> <owner>',
		   'Call NFT ownerOf - determine if this is an owner', (yargs) => {
			 yargs
			   .positional('addr', {
				 describe: 'NFT address (hex)',
				 type: 'string'
			   })
			   .positional('owner', {
				 describe: 'Owner address to check (hex)',
				 type: 'string'
			   })
		   }, (argv) => {

			 CmdNftBalanceOf({argv});

		   })

  .command('nft_show <addr>',
		   'Show info on this NFT', (yargs) => {
			 yargs
			   .positional('addr', {
				 describe: 'NFT address (hex)',
                 type: 'string'
               })
               .option('check_minter', {
                 describe: 'Check that all NFTs use this mint helper',
			   })
               .option('show_owners', {
				 describe: 'Show up to these many owners (default 0)',
				 type: 'integer'
			   })
		   }, (argv) => {

			 CmdNftShow({argv});

		   })

  .command('nft_proxy_transfer <addr> <token_id> <from_addr> <to_addr>',
		   'Tranfer NFT as a proxy owner', (yargs) => {
			 yargs
			   .positional('addr', {
				 describe: 'NFT address (hex)',
                 type: 'string'
               })
			   .positional('token_id', {
				 describe: 'NFT address (hex)',
                 type: 'integer'
               })
			   .positional('from_addr', {
				 describe: 'Address to transfer from (hex)',
                 type: 'string'
               })
			   .positional('to_addr', {
				 describe: 'Address to transfer to (hex)',
                 type: 'string'
               })
		   }, (argv) => {

			 CmdNftProxyTransfer({argv});

		   })

  .command('nft_build <library> <object>',
		   'Build the public/nft section based on asset metadata', (yargs) => {
			 yargs
			   .positional('library', {
				 describe: 'Content library',
				 type: 'string'
			   })
			   .positional('object', {
				 describe: 'Content object hash (hq__) or id (iq__)',
				 type: 'string'
			   })
		   }, (argv) => {

			 CmdNftBuild({argv});

		   })

  .command('nft_lookup <addr> <token_id>',
		   'Decode and look up a local NFT by external token ID', (yargs) => {
			 yargs
			   .positional('addr', {
				 describe: 'Local NFT contract address',
				 type: 'string'
			   })
			   .positional('token_id', {
				 describe: 'External token ID',
				 type: 'string' // BigNumber as string
			   })
		   }, (argv) => {

			 CmdNftLookup({argv});

		   })

  .command('tenant_show <tenant> <library> <object> [event] [marketplace]',
		   'Show info on this tenant', (yargs) => {
			 yargs
			   .positional('tenant', {
				 describe: 'Tenant ID',
				 type: 'string'
			   })
			   .positional('library', {
				 describe: 'Tenant-level EluvioLive library',
				 type: 'string'
			   })
			   .positional('object', {
				 describe: 'Tenant-level EluvioLive object ID',
				 type: 'string'
			   })
			   .option('event', {
				 describe: 'Event ID',
				 type: 'string'
			   })
			   .option('marketplace', {
				 describe: 'Marketplace ID',
				 type: 'string'
			   })
			   .option('check_cauth', {
				 describe: 'Check that all NFTs use this cauth ID',
				 type: 'string'
			   })
			   .option('check_minter', {
				 describe: 'Check that all NFTs use this mint helper',
				 type: 'string'
			   })

		   }, (argv) => {

			 CmdTenantShow({argv});

		   })

  .command('tenant_balance_of <tenant> <library> <object> <owner>',
		   'Show NFTs owned by this owner in this tenant', (yargs) => {
			 yargs
			   .positional('tenant', {
				 describe: 'Tenant ID',
				 type: 'string'
			   })
			   .positional('library', {
				 describe: 'Tenant-level EluvioLive library',
				 type: 'string'
			   })
			   .positional('object', {
				 describe: 'Tenant-level EluvioLive object ID',
				 type: 'string'
			   })
			   .option('owner', {
				 describe: 'Owner address (hex)',
				 type: 'string'
			   })
		   }, (argv) => {

			 CmdTenantBalanceOf({argv});

		   })


  .command('site_show <library> <object>',
		   'Show info on this site/event', (yargs) => {
			 yargs
			   .positional('library', {
				 describe: 'Site library',
				 type: 'string'
			   })
			   .positional('object', {
				 describe: 'Site object ID',
				 type: 'string'
			   })
		   }, (argv) => {

			 CmdSiteShow({argv});

		   })

  .command('site_set_drop <library> <object> <uuid> <start_date> [options]',
		   'Set drop dates for a site/event', (yargs) => {
			 yargs
			   .positional('library', {
				 describe: 'Site library',
				 type: 'string'
			   })
			   .positional('object', {
				 describe: 'Site object ID',
				 type: 'string'
			   })
			   .positional('uuid', {
				 describe: 'Drop UUID',
				 type: 'string'
			   })
			   .positional('start_date', {
				 describe: 'Event start date (ISO format)',
				 type: 'string'
			   })
			   .option('end_date', {
				 describe: 'Event end date (ISO format)',
				 type: 'string'
			   })
			   .option('end_vote', {
				 describe: 'Event vote end date (ISO foramt)',
				 type: 'string'
			   })
			   .option('start_mint', {
				 describe: 'Event start mint date (ISO format)',
				 type: 'string'
			   })
			   .option('new_uuid', {
				 describe: 'Assign a new UUID',
				 type: 'boolean'
			   })
			   .option('update', {
				 describe: 'Tenant-level EluvioLive object to update',
				 type: 'string'
			   })

		   }, (argv) => {

			 CmdSiteSetDrop({argv});

		   })

  .help()
  .usage('EluvioLive CLI\n\nUsage: elv-live <command>')
  .scriptName('')
  .demandCommand(1)
  .argv
