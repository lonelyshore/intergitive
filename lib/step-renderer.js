'use strict';

const elaborate = require('./component/elaborate');

class StepRenderer {
    getElaborateComponent() {
        return elaborate;
    }
}

exports = module.exports = new StepRenderer();