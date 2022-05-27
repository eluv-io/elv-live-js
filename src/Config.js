const net = "demov3"; // Set to "main" or "demov3"

const networks = {
  main: "https://main.net955305.contentfabric.io",
  demo: "https://demov3.net955210.contentfabric.io",
  demov3: "https://demov3.net955210.contentfabric.io",
  test: "https://test.net955203.contentfabric.io",
};

const mainObjects = {
  main: "iq__suqRJUt2vmXsyiWS5ZaSGwtFU9R",
  demov3: "iq__2gkNh8CCZqFFnoRpEUmz7P3PaBQG",
};

const consts = {
  main: {
    tokenUriStart: "https://main.net955305.contentfabric.io/s/main/q/",
    tokenUriEnd: "/meta/public/nft",
    kmsAddress: "0xd962aff088ca845de83ce0db0c91b9a0b93d294f",
    spaceAddress: "0x6612d94a31fab146b4c7ace60ddf3a1e5e40e500",
  },
  demov3: {
    tokenUriStart: "https://demov3.net955210.contentfabric.io/s/demov3/q/",
    tokenUriEnd: "/meta/public/nft",
    kmsAddress: "0x501382e5f15501427d1fc3d93e949c96b25a2224",
    spaceAddress: "0x9b29360efb1169c801bbcbe8e50d0664dcbc78d3",
  },
};

exports.Config = { net, networks, mainObjects, consts };
