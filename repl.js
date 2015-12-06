/*
A function that returns an object to manage the Python REPL connection to the 
BBC micro:bit.
*/
function pythonREPL(args) {
  var  repl = {}; // The object representing the REPL.
  repl.args = args; // Argumnets define various settings and references.
  repl.io = null; // Represents the input/output (IO) of the REPL.
  repl.connectionId = -1; // Identifies the connection to the micro:bit REPL.

  // Setup the REPL connection with the micro:bit.
  repl.run = function() {
    this.io = this.args.io.push();
    this.io.onVTKeystroke = this.sendString.bind(this, true);
    this.io.sendString = this.sendString.bind(this, false);
    this.io.println("MicroPython REPL for the BBC micro:bit.");
    var self = this; // inner reference for when JS this changes.
    // Try to find the micro:bit device as a USB serial connection.
    chrome.serial.getDevices(function(ports) {
      var eligiblePorts = ports;
      var foundMicrobit = false;
      if (eligiblePorts.length > 0) {
        // Look through the discovered devices and identify the micro:bit by its
        // productId and vendorId.
        eligiblePorts.forEach(function(portNames) {
          console.log(portNames);
          if(portNames.productId === 516 && portNames.vendorId === 3368) {
            // Device found!
            foundMicrobit = true;
            console.log('BBC micro:bit discovered. Making connection...');
            // Make a connection to the micro:bit.
            chrome.serial.connect(portNames.path, {'bitrate': 115200}, function(openInfo) {
              // Connection made... print something helpful and set a couple of
              // listeners.
              self.io.println("Connected: type 'help()' for more information.");
              self.io.print('>>> ');
              self.connectionId = openInfo.connectionId;
              // When the window closes, disconnect the device.
              window.addEventListener('close', function(){
                chrome.serial.disconnect(self.connectedId, function(){});
              });
              // When the program gets data from the micro:bit print it!
              chrome.serial.onReceive.addListener(function(info) {
                if (info && info.data) {
                  self.io.print(converter.bufferToString(info.data));
                }
              });
            });
          }
        });
      }
      // No micro:bit found, so show something useful.
      if(!foundMicrobit) {
        self.io.println('Could not find micro:bit. Plug in device and try again.');
      }
    });
  };
  
  // Send a string to the REPL running on the BBC micro:bit.
  repl.sendString = function(fromKeyboard, str) {
    console.log(str);
    chrome.serial.send(this.connectionId, converter.stringToBuffer(str), function(){});
  };
  
  // Handle when the REPL session is closed.
  repl.exit = function(code) {
    console.log(code);
  };
  
  return repl;
}

// Make the REPL "go".
var go = function() {
  hterm.defaultStorage = new lib.Storage.Chrome(chrome.storage.sync);
  var t = new hterm.Terminal("opt_profileName");
  t.decorate(document.querySelector('#terminal'));

  t.onTerminalReady = function() {
    t.runCommandClass(pythonREPL, document.location.hash.substr(1));
    return true;
  };
};

// Run when the REPL window has loaded.
window.onload = function() {
  go();
};

