// posthtml does not handle Vue components well
// it can recognize self-closing tags, but it goes by TAG, not by specific instance
// i.e., either all MyCmp will be self-closing or none will.
// This is not how Vue works.
// If children are passed, then it can't be self-closing. Otherwise, it should be.
// Self-closingness should be picked up from the context.

function shouldSelfClose(node) {
    return isVueTag(node.tag) && hasNoContent(node);
}

function isVueTag(tag) {
    return tag.includes('-') || tag.match(/[A-Z]/);
}

function hasNoContent({ content }) {
    return !(Array.isArray(content) && content.length > 0);
}



var SINGLE_TAGS = [
    'area',
    'base',
    'br',
    'col',
    'command',
    'embed',
    'hr',
    'img',
    'input',
    'keygen',
    'link',
    'menuitem',
    'meta',
    'param',
    'source',
    'track',
    'wbr',
    // Custom (PostHTML)
    'import',
    'include',
    'extend'
]

/**
 * Render PostHTML Tree to HTML
 *
 * @param  {Array|Object} tree PostHTML Tree
 * @param  {Object} options Options
 *
 * @return {String} HTML
 */
exports.render = function render(tree, options) {
    /**
     * Options
     *
     * @type {Object}
     *
     * @prop {Array<String|RegExp>} singleTags  Custom single tags (selfClosing)
     * @prop {String} closingSingleTag Closing format for single tag
     *
     * Formats:
     *
     * ``` tag: `<br></br>` ```, slash: `<br />` ```, ```default: `<br>` ```
     */
    options = options || {}

    var singleTags = options.singleTags ? SINGLE_TAGS.concat(options.singleTags) : SINGLE_TAGS
    var singleRegExp = singleTags.filter(function (tag) {
        return tag instanceof RegExp
    })

    var closingSingleTag = options.closingSingleTag

    return html(tree)

    /** @private */
    function isSingleTag(tag) {
        if (singleRegExp.length !== 0) {
            for (var i = 0; i < singleRegExp.length; i++) {
                return singleRegExp[i].test(tag)
            }
        }

        if (singleTags.indexOf(tag) === -1) {
            return false
        }

        return true
    }

    /** @private */
    function attrs(obj, padding) {
        var attr = ''
        const hasMultipleKeys = Object.keys(obj).length > 1;
        const spacing = hasMultipleKeys ? '\n' + ' '.repeat(padding + 4) : ' ';
        for (var key in obj) {
            if (typeof obj[key] === 'string') {
                attr += spacing + key + '="' + obj[key].replace(/"/g, '&quot;') + '"'
            } else if (obj[key] === true) {
                attr += spacing + key
            } else if (typeof obj[key] === 'number') {
                attr += spacing + key + '="' + obj[key] + '"'
            }
        }
        if (hasMultipleKeys) attr += '\n' + ' '.repeat(padding);

        return attr
    }

    /** @private */
    function traverse(tree, cb) {
        if (tree !== undefined) {
            for (var i = 0, length = tree.length; i < length; i++) {
                traverse(cb(tree[i]), cb)
            }
        }
    }

    /**
     * HTML Stringifier
     *
     * @param  {Array|Object} tree PostHTML Tree
     *
     * @return {String} result HTML
     */
    function html(tree) {
        var result = ''

        if (!Array.isArray(tree)) {
            tree = [tree]
        }

        traverse(tree, function (node) {
            // undefined, null, '', [], NaN
            if (node === undefined ||
                node === null ||
                node === false ||
                node.length === 0 ||
                Number.isNaN(node)) {
                return
            }

            // treat as new root tree if node is an array
            if (Array.isArray(node)) {
                result += html(node)
                return
            }

            if (typeof node === 'string' || typeof node === 'number') {
                result += node
                return
            }

            // skip node
            if (node.tag === false) {
                result += html(node.content)

                return
            }

            var tag = node.tag || 'div'

            const width = result.split('\n').slice(-1)[0].length;
            result += '<' + tag

            if (node.attrs) {
                result += attrs(node.attrs, width);
            }

            if (isSingleTag(tag) || shouldSelfClose(node)) {
                switch (closingSingleTag) {
                    case 'tag':
                        result += '></' + tag + '>'
                        break
                    case 'slash':
                        result += ' />'
                        break
                    default:
                        result += '>'
                }

                result += html(node.content)
            } else {
                result += '>' + html(node.content) + '</' + tag + '>'
            }
        })

        return result
    }
}
