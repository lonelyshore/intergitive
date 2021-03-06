'use strict'

const path = require('path')
const fs = require('fs-extra')
const assert = require('assert')

const yaml = require('js-yaml')
const chai = require('chai')
const chaiAsPromised = require('chai-as-promised')

const utils = require('./test-utils')
const { typeCheck } = require('../../src/common/utility')
const { LEVEL_CONFIG_SCHEMA } = require('../../src/common/level-config-schema')
const stepConfigs = require('../../src/common/config-step')
const actionConfigs = require('../../src/common/config-action')

chai.use(chaiAsPromised)
chai.should()

/**
 * This test fixture ensures that serialization of level configuration
 * has the following properties:
 * 1. All defined step types (in config-step.js) and actions types (in lib/config-actino.js)
 *    can be serialized and deserialized via YAML
 * 2. The YAML serialization is stable.
 *    The object deserialized from a text equals to the one that generates the text.
 */
describe('Level Serialization #core', function () {
  let sampleSteps = []
  let sampleActions = []
  let allStepTypes
  let allActionTypes

  before('Loads Sample Steps and Actions', function () {
    return fs.readFile(
      path.join(
        utils.RESOURCES_PATH,
        'serialization',
        'sample-steps.yaml'
      )
    )
      .then(content => {
        sampleSteps = yaml.load(content, { schema: LEVEL_CONFIG_SCHEMA })
      })
      .then(() => fs.readFile(
        path.join(
          utils.RESOURCES_PATH,
          'serialization',
          'sample-actions.yaml'
        )
      ))
      .then(content => {
        sampleActions = yaml.load(content, { schema: LEVEL_CONFIG_SCHEMA })
      })
  })

  before('Prepare Step and Action Types', function () {
    allStepTypes = Object.assign({}, stepConfigs)
    delete allStepTypes.Step
    delete allStepTypes.ProcessState
    delete allStepTypes.AutoFirstProcessPhase
    delete allStepTypes.UserDrivenProcessPhase

    allActionTypes = Object.assign({}, actionConfigs)
    delete allActionTypes.Action
  })

  describe('Validate Test Coverage Rate', function () {
    function assertConsumeAllTypes (deserializedObjects, typeMapping) {
      const unconsumed = new Set(Object.keys(typeMapping))

      deserializedObjects.forEach(obj => {
        const typeName = obj.constructor.name
        if (unconsumed.has(typeName)) {
          unconsumed.delete(typeName)
        }
      })

      assert(unconsumed.size === 0, `unconsumed: {${Array.from(unconsumed).join(', ')}`)
    }

    it('Sample steps covers all defiend steps', function () {
      assertConsumeAllTypes(
        sampleSteps,
        allStepTypes
      )
    })

    it('Sample actions covers all defiend actions', function () {
      assertConsumeAllTypes(
        sampleActions,
        allActionTypes
      )
    })
  })

  it('GENERATE_TESTS', function () {
    createTestsForSampleObjects(sampleSteps, allStepTypes)
    createTestsForSampleObjects(sampleActions, allActionTypes)
  })
})

function createTestsForSampleObjects (sampleObjects, refTypes) {
  describe('Validate Serialization', function () {
    sampleObjects.forEach(obj => {
      it(obj.constructor.name, function () {
        return Promise.resolve()
          .then(() => yaml.dump(obj, { schema: LEVEL_CONFIG_SCHEMA }))
          .should.eventually.be.fulfilled
      })
    })
  })

  describe('Validate Deserialized Equals Original', function () {
    sampleObjects.forEach(obj => {
      it(obj.constructor.name, function () {
        return Promise.resolve()
          .then(() => {
            const another = yaml.load(
              yaml.dump(
                obj,
                { schema: LEVEL_CONFIG_SCHEMA }
              ),
              { schema: LEVEL_CONFIG_SCHEMA }
            )

            return equals(obj, another)
          })
          .should.eventually.be.true
      })
    })

    function equals (a, b) {
      if (a === undefined) {
        return b === undefined
      } else if (a === null) {
        return b === null
      } else if (typeCheck.isNumber(a)) {
        assert(typeCheck.isNumber(b), 'b should be a number, too')

        return Math.abs(a - b) < 0.01
      } else if (typeCheck.isString(a)) {
        assert(typeCheck.isString(b), 'b should be a string, too')

        return a === b
      } else if (typeCheck.isBool(a)) {
        assert(typeCheck.isBool(b), 'b should be a bool, too')

        return a === b
      } else if (typeCheck.isArray(a)) {
        assert(typeCheck.isArray(b), 'b should be an array, too')

        return a.length === b.length &&
                    a.map((itemA, index) => {
                      return equals(itemA, b[index])
                    }).every(result => result)
      } else {
        const propNames = Object.keys(a)

        if (a instanceof stepConfigs.Step) {
          assert(b instanceof stepConfigs.Step)

          // Because some steps uses getter & setter to force
          // its subclass initialize "actions" or "appendCheckpoint",
          // these properties cannot be detected by Object.keys.
          // Please refer to "hasActionStep" and "mayAppendCheckpointStep" in config-step.js
          if ('actions' in a) {
            propNames.push('actions')
          }
          if ('appendCheckpoint' in a) {
            propNames.push('appendCheckpoint')
          }

          assert('createInitialState' in a)
          assert('createInitialState' in b)
        }

        if (a instanceof actionConfigs.Action) {
          assert(b instanceof actionConfigs.Action)
          assert('executeBy' in a)
          assert('executeBy' in b)
        }

        return propNames.map(propName => {
          return propName in a &&
                        propName in b &&
                        equals(a[propName], b[propName])
        })
          .every(ret => ret)
      }
    }
  })
}
