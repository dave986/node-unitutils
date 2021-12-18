const Sshconnector = require("./Sshconnector");

class Unit extends Sshconnector {
    async en () {
        await this.cmd('kill enable', { expect: 'ok', suppressOutput: false, timeout: 2 });
    }
}

module.exports = Unit;