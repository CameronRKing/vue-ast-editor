# Vue Ast Editor

A tool for programmatically manipulating Vue single-file components.

## Usage

```javascript
import VueAstEditor from 'vue-ast-editor';

const ast = new VueAstEditor(src);
await ast.ready();

// imports the component and adds it to the component option,
// initializing the option if necessary
ast.importComponent('@/components/MyComponent.vue');
// initializes the data option or adds to it
ast.addData('foo', '"this string will be parsed into a JS value"');
ast.addProp('myProp');
// automatically restructures between array and object syntax
ast.updateProp('myProp', { type: 'String', required: 'false', default: '"default value"' });
ast.addMethod('myMethod');
// updates references in the component definition, HTML attributes, and HTML template expressions
// renaming is implemented heuristically and not promised to be 100% accurate
ast.renameMethod('myMethod', 'newName');

console.log(ast.toString());
```

## Methods


### General
+ ready()
    + returns a promise that resolves when parsing is done
+ toString()
    + prints the source code of the component
    + options unconfigurable and set to personal preferences; recommend piping the output through a formatter
+ filterHAST(filter)
    + a convenience wrapper around posthtml.tree.match
+ findOption(name)
    + returns a jscodeshift collection
+ renameAttribute(name, newName)
    + called internally by the various renaming methods

### Option management    
+ importComponent(path: string)
    + path expects a file type ending
+ deportComponent(name)
    + note the difference in API. To import a component, we need its path, but to deport it, we need only to know its name; e.g., "@/components/MyBtn.vue" vs. "MyBtn"
+ components()
    + returns an object of { [component_name]: true }
+ addProp(name)
+ renameProp(name, newName)
+ updateProp(name, attrs)
    + where attrs is an object of { [attr_name]: string | null }
    + string will be parsed, null removes the attribute
+ removeProp(name)
+ props()
    + returns an object of { [prop_name]: [ast_node] }
+ addData(name, val: string) // string will be parsed
+ renameData(name, newName)
+ setData(name, newVal: string) // string will be parsed
+ data()
    + returns an object of { [data_name]: [ast_node] }
+ addWatcher(name, node=null)
    + the optional second argument is for refactoring purposes
+ renameWatcher(name, newName)
+ updateWatcher(name, attrs)
    + where attrs is an object of { [deep | immediate]: true | null }
+ removeWatcher(name)
+ watchers()
    + returns an object of { [watcher_name]: [ast_node] }
+ addComputed(name, node=null)
    + optional second argument is for refactoring purposes
+ renameComputed(name, newName)
+ addComputerSetter(name)
+ removeComputedSetter(name)
+ removeComputed(name)
+ computed()
    + returns an object of { [computed_name]: [ast_node] }
+ addMethod(name, node=null)
    + optional second argument is for refactoring purposes
+ renameMethod(name, newName)
+ removeMethod(name)
+ methods()
    + returns an object of { [method_name]: [ast_node] }
+ addHook(name)
+ removeHook(name)


### Refactoring (experimental!)

+ async refactorIntoComponent(htmlNode, cmpPath, attrs=[])
    + pushes the given HTML node into a new component
    + attrs is a list of HTML attributes that you want moved into the new component. attrs not in the list will remain in the source component.
+ pushAboveSlot(htmlNode, cmp)
    + given a node in a slot
+ pushBelowSlot(htmlNode, cmp)
+ pushAroundSlot(htmlNode, cmp)
+ pushIntoSlot(htmlNode, cmp)
+ pushIntoNewSlot(htmlNode, slotName, hostCmp)
+ pushComponent(componentName, cmp)
+ pushData(dataName | array of names, cmp)
+ pushComputed(computedName | array of names, cmp)
+ pushWatcher(watcherName | array of names, cmp)
+ pushMethod(methodName | array of name, cmp)

### Lower-level utilities used in refactoring

+ findContainingSlot(htmlNode)
+ findParentComponent(htmlNode)
+ findHostSlot(htmlNode, hostCmp)
+ removeNode(htmlNode)
+ copyNode(htmlNode)
+ replaceNode(target, replacement)
+ insertBefore(newNode, target)
+ insertAfter(newNode, target)
+ append(node, parent)