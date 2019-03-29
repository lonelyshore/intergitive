const git = require('nodegit');

/**
 * Returns if the repo has tag tagName
 * @param {git.Repository} repo 
 * @param {string} tagName 
 * @returns {Promise<Number>} Whether repo contains a tag named tagName
 */
const hasTag = function(repo, tagName) {
    return git.Tag.list(repo)
    .then((tag_names) =>  {
        return tag_names.indexOf(tagName) !== -1;
    });
};

/**
 * Returns if the repo is on branch
 * @param {git.Repository} repo 
 * @param {string} branchName 
 * @returns {Promise<Boolean>} Whether the repo HEAD is pointing to branchName
 */
const isOnBranch = function(repo, branchName) {
    return repo.getReference(branchName)
    .then((branchRef) => git.Branch.isHead(branchRef));
}

const checkoutRef = function(repo, refName, strategy) {
    let options = new git.CheckoutOptions();
    options.checkoutStrategy = strategy;

    return repo.getReference(refName)
    .then((ref) => repo.checkoutRef(ref, options));    
}

/**
 * Force checkout to branchName and remove untracked files
 * @param {git.Repository} repo 
 * @param {String} refName 
 * @param {Promise<void>}
 */
const cleanCheckoutRef = function(repo, refName) {
    return checkoutRef(
        repo,
        refName, 
        git.Checkout.STRATEGY.FORCE | git.Checkout.STRATEGY.RECREATE_MISSING | git.Checkout.STRATEGY.REMOVE_UNTRACKED);
}

/**
 * Force checkout to branchName
 * @param {git.Repository} repo 
 * @param {string} refName 
 * @returns {Promise<void>}
 */
const forceCheckoutRef = function(repo, refName) {
    return checkoutRef(
        repo,
        refName,
        git.Checkout.STRATEGY.FORCE | git.Checkout.STRATEGY.RECREATE_MISSING)
}

const createSubModuleAndWarnExisting = function(gitModule, subModuleName) {
    if (gitModule[subModuleName]) {
        console.error(subModuleName + " already exists in nodegit");
    }

    return gitModule[subModuleName] = {};
}

const getSubModuleAndWarnMissing = function(gitModule, subModuleName) {
    let subModule = gitModule[subModuleName];
    if (!subModule) {
        console.error(subModuleName + " is missing from nodegit");
        gitModule[subModuleName] = {};
    }

    return subModule;
}

const overrideSubModuleMemeberAndWarn = function(subModule, subModuleName, member, memberName) {
    if (subModule[memberName]) {
        console.error(subModuleName + " already has " + memberName);
    }
    subModule[memberName] = member;
}

const tagName = "Tag";
let tag = getSubModuleAndWarnMissing(git, tagName);
overrideSubModuleMemeberAndWarn(tag, "Tag", hasTag, "hasTag");

const branchName = "Branch"
let branch = getSubModuleAndWarnMissing(git, branchName);
overrideSubModuleMemeberAndWarn(branch, branchName, isOnBranch, "isOnBranch");

const commandsName = "Commands";
let commands = createSubModuleAndWarnExisting(git, commandsName);
overrideSubModuleMemeberAndWarn(commands, commandsName, forceCheckoutRef, "forceCheckoutRef");
overrideSubModuleMemeberAndWarn(commands, commandsName, cleanCheckoutRef, "cleanCheckoutRef");

module.exports = git;