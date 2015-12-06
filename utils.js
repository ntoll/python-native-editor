// Creates an object that converts strings to/from binary arrays.
var convert = function() {
  converter = {};
    
  // Convert an incoming buffer into a unicode string.
  converter.bufferToString = function(buffer) {
    var bufferView = new Uint8Array(buffer);
    var unicodeChars = [];
    for (var i = 0; i < bufferView.length; i++) {
      unicodeChars.push(bufferView[i]);
    }
    return String.fromCharCode.apply(null, unicodeChars);
  };
  
  // Convert a unicode string into a buffer of bytes to send to the device.
  converter.stringToBuffer = function(str) {
    var buffer = new ArrayBuffer(str.length);
    var bufferView = new Uint8Array(buffer);
    for (var i = 0; i < str.length; i++) {
      bufferView[i] = str.charCodeAt(i);
    }
    return buffer;
  };
  
}();