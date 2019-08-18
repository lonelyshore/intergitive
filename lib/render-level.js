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
const level = require('./component/page/level');
const store = require('./store');

var app = new vue({
  el: '#main',
  data: {
    store: store,
  },
  computed: {
  },
  created: function () {
    this.store.loadTerms()
      .then(() => {
        return this.store.loadCommonAssetRelativePaths();
      })
      .then(() => {
        return this.store.loadLevel('local');
      });
  },
  
  render(h) {
    return h(level, {
      props: {
        levelState: this.store.state.levelState
      }
    });
  }
});