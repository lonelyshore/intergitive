const git = require('nodegit');

/**
 * 
 * @param {Repository} repo 
 * @param {string} tag_name 
 */
const hasTag = function(repo, tag_name) {
    return git.Tag.list(repo)
    .then((tag_names) =>  {
        return tag_names.indexOf(tag_name) !== -1;
    });
};

const helpers = {};

helpers['Tag'] = helpers.Tag || {};

helpers.Tag.hasTag = helpers.Tag.hasTag || hasTag;

git.helpers = helpers;

module.exports = git;