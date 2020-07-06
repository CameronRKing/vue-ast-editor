const posthtml = require('posthtml');
const { expect } = require('chai');
const renameAttrInHtml = require('../src/RenameAttrInHtml');

describe('RenameAttrInHtml', () => {
    it('looks for an identifier in Vue attributes and renames it', async () => {
        const res = await posthtml().process('<div class="foo" :class="foo" @click="console.log(foo)" v-for="item in foo"></div>');
        renameAttrInHtml(res.tree, 'foo', 'bar');
        expect(res.html).to.equal('<div class="foo" :class="bar" @click="console.log(bar)" v-for="item in bar"></div>');
    });

    it('renames the identifier in text templates', async () => {
        const res = await posthtml().process('<div>{{ foo }} {{ JSON.stringify(foo) }}</div>');
        renameAttrInHtml(res.tree, 'foo', 'bar');
        expect(res.html).to.equal('<div>{{ bar }} {{ JSON.stringify(bar) }}</div>');
    });
});