/**
 * This script upgrades the unit and attached EMMs to the firmware version specified in the checkversions.afw file.
 * Make sure that all packages are available on the FTP server.
 * 
 * Installation:
 * 1. Install Node.js from https://nodejs.org/en/download/
 * 2. Install the git from https://git-scm.com/downloads
 * 3. Open the script folder in terminal and run the following commands:
 *     `npm install`    - to install the required packages
 *     `node index.js`  - to run the script
 * 
 * Optional local FTP server:
 * npx ftp-srv ftp://0.0.0.0:9876 --root ~/Dokumenty/Firmware/ 
 */

const {Unit, ok, ko, parse, countdown, prompt} = require('node-unitutils');
const path = require('path');

// VARIABLES  
const IP = '10.10.11.10';  // unit IP
// const IP = '192.168.3.145';  // unit IP
// const IP = '192.168.3.165';  // unit IP
// const IP = '192.168.3.102';  // unit IP
const checkverFtpPath = 'usb://FW/checkversions_21.afw';
// const checkverFtpPath = 'ftp://{{user}}:{{passwd}}@{{server}}/WFM-CX/Firmware/CX2_C21_STD1-DBN/C21_0801_02/checkversions_21.afw';
// const checkverFtpPath = 'ftp://{{user}}:{{passwd}}@{{server}}/WFM-CX/Firmware/CX2_C21_STD1-DBN/C21_0805_01T03/checkversions.afw';
// const checkverFtpPath = 'ftp://{{user}}:{{passwd}}@{{server}}/WFM-CX/Firmware/CX2_C21_STD1-DBN/C21_0805_01T05/checkversions_21.afw';
// const checkverFtpPath = 'ftp://{{user}}:{{passwd}}@{{server}}/WFM-CX/Firmware/CX2_C2_STD1/C2_0804_04/checkversions.afw';
// const checkverFtpPath = 'ftp://{{user}}:{{passwd}}@{{server}}/WFM-CX/Firmware/CX2_C2_STD1/C2_0801_02/checkversions.afw';
// const checkverFtpPath = 'ftp://192.168.1.166/0502_02/checkversions.afw';

// WARNING: This checkversions will be loaded after the upgrade. Replaces the broken wizard contained in the 0801_02 version. 
// Remove this and its usage after abandoning the 0801_02 version.
// Note this fix is available only for CX2_C21_STD1-DBN variant. Disable it for other variants.
// const checkverFixPath = 'ftp://{{user}}:{{passwd}}@{{server}}/WFM-CX/Firmware/CX2_C21_STD1-DBN/C21_0805_01T05/checkversions_21.afw';
// const checkverFixPath = null;  // no fix applied
const checkverFixPath = 'usb://FW/fixwiz.afw';  



(async () => { // MAIN

    const options = { 
        suppressOutput: false, 
        timeout: 120 // command timeout in seconds
    };

    try {
        const unit = new Unit(IP);
    
        while (true) {
            
            await prompt(`Please connect the next unit and press Enter\n(${checkverFtpPath})`);
            process.stdout.write('Connecting...');  // clear the console

            await unit.en();  // autoconnects
            await resetEmmMux(unit);  // force refresh emm versions info, if any
            

            // Get the checkversions output
            let output = await unit.cmd(`update fw ${checkverFtpPath}`, options);
            
            //If error encountered, exit the process (probably no such file on the FTP server)
            await checkError(output);
            
            //Parse the packages to upgrade
            let toUpgrade = output
                .match(/^.*recommended upgrade.*$/gm)
                ?.map((line) => line.trim().split(" ")[0]) || [];  // package name


            // If it is already up to date
            if (toUpgrade?.length === 0) {
                ok('This unit is seems already up to date, checking EMMs...');
            }
            

            // Upgrade outdated packages
            // a) oskernel
            if (toUpgrade.includes('oskernel')) {
                output = await unit.cmd(`update fw ${checkverFtpPath.replace('checkversions', 'oskernel')}`, options);
                await checkError(output);
            }
            
            // b) hwbaseXYZ
            const hwbasePackages = toUpgrade.filter((pkg) => pkg.match(/hwbase\d\d\d/));  
            for (const pkg of hwbasePackages) {
                output = await unit.cmd(`update fw ${checkverFtpPath.replace('checkversions', pkg)}`, options);
                await checkError(output);
            }
            
            // c) hwbaseemm
            if (toUpgrade.includes('hwbaseemm')) {
                output = await unit.cmd(`update fw ${checkverFtpPath.replace('checkversions', 'hwbaseemm')}`, options);
                await checkError(output);
            }
            
            // d) hwbaseemmXYZ
            //  sw alarms : UpdFw, UpdFwEmm1, 
            let emmToUpgrade = parse('sw alarms :', await unit.cmd(`sh ala details`), ',')
                .filter(alm => alm.startsWith('UpdFwEmm'))
                .map(updstr => Number(updstr.slice(-1)))  // -> UpdFwEmm1 -> 1
                .sort()
                .reverse();  // we should upgrade the highest EMM number first
            
            for (const emm of emmToUpgrade) {
                output = await unit.cmd(`set emm${emm} updfpgafw`, { timeout: 180 });
                await checkError(output);
            }
            
            // e) fwbase
            if (toUpgrade.includes('fwbase')) {                                    
                output = await unit.cmd(`update fw ${checkverFtpPath.replace('checkversions', 'fwbase')}`, { expect: 'done', timeout: 180 }); 
                await checkError(output);
            }
            
            
            // Wait for the unit to restart
            const restartNeeded = ( !toUpgrade.includes('fwbase') && toUpgrade.length !== 0 );  // only if there is something to upgrade

            if (restartNeeded) {
                await unit.cmd(`reset global`, { expect: 'reseting' });  
            } 

            if (restartNeeded || toUpgrade.includes('fwbase')) {
                await countdown(40, 'Waiting for the unit to restart');
            } else {
                // manually refresh the EMM versions after the upgrade(s)
                await resetEmmMux(unit);
            }
            

            // Check if all packages are upgraded
            const alarmsOk = parse('sw alarms :', await unit.cmd(`sh ala details`))[0].indexOf('UpdFw') === -1;
            if (!alarmsOk) {
                ko('FW consistency check failed. Please check it manually!');
                await exitHandler();
            }

            const upgradedVersion = parse('fw rev   :', await unit.cmd(`sh inf`))[0];
            
            // WARNING: The following code is a hack - replace the wizard file with a new one from the FTP. Needed only when upgrading to the 0801_02 or older version.
            const verInt = Number(upgradedVersion.match(/\d{4}_\d{2}/)[0].replace('_', '')); // C21_0801_02T01X -> 80102
            if (checkverFixPath && verInt < 80501)  {  // 0805_01 or older
                ok('Fixing the wizard...');
                await unit.en({ suppressOutput: true });  // beter hide the output to not confuse the user
                output = await unit.cmd(`update fw ${checkverFixPath}`, { timeout: 60, suppressOutput: true});
                await checkError(output);
            }
            
            // Log success and the upgraded version, then continue with the next unit
            unit.cmd('exit', { suppressOutput: true });  // does not need to wait for the command to finish
            ok(`Unit upgraded to ${upgradedVersion}`);
        }
    }
    catch (e) {
        console.log(e);
        await exitHandler();        
    }

})();

/**
 * Check if the string contains the word 'error' and exit the process if it does.
 * @param {String} str The string to check for the error
 * @returns Boolean value, true if the string does not contain the word 'error'
 */
async function checkError(str) {
    if (str.toLowerCase().indexOf('error') !== -1) {
        ko('An unexpected error occured. Please check it manually!');
        await exitHandler();
    }
}

/**
 * Forces EMM info refresh by resetting the EMM mux. Works silently and does nothing if the EMM mux is not set.
 * @param {Unit} unit IDU context
 */
async function resetEmmMux(unit) {
    const emmMux = parse('emm 1:', await unit.cmd(`sh mux`, { suppressOutput: true }))[0];
    if (emmMux.startsWith('sfp')) {
        await unit.en({ suppressOutput: true });
        await unit.cmd(`set ${emmMux} mux none`, { suppressOutput: true});
        await unit.cmd(`set ${emmMux} mux emm1`, { suppressOutput: true});
    }
}

/**
 * Exit handler
 * Forces prompt to wait for the user to press Enter before closing the window to prevent the window from closing when running the script as a standalone executable.
 * @returns {Promise<void>}
 */
async function exitHandler() {
    await prompt('Press Enter to close');
    process.exit(1);
}

