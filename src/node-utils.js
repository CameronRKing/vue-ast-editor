const { getFieldNames, getFieldValue, namedTypes: n } = require('ast-types');
const { assocIn } = require('./utils.js');
const j = require('jscodeshift');

/**
 * Returns an array of the path from the given node to the root
 * Root is at the end of the array.
 **/
exports.getNodeParentChain = getNodeParentChain;
function getNodeParentChain(node) {
    let nodeChain = [{ node, type: node.value.type }];
    let parent = node.parent;
    let child = node;
    while (parent) {
        nodeChain.push(getPositionInParent(child.value, parent.value));
        let newChild = parent;
        parent = parent.parent;
        child = newChild;
    }
    return nodeChain;
}

exports.getPositionInParent = getPositionInParent;
function getPositionInParent(child, parent) {
    // if its an Array, we need the field name AND the position
    // otherwise, we just need the field name
    let pos;
    const field = getFieldNames(parent).find(name => {
        const val = getFieldValue(parent, name);
        if (Array.isArray(val)) {
            pos = val.indexOf(child);
            if (pos >= 0) return true;
            pos = undefined;
            return false;
        }
        return val == child;
    });
    return {
        field,
        pos,
        type: parent.type,
        node: parent,
    };
}

exports.attemptToFind = attemptToFind;
function attemptToFind(startNode, nodePath) {
    const chain = getNodeParentChain(nodePath);
    // remove the first link, which is the nodePath itself
    chain.shift();
    let link, node = startNode;
    while (link = chain.pop()) {
        const { field, pos } = link;
        const args = pos === undefined ? [field] : [field, pos]

        let child = node.get(...args);

        if (!child) break;
        node = child;
    }
    return node;
}


exports.nodeAttrs = nodeAttrs;
function nodeAttrs(node) {
    return getFieldNames(node)
        .filter(field => node[field] == null || !(Array.isArray(node[field]) || typeof node[field] == 'object'))
        .reduce((acc, field) => ({ ...acc, [field]: node[field] }), {});
}

exports.nodeChildren = nodeChildren;
function nodeChildren(node) {
    const attrs = Object.keys(nodeAttrs(node));
    return getFieldNames(node)
        .filter(field => !attrs.includes(field))
        .reduce((acc, field) => ({ ...acc, [field]: node[field] }), {});
}

exports.getDefaultExport = getDefaultExport;
function getDefaultExport(coll) {
    const objPath = coll.find(j.ExportDefaultDeclaration)
        .get()
        .get('declaration');
    return j(objPath);
}

exports.setObjProp = setObjProp;
function setObjProp(objColl, key, val) {
    let prop;
    if (objHasProp(objColl, key)) {
        prop = findObjProp(objColl, key);
        prop.get().value.value = parseJSValue(val);
    } else {
        prop = objProp(key, val);
        objColl.get().value.properties.push(prop);
    }
    return prop;
}

exports.objHasProp = objHasProp;
function objHasProp(objColl, name) {
    return Boolean(objColl.find(j.Identifier, { name }).length);
}

exports.findObjProp = findObjProp;
function findObjProp(objColl, name) {
    return objColl.find(j.Identifier, { name }).closest(j.Property);
}

/**
 * Turns a JavaScript value into its corresponding AST type
 * If given a jscodeshift collection, returns the first node in it
 * If given an AST node, returns the AST node
 **/
function parseJSValue(value) {
    let val;
    if (isNodeCollection(value)) {
        val = value.get().value;
    } else if (isNode(value)) {
        val = value;
    } else {
        switch (typeof value) {
            case 'object':
                val = object(value);
                break;
            case 'function':
                val = parseFn(value);
                break;
            default:
                val = j.literal(value);
        }
    }
    return val;
}
exports.parseJSValue = parseJSValue;
/**
 * Returns an AST node created from a given string
 * Assumes that there is only one statement in the string
 **/
exports.parse = parse;
function parse(str) {
    return j(str).find(j.Program).get().value.body[0];
}

exports.parseFn = parseFn;
function parseFn(fn) {
    return j(fn.toString()).find(j.FunctionExpression).get()
}

exports.objProp = objProp;
function objProp(key, value, overrides = {}) {
    const prop = j.property('init', j.identifier(key), parseJSValue(value));
    assocIn(prop, overrides);
    return prop;
}

exports.object = object;
function object(obj = {}) {
    return j.objectExpression(
        Object.keys(obj).map(key => objProp(key, obj[key]))
    )
}

// is that really the best way to check?
function isNodeCollection(value) {
    return typeof value == 'object' && typeof value.get == 'function';
}
exports.isNodeCollection = isNodeCollection;

exports.isNode = isNode;
function isNode(value) {
    return n.Node.check(value);
}

exports.returnEmptyObject = returnEmptyObject;
function returnEmptyObject() {
    return j.functionExpression(
        null,
        [],
        j.blockStatement([
            j.returnStatement(
                j.objectExpression([])
            )
        ])
    );
}

exports.contains = contains;
function contains(point) {
    return (node) => node.start <= point && point <= node.end;
}

// this needs to be a lot more flexible  
exports.toSource = toSource;
function toSource(jSrc) {
    return jSrc.toSource({ quote: 'single', lineTerminator: '\n', tabWidth: 4, arrowParensAlways: true })
        // Recast seperates multiline object properties by an extra newline on both sides
        // https://github.com/benjamn/recast/issues/242
        // the author did it for personal preference and, after years of complaints, has not made it alterable
        .replace(/,\n\n/mg, ',\n')
        .replace(/{\n\n/mg, '{\n')
}

exports.addToTop = addToTop;
function addToTop(jSrc, node) {
    jSrc.find(j.Program).get().value.body.unshift(node);
}