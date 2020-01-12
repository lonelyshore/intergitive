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
const paths = require('../paths');

const page = require('./component/page-components');
const navBar = require('./component/page/nav-bar');

var app = new vue({
    el: '#main',
    data: {
        store: store,
    },
    computed: {
        currentPage: function() {
            return this.store.courseState.isReady ? this.store.pageState.displayingNode : null;
        }
    },
    created: function () {
        this.store.loadTerms()
        .then(() => {
            return this.store.loadCommonAssetRelativePaths();
        })
        .then(() => {
            return this.store.loadCourse(paths.COURSE);
        })
        .then(() => {
            this.store.navigate(this.store.courseState.courseTree);
        });
    },
    render(h) {
        if (this.currentPage !== null) {
            return h(
                'div',
                [
                    h(
                        navBar,
                        {
                            props: {
                                pageState: this.store.state.pageState
                            }
                        }
                    ),
                    h(
                        page[this.currentPage.renderComponent],
                        {
                            props: {
                                levelState: this.store.state.levelState,
                                courseState: this.store.state.courseState,
                                pageState: this.store.state.pageState
                            }
                        }
                    )
                ]
            );
        }
        else {
            return h('div');
        }
    }
});