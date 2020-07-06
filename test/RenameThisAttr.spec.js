const { expect } = require('chai');
const j = require('jscodeshift');
const renameThisAttr = require('../src/RenameThisAttr');

describe('RenameThisAttr', () => {
    it('renames identifier member expressions', () => {
        const jsrc = j('this.foo = 1');
        renameThisAttr(jsrc, 'foo', 'bar');
        expect(jsrc.toSource()).to.equal('this.bar = 1');
    });

    it('renames literal member expressions', () => {
        const jsrc = j('this["foo"] = 1');
        renameThisAttr(jsrc, 'foo', 'bar');
        expect(jsrc.toSource()).to.equal('this["bar"] = 1');
    });

    it('renames variable destructurings', () => {
        const jsrc = j('const { foo } = this;');
        renameThisAttr(jsrc, 'foo', 'bar');
        expect(jsrc.toSource()).to.equal('const { bar: foo } = this;');
    });
});