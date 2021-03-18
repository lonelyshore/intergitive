const git = require('nodegit')

/**
 * Returns if the repo has tag tagName
 * @param {git.Repository} repo
 * @param {string} tagName
 * @returns {Promise<Number>} Whether repo contains a tag named tagName
 */
const hasTag = function (repo, tagName) {
  return git.Tag.list(repo)
    .then((tag_names) => {
      return tag_names.indexOf(tagName) !== -1
    })
}

/**
 * Returns if the repo is on branch
 * @param {git.Repository} repo
 * @param {string} branchName
 * @returns {Promise<Boolean>} Whether the repo HEAD is pointing to branchName
 */
const isOnBranch = function (repo, branchName) {
  return repo.getReference(branchName)
    .then((branchRef) => git.Branch.isHead(branchRef))
}

const checkoutRef = function (repo, refName, strategy) {
  const options = new git.CheckoutOptions()
  options.checkoutStrategy = strategy

  return repo.getReference(refName)
    .then((ref) => repo.checkoutRef(ref, options))
}

/**
 * Force checkout to branchName and remove untracked files
 * @param {git.Repository} repo
 * @param {String} refName
 * @param {Promise<void>}
 */
const cleanCheckoutRef = function (repo, refName) {
  return checkoutRef(
    repo,
    refName,
    git.Checkout.STRATEGY.FORCE | git.Checkout.STRATEGY.RECREATE_MISSING | git.Checkout.STRATEGY.REMOVE_UNTRACKED)
}

/**
 * Force checkout to branchName
 * @param {git.Repository} repo
 * @param {string} refName
 * @returns {Promise<void>}
 */
const forceCheckoutRef = function (repo, refName) {
  return checkoutRef(
    repo,
    refName,
    git.Checkout.STRATEGY.FORCE | git.Checkout.STRATEGY.RECREATE_MISSING)
}

const createSubModuleAndWarnExisting = function (gitModule, subModuleName) {
  if (gitModule[subModuleName]) {
    console.error(subModuleName + ' already exists in nodegit')
  }

  return gitModule[subModuleName] = {}
}

const getSubModuleAndWarnMissing = function (gitModule, subModuleName) {
  const subModule = gitModule[subModuleName]
  if (!subModule) {
    console.error(subModuleName + ' is missing from nodegit')
    gitModule[subModuleName] = {}
  }

  return subModule
}

const overrideSubModuleMemeberAndWarn = function (subModule, subModuleName, member, memberName) {
  if (subModule[memberName]) {
    console.error(subModuleName + ' already has ' + memberName)
  }
  subModule[memberName] = member
}

function commit (repo, commitMessage, signature) {
  let index

  const getSignature = (repo) => {
    if (signature) {
      return Promise.resolve(signature)
    } else {
      // nodegit 0.24.1 defaultSignature is SYNC, but 0.26.1 is ASYNC
      // The extra resolve is used to make this implementation compatible across difference nodegit versions
      return Promise.resolve()
        .then(() => repo.defaultSignature())
    }
  }

  return repo.refreshIndex()
    .then((indexResult) => {
      index = indexResult
      let getParentsPromise

      if (repo.isEmpty() && index.entryCount() != 0) {
        getParentsPromise = () => Promise.resolve([])
      } else {
        getParentsPromise = () => {
          return repo.head()
            .then((ref) => repo.getReferenceCommit(ref))
            .then((baseCommitResult) => {
              return [baseCommitResult]
            })
        }
      }

      let parents

      return getParentsPromise()
        .then((parentsResult) => {
          parents = parentsResult
        })
        .then(() => {
          let checkShouldCommit

          if (parents.length === 0) {
            checkShouldCommit = () => Promise.resolve(true)
          } else {
            checkShouldCommit = () => {
              return parents[0].getTree()
                .then((baseTree) => {
                  return git.Diff.treeToIndex(repo, baseTree, null)
                })
                .then((diff) => {
                  return diff.numDeltas() !== 0
                })
            }
          }

          return checkShouldCommit()
        })
        .then((shouldCommit) => {
          if (shouldCommit) {
            return getSignature(repo)
              .then(sign => {
                return index.writeTree()
                  .then((indexTreeOid) => {
                    return repo.createCommit('HEAD', sign, sign, commitMessage, indexTreeOid, parents)
                  })
                  .then((commitOid) => {
                    return {
                      commitCreated: true,
                      commitOid: commitOid
                    }
                  })
              })
          } else {
            return {
              commitCreated: false,
              commitOid: parents.length === 0 ? 0 : parents[0].id()
            }
          }
        })
    })
}

const tagName = 'Tag'
const tag = getSubModuleAndWarnMissing(git, tagName)
overrideSubModuleMemeberAndWarn(tag, 'Tag', hasTag, 'hasTag')

const branchName = 'Branch'
const branch = getSubModuleAndWarnMissing(git, branchName)
overrideSubModuleMemeberAndWarn(branch, branchName, isOnBranch, 'isOnBranch')

const commandsName = 'Commands'
const commands = createSubModuleAndWarnExisting(git, commandsName)
overrideSubModuleMemeberAndWarn(commands, commandsName, forceCheckoutRef, 'forceCheckoutRef')
overrideSubModuleMemeberAndWarn(commands, commandsName, cleanCheckoutRef, 'cleanCheckoutRef')
overrideSubModuleMemeberAndWarn(commands, commandsName, commit, 'commit')

module.exports = git
