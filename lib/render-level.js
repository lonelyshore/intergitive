const fullVue = require('vue/dist/vue');
const overrideRequire = require('override-require');

// Setup a callback used to determine whether a specific `require` invocation
// needs to be overridden.
const isOverride = (request, parent) => {
  return request === 'vue';
};

// Setup a callback used to handle an overridden `require` invocation.
const resolveRequest = (request, parent) => {
  return fullVue;
};

overrideRequire(isOverride, resolveRequest);

const vue = require('vue');
const store = require('./store');

var app = new vue({
  el: '#level',
  data: {
    store: store,
  },
  computed: {
    levelState: function() {
      return this.store.state;
    },
    renderSteps: function () {
      return this.levelState.stepsReady ? this.levelState.renderSteps : [];
    },
    stepStates: function () {
      return this.levelState.stepsReady ? this.levelState.stepStates : {};
    }
  },
  created: function () {
    this.store.loadTerms()
      .then(() => {
        return this.store.loadCommonAssetRelativePaths();
      })
      .then(() => {
        return this.store.loadLevel('test');
      });
  },
  components: require('./step-components')
});