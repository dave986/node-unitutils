const { NodeSSH } = require('node-ssh');
const { wait, colorCodes, concatRegExp, stripColors } = require('./utils');


class Sshconnector {
    /**
     * This class allows for custom ssh shell to a remote host. It supports basic Socket messaging. Note it is not optimized for performance.
     * @param {String} host The IP or hostname of the target system
     * @param {Object} options The optional parameters:
     * @param {String} options.username The ssh user. DEFAULT is 'admin'
     * @param {String} options.password Optional password parameter. Alternatively you can use the privateKey. DEFAULT is 'secret'
     * @param {String} options.privateKey Path to the private key. An alternative to the password login. When ommited, the password will be used instead. DEFAULT is null
     * @param {Socket} options.socket The default socket to which you want to send the response. Note the event name can be specified on the Unit.cmd() methid. DEFAULT is false
     * @param {String} options.id This unit identifier, if different than the hostname. It will be used as default for the socket communication. DEFAULT is hostname
     * @param {Bool} options.blindMask When true, the output of all commands will be suppressed. For suppressing only a particular command output, use Unit.cmd(options.suppressOutput) option instead. DEFAULT is false
     * @param {Bool} options.color When true, the sent command string will be colorized in the *terminal output*. DEFAULT is true
     * @param {Bool} options.suppressShellColors When true, all the command stdout outputs will be strip of ASCI color escape sequences. Note the return and emit strig will be always de-colorized. DEFAULT is false
     * @param {String} options.promptRegExpStr The target host prompt line regexp string. DEFAULT is /[a-zA-Z0-9_!@#%()-+=:,.?\/].*[\||]{1}[#|>]{1}/g, aka: some_string_EE|>
     * @example
     * const App = async () => {
            const unit = new Unit('192.168.3.102', { socket: io });
            await unit.cmd('sh inf', {expect: 'ok'});
            let output = await unit.cmd('sh stat');
       };
       App();
     */
    constructor(host, options = {}) {

        this.host = host;

        this.username = options.username || 'admin';
        this.password = options.password || 'secret';
        this.privateKey = options.privateKey || null;
        this.socket = options.socket || null;
        this.id = options.id || options.host;
        this.blindMask = options.blindMask || false;
        this.color = ('color' in options) ? options.color : true;
        this.suppressShellColors = ('suppressShellColors' in options) ? options.suppressShellColors : false;
        this.promptRegExpStr = new RegExp(options.promptRegExpStr || /[a-zA-Z0-9_!@#%()-+=:,.?\/].*[\||]{1}[>|#]{1}/g);

        this.ssh = new NodeSSH();
        this.buffer = '';

    }

    async connect () {
        this.connection = await this.ssh.connect({
            host: this.host,
            username: this.username,
            password: this.password,
            privateKey: this.privateKey
        });

        this.shell = await this.ssh.requestShell();
        this.shell.on('data', data => {
            this.buffer += data.toString('utf-8') || '';
        });

        while (true) {
            await wait(25);
            if (this.buffer.search(this.promptRegExpStr) !== -1) { // wait for first prompt  FIXME: It is kinda hard to guess a colorful prompt. It should probably be stripped. 
                break;
            }
        }

        console.log('Connected...');
        this.socket && this.socket.emit('start', { msg: 'Connected to ' + this.host })
    }

    /**
     * Writes desired command in the connected shell and returns its output. It automatically connect to the unit, if not already connected. Asynchronous.
     * @param {String} cmd Command to be executed
     * @param {Object} options Method modifiers:
     * @param {String} options.expect What should be considered as the end of output. When not found until timeout expires, a new Error will be thrown. DEFAULT is 'prompt', which is special case, which will expect new line after finished command. Note this means a possible set errors will not be detected.
     * @param {Integer} options.timeout How long in seconds to wait for the desired output. When reached a new Error will be thrown. DEFAULT '10' seconds.
     * @param {Bool} options.suppressOutput If the output should be passed to the stdout. DEFAULT true
     * @param {Object} options.emit Socket definition. It will be emmited as:
     * @example
     * socket.emit(socketEvent, { unit: Unit.id, cmd: cmd, opt: msg });
     * @param {Socket} options.emit.socket Existing socket to which the response should be passed. DEFAULT Unit.socket
     * @param {String} options.emit.socketEvent Name of the socket event that should be emmited. DEFAULT 'sshcmd'
     * @returns Command result
     */
    async cmd (cmd, options = {}) {

        // Options
        const expect = ('expect' in options) ? options.expect : 'prompt';
        const timeout = options.timeout || 10;
        const suppressOutput = options.suppressOutput || false;
        const socket = options.emit && options.emit.socket || this.socket;
        const socketEvent = options.emit && options.emit.event || 'sshcmd';

        const processOutputs = (msg) => {

            let opt = this.suppressShellColors ? stripColors(msg) : msg;

            result += opt;

            if (socket) {
                socket.emit(socketEvent, { unit: this.id, cmd: cmd, opt: stripColors(opt) });
            }

            if (!suppressOutput && !this.blindMask) {
                if (this.color) {
                    opt = opt.replace(`${cmd}\r`, colorCodes.Bright + colorCodes.FgYellow + cmd + colorCodes.Reset + '\r');
                }
                process.stdout.write(opt);
            }
        }


        const firstLineRegExp = concatRegExp(this.promptRegExpStr, new RegExp(`(${cmd})`));
        const expecting = expect === 'prompt' ? this.promptRegExpStr : expect;

        let firstLineStartInd = -1;
        let startLastCharIndex = -1;
        let currIndex = 0;
        let endIndex = -1;

        let time = 0;
        let result = '';

        if (!this.ssh.isConnected()) {
            await this.connect();
        }

        this.buffer = '';
        this.shell.write('\r\n');
        this.shell.write(cmd + '\r\n');

        while (endIndex === -1) {

            if (time >= timeout * 1000) {
                throw new Error(`Timeout when waiting for expected "${expect}" in "${cmd}". BUFFER: ${this.buffer}`);
            }

            await wait(10);

            // Sanitize the raw output and print, emit, return. Requirements:
            //  - print first line with prompt and command (nothing before)
            //  - print the command output
            //  - when the 'expect' occurs, end and return nothing after
            //      - handle special case of the expect == 'prompt'. In such case do not print the last line with prompt
            if (firstLineStartInd === -1) {
                firstLineStartInd = this.buffer.search(firstLineRegExp);
                if (firstLineStartInd !== -1) {
                    currIndex = firstLineStartInd;
                    startLastCharIndex = this.buffer.slice(firstLineStartInd).search('\r\n') + '\r\n'.length + firstLineStartInd;
                }
            } else {
                const endIndexWithoutFirstLine = this.buffer.slice(startLastCharIndex).search(expecting);

                if (endIndexWithoutFirstLine !== -1) {
                    endIndex = endIndexWithoutFirstLine + startLastCharIndex;
                }

                if (endIndex === -1) {
                    const newIndex = this.buffer.length - 1;
                    processOutputs(this.buffer.slice(currIndex, newIndex));
                    currIndex = newIndex;
                } else { // we have all we need
                    const newLine = expect === 'prompt' ? '' : '\r\n';
                    endIndex += expect === 'prompt' ? 0 : expect.length;
                    processOutputs(this.buffer.slice(currIndex, endIndex) + newLine);

                    return stripColors(result);
                }
            }

            time += 10;
        }
    }

    
}

module.exports = Sshconnector;