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

var app = new vue({
    el: '#level',
    data: {
      message: 'Hello Vue! KERKERKERKERKER NO KING'
    }
  });