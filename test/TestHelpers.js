const crypto = require("crypto");
const fs = require("fs");
const os = require("os");
const path = require("path");

exports.writeTestFile = () => {
  let d = "1\n2\n3\n4\n\n5\n"; // Test with extra newline
  let f = path.join(os.tmpdir(), crypto.randomUUID());
  console.log("writing test file", f);
  fs.writeFileSync(f, d);
  return f;
};
