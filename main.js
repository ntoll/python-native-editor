/*
A simple editor that targets MicroPython for the BBC micro:bit.

Feel free to have a look around! (We've commented the code so you can see what
everything does.)

Have fun!

Nicholas and Damien.
*/

/*
Returns an object that defines the behaviour of the Python editor. The editor
is attached to the div with the referenced id.
*/
function pythonEditor(id) {
    // An object that encapsulates the behaviour of the editor.
    editor = {};

    // Represents the ACE based editor.
    var ACE = ace.edit(id);  // The editor is in the tag with the referenced id.
    ACE.setOptions({
        enableSnippets: true  // Enable code snippets.
    });
    ACE.setTheme("ace/theme/kr_theme");  // Make it look nice.
    ACE.getSession().setMode("ace/mode/python");  // We're editing Python.
    ACE.getSession().setTabSize(4); // Tab=4 spaces.
    ACE.getSession().setUseSoftTabs(true); // Tabs are really spaces.
    editor.ACE = ACE; // Set a reference to the editor.

    // Gets the textual content of the editor (i.e. what the user has written).
    editor.getCode = function() {
        return ACE.getValue();
    };

    // Sets the textual content of the editor (i.e. the Python script).
    editor.setCode = function(code) {
        ACE.setValue(code);
    };

    // Give the editor user input focus.
    editor.focus = function() {
        ACE.focus();
    };

    // Set a handler function to be run if code in the editor changes.
    editor.on_change = function(handler) {
        ACE.getSession().on('change', handler);
    };

    // Return details of all the snippets this editor knows about.
    editor.getSnippets = function() {
        var snippetManager = ace.require("ace/snippets").snippetManager;
        return snippetManager.snippetMap.python;
    };

    // Triggers a snippet by name in the editor.
    editor.triggerSnippet = function(snippetName) {
        var snippetManager = ace.require("ace/snippets").snippetManager;
        var snippet = snippetManager.snippetNameMap.python[snippetName];
        if(snippet) {
            snippetManager.insertSnippet(ACE, snippet.content);
        }
    };

    /*
    Turn a Python script into Intel HEX format to be concatenated at the
    end of the MicroPython firmware.hex.  A simple header is added to the
    script.

    - takes a Python script as a string
    - returns hexlified string, with newlines between lines
    */
    editor.hexlify = function(script) {
        function hexlify(ar) {
            var result = '';
            for (var i = 0; i < ar.length; ++i) {
                if (ar[i] < 16) {
                    result += '0';
                }
                result += ar[i].toString(16);
            }
            return result;
        }
        // add header, pad to multiple of 16 bytes
        data = new Uint8Array(4 + script.length + (16 - (4 + script.length) % 16));
        data[0] = 77; // 'M'
        data[1] = 80; // 'P'
        data[2] = script.length & 0xff;
        data[3] = (script.length >> 8) & 0xff;
        for (var i = 0; i < script.length; ++i) {
            data[4 + i] = script.charCodeAt(i);
        }
        // TODO check data.length < 0x2000
        // convert to .hex format
        var addr = 0x3e000; // magic start address in flash
        var chunk = new Uint8Array(5 + 16);
        var output = [];
        for (i = 0; i < data.length; i += 16, addr += 16) {
            chunk[0] = 16; // length of data section
            chunk[1] = (addr >> 8) & 0xff; // high byte of 16-bit addr
            chunk[2] = addr & 0xff; // low byte of 16-bit addr
            chunk[3] = 0; // type (data)
            for (var j = 0; j < 16; ++j) {
                chunk[4 + j] = data[i + j];
            }
            var checksum = 0;
            for (j = 0; j < 4 + 16; ++j) {
                checksum += chunk[j];
            }
            chunk[4 + 16] = (-checksum) & 0xff;
            output.push(':' + hexlify(chunk).toUpperCase());
        }
        return output.join('\n');
    };

    // Generates a hex file containing the user's Python from the firmware.
    editor.getHexFile = function(firmware) {
        var hexlified_python = this.hexlify(this.getCode());
        var insertion_point = ":::::::::::::::::::::::::::::::::::::::::::";
        return firmware.replace(insertion_point, hexlified_python);
    };

    return editor;
}

/*
The following code contains the various functions that define the behaviour of
the editor.

See the comments in-line for more information.
*/
function editorUI() {
  
    // The name of the file being edited.
    var filename = 'micropython_script';
    
    // A flag indicating unsaved changes in the editor.
    var dirty = false;
    
    // A reference to the Google drive of the current user. We use this to
    // store their MicroPython scripts "in the cloud".
    var drive = null;
  
    // On your marks, get set...
    function go() {
        setupEditor();
        setupButtons();
    }
    
    // Get the font size of the text currently displayed in the editor.
    function getFontSize() {
        return parseInt($('#editor').css('font-size'));
    }

    // Set the font size of the text currently displayed in the editor.
    function setFontSize(size) {
        $('#editor').css('font-size', size + 'px');
    }

    // Sets up the zoom-in functionality.
    function zoomIn() {
        var fontSize = getFontSize();
        fontSize += 8;
        if(fontSize > 46) {
            fontSize = 46;
        }
        setFontSize(fontSize);
    }

    // Sets up the zoom-out functionality.
    function zoomOut() {
        var fontSize = getFontSize();
        fontSize -= 8;
        if(fontSize < 22) {
            fontSize = 22;
        }
        setFontSize(fontSize);
    }

    // Grabs the textual content of the editor (i.e. what the user has written).
    function savePython() {
        return EDITOR.getValue();
    }
    
    // Loads a Python script into the editor.
    function loadPython(script) {
        EDITOR.setCode(code);
        EDITOR.focus();
        EDITOR.ACE.gotoLine(EDITOR.ACE.session.getLength());
    }
    
    // Given a reference to a directory representing the micro:bit on the local
    // filesystem, will generate and flash the .hex file to that location.
    function copyToMicroBit(directory_entry) {
      // Create the hex file to flash onto the device.
      var firmware = $("#firmware").text();
      var hexfile = EDITOR.getHexFile(firmware);
      var hex_filename = filename + '.hex';
      saveFile(directory_entry, hex_filename, hexfile);
    }
    
    // Attempts to write content to the file in the given directory with the 
    // referenced filename.
    function saveFile(directory_entry, filename, content) {
      console.log("Writing file: " + filename);
      console.log(directory_entry);
      chrome.fileSystem.getWritableEntry(directory_entry, function(writable_directory) {
        if(writable_directory) {
          writable_directory.getFile(filename, {create: true}, function(file) {
            file.createWriter(function(writer){
              file.file(function(f){
                var out = new Blob([content]);
                writer.write(out, {type: 'text/plain'});
              });
            });
          });
        } else {
          microbitDirectory = null;
          displayMessage('Error', 'Unable to write to micro:bit. Have you got it plugged in?');
        }
      });
    }
    
    // Loads a Python script (the referenced file_entry) and loads it into the
    // editor.
    function loadFile(file_entry) {
      file_entry.file(function(file) {
         var reader = new FileReader();
         reader.onloadend = function(e) {
           EDITOR.setCode(this.result);
         };
         reader.readAsText(file);
       }, function(error) {console.log(error);});
    }
    
    // Display a message to the end user.
    function displayMessage(label, message) {
      console.log(label);
      console.log(message);
      var template = $('#message-template').html();
      vex.open({
          content: Mustache.render(template, {label: label, text: message})
      });
    }

    // This function is called when the editor first starts. It sets it up so
    // the user sees their code or, in the case of a new program, uses some
    // sane defaults.
    function setupEditor() {
        // Create a Python editor attached to the 'editor' element.
        EDITOR = pythonEditor('editor');
        window.setTimeout(function () {
            // Handles what to do if the user changes the content of the editor.
            EDITOR.ACE.getSession().on('change', function () {
                dirty = true;
            });
        }, 1);
        // Sync up with the user's Google Drive...
        chrome.syncFileSystem.requestFileSystem(function (fs) {
          console.log('Connected to Google Drive.');
          drive = fs;
        });
        // Bind the ESCAPE key.
        $(document).keyup(function(e) {
            if (e.keyCode == 27) { // ESCAPE
                $('#command-new').focus();
            }
        });
        // Focus on the element with TAB-STATE=1
        $("#command-new").focus();
    }
    
    // Describes how to create a new Python script.
    function doNew() {
      if(dirty) {
        displayMessage('Warning', 'You have unsaved work. Please save before continuing.');
      } else {
        EDITOR.setCode("from microbit import *\n\n# Type your Python code here. For example...\ndisplay.scroll(\"Hello, World!\")");
        dirty = false;
        
      }
    }
    
    // Defines the process of loading a script from the filesystem.
    function doLoad() {
      
    }
    
    // Defines the process of saving a script to the filesystem.
    function doSave() {
      dirty = false;
    }

    // This function describes what to do when the snippets button is clicked.
    function doSnippets() {
        // Snippets are triggered by typing a keyword followed by pressing TAB.
        // For example, type "wh" followed by TAB.
        var snippetManager = ace.require("ace/snippets").snippetManager;
        var template = $('#snippet-template').html();
        Mustache.parse(template);
        var context = {
            'snippets': snippetManager.snippetMap.python,
            'describe': function() {
                return function(text, render) {
                    name = render(text);
                    description = name.substring(name.indexOf(' - '),
                                                 name.length);
                    return description.replace(' - ', '');
                };
            }
        };
        vex.open({
            content: Mustache.render(template, context),
            afterOpen: function(vexContent) {
                $(vexContent).find('.snippet-selection').click(function(e){
                    var snippet_name = $(this).find('.snippet-name').text();
                    var content = snippetManager.snippetNameMap.python[snippet_name].content;
                    snippetManager.insertSnippet(EDITOR.ACE, content);
                    vex.close();
                    EDITOR.focus();
                });
            }
        });
    }
    
    // Takes the Python script in the editor, turns it into an appropriate .hex
    // format and copies (flashes) it onto the micro:bit indicated by the user.
    // If the directory is not a link to the micro:bit you'll just end up with
    // a .hex file named after the current script.
    function doFlash() {
     var handler = function(entry) {
        if(entry) {
          microbitDirectory = entry;
          copyToMicroBit(entry);
        } else {
          displayMessage('Error', 'Unable to open directory.');
        }
      };
      chrome.fileSystem.chooseEntry({type: 'openDirectory'}, handler);
    }
    
    // Toggles the REPL. If a micro:bit is connected will attempt to bring up
    // the REPL for interactive programming. This behaviour is defined within
    // an iFrame whose source points to repl.html and associated repl.js.
    function doREPL() {
      $('#repl').toggle(); // display on/off
      $('#repl-frame').attr('src', 'repl.html');
    }
    
    // Starts the introJs help system to give the user a walk-through of the
    // editor's functionality.
    function doHelp() {
      introJs().start();
    }

    // Join up the buttons in the user interface with some functions for 
    // handling what to do when they're clicked.
    function setupButtons() {
        $("#command-new").click(function () {
            doNew();
        });
        $("#command-load").click(function () {
            doLoad();
        });
        $("#command-save").click(function () {
            doSave();
        });
        $("#command-snippet").click(function () {
            doSnippets();
        });
        $('#command-flash').click(function() {
          doFlash(); // Ah Aah!
        });
        $('#command-repl').click(function() {
            doREPL();
        });
        $('#command-help').click(function() {
          doHelp();
        });
        $("#zoom-in").click(function (e) {
            e.stopPropagation();
            zoomIn();
        });
        $("#zoom-out").click(function (e) {
            e.stopPropagation();
            zoomOut();
        });
    }

    // 5, 4, 3, 2, 1...
    go();
}

// Called once all the assets have loaded and been processed.
window.onload = function() {
  // Vex is the popup window tool. Set the theme to something nice.
  vex.defaultOptions.className = 'vex-theme-wireframe';
  // Cause the editorUI function take control of the page.
  editorUI();
};