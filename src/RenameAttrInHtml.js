const j = require('jscodeshift');
const { pairs, mapWithKeys } = require('./utils');
/**
 * Given an HTML AST, looks for Vue HTML attributes that use the given JS attribute (prop, data, method, etc.)
 * And updates the value of the HTML attributes to reflect the new name
 * @param {*} hast 
 * @param {String} name 
 * @param {String} newName 
 */
module.exports = function renameAttrInHtml(hast, name, newName) {
   renameInHtmlAttributes(hast, name, newName);
   renameInTextTemplates(hast, name, newName);
}

function renameInHtmlAttributes(hast, name, newName) {
    hast.match({ tag: /.*/ }, node => {
        if (!node.attrs) return node;
        const vueAttrs = pairs(node.attrs).filter(([key, val]) => key.includes(':') || key.includes('@') || key.includes('v-'));
        const parsedAttrs = vueAttrs.map(([key, val]) => [key, j(val)]);
        const renamedAttrs = parsedAttrs.map(([key, jsrc]) => {
            replaceIdentifiers(jsrc, name, newName);
            return [key, jsrc];
        });
        renamedAttrs.forEach(([key, jsrc]) => {
            node.attrs[key] = jsrc.toSource({ quote: 'single' })
        });
        return node;
    });
}

function replaceIdentifiers(jsrc, name, newName) {
    jsrc.find(j.Identifier, { name }).map(path => {
        path.replace(j.identifier(newName));
        return path;
    });
}

function renameInTextTemplates(hast, name, newName) {
    hast.match({ tag: /.*/ }, node => {
        if (!(node.content && node.content.length > 0)) return node;
        node.content = node.content.map(child => {
            if (typeof child !== 'string') return child;
            if (!child.match('{{([^}]+)}}')) return child;
            // I need to find, parse, update, and replace the template innards
            // assuming that the HTML doesn't naturally contain {{
            const statements = child.split('{{');
            const updated = statements.slice(1).map(statement => {
                const [expression, trailing] = statement.split('}}');
                const jsrc = j(expression);
                replaceIdentifiers(jsrc, name, newName);
                return '{{' + jsrc.toSource({ quote: 'single' }) + '}}' + trailing;
            });
            return statements[0] + updated.join('');
        });
        return node;
    });
}