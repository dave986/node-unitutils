# fw_updater

This example demonstrates how to upgrade the firmware of a device from an USB/FTP server.

## Setup and run

Inside the `fw_updater` folder, run the following command to install the required dependencies:

```bash
npm install
```

If you wish to use local FTP server, you can use the following command to start the included FTP server before running the example:

```bash
npx ftp-srv ftp://0.0.0.0:9876 --root ~/Documents/Firmware/
```

Where `~/Documents/Firmware/` is the path to the folder containing the firmware files. The port number can be changed to any other port number but note that the port number should be between 1024 and 65535 for non-root users. Remember to change the FTP path to the firmware file in the `index.js` file accordingly - with your local IP (which is accessible from the IDU) address and the selected port number.

## How to use

1. Edit the index.js file to set the correct device IP address and the path to the firmware file.
2. Optional: set path to a post-install checkversions package. Usefull for patching the firmware with the latest version of the FW upgrade wizard independently of the targetted firmware version.
3. Run the example with `node index.js`. The script will update the firmware of the device, all attached outdated EMM cards, reboot, confirm the firmware version and then it waits for the next device to update.

## Compiling into executable

When happy with the script settings you can bundle all necessary files and the node runtime into a single executable file. This can be done using the `pkg` package. To install it globally in your system, run the following command:

```bash
npm install -g pkg
```

Then, run the following command to compile the script into an executable:

```bash
npx pkg index.js
```

For possible options, including possible targets, see the [pkg documentation](https://www.npmjs.com/package/pkg).

NOTE: If the pck command complains about unavailable node target, you can specify to target an older version of node by adding the `--target` option. For example, to bundle for windows with node version 18, run the following command:

```bash
npx pkg --target node18-win index.js
```

The produced executable can be run on the target device without the need to install node.js or any other dependencies.
