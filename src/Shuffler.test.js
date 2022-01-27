const {Shuffler} = require("./Shuffler")

const crypto = require("crypto")
const fs = require("fs")
const os = require("os")
const path = require("path")

function writeTestFile() {
    let d = "1\n2\n3\n4\n\n5\n" // Test with extra newline
    let f = path.join(os.tmpdir(), crypto.randomUUID())
    console.log("writing test file", f)
    fs.writeFileSync(f, d)
    return f
}

test("read file", async () => {
    let f = writeTestFile()
    let a = await Shuffler.readFileToArray(f)
    expect(a).toEqual(["1", "2", "3", "4", "5"])
    fs.rmSync(f)
})

test("shuffle basic", () => {
    let a = ["1", "2", "3", "4", "5"]
    Shuffler.shuffle(a, true, "")
    expect(a).toEqual(["4", "1", "3", "5", "2"])

    let b = ["1", "2", "3", "4", "5"]
    Shuffler.shuffle(b, true, "lukeisbad")
    expect(b).toEqual(["3", "1", "5", "4", "2"])
})

test("shuffle sort", () => {
    let a = ["1", "2", "3", "4", "5"]
    Shuffler.shuffle(a, true, "lukeisbad")
    expect(a).toEqual(["3", "1", "5", "4", "2"])
    Shuffler.shuffle(a, true, "lukeisbad")
    expect(a).toEqual(["3", "1", "5", "4", "2"])
})

test.skip("shuffle duplicate", () => {
    let c = ["1", "2", "3", "4", "5", "3"]
    expect(() => {
        Shuffler.shuffle(c, true, "lukeisbad")
    }).toThrow()
})

test("shuffle empty", () => {
    let c = ["1", "2", "", "4", "5", "3"]
    expect(() => {
        Shuffler.shuffle(c, true, "lukeisbad")
    }).toThrow()
})

test("shuffle 10000 times", () => {
    const iterations = 10000
    let dist = {
        "1": [0, 0, 0, 0, 0],
        "2": [0, 0, 0, 0, 0],
        "3": [0, 0, 0, 0, 0],
        "4": [0, 0, 0, 0, 0],
        "5": [0, 0, 0, 0, 0]
    }
    for (let i = 0; i < iterations; i++) {
        let a = ["1", "2", "3", "4", "5"]
        Shuffler.shuffle(a)

        // Record where the element ocurred
        for (let j = 0; j < a.length; j++) {
            dist[a[j]][j]++
        }
    }

    console.log("distribution:", dist)

    // Check if the distribution is within the expected range
    for (let elem in dist) {
        for (let count of dist[elem]) {
            // This won't be reliable if iterations is too low
            expect(count).toBeGreaterThan(iterations / 5 * 0.9)
        }
    }
})

test("shuffle file", async () => {
    let f = writeTestFile()
    let a = await Shuffler.shuffleFile(f, true, "lukeisbad")
    expect(a).toEqual(["3", "1", "5", "4", "2"])

    let fo = Shuffler.shuffledPath(f)
    expect(fs.readFileSync(fo, "utf8")).toEqual("3\n1\n5\n4\n2\n")

    fs.rmSync(f)
    fs.rmSync(fo)
})
