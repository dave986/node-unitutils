const readline = require('readline');
const spawnCommand = require('spawn-command');

// TODO: Add mocha to the workflow

/**
 * A system call.
 * @param {String} command Command to be executed
 * @returns The command result, both stdin and stderr
 */
const system = async (command) => {
    // TODO: Implement socket pipe
    const child = spawnCommand(command)

    let result = '';
    let isDone = false;

    child.stdout.on('data', (chunk) => {
        result += chunk;
        process.stdout.write(chunk);
    });
    child.stderr.on('data', (chunk) => {
        result += chunk;
        process.stdout.write(chunk);
    });

    // since these are streams, you can pipe them elsewhere
    // child.stderr.pipe(dest);

    child.on('close', (code) => {
        // console.log(`child process exited with code ${code}`);
        isDone = true;
    });

    while (!isDone) {
        await wait(10);
    }

    return result;
};

const parse = (what, where, delimiter) => {
    for (row of where.split(/\n/)) {
        const regExpMatch = what instanceof RegExp && row.search(what) !== -1;
        const stringMatch = typeof what === 'string' && row.indexOf(what) !== -1;
        if (regExpMatch || stringMatch) {
            return row.replace(what, '').trim().split(delimiter || ' ').filter(v => v);
        }
    }
};

const wait = (delay) => {
    return new Promise(function (resolve) {
        setTimeout(resolve, delay)
    })
};

// TODO: reimplement with chalk
const colorCodes = {
    Reset: '\x1b[0m',
    Bright: '\x1b[1m',
    Dim: '\x1b[2m',
    Underscore: '\x1b[4m',
    Blink: '\x1b[5m',
    Reverse: '\x1b[7m',
    Hidden: '\x1b[8m',

    FgBlack: '\x1b[30m',
    FgRed: '\x1b[31m',
    FgGreen: '\x1b[32m',
    FgYellow: '\x1b[33m',
    FgBlue: '\x1b[34m',
    FgMagenta: '\x1b[35m',
    FgCyan: '\x1b[36m',
    FgWhite: '\x1b[37m',

    BgBlack: '\x1b[40m',
    BgRed: '\x1b[41m',
    BgGreen: '\x1b[42m',
    BgYellow: '\x1b[43m',
    BgBlue: '\x1b[44m',
    BgMagenta: '\x1b[45m',
    BgCyan: '\x1b[46m',
    BgWhite: '\x1b[47m',
};

const stripColors = (msg) => msg.replaceAll(/[\u001b\u009b][[()#;?]*(?:[0-9]{1,4}(?:;[0-9]{0,4})*)?[0-9A-ORZcf-nqry=><]/g, '');

const ok = (msg, suffix = '\r\n') => process.stdout.write(colorCodes.Bright + colorCodes.FgGreen + msg + colorCodes.Reset + suffix);
const ko = (msg, suffix = '\r\n') => process.stdout.write(colorCodes.Bright + colorCodes.FgRed + msg + colorCodes.Reset + suffix);

/**
 * Async function which will wait for given period of time with countdown printing into the stdout
 * @param {Integer} sec The countdown duration
 * @param {String} msg Optional message for the countdown
 */
const countdown = async (sec, msg = '') => {
    let str = msg ? msg + '  ' : '';
    while (sec > 0) {
        process.stdout.write(`${str}${sec--}`);
        await wait(1000);
        readline.clearLine(process.stdout);
        readline.cursorTo(process.stdout, 0)
    }
    console.log(''); // new line
};

const concatRegExp = (r1, r2) => new RegExp(
    r1.source + r2.source,
    (r1.global ? 'g' : '') +
    (r1.ignoreCase ? 'i' : '') +
    (r1.multiline ? 'm' : '')
);

class Shortcuts {
    /**
     * Adds option to add custom keyboard shortcuts to the console app
     * @argument {Bool} debug Prints the encountered shortcut. DEFAULT is false
     * @example
     * const {Shortcuts} = require('./utils');

     * ( async() => {
     *     const shortcuts = new Shortcuts();
     *     shortcuts.add('ctrl', 'a', () => console.log(111))
     * })();
     */
    constructor(debug = false) {
        this.shortcuts = [];
        this.keypress = require('keypress');

        this.keypress(process.stdin);
        process.stdin.on('keypress', (ch, key) => {
            debug && console.log('got "keypress"', key);
            if (key && key.ctrl && key.name == 'c') {
                process.exit();
            }
            this.shortcuts.forEach(shortcut => {
                if (key && key[shortcut[0]] && key.name == shortcut[1]) {
                    shortcut[2]();
                }
            });

        });

        if (process.stdin.isTTY) { // without this there will be crash on no-tty terminals (datemons, debugger,..)
            process.stdin.setRawMode(true);
        }
        process.stdin.resume();
    }
    /** Add a new shortcut and the function which should be executed.
     * @param {*} mod ctrl or shift (these are on all keyboards)
     * @param {*} key A standard keyboard key, aka a b c d ...
     * @param {function} clb Callback with all the shortcuts that should be considered. Note this will overwrite all default shortcuts, except for mandatory default Ctrl+C
     */
    add(mod, key, clb) {
        this.shortcuts.push([mod, key, clb])
    }
    /**
     * Deletes the specified shortcut
     * @param {*} mod ctrl or shift (these are on all keyboards)
     * @param {*} key A standard keyboard key, aka a b c d ...
     */
    del(mod, key) {
        this.shortcuts = this.shortcuts.filter(arr => !(arr[0] === mod && arr[1] === key));
    }
}

function prompt(query) {
    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout,
    });

    return new Promise(resolve => rl.question(query, ans => {
        rl.close();
        resolve(ans);
    }))
}

module.exports = {
    system,
    parse,
    wait,
    colorCodes,
    stripColors,
    ok,
    ko,
    countdown,
    concatRegExp,
    Shortcuts,
    prompt
};