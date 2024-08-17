const net = "main"; // Set to "main"  "dv3" "tv4" "local"

/*
 * networks:
 * Defines the main config URLs for the respective networks.
 * There are 3 public networks and 1 private dev network:
 * - main: the main Eluvio production fabric
 * - dv3: the demo and bleeding edge network
 * - tv4: the primary test network
 * - local: content-fabric development scripts can create a local dev network
 */
const networks = {
  main: "https://main.net955305.contentfabric.io",
  dv3: "https://demov3.net955210.contentfabric.io", // formerly "demo" and "demov3"
  tv4: "https://test.net955205.contentfabric.io/config", // formerly "test"
  local: "http://localhost:8008/config?qspace=dev&self", // formerly "dev"
};

const mainObjects = {
  main: "iq__suqRJUt2vmXsyiWS5ZaSGwtFU9R",
  dv3: "iq__2gkNh8CCZqFFnoRpEUmz7P3PaBQG", // formerly "demov3"
  tv4: "NOT YET SET UP", // formerly "test"
  local: "NOT YET SET UP" // formerly "dev"
};

const consts = {
  main: {
    tokenUriStart: "https://main.net955305.contentfabric.io/s/main/q/",
    tokenUriEnd: "/meta/public/nft",
    kmsAddress: "0xd962aff088ca845de83ce0db0c91b9a0b93d294f",
    spaceAddress: "0x6612d94a31fab146b4c7ace60ddf3a1e5e40e500",
    claimerAddressTest: "0x2c0a54f3f2b4c95d162bbb7696bd161125222a26",
    claimerAddress: "0x27fdfa3a50de40b79cbfa3dd5921715c51db93c4",
    notificationService: "https://appsvc.svc.eluv.io/push/main"

  },
  dv3: { // formerly "demov3"
    tokenUriStart: "https://demov3.net955210.contentfabric.io/s/demov3/q/",
    tokenUriEnd: "/meta/public/nft",
    kmsAddress: "0x501382e5f15501427d1fc3d93e949c96b25a2224",
    spaceAddress: "0x9b29360efb1169c801bbcbe8e50d0664dcbc78d3",
    claimerAddress: "0x",
    notificationService: "https://appsvc.svc.eluv.io/push/dv3"
  },
  tv4: { // formerly "test"
    tokenUriStart: "https://test.net955205.contentfabric.io/s/test/q/",
    tokenUriEnd: "/meta/public/nft",
    kmsAddress: "0x567f76e552cfea5a81945a87133867f45fafc418",
    spaceAddress: "0x8e5935ca87ad11779e3aec4adcb48a5cb7c2abb4",
    claimerAddress: "0xdB9241496785241f0727D3f2BbB12a5B75dEb3E9",
  },
  local: { // formerly "dev"
    spaceAddress: "0x96d03f6476f478f99017aec366c874004020899f",
    kmsAddress: "0xd9dc97b58c5f2584062cf69775d160ed9a3bfbc4",
  }
};

exports.Config = { net, networks, mainObjects, consts };
