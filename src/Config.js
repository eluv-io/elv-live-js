
const net = "main"; // Set to "main" or "demov3"

const networks = {
  "main": "https://main.net955305.contentfabric.io",
  "demo": "https://demov3.net955210.contentfabric.io",
  "demov3": "https://demov3.net955210.contentfabric.io",
  "test": "https://test.net955203.contentfabric.io"
  };

const mainObjects = {
	"main": "iq__2gkNh8CCZqFFnoRpEUmz7P3PaBQG",
	"demov3": "iq__2gkNh8CCZqFFnoRpEUmz7P3PaBQG"
};

const consts = {
  main: {
	tokenUriStart: "https://main.net955305.contentfabric.io/s/main/q/",
	tokenUriEnd: "/meta/public/nft"
  },
  demov3: {
	tokenUriStart: "https://demov3.net955210.contentfabric.io/s/demov3/q/",
	tokenUriEnd: "/meta/public/nft"
  }
}

exports.Config = {net, networks, mainObjects, consts};
