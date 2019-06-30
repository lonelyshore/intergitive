"use strict";


const path = require("path");

const workingPath = path.resolve("./test/playground/generate-vcs-repo");

const nodeConsole = require('console');
let myConsole = new nodeConsole.Console(process.stdout, process.stderr);
myConsole.log(workingPath);


