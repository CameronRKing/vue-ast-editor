exports.mapInvert = mapInvert;
function mapInvert(obj) {
    return Object.keys(obj)
        .reduce((acc, key) => ({
            ...acc, [obj[key]]: key
        }), {});
}

exports.pairs = pairs;
function pairs(obj) {
    return Object.keys(obj).map(key => [key, obj[key]]);
}

exports.assocIn = assocIn;
function assocIn(modified, toAdd) {
    pairs(toAdd).forEach(([key, val]) => modified[key] = val);
    return modified;
}

exports.capitalize = capitalize;
function capitalize(str) {
    return str[0].toUpperCase() + str.slice(1);
}

exports.decapitalize = decapitalize;
function decapitalize(str) {
    return str[0].toLowerCase() + str.slice(1);
}

exports.mapWithKeys = mapWithKeys;
function mapWithKeys(arr, cb) {
    if (!cb) cb = (args) => args;
    return arr.reduce((acc, value) => {
        const [key, val] = cb(value);
        return { ...acc, [key]: val };
    }, {});
}

exports.remove = remove;
function remove(arr, item) {
    const idx = arr.indexOf(item);
    if (idx == -1) return;
    arr.splice(idx, 1);
}

exports.first = first;
function first(arr) {
    if (arr.length == 0) throw new Error('Array is empty. Cannot get first item.');
    return arr[0];
}

exports.last = last;
function last(arr) {
    return arr[arr.length - 1];
}

exports.nextIdx = nextIdx;
function nextIdx(arr, idx) {
    if (idx < arr.length - 1) return idx++;
    return idx;
}

exports.prevIdx = prevIdx;
function prevIdx(arr, idx) {
    if (idx > 0) return idx--;
    return idx;
}

exports.next = next;
function next(arr, item) {
    const idx = arr.indexOf(item);
    if (idx == arr.length - 1) return item;
    return arr[idx + 1];
}

exports.prev = prev;
function prev(arr, item) {
    const idx = arr.indexOf(item);
    if (idx == 0) return item;
    return arr[idx - 1];
}

exports.lastIdx = lastIdx;
function lastIdx(arr) {
    return arr.length - 1;
}

exports.debounce = debounce;
function debounce(fn, wait) {
    let lastCall, scheduledCall;
    return (...args) => {
        lastCall = Date.now();
        if (scheduledCall) clearTimeout(scheduledCall);
        scheduledCall = setTimeout(() => fn(...args), wait);
    }
}

// given a dot-separated path,
// returns the instantiated object tree that it represents
// with the given value at the very end
exports.hydratePath = hydratePath;
function hydratePath(path, val) {
    return path.split('.').reverse().reduce((acc, val) => ({ [val]: acc }), val);
}

exports.s = s;
function s(...exp) {
    console.log(...exp);
    return exp;
}
