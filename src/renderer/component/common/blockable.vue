<template>
    <div class="blockable" v-bind:blocked="isBlocked">
        <slot></slot>
    </div>
</template>

<script>
'use strict'

exports = module.exports = {
  computed: {
    isBlocked: function () {
      const levelState = this.$root.$data.store.state.levelState
      return levelState.stepStates[this.stepKey].state.isBlocked
    }
  },
  props: {
    stepKey: String
  }
}
</script>
