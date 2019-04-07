"use strict";

class Action {};

class AddFileAction extends Action {
    /**
     * 
     * @param {Array<string>} paths 
     */
    constructor(paths) {
        super();

        this.klass = "AddFileAction";
        this.paths = paths;
    }
}

class RemoveFileAction extends Action {
    constructor(paths) {
        super();

        this.klass = "RemoveFileAction";
        this.paths = paths;
    }
}

module.exports.Action = Action;
module.exports.AddFileAction = AddFileAction;
module.exports.RemoveFileAction = RemoveFileAction;