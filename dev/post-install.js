var exec = require('child_process').exec;
var os = require('os');

function puts(error, stdout, stderr) { 
   console.error(error);
   console.log(stdout);
   console.error(stderr);
}

// Run command depending on the OS
if (os.type() === 'Windows_NT') 
   exec("Invoke-Item ../post-npm-install-win.ps1", puts);
else
   throw new Error("Unsupported OS found: " + os.type());