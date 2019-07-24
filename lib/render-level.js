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
    state: store.state
  },
  computed: {
    renderSteps: function () {
      return this.state.stepsReady ? this.state.renderSteps : [];
    },
    stepStates: function () {
      return this.state.stepsReady ? this.state.stepStates : {};
    }
  },
  created: function () {
    store.loadTerms()
      .then(() => {
        return store.loadLevel('test');
      });

    if (process.argv.indexOf("debug") !== -1) {
      store.state.isDebug = true;
    }
  },
  components: require('./step-components')
});