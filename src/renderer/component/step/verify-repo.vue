<template>
    <div class="level-block verify" v-bind:appending="appending">
        <div class="processing-box">
            <a v-if="!appending">{{ description }}</a>

            {{status}}: {{statusDescription}}

            <button
                v-on:click="operate"
                v-bind:disabled="isRunning"
                v-if="!isSuccess">
                {{buttonText}}
            </button>

            <img
                class="inline-img"
                v-if="isSuccess"
                v-bind:src="correctImagePath" />
        </div>

        <div v-if="isDebug">
            Current Phase: {{phase}}
            <button
                v-on:click="skip"
                style="pointer-events: visiblePainted;">
                SKIP
            </button>
        </div>
    </div>
</template>

<script>
'use strict'

const stepConfig = require('../../../common/config-step')
const Phase = stepConfig.UserDrivenProcessPhase

exports = module.exports = {
  data: function () {
    return {
      phase: Phase.IDLE
    }
  },
  computed: {
    store: function () {
      return this.$root.$data.store
    },
    levelState: function () {
      return this.store.state.levelState
    },
    description: function () {
      return this.levelState.terms.verifyRepoDescription
    },
    status: function () {
      return this.levelState.terms.operationStatus
    },
    statusDescription: function () {
      switch (this.phase) {
        case Phase.IDLE:
          return this.levelState.terms.operationReady

        case Phase.RUNNING:
          return this.levelState.terms.operationRunning

        case Phase.FAILED:
          return this.levelState.terms.operationFailed

        case Phase.SUCCESS:
          return this.levelState.terms.operationCompleted

        default:
          return `Please translate for ${this.phase}`
      }
    },
    buttonText: function () {
      return this.levelState.terms.startOperationButton
    },
    stepState: function () {
      return this.levelState.stepStates[this.stepKey]
    },
    appending: function () {
      if (this.stepKey === undefined) {
        return false
      } else {
        const renderStepIndex = this.levelState.renderSteps.indexOf(this.stepKey)

        if (renderStepIndex !== 0) {
          const previousKey = `${this.levelState.renderSteps[renderStepIndex - 1]}`
          const previousStep = this.levelState.stepStates[previousKey].step
          return previousStep instanceof stepConfig.InstructStep
        } else {
          return false
        }
      }
    },
    processState: function () {
      return this.stepState.state.processState
    },
    isDebug: function () {
      return this.levelState.isDebug
    },
    isRunning: function () {
      return this.phase === Phase.RUNNING
    },
    isSuccess: function () {
      return this.phase === Phase.SUCCESS
    },
    isFailed: function () {
      return this.phase === Phase.FAILED
    },
    isIdle: function () {
      return this.phase === Phase.IDLE
    },
    correctImagePath: function () {
      return this.levelState.commonAssetRelativePaths.imgCorrect
    }
  },
  props: {
    stepKey: String
  },
  created: function () {
    this.phase = Phase.IDLE
  },
  watch: {
    processState: function (val, oldVal) {
      if (val === stepConfig.ProcessState.PROCESS_COMPLETE) {
        this.store.unblock(this.stepKey)
      } else if (val === stepConfig.ProcessState.PROCESSING ||
                    val === stepConfig.ProcessState.PREPARE_PROCESS) {
        this.phase = Phase.IDLE
      }
    }
  },
  methods: {
    operate: function (event) {
      if (this.phase === Phase.RUNNING ||
                this.phase === Phase.SUCCESS) {
        return
      }

      this.phase = Phase.RUNNING

      this.store.verifyRepoEqual(this.stepKey)
        .then(success => {
          if (success) {
            this.phase = Phase.SUCCESS
            this.store.markProcessComplete(this.stepKey)
          } else {
            this.phase = Phase.FAILED
          }
        })
    },
    skip: function (event) {
      if (this.phase === Phase.RUNNING ||
                this.phase === Phase.SUCCESS) {
        return
      }

      this.phase = Phase.RUNNING

      this.store.loadRepoReferenceForVerifyStep(this.stepKey)
        .then(success => {
          if (success) {
            this.phase = Phase.SUCCESS
            this.store.markProcessComplete(this.stepKey)
          } else {
            this.phase = Phase.FAILED
          }
        })
    }
  }
}
</script>
