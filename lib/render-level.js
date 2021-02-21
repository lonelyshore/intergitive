const fullVue = require('vue/dist/vue.common');
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

const Vue = require('vue');
const store = require('./store')
const paths = require('./paths');

const page = require('./component/page-components');
const navBar = require('./component/page/nav-bar');

var app = new Vue({
    el: '#main',
    data: {
        store: store,
    },
    computed: {
        currentPage: function() {
            return this.store.courseState.isReady ? this.store.state.pageState.displayingNode : null;
        }
    },
    created: function () {
        this.store.loadTerms()
        .then(() => {
            return this.store.loadCommonAssetRelativePaths();
        })
        .then(() => {
            return this.store.loadCourse(paths.course);
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