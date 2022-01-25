const seedrandom = require("seedrandom")

const fs = require("fs")
const readline = require('readline')

class Shuffler {
    /**
     * Shuffle an array using the Durstenfeld algorithm
     * @param a - An array of strings
     * @param seed - The order will always be the same for the given string; nil for a random seed
     * @returns {*} - The same array object, after shuffling
     */
    static shuffle(a, seed) {
        let rng = seedrandom(seed);
        for (let i = a.length - 1; i > 0; i--) {
            let j = Math.floor(rng() * (i + 1))
            let temp = a[i]
            a[i] = a[j]
            a[j] = temp
        }
        return a
    }

    /**
     * Read a file into an array of line strings
     * @param f - The file path
     * @returns {Promise<*[]>} - An array of lines
     */
    static async readFileToArray(f) {
        const a = []
        const rl = readline.createInterface({
            input: fs.createReadStream(f),
            crlfDelay: Infinity
        })
        for await (const line of rl) {
            a.push(line)
        }
        return a
    }

    /**
     * Write an array of strings to a file, one element per line
     * @param f - The file path
     * @param a - An array of strings
     */
    static writeArrayToFile(f, a) {
        let fd
        try {
            fd = fs.openSync(f, "ax")
            for (let line of a) {
                fs.appendFileSync(fd, line)
                fs.appendFileSync(fd, "\n")
            }
        } finally {
            if (fd !== undefined) fs.closeSync(fd)
        }
    }

    static shuffledPath(f) {
        return f + ".shuffled"
    }

    /**
     * Shuffle the lines in a file, print the result, and write it back out
     * to the result of shuffledPath
     * @param f - The file path
     * @param seed - The order will always be the same for the given string; nil for a random seed
     * @returns {Promise<*[]>} - The shuffled lines in an array
     */
    static async shuffleFile(f, seed) {
        let a = await Shuffler.readFileToArray(f)
        Shuffler.shuffle(a, seed)
        Shuffler.writeArrayToFile(Shuffler.shuffledPath(f), a)
        return a
    }
}

exports.Shuffler = Shuffler
