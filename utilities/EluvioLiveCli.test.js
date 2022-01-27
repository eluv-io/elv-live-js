process.argv = ["make", "yargs", "happy"]

const elc = require("./EluvioLiveCli")
const th = require("../test/TestHelpers");
const {Shuffler} = require("../src/Shuffler");

const fs = require("fs");
const path = require("path")

function checkShuffled() {
    let f = Shuffler.shuffledPath(__dirname + "/../test/shuffle.in.txt")
    expect(fs.readFileSync(f, "utf8")).toEqual(
        "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa\n" +
        "0xffffffffffffffffffffffffffffffffffffffff\n" +
        "0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee\n" +
        "0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb\n" +
        "0xcccccccccccccccccccccccccccccccccccccccc\n" +
        "0xdddddddddddddddddddddddddddddddddddddddd\n" +
        "0xcccccccccccccccccccccccccccccccccccccccc\n")
    fs.rmSync(f)
}

test("shuffle basic", async () => {
    let f = th.writeTestFile()
    await elc.CmdShuffle({
        argv: {
            file: f,
            seed: "lukeisbad",
            check_dupes: false,
            print_js: false
        }
    })

    let fo = Shuffler.shuffledPath(f)
    expect(fs.readFileSync(fo, "utf8")).toEqual("3\n1\n5\n4\n2\n")

    fs.rmSync(f)
    fs.rmSync(fo)
})

test("shuffle addresses", async () => {
    let f = __dirname + "/../test/shuffle.in.txt"
    await elc.CmdShuffle({
        argv: {
            file: f,
            seed: "acc75eacc75eacc75eacc75eacc75eacc75eacc75eacc75eacc75eacc75eacc7"
        }
    })

    checkShuffled()
})

test("shuffle directory", async () => {
    let dir = __dirname + "/../test"
    await elc.CmdShuffle({
        argv: {
            file: dir,
            seed: "acc75eacc75eacc75eacc75eacc75eacc75eacc75eacc75eacc75eacc75eacc7"
        }
    })

    checkShuffled()
    fs.readdirSync(dir).forEach((f) => {
        if (f.endsWith(".shuffled")) {
            fs.rmSync(path.join(dir, f))
        }
    })
})
