const j = require('jscodeshift');

// Finds references to the given property referenced on any `this` and renames it.
// In Vue components, we assume any `this` to be the component instance.
// Detects references like: this.prop, this['prop'], var { prop } = this;
module.exports = function renameThisAttr(jSrc, name, newName) {
    renameMemberExpressions(jSrc, name, newName);
    renameVariableDestructurings(jSrc, name, newName);
}

function renameMemberExpressions(jSrc, name, newName) {
    jSrc.find(j.MemberExpression, { object: { type: 'ThisExpression' } })
        .map(path => {
            const prop = path.value.property;
            // modifying prop directly had no effect
            // going through the path methods does
            if (prop.value == name) path.get('property').replace(j.literal(newName));
            if (prop.name == name) path.get('property').replace(j.identifier(newName));
            return path;
        });
}

function renameVariableDestructurings(jSrc, name, newName) {
    jSrc.find(j.VariableDeclarator, { init: { type: 'ThisExpression' } })
        .map(path => {
            path.get('id', 'properties').value.forEach((prop, idx) => {
                if (prop.key.name == name) {
                    const newProp = j.property('init', j.identifier(newName), prop.value);
                    path.get('id', 'properties', idx).replace(newProp);
                }
            });
            return path;
        });
}
