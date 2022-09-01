const { ElvUtils } = require("../src/Utils");

test("read csv object list", async () => {
  const expected = {"iq__3KU9rJxMptMk5jhvuJFQyqRB72Vv":{"public":{"name":"Test BBB Batcher 003 1","asset_metadata":{"title":"Title of Test Batcher 003 1","info":{"template_id":"LsSJ7qg73sEFAVx9ZtDfBB","edition":"Edition A20"}},"nft":{"edition":"Edition A10"},"tnt":["0x111"]}},"iq__4BZXWUK4VtrFEaem4PfoartyhjZK":{"public":{"name":"Test BBB Batcher 003 2","asset_metadata":{"title":"Title of Test Batcher 003 2","info":{"template_id":"DFj1F9fEeE952SVGcM1wpb","edition":"Edition B20"}},"nft":{"edition":"Edition B10"},"tnt":["0x222"]}}};
  let res = await ElvUtils.ReadCsvObjects({csvFile: "./test/testdata/testobjlist.csv"});
  expect(res).toEqual(expected);
});

test("make csv from fields", async () => {

  const meta = {
    public: {
      name: "Name 1",
      asset_metadata: {
        title: "Title 1",
        info: {
          addr: "0x1111"
        }
      },
      nft: {
        addr: "0x1111"
      },
      tnt: {
        nft_owners: [
          "0xaabb",
          "0xaacc"
        ]
      }
    }
  };
  const fields = [
    "public.name",
    "public.asset_metadata.title",
    "public.nft",
    "public.tnt.nft_owners[0]",
    "public.tnt.nft_owners[1]"
  ];

  let res = await ElvUtils.MakeCsv({fields, meta});
  expect(res).toEqual("Name 1,Title 1,{\"addr\":\"0x1111\"},0xaabb,0xaacc");
});
