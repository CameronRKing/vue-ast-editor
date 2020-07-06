const j = require('jscodeshift');
const posthtml = require('posthtml');
const { render } = require('./htmlrender');
const { findObjProp, toSource, getDefaultExport, objProp, addToTop, parse, object } = require('./node-utils');
const { mapWithKeys, pairs, remove } = require('./utils');
const renameThisAttr = require('./RenameThisAttr');
const renameAttrInHtml = require('./RenameAttrInHtml');

function emptyFunc() {
    return j.functionExpression(null, [], j.blockStatement([]));
}

module.exports = class VueAstEditor {
    constructor(text) {
        // ideally this would be synchronous, but the HTML tree returned by synchronous parser does not have the same methods
        this.isDone = new Promise(resolve => {
            posthtml().process(text, { recognizeSelfClosing: true, closingSingleTag: 'slash', render }).then(results => {
                this.results = results;
                this.tree = results.tree;
                this.script = undefined;
                this.addParentsToHtmlTree();
                results.tree.match({ tag: 'script' }, node => {
                    this.scriptNode = node;
                    // node.content may be an array of strings instead of one string
                    // since the JS code is represented as a JS string, slashes need to be double-escaped
                    // else you get "unterminated string constant" errors because
                    // the slashes get used up by the parser
                    let content = node.content.join('').replace(/\\/g, '\\\\');
                    this.script = j(content);
                    return node;
                });
                let found = false;
                results.tree.match({ tag: 'template' }, node => {
                    if (found) return node;
                    found = true;
                    this.template = node;
                    return node;
                });
                if (!this.script) this.script = j('');
                resolve();
            });
        });
    }

    ready() {
        return this.isDone;
    }

    addParentsToHtmlTree() {
        this.tree.walk(node => {
            if (!node.content) return node;
            node.content.forEach(child => {
                if (typeof child == 'object') child.parent = node;
            });
            return node;
        });
    }

    /**
     * Returns an array of HTML AST nodes that match the given filter
     * Semantics are the same as posthtml.tree.match
     * @param {Object} filter 
     */
    filterHAST(filter) {
        const nodes = [];
        this.tree.match(filter, node => {
            nodes.push(node);
            return node;
        });
        return nodes;
    }

    /**
     * Looks for the given option in the Vue component.
     * Returns if found.
     * Initializes with default value and returns if not.
     * @param {String} name 
     * @returns {Collection} option
     */
    option(name) {
        let node = this.findOption(name);
        if (!node.length) {
            const prop = this.makeOptionProp(name);
            getDefaultExport(this.script).get().value.properties.push(prop);
            node = j(prop);
        }
    
        return node;
    }

    findOption(name) {
        return findObjProp(getDefaultExport(this.script), name);
    }

    makeOptionProp(name) {
        switch (name) {
            case 'data':
                return objProp(name, j.functionExpression(null, [],
                    j.blockStatement([
                        j.returnStatement(
                            j.objectExpression([])
                        )
                    ])
                ), { method: true });
            case 'props':
                return objProp(name, j.arrayExpression([]));
            default:
                return objProp(name, object());
        }
    }

    sortOptions() {
        // ignoring hooks for now
        // I don't feel like looking them up in this moment and I rarely use them, other than mounted
        const nonHookOptions = [
            'mixins',
            'components',
            'props',
            'data',
            'computed',
            'watch',
            'mounted',
            'methods'
        ];

        let currSlot = 0;
        const defaultExport = getDefaultExport(this.script).get().value;
        nonHookOptions.forEach(option => {
            const prop = defaultExport.properties.find(prop => prop.key.name == option);
            if (!prop) return;
            remove(defaultExport.properties, prop);
            defaultExport.properties.splice(currSlot++, 0, prop);
        });
    }

    /**
     * Removes the given property from the given option.
     * If the option has no more properties, it is removed from the component.
     * @param {String} option 
     * @param {String} name 
     */
    removeFromOption(optionName, name) {
        const option = this.option(optionName);
        option.find(j.Property, { key: { name } }).remove();
        if (option.find(j.Property).length == 0) option.remove();
    }

    /**
     * Looks for references to the given attribute in the script and the HTML and renames them.
     * @param {String} name 
     * @param {String} newName 
     */
    renameAttribute(name, newName) {
        renameThisAttr(this.script, name, newName);
        renameAttrInHtml(this.tree, name, newName);
    }

    /**
     * Given a component path relative to the project root,
     * imports that component.
     * @param {String} path 
     */
    importComponent(path) {
        const cmpName = path.split('/').slice(-1)[0].split('.')[0];
        // ideally, we should be able to pull aliases out of wherever they are defined
        // but for now, hardwiring the default src alias is okay
        const aliasedPath = path.replace('src', '@');

        addToTop(this.script, parse(`import ${cmpName} from '${aliasedPath}';`));

        const components = this.option('components');
        const cmpProp = objProp(cmpName, j.identifier(cmpName), { shorthand: true });
        components.get().value.value.properties.push(cmpProp);
    }

    /**
     * Returns an  object where key is name of component and value is true
     * Returns an object instead of an array for consistency with similar methods
     */
    components() {
        return mapWithKeys(
            this.option('components').get().value.value.properties,
            prop => [prop.key.name, true]
        );
    }

    deportComponent(name) {
        this.script.find(j.ImportDefaultSpecifier, { local: { name } })
            .closest(j.ImportDeclaration)
            .remove();

        this.removeFromOption('components', name);
    }

    addProp(name) {
        const props = this.option('props').get().value;

        if (props.value.type == 'ArrayExpression') {
            props.value.elements.push(j.literal(name));
        } else {
            props.value.properties.push(objProp(name, object()));
        }
    }

    renameProp(name, newName) {
        const props = this.option('props').get().value;
        if (props.value.type == 'ArrayExpression') {
            props.value.elements.filter(el => el.value == name)[0].value = newName;
        } else {
            props.value.properties.filter(prop => prop.key.name == name)[0].key.name = newName;
        }
        this.renameAttribute(name, newName);
    }

    /**
     * Returns an object where key is prop name and value is the AST node for configuration || null
     */
    props() {
        const props = this.option('props').get().value.value;
        if (props.type == 'ArrayExpression') {
            return mapWithKeys(props.elements, prop => [prop.value, null]);
        } else {
            return mapWithKeys(props.properties, prop => [prop.key.name, prop.value]);
        }
    }

    removeProp(name) {
        const props = this.option('props');
        
        if (props.get().value.value.type == 'ArrayExpression') {
            props.find(j.Literal, { value: name }).remove();
            if (props.get().value.value.elements.length == 0) {
                props.remove();
            }
        } else {
            this.removeFromOption('props', name);
        }
    }

    updateProp(name, attrs) {
        const props = this.option('props');
        // convert from array to object if necessary
        if (props.get().value.value.type == 'ArrayExpression') {
            const propNames = props.get().value.value.elements
                .map(el => el.value);
            const propsObj = mapWithKeys(propNames, name => [name, {}]);
            props.get().get('value').replace(object(propsObj));
        }

        const prop = props.find(j.Property, { key: { name } });
        pairs(attrs).forEach(([propAttr, val]) => {
            // remove attribute if null
            if (val == null) {
                prop.find(j.Property, { key: { name: propAttr }}).remove();
            } else {
                let nodeVal = parse(val);
                // the parsed node needs to be unpacked if it's a boolean or a type
                if (nodeVal.type == 'ExpressionStatement') nodeVal = nodeVal.expression;
                prop.get().value.value.properties.push(objProp(propAttr, nodeVal));
            }
        });

        const propsList = props.find(j.Property);
        const emptyProps = propsList.filter(propPath => propPath.value.value.type == 'ObjectExpression' && propPath.value.value.properties.length == 0);
        // convert back to array syntax if we don't have any object properties
        if (propsList.length == emptyProps.length) {
            const newProps = propsList.paths().map(propPath => j.literal(propPath.value.key.name));
            props.get().get('value').replace(j.arrayExpression(newProps));
        }
    }

    addData(name, val) {
        const data = this.option('data');
        data.find(j.ReturnStatement)
            .find(j.ObjectExpression)
            .get().value.properties.push(objProp(name, parse(val).expression));
    }

    renameData(name, newName) {
        this.option('data')
            .find(j.ReturnStatement)
            .find(j.Property, { key: { name } })
            .get().value
            .key.name = newName;

        this.renameAttribute(name, newName);
    }

    /**
     * Returns an object like the component's data, but the values are replaced by their AST nodes
     */
    data() {
        const props = this.option('data').find(j.ReturnStatement)
            .find(j.ObjectExpression)
            .get().value
            .properties;
        return mapWithKeys(props, prop => [prop.key.name, prop.value]);
    }

    setData(name, newVal) {
        const data = this.option('data');
        data.find(j.Property, { key: { name } })
            .get().get('value').replace(parse(newVal).expression);
    }

    removeData(name) {
        const data = this.option('data');
        data.find(j.Property, { key: { name } }).remove();
        if (data.find(j.ReturnStatement).get().value.argument.properties.length == 0) {
            data.remove();
        }
    }

    addWatcher(name, node=null) {
        if (node === null) {
            node = j.functionExpression(null,
                [j.identifier('newVal'), j.identifier('oldVal')],
                j.blockStatement([])
            );
        }
        const watcher = objProp(name, node, { method: true });
        this.option('watch').get().value.value.properties.push(watcher);
    }

    renameWatcher(name, newName) {
        this.option('watch').find(j.Property, { key: { name } })
            .get().value
            .key.name = newName;
    }

    /**
     * Returns an object where key is the watcher name and value is the function/object AST node
     */
    watchers() {
        const watchers = this.option('watch').get().value.value.properties;
        return mapWithKeys(watchers, watcher => [watcher.key.name, watcher.value]);
    }

    updateWatcher(name, attrs) {
        const watchers = this.option('watch');
        const watcher = watchers.find(j.Property, { key: { name } });
        const watcherNode = watcher.get().value;

        // convert to object syntax if necessary
        if (watcherNode.value.type == 'FunctionExpression') {
            const handlerProp = objProp('handler', watcherNode.value, { method: true });
            watcherNode.value = j.objectExpression([handlerProp]);
            watcherNode.method = false;
        }

        // update deep/immediate attributes
        pairs(attrs).forEach(([attr, val]) => {
            if (val === null) {
                watcher.find(j.Property, { key: { name: attr } }).remove();
            } else {
                // if it already exists, do nothing
                if (watcher.find(j.Property, { key: { name: attr } }).length) return;

                watcherNode.value.properties.push(objProp(attr, val));
            }
        });

        // convert back to function syntax if deep/immediate not present
        if (watcherNode.value.properties.length == 1) {
            watcherNode.value = watcher.find(j.Property, { key: { name: 'handler' } }).get().value.value;
            watcherNode.method = true;
        }
    }

    removeWatcher(name) {
        this.removeFromOption('watch', name);
    }

    addComputed(name, node=null) {
        if (node === null) node = emptyFunc();

        this.option('computed')
            .get().value
            .value.properties
            .push(objProp(name, node, { method: true }));
    }

    renameComputed(name, newName) {
        this.option('computed')
            .find(j.Property, { key: { name } })
            .get().value
            .key.name = newName;

        this.renameAttribute(name, newName);
    }
    
    /**
     * Returns an object where key is the computed name and value is the corresponding function/object AST node
     */
    computed() {
        const computed = this.option('computed').get().value.value.properties;
        return mapWithKeys(computed, computer => [computer.key.name, computer.value]);
    }

    addComputedSetter(name) {
        const node = this.option('computed')
            .find(j.Property, { key: { name } })
            .get().value;

        const getter = objProp('get', node.value, { method: true });
        const setter = objProp('set', j.functionExpression(null,
            [j.identifier('newValue')],
            j.blockStatement([parse(`this.${name} = newValue;`)])),
            { method: true });
        node.value = j.objectExpression([getter, setter]);
        node.method = false;
    }

    removeComputedSetter(name) {
        const prop = this.option('computed')
            .find(j.Property, { key: { name } });
        
        const getter = prop.find(j.Property, { key: { name: 'get' } })
            .get().value;
        
        const node = prop.get().value;
        node.value = getter.value;
        node.method = true;
    }

    removeComputed(name) {
        this.removeFromOption('computed', name);
    }

    addMethod(name, node=null) {
        if (node === null) node = emptyFunc();

        this.option('methods')
            .get().value
            .value.properties
            .push(objProp(name, node, { method: true }));
    }

    renameMethod(name, newName) {
        this.option('methods')
            .find(j.Property, { key: { name } })
            .get().value
            .key.name = newName;
        this.renameAttribute(name, newName);
    }

    /**
     * Returns an object where key is method name and value is function AST node
     */
    methods() {
        const methods = this.option('methods').get().value.value.properties;
        return mapWithKeys(methods, method => [method.key.name, method.value]);
    }

    removeMethod(name) {
        this.removeFromOption('methods', name);
    }

    async refactorIntoComponent(htmlNode, cmpPath, attrs=[]) {
        const newAttrs = mapWithKeys(attrs, key => [key, htmlNode.attrs[key]]);
        attrs.forEach(key => delete htmlNode.attrs[key]);
        const newTag = { tag: htmlNode.tag, attrs: newAttrs, content: ['\n    ', {tag: 'slot' }, '\n'] };
        const cmpName = cmpPath.split('/').slice(-1)[0].split('.')[0];
        htmlNode.tag = cmpName;
        this.importComponent(cmpPath);
        const newCmp = new VueAstEditor(`<script>
export default {}
</script>

<template></template>`);
        await newCmp.ready();
        newCmp.tree[2].content = ['\n', newTag, '\n'];
        return newCmp;
    }

    toString() {
        this.sortOptions();
        this.tree.match({ tag: 'script' }, node => {
            node.content = [toSource(this.script)];
            return node;
        });
        return this.results.html;
    }

    pushAboveSlot(htmlNode, hostCmp) {
        const hostSlot = this.findHostSlot(htmlNode, hostCmp);
        hostCmp.insertBefore(this.copyNode(htmlNode), hostSlot);
        this.removeNode(htmlNode);
    }

    pushBelowSlot(htmlNode, hostCmp) {
        const hostSlot = this.findHostSlot(htmlNode, hostCmp);
        hostCmp.insertAfter(this.copyNode(htmlNode), hostSlot);
        this.removeNode(htmlNode);
    }

    pushAroundSlot(htmlNode, hostCmp) {
        const hostSlot = this.findHostSlot(htmlNode, hostCmp);
        const copiedNode = this.copyNode(htmlNode);
        copiedNode.content = [hostSlot];
        hostCmp.replaceNode(hostSlot, copiedNode);
        // remove the tag, but splice its contents into its parents'
        htmlNode.tag = false;
        const idx = htmlNode.parent.content.indexOf(htmlNode);
        htmlNode.parent.content.splice(idx, 1, ...htmlNode.content);
    }

    pushIntoSlot(htmlNode, hostCmp) {
        const hostSlot = this.findHostSlot(htmlNode, hostCmp);
        if (!hostSlot.content) hostSlot.content = [];
        const whitespace = this.findWhitespace(hostSlot);
        hostSlot.content = hostSlot.content.concat(
            [whitespace + '    ', this.copyNode(htmlNode), whitespace]
        );
        this.removeNode(htmlNode);
    }

    pushIntoNewSlot(htmlNode, slotName, hostCmp) {
        const container = this.findContainingSlot(htmlNode);

        // update slot attribute
        if (!htmlNode.attrs) htmlNode.attrs = {};
        htmlNode.attrs.slot = slotName;
        
        // if the node isn't in the default slot, then we need to move it outside of its current slot
        if (!container.tag.match(/[A-Z]+/)) {
            this.insertAfter(htmlNode, container);
        }

        const template = hostCmp.filterHAST({ tag: 'template' })[0];
        const newSlot = { tag: 'slot', attrs: { name: slotName } }
        this.append(newSlot, template.content[1]);
    }

    findContainingSlot(htmlNode) {
        let node = htmlNode;
        while (node && !(node.tag.match(/[A-Z]/) || (node.attrs && node.attrs.slot))) {
            node = node.parent;
        }
        return node;
    }

    findParentComponent(htmlNode) {
        let node = htmlNode;
        while (node && !node.tag.match(/[A-Z]/)) {
            node = node.parent;
        }
        return node;
    }

    findHostSlot(htmlNode, hostCmp) {
        const container = this.findContainingSlot(htmlNode);

        // assume node is in the default slot by default
        let filter = { tag: 'slot' };
        if (container.attrs && container.attrs.slot) {
            filter.attrs = { name: container.attrs.slot };
        }
        return hostCmp.filterHAST(filter)[0];
    }

    removeNode(node) {
        const idx = node.parent.content.indexOf(node);
        if (idx != 0) {
            // clean up whitespace before node
            node.parent.content[idx - 1] = node.parent.content[idx - 1].trimRight();
        }
        // remove node && children from source
        node.tag = false;
        node.content = undefined;
    }

    copyNode(node) {
        const copy = { ...node };
        // since we don't want nodes competing for slots,
        // or we may be moving this node out of its slot,
        // it makes sense to remove any slot designation by default
        // I can't think of a situation when I would copy a node AND want it to retain its slot
        // if I want to keep the slot, I'd just move the node, not copy it
        if (copy.attrs && copy.attrs.slot) {
            copy.attrs.slot = undefined;
        }
        return copy;
    }

    replaceNode(targetNode, replacement) {
        const idx = targetNode.parent.content.indexOf(targetNode);
        targetNode.parent.content.splice(idx, 1, replacement);
        replacement.parent = targetNode.parent;
    }

    insertBefore(insertedNode, targetNode) {
        const idx = targetNode.parent.content.indexOf(targetNode);
        const whitespace = this.findWhitespace(targetNode.parent);
        targetNode.parent.content.splice(idx, 0, insertedNode, whitespace);
    }
    
    /**
     * Looks for a whitespace-only string in the given node's content.
     * Convenience method for preserving styling when adding nodes.
     * @param {*} node 
     */
    findWhitespace(node) {
        const whitespace = node.content.filter(str => typeof str == 'string' && str.match(/^\s+$/));
        if (whitespace.length) return whitespace[0];
        else return '\n    '; // reasonable default
    }

    insertAfter(insertedNode, targetNode) {
        const idx = targetNode.parent.content.indexOf(targetNode);
        const whitespace = this.findWhitespace(targetNode.parent);
        targetNode.parent.content.splice(idx + 1, 0, whitespace, insertedNode);
    }

    append(node, parent) {
        const target = parent.content.filter(node => typeof node == 'object').slice(-1)[0];
        this.insertAfter(node, target);
    }

    pushComponent(cmpName, hostCmp) {
        const path = this.script.find(j.ImportDefaultSpecifier, { local: { name: cmpName } })
            .closest(j.ImportDeclaration)
            .get().value
            .source.value;
        
        this.deportComponent(cmpName);
        hostCmp.importComponent(path);
    }

    pushData(data, hostCmp) {
        if (typeof data == 'string') data = [data];

        data.forEach(name => {
            const stringifiedValue = j(this.data()[name]).toSource({ quote: 'single' });
            this.removeData(name);
            hostCmp.addData(name, stringifiedValue);
        });
    }

    pushComputed(computed, hostCmp) {
        if (typeof computed == 'string') computed = [computed];
        
        computed.forEach(name => {
            const node = this.computed()[name];
            this.removeComputed(name);
            hostCmp.addComputed(name, node);
        });
    }

    pushWatcher(watcher, hostCmp) {
        if (typeof watcher == 'string') watcher = [watcher];

        watcher.forEach(name => {
            const node = this.watchers()[name];
            this.removeWatcher(name);
            hostCmp.addWatcher(name, node);
        })
    }

    pushMethod(method, hostCmp) {
        if (typeof method == 'string') method = [method];

        method.forEach(name => {
            const node = this.methods()[name];
            this.removeMethod(name);
            hostCmp.addMethod(name, node);
        })
    }
}