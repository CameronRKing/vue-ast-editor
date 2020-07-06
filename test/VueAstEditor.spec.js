const { expect } = require('chai');
const VueAstEditor = require('../src/VueAstEditor.js');

describe('Vue AST Editor, which accepts a string and returns a collection of named ASTs with useful methods', () => {
    let asts;
    const inlineCmp = () => new VueAstEditor(`<script>
export default {}
</script>`);
    const getCmp = async () => {
        const parser = inlineCmp();
        await parser.ready();
        return parser;
    };
    beforeEach(async () => {
        asts = await getCmp();
    });

    it('sorts options in an opinionated way', async () => {
        const cmp = new VueAstEditor(`<script>
export default {
    methods: {},
    computed: {},
    watch: {},
    props: [],
    data() {},
    components: {},
    mixins: []
};
</script>`);
        await cmp.ready();

        expect(cmp.toString()).to.equal(`<script>
export default {
    mixins: [],
    components: {},
    props: [],
    data() {},
    computed: {},
    watch: {},
    methods: {}
};
</script>`)
    });

    describe('components', () => {
        it('imports components', () => {
            asts.importComponent('src/components/FooCmp.vue');
            expect(asts.toString()).to.equal(`<script>
import FooCmp from '@/components/FooCmp.vue';
export default {
    components: {
        FooCmp
    }
};
</script>`);
    });

        it('deports components', () => {
            asts.importComponent('src/components/FooCmp.vue');
            asts.deportComponent('FooCmp');
            expect(asts.toString()).to.equal(`<script>
export default {}
</script>`)
        });
    });

    describe('props', () => {
        it('adds props', () => {
            asts.addProp('foo');
            expect(asts.toString()).to.equal(`<script>
export default {
    props: ['foo']
};
</script>`);

            asts.updateProp('foo', { default: 'true' });
            asts.addProp('bar');
            expect(asts.toString()).to.equal(`<script>
export default {
    props: {
        foo: {
            default: true
        },
        bar: {}
    }
};
</script>`)
        });

        it('renames props', async () => {
            // definition
            const cmp = new VueAstEditor(`<script>
export default {
    props: ['foo'],
    methods: {
        usesFoo() {
            console.log(this.foo);
            this['foo'] = 1;
            const { foo } = this;
        },
        doesntUseFoo() {
            const foo = 'foo';
        }
    }
}</script>

<template>
<div attr="foo" :class="foo" @click="() => console.log(foo)"></div>
</template>`)
            await cmp.ready();
            cmp.renameProp('foo', 'bar');
            expect(cmp.toString()).to.equal(`<script>
export default {
    props: ['bar'],
    methods: {
        usesFoo() {
            console.log(this.bar);
            this['bar'] = 1;
            const { bar: foo } = this;
        },
        doesntUseFoo() {
            const foo = 'foo';
        }
    }
}</script>

<template>
<div
    attr="foo"
    :class="bar"
    @click="() => console.log(bar)"
></div>
</template>`);

            cmp.updateProp('bar', { default: 'true' });
            cmp.renameProp('bar', 'baz');
            expect(cmp.toString()).to.equal(`<script>
export default {
    props: {
        baz: {
            default: true
        }
    },
    methods: {
        usesFoo() {
            console.log(this.baz);
            this['baz'] = 1;
            const { baz: foo } = this;
        },
        doesntUseFoo() {
            const foo = 'foo';
        }
    }
}</script>

<template>
<div
    attr="foo"
    :class="baz"
    @click="() => console.log(baz)"
></div>
</template>`)
        });

        it('updates required/default/type/validator', () => {
            asts.addProp('foo');
            asts.updateProp('foo', {
                required: 'true',
                default: `'irrelevant'`,
                type: 'String',
                validator: `(val) => val == 'secret-key'`
            });
            expect(asts.toString()).to.equal(`<script>
export default {
    props: {
        foo: {
            required: true,
            default: 'irrelevant',
            type: String,
            validator: (val) => val == 'secret-key'
        }
    }
};
</script>`);
            // set the attribute to null to remove it
            asts.updateProp('foo', {
                required: null,
                default: null,
                type: null,
                validator: null
            });

            expect(asts.toString()).to.equal(`<script>
export default {
    props: ['foo']
};
</script>`);
        });

        it('removes props', () => {
            asts.addProp('foo');
            asts.removeProp('foo');
            expect(asts.toString()).to.equal(`<script>
export default {}
</script>`);
        });
    });

    describe('data', () => {
        it('adds data', () => {
            asts.addData('foo', `'bar'`);
            expect(asts.toString()).to.equal(`<script>
export default {
    data() {
        return {
            foo: 'bar'
        };
    }
};
</script>`);
        });

        it('renames data', async () => {
            const cmp = new VueAstEditor(`<script>
export default {
    data() {
        return {
            foo: true
        };
    },
    methods: {
        usesFoo() {
            console.log(this.foo);
            this['foo'] = 1;
            const { foo } = this;
        },
        doesntUseFoo() {
            const foo = 'foo';
        }
    }
}</script>

<template>
<div
    attr="foo"
    :class="foo"
    @click="() => console.log(foo)"
></div>
</template>`);
            await cmp.ready();
            cmp.renameData('foo', 'bar');
            expect(cmp.toString()).to.equal(`<script>
export default {
    data() {
        return {
            bar: true
        };
    },
    methods: {
        usesFoo() {
            console.log(this.bar);
            this['bar'] = 1;
            const { bar: foo } = this;
        },
        doesntUseFoo() {
            const foo = 'foo';
        }
    }
}</script>

<template>
<div
    attr="foo"
    :class="bar"
    @click="() => console.log(bar)"
></div>
</template>`)
        })

        it('sets data', () => {
            asts.addData('bar', `'initial-value'`);
            asts.setData('bar', `'new-value'`);
            expect(asts.toString()).to.equal(`<script>
export default {
    data() {
        return {
            bar: 'new-value'
        };
    }
};
</script>`)
        });

        it('removes data', () => {
            asts.addData('bar', `'value'`);
            asts.removeData('bar');
            expect(asts.toString()).to.equal(`<script>
export default {}
</script>`);
        });
    });

    describe('watchers', () => {
        it('adds watchers', () => {
            asts.addWatcher('foo');
            expect(asts.toString()).to.equal(`<script>
export default {
    watch: {
        foo(newVal, oldVal) {}
    }
};
</script>`)
        });

        it('renames watchers', () => {
            asts.addWatcher('foo');
            asts.renameWatcher('foo', 'bar');
            expect(asts.toString()).to.equal(`<script>
export default {
    watch: {
        bar(newVal, oldVal) {}
    }
};
</script>`);

            asts.updateWatcher('bar', { deep: true });
            asts.renameWatcher('bar', 'baz');
            expect(asts.toString()).to.equal(`<script>
export default {
    watch: {
        baz: {
            handler(newVal, oldVal) {},
            deep: true
        }
    }
};
</script>`)
        });

        it('configures deep/immediate', () => {
            asts.addWatcher('foo');
            asts.updateWatcher('foo', { deep: true, immediate: true });
            expect(asts.toString()).to.equal(`<script>
export default {
    watch: {
        foo: {
            handler(newVal, oldVal) {},
            deep: true,
            immediate: true
        }
    }
};
</script>`);

            asts.updateWatcher('foo', { deep: null, immediate: null });
            expect(asts.toString()).to.equal(`<script>
export default {
    watch: {
        foo(newVal, oldVal) {}
    }
};
</script>`);
        });

        it('removes watchers', () => {
            asts.addWatcher('foo');
            asts.removeWatcher('foo');
            expect(asts.toString()).to.equal(`<script>
export default {}
</script>`);

            asts.addWatcher('bar');
            asts.updateWatcher('bar', { deep: true, immediate: true });
            asts.removeWatcher('bar');
            expect(asts.toString()).to.equal(`<script>
export default {}
</script>`);
        });
    });

    describe('computed properties', () => {
        it('adds computed', () => {
            asts.addComputed('foo');
            expect(asts.toString()).to.equal(`<script>
export default {
    computed: {
        foo() {}
    }
};
</script>`);
        });

        it('renames computed', async () => {
            const cmp = new VueAstEditor(`<script>
export default {
    computed: {
        foo() {}
    },
    methods: {
        usesFoo() {
            console.log(this.foo);
        }
    }
};
</script>

<template>
<div :class="foo" attr="foo">{{ foo }}</div>
</template>`);
            await cmp.ready();
            cmp.renameComputed('foo', 'bar');
            expect(cmp.toString()).to.equal(`<script>
export default {
    computed: {
        bar() {}
    },
    methods: {
        usesFoo() {
            console.log(this.bar);
        }
    }
};
</script>

<template>
<div
    :class="bar"
    attr="foo"
>{{ bar }}</div>
</template>`)
        });

        it('updates setter', () => {
            asts.addComputed('foo');
            asts.addComputedSetter('foo');
            expect(asts.toString()).to.equal(`<script>
export default {
    computed: {
        foo: {
            get() {},
            set(newValue) {
                this.foo = newValue;
            }
        }
    }
};
</script>`);

            asts.removeComputedSetter('foo');
            expect(asts.toString()).to.equal(`<script>
export default {
    computed: {
        foo() {}
    }
};
</script>`);
        });

        it('removes computed', () => {
            asts.addComputed('foo');
            asts.removeComputed('foo');
            expect(asts.toString()).to.equal(`<script>
export default {}
</script>`);

            asts.addComputed('bar');
            asts.addComputedSetter('bar');
            asts.removeComputed('bar');
            expect(asts.toString()).to.equal(`<script>
export default {}
</script>`);
        });
    });

    describe('methods', () => {
        it('adds methods', () => {
            asts.addMethod('foo');
            expect(asts.toString()).to.equal(`<script>
export default {
    methods: {
        foo() {}
    }
};
</script>`);
        });

        it('renames methods', async () => {
            const cmp = new VueAstEditor(`<script>
export default {
    methods: {
        foo() {},
        usesFoo() {
            console.log(this.foo());
        }
    }
};
</script>

<template>
<div @click="foo" attr="foo">{{ foo() }}</div>
</template>`);
            await cmp.ready();
            cmp.renameMethod('foo', 'bar');
            expect(cmp.toString()).to.equal(`<script>
export default {
    methods: {
        bar() {},
        usesFoo() {
            console.log(this.bar());
        }
    }
};
</script>

<template>
<div
    @click="bar"
    attr="foo"
>{{ bar() }}</div>
</template>`)
        });

        it('removes methods', () => {
            asts.addMethod('foo');
            asts.removeMethod('foo');
            expect(asts.toString()).to.equal(`<script>
export default {}
</script>`);
        });
    });

    describe('lifecycle hooks', () => {
        it('adds hooks', () => {
            asts.addHook('mounted');
            expect(asts.toString()).to.equal(`<script>
export default {
    mounted() {}
};
</script>`);
        });

        it('removes hooks', () => {
            asts.addHook('mounted');
            asts.removeHook('mounted');
            expect(asts.toString()).to.equal(`<script>
export default {}
</script>`);
        });
    });

    describe('component refactoring', () => {
        it('creates new components', async () => {
            const cmp = new VueAstEditor(`<script>
export default {}
</script>

<template>
<div class="my-class" v-if="true">
    <span>I am the slot contents</span>
</div>
</template>`);
            await cmp.ready();
            const node = cmp.filterHAST({ tag: 'div' })[0];
            const newCmp = await cmp.refactorIntoComponent(node, 'src/MyDiv.vue', ['class']);
            expect(cmp.toString()).to.equal(`<script>
import MyDiv from '@/MyDiv.vue';
export default {
    components: {
        MyDiv
    }
};
</script>

<template>
<MyDiv v-if="true">
    <span>I am the slot contents</span>
</MyDiv>
</template>`);
            expect(newCmp.toString()).to.equal(`<script>
export default {}
</script>

<template>
<div class="my-class">
    <slot></slot>
</div>
</template>`);
        });


        it('pushes HTML above a slot', async () => {
            const cmp = new VueAstEditor(`<script>
export default {}
</script>

<template>
<MyDiv>
    <span>This will be pushed into the component.</span>
    <p>This won't be pushed into the component.</p>
</MyDiv>
</template>`);
            await cmp.ready();
            const hostCmp = new VueAstEditor(`<script>
export default {}
</script>

<template>
<div>
    <slot></slot>
</div>
</template>`);
            await hostCmp.ready();
            const node = cmp.filterHAST({ tag: 'span' })[0];

            cmp.pushAboveSlot(node, hostCmp);

            expect(cmp.toString()).to.equal(`<script>
export default {}
</script>

<template>
<MyDiv>
    <p>This won't be pushed into the component.</p>
</MyDiv>
</template>`);
            expect(hostCmp.toString()).to.equal(`<script>
export default {}
</script>

<template>
<div>
    <span>This will be pushed into the component.</span>
    <slot></slot>
</div>
</template>`);
        });

        it('pushes HTML below a slot', async () => {
            const cmp = new VueAstEditor(`<script>
export default {}
</script>

<template>
<MyDiv>
    <span>This will be pushed into the component.</span>
    <p>This won't be pushed into the component.</p>
</MyDiv>
</template>`);
            await cmp.ready();
            const hostCmp = new VueAstEditor(`<script>
export default {}
</script>

<template>
<div>
    <slot></slot>
</div>
</template>`);
            await hostCmp.ready();
            const node = cmp.filterHAST({ tag: 'span' })[0];

            cmp.pushBelowSlot(node, hostCmp);

            expect(cmp.toString()).to.equal(`<script>
export default {}
</script>

<template>
<MyDiv>
    <p>This won't be pushed into the component.</p>
</MyDiv>
</template>`);
            expect(hostCmp.toString()).to.equal(`<script>
export default {}
</script>

<template>
<div>
    <slot></slot>
    <span>This will be pushed into the component.</span>
</div>
</template>`);
        });

        it('pushes HTML around (wrapping) a slot', async () => {
            const cmp = new VueAstEditor(`<script>
export default {}
</script>

<template>
<MyDiv>
    <span slot="my-slot" class="ill-be-taken">I'll be left behind.</span>
</MyDiv>
</template>`);
            await cmp.ready();
            const hostCmp = new VueAstEditor(`<script>
export default {}
</script>

<template>
<div>
    <slot></slot>
    <slot name="my-slot"></slot>
</div>
</template>`);
            await hostCmp.ready();
            const node = cmp.filterHAST({ tag: 'span' })[0];

            cmp.pushAroundSlot(node, hostCmp);

            expect(cmp.toString()).to.equal(`<script>
export default {}
</script>

<template>
<MyDiv>
    I'll be left behind.
</MyDiv>
</template>`);
            expect(hostCmp.toString()).to.equal(`<script>
export default {}
</script>

<template>
<div>
    <slot></slot>
    <span
        class="ill-be-taken"
    ><slot name="my-slot"></slot></span>
</div>
</template>`);
        });

        it('pushes HTML into a slot (as default content)', async () => {
            const cmp = new VueAstEditor(`<script>
export default {}
</script>

<template>
<MyDiv>
    <span slot="my-slot">Default content</span>
</MyDiv>
</template>`);
            await cmp.ready();
            const hostCmp = new VueAstEditor(`<script>
export default {}
</script>

<template>
<div>
    <slot></slot>
    <slot name="my-slot"></slot>
</div>
</template>`);
            await hostCmp.ready();
            const node = cmp.filterHAST({ tag: 'span' })[0];

            cmp.pushIntoSlot(node, hostCmp);

            expect(cmp.toString()).to.equal(`<script>
export default {}
</script>

<template>
<MyDiv>
</MyDiv>
</template>`);
            expect(hostCmp.toString()).to.equal(`<script>
export default {}
</script>

<template>
<div>
    <slot></slot>
    <slot name="my-slot">
        <span>Default content</span>
    </slot>
</div>
</template>`);
        });

        it('pushes HTML into a new slot', async () => {
            const cmp = new VueAstEditor(`<script>
export default {}
</script>

<template>
<MyDiv>
    <span>I'll stay here</span>
    <p>And I'll go into a new slot</p>
</MyDiv>
</template>`);
            await cmp.ready();

            const hostCmp = new VueAstEditor(`<script>
export default {}
</script>

<template>
<div>
    <slot></slot>
</div>
</template>`);
            await hostCmp.ready();

            const node = cmp.filterHAST({ tag: 'p' })[0];
            cmp.pushIntoNewSlot(node, 'my-slot', hostCmp);

            expect(cmp.toString()).to.equal(`<script>
export default {}
</script>

<template>
<MyDiv>
    <span>I'll stay here</span>
    <p slot="my-slot">And I'll go into a new slot</p>
</MyDiv>
</template>`);

            expect(hostCmp.toString()).to.equal(`<script>
export default {}
</script>

<template>
<div>
    <slot></slot>
    <slot name="my-slot"></slot>
</div>
</template>`);
            
        });

        it('pushes components', async () => {
            const donor = new VueAstEditor(`<script>
import MyDiv from '@/MyDiv.vue';
export default {
    components: {
        MyDiv
    }
};
</script>`);
            await donor.ready();

            const host = new VueAstEditor(`<script>
export default {}
</script>`);
            await host.ready();

            donor.pushComponent('MyDiv', host);

            expect(donor.toString()).to.equal(`<script>
export default {};
</script>`);
            expect(host.toString()).to.equal(`<script>
import MyDiv from '@/MyDiv.vue';
export default {
    components: {
        MyDiv
    }
};
</script>`);
        });

        it('pushes data', async () => {
            const donor = new VueAstEditor(`<script>
export default {
    data() {
        return {
            foo: 'foo',
            bar: 'bar',
            baz: 'baz'
        };
    }
};
</script>`);
            await donor.ready();

            const host = new VueAstEditor(`<script>
export default {}
</script>`);
            await host.ready();

            donor.pushData('foo', host);

            expect(donor.toString()).to.equal(`<script>
export default {
    data() {
        return {
            bar: 'bar',
            baz: 'baz'
        };
    }
};
</script>`);
            expect(host.toString()).to.equal(`<script>
export default {
    data() {
        return {
            foo: 'foo'
        };
    }
};
</script>`);

            donor.pushData(['bar', 'baz'], host);

            expect(donor.toString()).to.equal(`<script>
export default {};
</script>`);
            expect(host.toString()).to.equal(`<script>
export default {
    data() {
        return {
            foo: 'foo',
            bar: 'bar',
            baz: 'baz'
        };
    }
};
</script>`)
        });

        it('pushes computed', async () => {
            const donor = new VueAstEditor(`<script>
export default {
    computed: {
        foo() { return 42; }
    }
};
</script>`);
            await donor.ready();

            const host = new VueAstEditor(`<script>
export default {}
</script>`);
            await host.ready();

            donor.pushComputed('foo', host);

            expect(donor.toString()).to.equal(`<script>
export default {};
</script>`);
            expect(host.toString()).to.equal(`<script>
export default {
    computed: {
        foo() { return 42; }
    }
};
</script>`);
        });
        
        it('pushes watchers', async () => {
            const donor = new VueAstEditor(`<script>
export default {
    watch: {
        foo(newVal, oldVal) {
            console.log(newVal);
        }
    }
};
</script>`);
            await donor.ready();

            const host = new VueAstEditor(`<script>
export default {}
</script>`);
            await host.ready();

            donor.pushWatcher('foo', host);

            expect(donor.toString()).to.equal(`<script>
export default {};
</script>`);
            expect(host.toString()).to.equal(`<script>
export default {
    watch: {
        foo(newVal, oldVal) {
            console.log(newVal);
        }
    }
};
</script>`);
        });
        
        it('pushes methods', async () => {
            const donor = new VueAstEditor(`<script>
export default {
    methods: {
        foo() {}
    }
}
</script>`);
            await donor.ready();

            const host = new VueAstEditor(`<script>
export default {}
</script>`);
            await host.ready();

            donor.pushMethod('foo', host);

            expect(donor.toString()).to.equal(`<script>
export default {};
</script>`);
            expect(host.toString()).to.equal(`<script>
export default {
    methods: {
        foo() {}
    }
};
</script>`);
        });
    });
});