const { EluvioLiveStream } = require("../src/LiveStream.js");
const { Config } = require("../src/Config.js"); // Question(JPH): This appears unused

const got = require("got");
const { HTTPError } = require('got')

// hack that quiets this msg:
//  node:87980) ExperimentalWarning: The Fetch API is an experimental feature. This feature could change at any time
//  (Use `node --trace-warnings ...` to show where the warning was created)
const originalEmit = process.emit;
process.emit = function (name, data, ...args) {
  if(name === `warning` && typeof data === `object` && data.name === `ExperimentalWarning`) {
    return false;
  }
  return originalEmit.apply(process, arguments);
};

const hdr = {
  "X-Content-Fabric-Trace": "enable"
};

const CheckMezSegment = async({}) => {

}


const LiveStreamParameters = async({}) => {

  const fpsList = [
    new Fraction(24000, 1001),
    new Fraction(24),
    new Fraction(25),
    new Fraction(30000, 1001),
    new Fraction(30),
    new Fraction(60000, 1001),
    new Fraction(60)
  ];

  for (let i = 0;i < fpsList.length; i++) {
    const fps = fpsList[i];
    console.log(fps);
  }

  // RTMP



  // MPEGTS

}

const Run = async ({}) => {
  try {

    LiveStreamParameters({});

  } catch (e) {
    console.error("ERROR:", e);
  }
};

Run({});
