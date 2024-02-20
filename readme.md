# unitutils

This library provides a set of utility functions for working with [ATH system](www.athsystem.com) units using standard ssh protocol.

## Installation

To install the library, add it to your project using npm:

```bash
npm install github:dave986/node-unitutils
```

## Examples

Check the [examples](./examples/readme.md) folder for some example code.

## Usage

### Class Unit

This class represents the unit and provides a set of methods for working with the unit:

```javascript
// ## Connection to the unit
const { Unit } = require('node-unitutils');       // Import the Unit class
const local = new Unit('192.168.1.11');           // Create a new unit object with the IP address of the unit
const remote = new Unit('192.168.1.12',           
    { username: 'root', password: 'password' });  // You can also provide an object with options as the second argument
const await idu.cmd('sh info');                   // Run the command 'sh info' on the unit (note you do not need to connect to the unit first)
```

#### Options

Here is the list of all options and their default values:

* @param {String} `options.username` - The ssh user. DEFAULT is 'admin'
* @param {String} `options.password` - Optional password parameter. Alternatively you can use the privateKey. DEFAULT is 'secret'
* @param {String} `options.privateKey` - Path to the private key. An alternative to the password login. When ommited, the password will be used instead. DEFAULT is null
* @param {Socket} `options.socket` - The default socket to which you want to send the response. Note the event name can be specified on the Unit.cmd() methid. DEFAULT is false
* @param {String} `options.id` - This unit identifier, if different than the hostname. It will be used as default for the socket communication. DEFAULT is hostname
* @param {Bool} `options.blindMask` - When true, the output of all commands will be suppressed. For suppressing only a particular command output, use Unit.cmd(`options.suppressOutput` -) option instead. DEFAULT is false
* @param {Bool} `options.color` - When true, the sent command string will be colorized in the *terminal output*. DEFAULT is true
* @param {Bool} `options.suppressShellColors` - When true, all the command stdout outputs will be strip of ASCI color escape sequences. Note the return and emit strig will be always de-colorized. DEFAULT is false
* @param {String} `options.promptRegExpStr` - The target host prompt line regexp string. DEFAULT is /[a-zA-Z0-9_!@#%()-+=:,.?\/].*[\||]{1}[#|>]{1}/g, aka: some_string_EE|>

#### Methods

##### async cmd(command, options)

Run a command on the unit. The command can be a string or an array of strings. The method returns a promise that resolves with the output of the command.

###### Async/Await note

In the following example pay attention to the `await` keyword before the cmd invokation. This lets the program wait for the command to finish before continuing the next line of code:

Example:

```javascript

let iduDate = 'none';
iduDate = idu.cmd('sh date');
console.log(iduDate);  // logs 'none' because the command has not finished yet

let iduNewDate = 'none';
iduDate = await idu.cmd('sh date');
console.log(iduDate);  // logs the date of the unit
```

Without the `await` keyword, the program would continue to the next line of code before the command finishes. This is not what you want in most cases.

###### `cmd` Options

The method also accepts an options object as the second argument. The options object can contain the following properties:

* @param {String} `options.expect`- What should be considered as the end of output. When not found until timeout expires, a new Error will be thrown. DEFAULT is 'prompt', which is special case, which will expect new line after finished command. Note this means a possible set errors will not be detected.
* @param {Integer} `options.timeout`- How long in seconds to wait for the desired output. When reached a new Error will be thrown. DEFAULT '10' seconds.
* @param {Bool} `options.suppressOutput`- If the output should be passed to the stdout. DEFAULT true
* @param {Object} `options.emit`- Socket definition. It will be emmited as:
* @param {Socket} `options.emit.socket` - Existing socket to which the response should be passed. DEFAULT Unit.socket
* @param {String} `options.emit.socketEvent` - Name of the socket event that should be emmited. DEFAULT 'sshcmd'

These two commands will be run in sequence, and the output of both commands will be passed to a socket. The command will be considered as finished when the regex "expect" match is found.

```javascript
const [info, status] = await idu.cmd(['sh info', 'sh stat'], { 
    expect: 'prompt', 
    timeout: 5, 
    suppressOutput: false, 
    emit: { 
        socket: mySocket, 
        socketEvent: 'myEvent' 
        } 
    });
console.log(info, status);
```

The `reset global` is one example of command which does not return to the prompt. In this case, the expect option should be set to a string which is expected to be present by the end of the output. Note that using any other than the default "prompt" expect option may cause the command to be considered as finished before the command execution is actually finished in the target host. Also, the timeout option should be set to a value greater than the time the command is expected to finish.

```javascript
await idu.cmd('reset global', { expect: 'resetting', timeout: 5 });
await countdown(40);  // you have to wait for the unit to reboot
await idu.cmd('sh date');
```

##### Utility functions

###### `system`

The asynchronous function `system` takes a command as an argument and executes it on the operating system level. It returns a promise that resolves with the output of the command.

Example:

```javascript
const { system } = require('node-unitutils');
const output = await system('uname -a');  // String
console.log(output);  // returns "Linux davidtp 5.15.0-94-generic #104-Ubuntu SMP Tue Jan 9 15:25:40 UTC 2024 x86_64 x86_64 x86_64 GNU/Linux"
```

###### `parse`

The function `parse` takes up to three arguments:

* `what` - a string or a regular expression to search for in the `where` string
* `where` - a string to search in
* `delimiter` - a string to split the result by. DEFAULT is ' ' (a single space)

The function returns an array of strings that are found in the `where` string after the `what` string or regular expression:

```javascript
const { parse } = require('node-unitutils');

const result1 = parse('MAC:', 'MAC: 00:11:22:33:44:55');
const result2 = parse('MAC:', 'MAC: 00:11:22:33:44:55', ':');
console.log(result1);  // returns ['00:11:22:33:44:55']
console.log(result2);  // returns ['00', '11', '22', '33', '44', '55']

// Parse info directly from the unit
const [mse1, mse2] = parse('MSE: ', await idu.cmd('sh modem'));
```

###### `wait`

The asynchronous function `wait` takes a delay in milliseconds as an argument and returns a promise that resolves after the delay. Use this function to pause the execution of the program for a certain amount of time.

Example:

```javascript
const { wait } = require('node-unitutils');
console.log('Waiting for 1 minute...');
await wait(1000 * 60);  // Stop on this line for 1 minute
console.log('Done waiting!');
```

###### `stripColors`

The utility function `stripColors` takes a string as an argument and returns the string without any ANSI color escape sequences.

Example:

```javascript
const { stripColors } = require('node-unitutils');
const coloredString = '\u001b[31mHello, world!\u001b[0m';
const plainString = stripColors(coloredString);
console.log(plainString);  // returns "Hello, world!"
```

###### `ok` and `ko`

The utility functions `ok` and `ko` mimics console.log, taking a string as an argument and printing a string with a green or red color, respectively. These functions are useful for logging the success or failure of a command.

Example:

```javascript
const { ok, ko } = require('node-unitutils');
ok('The command was successful!');
ko('The command failed!');
```

###### `countdown`

The asynchronous function `countdown` takes a delay in seconds as an argument and returns a promise that resolves after the delay. Use this function to pause the execution of the program for a certain amount of time with a countdown printed to the console.

Example:

```javascript
const { countdown } = require('node-unitutils');
await countdown(10);  // Stop on this line for 10 seconds while counting down
await countdown(60, 'Rebooting...');  // With a custom message
```

###### `concatRegExp`

The utility function `concatRegExp` takes two regular expressions as arguments and returns a new regular expression that matches both of the original regular expressions.

Example:

```javascript
const { concatRegExp } = require('node-unitutils');
const regExp1 = /hello/;
const regExp2 = /world/;
const regExp3 = concatRegExp(regExp1, regExp2);
console.log(regExp3.test('hello world'));  // returns true
```

###### `prompt`

The utility function `prompt` takes a string as an query shown to the user and returns a promise that resolves with the user's input.

Example:

```javascript
const { prompt } = require('node-unitutils');
const name = await prompt('What is your name? ');
console.log(`Hello, ${name}!`);
```

###### `Shortcuts`

The library also provides an easy way to define custom shortcuts for the terminal. The `Shortcuts` object contains two methods: `add(mod, key, clb)` and `del(mod, key)`.

The arguments of the `add` method are:

* `mod` - a string representing the modifier key (e.g. 'ctrl', 'shift', 'alt')
* `key` - a string representing the key (e.g. 'a', 'b', 'c', '1', '2', '3', 'F1', 'F2', 'F3')
* `clb` - a callback function that will be called when the shortcut is pressed

Example:

```javascript
const { Shortcuts } = require('node-unitutils');
const shortcuts = new Shortcuts();
shortcuts.add('ctrl', 'q', () => {
    console.log('You pressed ctrl+q!. Do it again to exit.')
    shortcuts.del('ctrl', 'q');
    shortcuts.add('ctrl', 'q', () => process.exit());
});
```
