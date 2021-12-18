const Unit = require('./Unit');

class USBUnit extends Unit {
    async connect () {
        console.log('USB pre-connect hooks');
        await super.connect();
    }
};

module.exports = USBUnit;