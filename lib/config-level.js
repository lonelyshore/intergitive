"use strict";

const step = require("./config-step");

class RepoVcsSetup {
    constructor(workingPath, referenceStoreName, checkpointStoreName) {
        this.workingPath = workingPath;
        this.referenceStoreName = referenceStoreName;
        this.checkpointStoreName = checkpointStoreName;
    }
}

class Level {
    /**
     * 
     * @param {Array<Step>} steps
     * @param {Object} repoVcsSetups
     */
    constructor(steps, repoVcsSetups) {
        this.klass = "Level";
        this.repoVcsSetups = repoVcsSetups;
        this.steps = steps;
    }
}

module.exports.Level = Level;
module.exports.RepoVcsSetup = RepoVcsSetup;