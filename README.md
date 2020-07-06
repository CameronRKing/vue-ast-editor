# Vue Ast Editor

A tool for programmatically manipulating Vue single-file components.

## Usage

```javascript
const ast = new VueAstEditor(src);
await ast.ready();

ast.importComponent('@/components/MyComponent.vue'); // imports the component and adds it to the component option, initializing the option if necessary
ast.addData('foo', '"this string will be parsed into a JS value"'); // initializes the data option or adds to it
ast.addProp('myProp');
ast.updateProp('myProp', { type: 'String', required: 'false', default: '"default value"' }); // automatically restructures between array and object syntax
ast.addMethod('myMethod');
ast.renameMethod('myMethod', 'newName'); // updates references in the component definition, HTML attributes, and HTML template expressions

console.log(ast.toString());
```

