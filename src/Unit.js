const Sshconnector = require("./Sshconnector");

class Unit extends Sshconnector {
    async en (options = {}) {
        const defaultOptions = {
            suppressOutput: false,
            timeout: 5  // can be after restart, give it a second
        }
        await this.cmd('kill enable', Object.assign(defaultOptions, options));
    }
}

module.exports = Unit;