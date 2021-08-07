"use strict";
var __extends = (this && this.__extends) || (function () {
    var extendStatics = function (d, b) {
        extendStatics = Object.setPrototypeOf ||
            ({ __proto__: [] } instanceof Array && function (d, b) { d.__proto__ = b; }) ||
            function (d, b) { for (var p in b) if (Object.prototype.hasOwnProperty.call(b, p)) d[p] = b[p]; };
        return extendStatics(d, b);
    };
    return function (d, b) {
        if (typeof b !== "function" && b !== null)
            throw new TypeError("Class extends value " + String(b) + " is not a constructor or null");
        extendStatics(d, b);
        function __() { this.constructor = d; }
        d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
var logger_1 = require("@ethersproject/logger");
var version = 'abi/5.4.0';
var logger = new logger_1.Logger(version);
var _constructorGuard = {};
var paramTypeArray = new RegExp(/^(.*)\[([0-9]*)\]$/);
var ModifiersBytes = { calldata: true, memory: true, storage: true };
var ModifiersNest = { calldata: true, memory: true };
function checkModifier(type, name) {
    if (type === 'bytes' || type === 'string') {
        if (ModifiersBytes[name]) {
            return true;
        }
    }
    else if (type === 'address') {
        if (name === 'payable') {
            return true;
        }
    }
    else if (type.indexOf('[') >= 0 || type === 'tuple') {
        if (ModifiersNest[name]) {
            return true;
        }
    }
    if (ModifiersBytes[name] || name === 'payable') {
        logger.throwArgumentError('invalid modifier', 'name', name);
    }
    return false;
}
function parseParamType(param, allowIndexed) {
    var originalParam = param;
    function throwError(i) {
        logger.throwArgumentError("unexpected character at position " + i, 'param', param);
    }
    param = param.replace(/\s/g, ' ');
    function newNode(parent) {
        var node = { type: '', name: '', parent: parent, state: { allowType: true } };
        if (allowIndexed) {
            node.indexed = false;
        }
        return node;
    }
    var parent = { type: '', name: '', state: { allowType: true } };
    var node = parent;
    for (var i = 0; i < param.length; i++) {
        var c = param[i];
        switch (c) {
            case '(':
                if (node.state.allowType && node.type === '') {
                    node.type = 'tuple';
                }
                else if (!node.state.allowParams) {
                    throwError(i);
                }
                node.state.allowType = false;
                node.type = verifyType(node.type);
                node.components = [newNode(node)];
                node = node.components[0];
                break;
            case ')':
                delete node.state;
                if (node.name === 'indexed') {
                    if (!allowIndexed) {
                        throwError(i);
                    }
                    node.indexed = true;
                    node.name = '';
                }
                if (checkModifier(node.type, node.name)) {
                    node.name = '';
                }
                node.type = verifyType(node.type);
                var child = node;
                node = node.parent;
                if (!node) {
                    throwError(i);
                }
                delete child.parent;
                node.state.allowParams = false;
                node.state.allowName = true;
                node.state.allowArray = true;
                break;
            case ',':
                delete node.state;
                if (node.name === 'indexed') {
                    if (!allowIndexed) {
                        throwError(i);
                    }
                    node.indexed = true;
                    node.name = '';
                }
                if (checkModifier(node.type, node.name)) {
                    node.name = '';
                }
                node.type = verifyType(node.type);
                var sibling = newNode(node.parent);
                //{ type: "", name: "", parent: node.parent, state: { allowType: true } };
                node.parent.components.push(sibling);
                delete node.parent;
                node = sibling;
                break;
            // Hit a space...
            case ' ':
                // If reading type, the type is done and may read a param or name
                if (node.state.allowType) {
                    if (node.type !== '') {
                        node.type = verifyType(node.type);
                        delete node.state.allowType;
                        node.state.allowName = true;
                        node.state.allowParams = true;
                    }
                }
                // If reading name, the name is done
                if (node.state.allowName) {
                    if (node.name !== '') {
                        if (node.name === 'indexed') {
                            if (!allowIndexed) {
                                throwError(i);
                            }
                            if (node.indexed) {
                                throwError(i);
                            }
                            node.indexed = true;
                            node.name = '';
                        }
                        else if (checkModifier(node.type, node.name)) {
                            node.name = '';
                        }
                        else {
                            node.state.allowName = false;
                        }
                    }
                }
                break;
            case '[':
                if (!node.state.allowArray) {
                    throwError(i);
                }
                node.type += c;
                node.state.allowArray = false;
                node.state.allowName = false;
                node.state.readArray = true;
                break;
            case ']':
                if (!node.state.readArray) {
                    throwError(i);
                }
                node.type += c;
                node.state.readArray = false;
                node.state.allowArray = true;
                node.state.allowName = true;
                break;
            default:
                if (node.state.allowType) {
                    node.type += c;
                    node.state.allowParams = true;
                    node.state.allowArray = true;
                }
                else if (node.state.allowName) {
                    node.name += c;
                    delete node.state.allowArray;
                }
                else if (node.state.readArray) {
                    node.type += c;
                }
                else {
                    throwError(i);
                }
        }
    }
    if (node.parent) {
        logger.throwArgumentError('unexpected eof', 'param', param);
    }
    delete parent.state;
    if (node.name === 'indexed') {
        if (!allowIndexed) {
            throwError(originalParam.length - 7);
        }
        if (node.indexed) {
            throwError(originalParam.length - 7);
        }
        node.indexed = true;
        node.name = '';
    }
    else if (checkModifier(node.type, node.name)) {
        node.name = '';
    }
    parent.type = verifyType(parent.type);
    return parent;
}
function defineReadOnly(object, name, value) {
    Object.defineProperty(object, name, {
        enumerable: true,
        value: value,
        writable: false
    });
}
var FormatTypes = Object.freeze({
    sighash: 'sighash',
    minimal: 'minimal',
    full: 'full',
    json: 'json'
});
function populate(object, params) {
    for (var key in params) {
        defineReadOnly(object, key, params[key]);
    }
}
function verifyType(type) {
    // These need to be transformed to their full description
    if (type.match(/^uint($|[^1-9])/)) {
        type = 'uint256' + type.substring(4);
    }
    else if (type.match(/^int($|[^1-9])/)) {
        type = 'int256' + type.substring(3);
    }
    // @TODO: more verification
    return type;
}
var ParamType = /** @class */ (function () {
    function ParamType(constructorGuard, params) {
        if (constructorGuard !== _constructorGuard) {
            logger.throwError('use fromString', logger_1.Logger.errors.UNSUPPORTED_OPERATION, {
                operation: 'new ParamType()'
            });
        }
        populate(this, params);
        var match = this.type.match(paramTypeArray);
        if (match) {
            populate(this, {
                arrayLength: parseInt(match[2] || '-1'),
                arrayChildren: ParamType.fromObject({
                    type: match[1],
                    components: this.components
                }),
                baseType: 'array'
            });
        }
        else {
            populate(this, {
                arrayLength: null,
                arrayChildren: null,
                baseType: this.components != null ? 'tuple' : this.type
            });
        }
        this._isParamType = true;
        Object.freeze(this);
    }
    ParamType.prototype.format = function (format) {
        if (!format) {
            format = FormatTypes.sighash;
        }
        if (!FormatTypes[format]) {
            logger.throwArgumentError('invalid format type', 'format', format);
        }
        if (format === FormatTypes.json) {
            var result_1 = {
                type: this.baseType === 'tuple' ? 'tuple' : this.type,
                name: this.name || undefined
            };
            if (typeof this.indexed === 'boolean') {
                result_1.indexed = this.indexed;
            }
            if (this.components) {
                result_1.components = this.components.map(function (comp) { return JSON.parse(comp.format(format)); });
            }
            return JSON.stringify(result_1);
        }
        var result = '';
        if (this.baseType === 'array') {
            result += this.arrayChildren.format(format);
            result += '[' + (this.arrayLength < 0 ? '' : String(this.arrayLength)) + ']';
        }
        else {
            if (this.baseType === 'tuple') {
                if (format !== FormatTypes.sighash) {
                    result += this.type;
                }
                result +=
                    '(' + this.components.map(function (comp) { return comp.format(format); }).join(format === FormatTypes.full ? ', ' : ',') + ')';
            }
            else {
                result += this.type;
            }
        }
        if (format !== FormatTypes.sighash) {
            if (this.indexed === true) {
                result += ' indexed';
            }
            if (format === FormatTypes.full && this.name) {
                result += ' ' + this.name;
            }
        }
        return result;
    };
    ParamType.from = function (value, allowIndexed) {
        if (typeof value === 'string') {
            return ParamType.fromString(value, allowIndexed);
        }
        return ParamType.fromObject(value);
    };
    ParamType.fromObject = function (value) {
        if (ParamType.isParamType(value)) {
            return value;
        }
        return new ParamType(_constructorGuard, {
            name: value.name || null,
            type: verifyType(value.type),
            indexed: value.indexed == null ? null : !!value.indexed,
            components: value.components ? value.components.map(ParamType.fromObject) : null
        });
    };
    ParamType.fromString = function (value, allowIndexed) {
        function ParamTypify(node) {
            return ParamType.fromObject({
                name: node.name,
                type: node.type,
                indexed: node.indexed,
                components: node.components
            });
        }
        return ParamTypify(parseParamType(value, !!allowIndexed));
    };
    ParamType.isParamType = function (value) {
        return !!(value != null && value._isParamType);
    };
    return ParamType;
}());
var HexCharacters = '0123456789abcdef';
function isHexable(value) {
    return !!value.toHexString;
}
function isHexString(value, length) {
    if (typeof value !== 'string' || !value.match(/^0x[0-9A-Fa-f]*$/)) {
        return false;
    }
    if (length && value.length !== 2 + 2 * length) {
        return false;
    }
    return true;
}
function isBytes(value) {
    if (value == null) {
        return false;
    }
    if (value.constructor === Uint8Array) {
        return true;
    }
    if (typeof value === 'string') {
        return false;
    }
    if (value.length == null) {
        return false;
    }
    for (var i = 0; i < value.length; i++) {
        var v = value[i];
        if (typeof v !== 'number' || v < 0 || v >= 256 || v % 1) {
            return false;
        }
    }
    return true;
}
function hexlify(value, options) {
    if (!options) {
        options = {};
    }
    if (typeof value === 'number') {
        logger.checkSafeUint53(value, 'invalid hexlify value');
        var hex = '';
        while (value) {
            hex = HexCharacters[value & 0xf] + hex;
            value = Math.floor(value / 16);
        }
        if (hex.length) {
            if (hex.length % 2) {
                hex = '0' + hex;
            }
            return '0x' + hex;
        }
        return '0x00';
    }
    if (typeof value === 'bigint') {
        value = value.toString(16);
        if (value.length % 2) {
            return '0x0' + value;
        }
        return '0x' + value;
    }
    if (options.allowMissingPrefix && typeof value === 'string' && value.substring(0, 2) !== '0x') {
        value = '0x' + value;
    }
    if (isHexable(value)) {
        return value.toHexString();
    }
    if (isHexString(value)) {
        if (value.length % 2) {
            if (options.hexPad === 'left') {
                value = '0x0' + value.substring(2);
            }
            else if (options.hexPad === 'right') {
                value += '0';
            }
            else {
                logger.throwArgumentError('hex data is odd-length', 'value', value);
            }
        }
        return value.toLowerCase();
    }
    if (isBytes(value)) {
        var result_2 = '0x';
        for (var i = 0; i < value.length; i++) {
            var v = value[i];
            result_2 += HexCharacters[(v & 0xf0) >> 4] + HexCharacters[v & 0x0f];
        }
        return result_2;
    }
    return logger.throwArgumentError('invalid hexlify value', 'value', value);
}
function addSlice(array) {
    if (array.slice) {
        return array;
    }
    array.slice = function () {
        var args = Array.prototype.slice.call(arguments);
        return addSlice(new Uint8Array(Array.prototype.slice.apply(array, args)));
    };
    return array;
}
function hexConcat(items) {
    var result = '0x';
    items.forEach(function (item) {
        result += hexlify(item).substring(2);
    });
    return result;
}
function arrayify(value, options) {
    if (!options) {
        options = {};
    }
    if (typeof value === 'number') {
        logger.checkSafeUint53(value, 'invalid arrayify value');
        var result_3 = [];
        while (value) {
            result_3.unshift(value & 0xff);
            value = parseInt(String(value / 256));
        }
        if (result_3.length === 0) {
            result_3.push(0);
        }
        return addSlice(new Uint8Array(result_3));
    }
    if (options.allowMissingPrefix && typeof value === 'string' && value.substring(0, 2) !== '0x') {
        value = '0x' + value;
    }
    if (isHexable(value)) {
        value = value.toHexString();
    }
    if (isHexString(value)) {
        var hex = value.substring(2);
        if (hex.length % 2) {
            if (options.hexPad === 'left') {
                hex = '0x0' + hex.substring(2);
            }
            else if (options.hexPad === 'right') {
                hex += '0';
            }
            else {
                logger.throwArgumentError('hex data is odd-length', 'value', value);
            }
        }
        var result_4 = [];
        for (var i = 0; i < hex.length; i += 2) {
            result_4.push(parseInt(hex.substring(i, i + 2), 16));
        }
        return addSlice(new Uint8Array(result_4));
    }
    if (isBytes(value)) {
        return addSlice(new Uint8Array(value));
    }
    return logger.throwArgumentError('invalid arrayify value', 'value', value);
}
function concat(items) {
    var objects = items.map(function (item) { return arrayify(item); });
    var length = objects.reduce(function (accum, item) { return accum + item.length; }, 0);
    var result = new Uint8Array(length);
    objects.reduce(function (offset, object) {
        result.set(object, offset);
        return offset + object.length;
    }, 0);
    return addSlice(result);
}
var Writer = /** @class */ (function () {
    function Writer(wordSize) {
        defineReadOnly(this, 'wordSize', wordSize || 32);
        this._data = [];
        this._dataLength = 0;
        this._padding = new Uint8Array(wordSize);
    }
    Object.defineProperty(Writer.prototype, "data", {
        get: function () {
            return hexConcat(this._data);
        },
        enumerable: false,
        configurable: true
    });
    Object.defineProperty(Writer.prototype, "length", {
        get: function () {
            return this._dataLength;
        },
        enumerable: false,
        configurable: true
    });
    Writer.prototype._writeData = function (data) {
        this._data.push(data);
        this._dataLength += data.length;
        return data.length;
    };
    Writer.prototype.appendWriter = function (writer) {
        return this._writeData(concat(writer._data));
    };
    // Arrayish items; padded on the right to wordSize
    Writer.prototype.writeBytes = function (value) {
        var bytes = arrayify(value);
        var paddingOffset = bytes.length % this.wordSize;
        if (paddingOffset) {
            bytes = concat([bytes, this._padding.slice(paddingOffset)]);
        }
        return this._writeData(bytes);
    };
    Writer.prototype._getValue = function (value) {
        var bytes = arrayify(BigNumber.from(value));
        if (bytes.length > this.wordSize) {
            logger.throwError('value out-of-bounds', logger_1.Logger.errors.BUFFER_OVERRUN, {
                length: this.wordSize,
                offset: bytes.length
            });
        }
        if (bytes.length % this.wordSize) {
            bytes = concat([this._padding.slice(bytes.length % this.wordSize), bytes]);
        }
        return bytes;
    };
    // BigNumberish items; padded on the left to wordSize
    Writer.prototype.writeValue = function (value) {
        return this._writeData(this._getValue(value));
    };
    Writer.prototype.writeUpdatableValue = function () {
        var _this = this;
        var offset = this._data.length;
        this._data.push(this._padding);
        this._dataLength += this.wordSize;
        return function (value) {
            _this._data[offset] = _this._getValue(value);
        };
    };
    return Writer;
}());
var bn_1 = require("bn");
var BN = bn_1.default.BN;
function toBN(value) {
    var hex = BigNumber.from(value).toHexString();
    if (hex[0] === '-') {
        return new BN('-' + hex.substring(3), 16);
    }
    return new BN(hex.substring(2), 16);
}
function throwFault(fault, operation, value) {
    var params = { fault: fault, operation: operation };
    if (value != null) {
        params.value = value;
    }
    return logger.throwError(fault, logger_1.Logger.errors.NUMERIC_FAULT, params);
}
var _warnedToStringRadix = false;
function toHex(value) {
    // For BN, call on the hex string
    if (typeof value !== 'string') {
        return toHex(value.toString(16));
    }
    // If negative, prepend the negative sign to the normalized positive value
    if (value[0] === '-') {
        // Strip off the negative sign
        value = value.substring(1);
        // Cannot have mulitple negative signs (e.g. "--0x04")
        if (value[0] === '-') {
            logger.throwArgumentError('invalid hex', 'value', value);
        }
        // Call toHex on the positive component
        value = toHex(value);
        // Do not allow "-0x00"
        if (value === '0x00') {
            return value;
        }
        // Negate the value
        return '-' + value;
    }
    // Add a "0x" prefix if missing
    if (value.substring(0, 2) !== '0x') {
        value = '0x' + value;
    }
    // Normalize zero
    if (value === '0x') {
        return '0x00';
    }
    // Make the string even length
    if (value.length % 2) {
        value = '0x0' + value.substring(2);
    }
    // Trim to smallest even-length string
    while (value.length > 4 && value.substring(0, 4) === '0x00') {
        value = '0x' + value.substring(4);
    }
    return value;
}
var MAX_SAFE = 0x1fffffffffffff;
var BigNumber = /** @class */ (function () {
    function BigNumber(constructorGuard, hex) {
        var _newTarget = this.constructor;
        logger.checkNew(_newTarget, BigNumber);
        if (constructorGuard !== _constructorGuard) {
            logger.throwError('cannot call constructor directly; use BigNumber.from', logger_1.Logger.errors.UNSUPPORTED_OPERATION, {
                operation: 'new (BigNumber)'
            });
        }
        this._hex = hex;
        this._isBigNumber = true;
        Object.freeze(this);
    }
    BigNumber.prototype.fromTwos = function (value) {
        return toBigNumber(toBN(this).fromTwos(value));
    };
    BigNumber.prototype.toTwos = function (value) {
        return toBigNumber(toBN(this).toTwos(value));
    };
    BigNumber.prototype.abs = function () {
        if (this._hex[0] === '-') {
            return BigNumber.from(this._hex.substring(1));
        }
        return this;
    };
    BigNumber.prototype.add = function (other) {
        return toBigNumber(toBN(this).add(toBN(other)));
    };
    BigNumber.prototype.sub = function (other) {
        return toBigNumber(toBN(this).sub(toBN(other)));
    };
    BigNumber.prototype.div = function (other) {
        var o = BigNumber.from(other);
        if (o.isZero()) {
            throwFault('division by zero', 'div');
        }
        return toBigNumber(toBN(this).div(toBN(other)));
    };
    BigNumber.prototype.mul = function (other) {
        return toBigNumber(toBN(this).mul(toBN(other)));
    };
    BigNumber.prototype.mod = function (other) {
        var value = toBN(other);
        if (value.isNeg()) {
            throwFault('cannot modulo negative values', 'mod');
        }
        return toBigNumber(toBN(this).umod(value));
    };
    BigNumber.prototype.pow = function (other) {
        var value = toBN(other);
        if (value.isNeg()) {
            throwFault('cannot raise to negative values', 'pow');
        }
        return toBigNumber(toBN(this).pow(value));
    };
    BigNumber.prototype.and = function (other) {
        var value = toBN(other);
        if (this.isNegative() || value.isNeg()) {
            throwFault("cannot 'and' negative values", 'and');
        }
        return toBigNumber(toBN(this).and(value));
    };
    BigNumber.prototype.or = function (other) {
        var value = toBN(other);
        if (this.isNegative() || value.isNeg()) {
            throwFault("cannot 'or' negative values", 'or');
        }
        return toBigNumber(toBN(this).or(value));
    };
    BigNumber.prototype.xor = function (other) {
        var value = toBN(other);
        if (this.isNegative() || value.isNeg()) {
            throwFault("cannot 'xor' negative values", 'xor');
        }
        return toBigNumber(toBN(this).xor(value));
    };
    BigNumber.prototype.mask = function (value) {
        if (this.isNegative() || value < 0) {
            throwFault('cannot mask negative values', 'mask');
        }
        return toBigNumber(toBN(this).maskn(value));
    };
    BigNumber.prototype.shl = function (value) {
        if (this.isNegative() || value < 0) {
            throwFault('cannot shift negative values', 'shl');
        }
        return toBigNumber(toBN(this).shln(value));
    };
    BigNumber.prototype.shr = function (value) {
        if (this.isNegative() || value < 0) {
            throwFault('cannot shift negative values', 'shr');
        }
        return toBigNumber(toBN(this).shrn(value));
    };
    BigNumber.prototype.eq = function (other) {
        return toBN(this).eq(toBN(other));
    };
    BigNumber.prototype.lt = function (other) {
        return toBN(this).lt(toBN(other));
    };
    BigNumber.prototype.lte = function (other) {
        return toBN(this).lte(toBN(other));
    };
    BigNumber.prototype.gt = function (other) {
        return toBN(this).gt(toBN(other));
    };
    BigNumber.prototype.gte = function (other) {
        return toBN(this).gte(toBN(other));
    };
    BigNumber.prototype.isNegative = function () {
        return this._hex[0] === '-';
    };
    BigNumber.prototype.isZero = function () {
        return toBN(this).isZero();
    };
    BigNumber.prototype.toNumber = function () {
        try {
            return toBN(this).toNumber();
        }
        catch (error) {
            throwFault('overflow', 'toNumber', this.toString());
        }
        return null;
    };
    BigNumber.prototype.toBigInt = function () {
        try {
            return BigInt(this.toString());
        }
        catch (e) { }
        return logger.throwError('this platform does not support BigInt', logger_1.Logger.errors.UNSUPPORTED_OPERATION, {
            value: this.toString()
        });
    };
    BigNumber.prototype.toString = function () {
        // Lots of people expect this, which we do not support, so check (See: #889)
        if (arguments.length > 0) {
            if (arguments[0] === 10) {
                if (!_warnedToStringRadix) {
                    _warnedToStringRadix = true;
                    logger.warn('BigNumber.toString does not accept any parameters; base-10 is assumed');
                }
            }
            else if (arguments[0] === 16) {
                logger.throwError('BigNumber.toString does not accept any parameters; use bigNumber.toHexString()', logger_1.Logger.errors.UNEXPECTED_ARGUMENT, {});
            }
            else {
                logger.throwError('BigNumber.toString does not accept parameters', logger_1.Logger.errors.UNEXPECTED_ARGUMENT, {});
            }
        }
        return toBN(this).toString(10);
    };
    BigNumber.prototype.toHexString = function () {
        return this._hex;
    };
    BigNumber.prototype.toJSON = function (key) {
        return { type: 'BigNumber', hex: this.toHexString() };
    };
    BigNumber.from = function (value) {
        if (value instanceof BigNumber) {
            return value;
        }
        if (typeof value === 'string') {
            if (value.match(/^-?0x[0-9a-f]+$/i)) {
                return new BigNumber(_constructorGuard, toHex(value));
            }
            if (value.match(/^-?[0-9]+$/)) {
                return new BigNumber(_constructorGuard, toHex(new BN(value)));
            }
            return logger.throwArgumentError('invalid BigNumber string', 'value', value);
        }
        if (typeof value === 'number') {
            if (value % 1) {
                throwFault('underflow', 'BigNumber.from', value);
            }
            if (value >= MAX_SAFE || value <= -MAX_SAFE) {
                throwFault('overflow', 'BigNumber.from', value);
            }
            return BigNumber.from(String(value));
        }
        var anyValue = value;
        if (typeof anyValue === 'bigint') {
            return BigNumber.from(anyValue.toString());
        }
        if (isBytes(anyValue)) {
            return BigNumber.from(hexlify(anyValue));
        }
        if (anyValue) {
            // Hexable interface (takes piority)
            if (anyValue.toHexString) {
                var hex = anyValue.toHexString();
                if (typeof hex === 'string') {
                    return BigNumber.from(hex);
                }
            }
            else {
                // For now, handle legacy JSON-ified values (goes away in v6)
                var hex = anyValue._hex;
                // New-form JSON
                if (hex == null && anyValue.type === 'BigNumber') {
                    hex = anyValue.hex;
                }
                if (typeof hex === 'string') {
                    if (isHexString(hex) || (hex[0] === '-' && isHexString(hex.substring(1)))) {
                        return BigNumber.from(hex);
                    }
                }
            }
        }
        return logger.throwArgumentError('invalid BigNumber value', 'value', value);
    };
    BigNumber.isBigNumber = function (value) {
        return !!(value && value._isBigNumber);
    };
    return BigNumber;
}());
function toBigNumber(value) {
    return BigNumber.from(toHex(value));
}
var Reader = /** @class */ (function () {
    function Reader(data, wordSize, coerceFunc, allowLoose) {
        defineReadOnly(this, '_data', arrayify(data));
        defineReadOnly(this, 'wordSize', wordSize || 32);
        defineReadOnly(this, '_coerceFunc', coerceFunc);
        defineReadOnly(this, 'allowLoose', allowLoose);
        this._offset = 0;
    }
    Object.defineProperty(Reader.prototype, "data", {
        get: function () {
            return hexlify(this._data);
        },
        enumerable: false,
        configurable: true
    });
    Object.defineProperty(Reader.prototype, "consumed", {
        get: function () {
            return this._offset;
        },
        enumerable: false,
        configurable: true
    });
    // The default Coerce function
    Reader.coerce = function (name, value) {
        var match = name.match('^u?int([0-9]+)$');
        if (match && parseInt(match[1]) <= 48) {
            value = value.toNumber();
        }
        return value;
    };
    Reader.prototype.coerce = function (name, value) {
        if (this._coerceFunc) {
            return this._coerceFunc(name, value);
        }
        return Reader.coerce(name, value);
    };
    Reader.prototype._peekBytes = function (offset, length, loose) {
        var alignedLength = Math.ceil(length / this.wordSize) * this.wordSize;
        if (this._offset + alignedLength > this._data.length) {
            if (this.allowLoose && loose && this._offset + length <= this._data.length) {
                alignedLength = length;
            }
            else {
                logger.throwError('data out-of-bounds', logger_1.Logger.errors.BUFFER_OVERRUN, {
                    length: this._data.length,
                    offset: this._offset + alignedLength
                });
            }
        }
        return this._data.slice(this._offset, this._offset + alignedLength);
    };
    Reader.prototype.subReader = function (offset) {
        return new Reader(this._data.slice(this._offset + offset), this.wordSize, this._coerceFunc, this.allowLoose);
    };
    Reader.prototype.readBytes = function (length, loose) {
        var bytes = this._peekBytes(0, length, !!loose);
        this._offset += bytes.length;
        // @TODO: Make sure the length..end bytes are all 0?
        return bytes.slice(0, length);
    };
    Reader.prototype.readValue = function () {
        return BigNumber.from(this.readBytes(this.wordSize));
    };
    return Reader;
}());
var Coder = /** @class */ (function () {
    function Coder(name, type, localName, dynamic) {
        // @TODO: defineReadOnly these
        this.name = name;
        this.type = type;
        this.localName = localName;
        this.dynamic = dynamic;
    }
    Coder.prototype._throwError = function (message, value) {
        logger.throwArgumentError(message, this.localName, value);
    };
    return Coder;
}());
var js_sha3_1 = require("js-sha3");
function keccak256(data) {
    return '0x' + js_sha3_1.default.keccak_256(arrayify(data));
}
function getChecksumAddress(address) {
    if (!isHexString(address, 20)) {
        logger.throwArgumentError('invalid address', 'address', address);
    }
    address = address.toLowerCase();
    var chars = address.substring(2).split('');
    var expanded = new Uint8Array(40);
    for (var i = 0; i < 40; i++) {
        expanded[i] = chars[i].charCodeAt(0);
    }
    var hashed = arrayify(keccak256(expanded));
    for (var i = 0; i < 40; i += 2) {
        if (hashed[i >> 1] >> 4 >= 8) {
            chars[i] = chars[i].toUpperCase();
        }
        if ((hashed[i >> 1] & 0x0f) >= 8) {
            chars[i + 1] = chars[i + 1].toUpperCase();
        }
    }
    return '0x' + chars.join('');
}
var ibanLookup = {};
for (var i = 0; i < 10; i++) {
    ibanLookup[String(i)] = String(i);
}
for (var i = 0; i < 26; i++) {
    ibanLookup[String.fromCharCode(65 + i)] = String(10 + i);
}
var MAX_SAFE_INTEGER = 0x1fffffffffffff;
function log10(x) {
    if (Math.log10) {
        return Math.log10(x);
    }
    return Math.log(x) / Math.LN10;
}
var safeDigits = Math.floor(log10(MAX_SAFE_INTEGER));
function ibanChecksum(address) {
    address = address.toUpperCase();
    address = address.substring(4) + address.substring(0, 2) + '00';
    var expanded = address
        .split('')
        .map(function (c) {
        return ibanLookup[c];
    })
        .join('');
    // Javascript can handle integers safely up to 15 (decimal) digits
    while (expanded.length >= safeDigits) {
        var block = expanded.substring(0, safeDigits);
        expanded = (parseInt(block, 10) % 97) + expanded.substring(block.length);
    }
    var checksum = String(98 - (parseInt(expanded, 10) % 97));
    while (checksum.length < 2) {
        checksum = '0' + checksum;
    }
    return checksum;
}
function _base36To16(value) {
    return new BN(value, 36).toString(16);
}
function getAddress(address) {
    var result = null;
    if (typeof address !== 'string') {
        logger.throwArgumentError('invalid address', 'address', address);
    }
    if (address.match(/^(0x)?[0-9a-fA-F]{40}$/)) {
        // Missing the 0x prefix
        if (address.substring(0, 2) !== '0x') {
            address = '0x' + address;
        }
        result = getChecksumAddress(address);
        // It is a checksummed address with a bad checksum
        if (address.match(/([A-F].*[a-f])|([a-f].*[A-F])/) && result !== address) {
            logger.throwArgumentError('bad address checksum', 'address', address);
        }
        // Maybe ICAP? (we only support direct mode)
    }
    else if (address.match(/^XE[0-9]{2}[0-9A-Za-z]{30,31}$/)) {
        // It is an ICAP address with a bad checksum
        if (address.substring(2, 4) !== ibanChecksum(address)) {
            logger.throwArgumentError('bad icap checksum', 'address', address);
        }
        result = _base36To16(address.substring(4));
        while (result.length < 40) {
            result = '0' + result;
        }
        result = getChecksumAddress('0x' + result);
    }
    else {
        logger.throwArgumentError('invalid address', 'address', address);
    }
    return result;
}
function hexZeroPad(value, length) {
    if (typeof value !== 'string') {
        value = hexlify(value);
    }
    else if (!isHexString(value)) {
        logger.throwArgumentError('invalid hex string', 'value', value);
    }
    if (value.length > 2 * length + 2) {
        logger.throwArgumentError('value out of range', 'value', arguments[1]);
    }
    while (value.length < 2 * length + 2) {
        value = '0x0' + value.substring(2);
    }
    return value;
}
var AddressCoder = /** @class */ (function (_super) {
    __extends(AddressCoder, _super);
    function AddressCoder(localName) {
        return _super.call(this, 'address', 'address', localName, false) || this;
    }
    AddressCoder.prototype.defaultValue = function () {
        return '0x0000000000000000000000000000000000000000';
    };
    AddressCoder.prototype.encode = function (writer, value) {
        try {
            getAddress(value);
        }
        catch (error) {
            this._throwError(error.message, value);
        }
        return writer.writeValue(value);
    };
    AddressCoder.prototype.decode = function (reader) {
        return getAddress(hexZeroPad(reader.readValue().toHexString(), 20));
    };
    return AddressCoder;
}(Coder));
var BooleanCoder = /** @class */ (function (_super) {
    __extends(BooleanCoder, _super);
    function BooleanCoder(localName) {
        return _super.call(this, 'bool', 'bool', localName, false) || this;
    }
    BooleanCoder.prototype.defaultValue = function () {
        return false;
    };
    BooleanCoder.prototype.encode = function (writer, value) {
        return writer.writeValue(value ? 1 : 0);
    };
    BooleanCoder.prototype.decode = function (reader) {
        return reader.coerce(this.type, !reader.readValue().isZero());
    };
    return BooleanCoder;
}(Coder));
var DynamicBytesCoder = /** @class */ (function (_super) {
    __extends(DynamicBytesCoder, _super);
    function DynamicBytesCoder(type, localName) {
        return _super.call(this, type, type, localName, true) || this;
    }
    DynamicBytesCoder.prototype.defaultValue = function () {
        return '0x';
    };
    DynamicBytesCoder.prototype.encode = function (writer, value) {
        value = arrayify(value);
        var length = writer.writeValue(value.length);
        length += writer.writeBytes(value);
        return length;
    };
    DynamicBytesCoder.prototype.decode = function (reader) {
        return reader.readBytes(reader.readValue().toNumber(), true);
    };
    return DynamicBytesCoder;
}(Coder));
var UnicodeNormalizationForm;
(function (UnicodeNormalizationForm) {
    UnicodeNormalizationForm["current"] = "";
    UnicodeNormalizationForm["NFC"] = "NFC";
    UnicodeNormalizationForm["NFD"] = "NFD";
    UnicodeNormalizationForm["NFKC"] = "NFKC";
    UnicodeNormalizationForm["NFKD"] = "NFKD";
})(UnicodeNormalizationForm || (UnicodeNormalizationForm = {}));
function toUtf8Bytes(str, form) {
    if (form === void 0) { form = UnicodeNormalizationForm.current; }
    if (form != UnicodeNormalizationForm.current) {
        logger.checkNormalize();
        str = str.normalize(form);
    }
    var result = [];
    for (var i = 0; i < str.length; i++) {
        var c = str.charCodeAt(i);
        if (c < 0x80) {
            result.push(c);
        }
        else if (c < 0x800) {
            result.push((c >> 6) | 0xc0);
            result.push((c & 0x3f) | 0x80);
        }
        else if ((c & 0xfc00) == 0xd800) {
            i++;
            var c2 = str.charCodeAt(i);
            if (i >= str.length || (c2 & 0xfc00) !== 0xdc00) {
                throw new Error('invalid utf-8 string');
            }
            // Surrogate Pair
            var pair = 0x10000 + ((c & 0x03ff) << 10) + (c2 & 0x03ff);
            result.push((pair >> 18) | 0xf0);
            result.push(((pair >> 12) & 0x3f) | 0x80);
            result.push(((pair >> 6) & 0x3f) | 0x80);
            result.push((pair & 0x3f) | 0x80);
        }
        else {
            result.push((c >> 12) | 0xe0);
            result.push(((c >> 6) & 0x3f) | 0x80);
            result.push((c & 0x3f) | 0x80);
        }
    }
    return arrayify(result);
}
function _toUtf8String(codePoints) {
    return codePoints
        .map(function (codePoint) {
        if (codePoint <= 0xffff) {
            return String.fromCharCode(codePoint);
        }
        codePoint -= 0x10000;
        return String.fromCharCode(((codePoint >> 10) & 0x3ff) + 0xd800, (codePoint & 0x3ff) + 0xdc00);
    })
        .join('');
}
var Utf8ErrorReason;
(function (Utf8ErrorReason) {
    // A continuation byte was present where there was nothing to continue
    // - offset = the index the codepoint began in
    Utf8ErrorReason["UNEXPECTED_CONTINUE"] = "unexpected continuation byte";
    // An invalid (non-continuation) byte to start a UTF-8 codepoint was found
    // - offset = the index the codepoint began in
    Utf8ErrorReason["BAD_PREFIX"] = "bad codepoint prefix";
    // The string is too short to process the expected codepoint
    // - offset = the index the codepoint began in
    Utf8ErrorReason["OVERRUN"] = "string overrun";
    // A missing continuation byte was expected but not found
    // - offset = the index the continuation byte was expected at
    Utf8ErrorReason["MISSING_CONTINUE"] = "missing continuation byte";
    // The computed code point is outside the range for UTF-8
    // - offset       = start of this codepoint
    // - badCodepoint = the computed codepoint; outside the UTF-8 range
    Utf8ErrorReason["OUT_OF_RANGE"] = "out of UTF-8 range";
    // UTF-8 strings may not contain UTF-16 surrogate pairs
    // - offset       = start of this codepoint
    // - badCodepoint = the computed codepoint; inside the UTF-16 surrogate range
    Utf8ErrorReason["UTF16_SURROGATE"] = "UTF-16 surrogate";
    // The string is an overlong reperesentation
    // - offset       = start of this codepoint
    // - badCodepoint = the computed codepoint; already bounds checked
    Utf8ErrorReason["OVERLONG"] = "overlong representation";
})(Utf8ErrorReason || (Utf8ErrorReason = {}));
function errorFunc(reason, offset, bytes, output, badCodepoint) {
    return logger.throwArgumentError("invalid codepoint at offset " + offset + "; " + reason, 'bytes', bytes);
}
function ignoreFunc(reason, offset, bytes, output, badCodepoint) {
    // If there is an invalid prefix (including stray continuation), skip any additional continuation bytes
    if (reason === Utf8ErrorReason.BAD_PREFIX || reason === Utf8ErrorReason.UNEXPECTED_CONTINUE) {
        var i = 0;
        for (var o = offset + 1; o < bytes.length; o++) {
            if (bytes[o] >> 6 !== 0x02) {
                break;
            }
            i++;
        }
        return i;
    }
    // This byte runs us past the end of the string, so just jump to the end
    // (but the first byte was read already read and therefore skipped)
    if (reason === Utf8ErrorReason.OVERRUN) {
        return bytes.length - offset - 1;
    }
    // Nothing to skip
    return 0;
}
function replaceFunc(reason, offset, bytes, output, badCodepoint) {
    // Overlong representations are otherwise "valid" code points; just non-deistingtished
    if (reason === Utf8ErrorReason.OVERLONG) {
        output.push(badCodepoint);
        return 0;
    }
    // Put the replacement character into the output
    output.push(0xfffd);
    // Otherwise, process as if ignoring errors
    return ignoreFunc(reason, offset, bytes, output, badCodepoint);
}
var Utf8ErrorFuncs = Object.freeze({
    error: errorFunc,
    ignore: ignoreFunc,
    replace: replaceFunc
});
function getUtf8CodePoints(bytes, onError) {
    if (onError == null) {
        onError = Utf8ErrorFuncs.error;
    }
    bytes = arrayify(bytes);
    var result = [];
    var i = 0;
    // Invalid bytes are ignored
    while (i < bytes.length) {
        var c = bytes[i++];
        // 0xxx xxxx
        if (c >> 7 === 0) {
            result.push(c);
            continue;
        }
        // Multibyte; how many bytes left for this character?
        var extraLength = null;
        var overlongMask = null;
        // 110x xxxx 10xx xxxx
        if ((c & 0xe0) === 0xc0) {
            extraLength = 1;
            overlongMask = 0x7f;
            // 1110 xxxx 10xx xxxx 10xx xxxx
        }
        else if ((c & 0xf0) === 0xe0) {
            extraLength = 2;
            overlongMask = 0x7ff;
            // 1111 0xxx 10xx xxxx 10xx xxxx 10xx xxxx
        }
        else if ((c & 0xf8) === 0xf0) {
            extraLength = 3;
            overlongMask = 0xffff;
        }
        else {
            if ((c & 0xc0) === 0x80) {
                i += onError(Utf8ErrorReason.UNEXPECTED_CONTINUE, i - 1, bytes, result);
            }
            else {
                i += onError(Utf8ErrorReason.BAD_PREFIX, i - 1, bytes, result);
            }
            continue;
        }
        // Do we have enough bytes in our data?
        if (i - 1 + extraLength >= bytes.length) {
            i += onError(Utf8ErrorReason.OVERRUN, i - 1, bytes, result);
            continue;
        }
        // Remove the length prefix from the char
        var res = c & ((1 << (8 - extraLength - 1)) - 1);
        for (var j = 0; j < extraLength; j++) {
            var nextChar = bytes[i];
            // Invalid continuation byte
            if ((nextChar & 0xc0) != 0x80) {
                i += onError(Utf8ErrorReason.MISSING_CONTINUE, i, bytes, result);
                res = null;
                break;
            }
            res = (res << 6) | (nextChar & 0x3f);
            i++;
        }
        // See above loop for invalid contimuation byte
        if (res === null) {
            continue;
        }
        // Maximum code point
        if (res > 0x10ffff) {
            i += onError(Utf8ErrorReason.OUT_OF_RANGE, i - 1 - extraLength, bytes, result, res);
            continue;
        }
        // Reserved for UTF-16 surrogate halves
        if (res >= 0xd800 && res <= 0xdfff) {
            i += onError(Utf8ErrorReason.UTF16_SURROGATE, i - 1 - extraLength, bytes, result, res);
            continue;
        }
        // Check for overlong sequences (more bytes than needed)
        if (res <= overlongMask) {
            i += onError(Utf8ErrorReason.OVERLONG, i - 1 - extraLength, bytes, result, res);
            continue;
        }
        result.push(res);
    }
    return result;
}
function toUtf8String(bytes, onError) {
    return _toUtf8String(getUtf8CodePoints(bytes, onError));
}
var StringCoder = /** @class */ (function (_super) {
    __extends(StringCoder, _super);
    function StringCoder(localName) {
        return _super.call(this, 'string', localName) || this;
    }
    StringCoder.prototype.defaultValue = function () {
        return '';
    };
    StringCoder.prototype.encode = function (writer, value) {
        return _super.prototype.encode.call(this, writer, toUtf8Bytes(value));
    };
    StringCoder.prototype.decode = function (reader) {
        return toUtf8String(_super.prototype.decode.call(this, reader));
    };
    return StringCoder;
}(DynamicBytesCoder));
var BytesCoder = /** @class */ (function (_super) {
    __extends(BytesCoder, _super);
    function BytesCoder(localName) {
        return _super.call(this, 'bytes', localName) || this;
    }
    BytesCoder.prototype.decode = function (reader) {
        return reader.coerce(this.name, hexlify(_super.prototype.decode.call(this, reader)));
    };
    return BytesCoder;
}(DynamicBytesCoder));
function pack(writer, coders, values) {
    var arrayValues = null;
    if (Array.isArray(values)) {
        arrayValues = values;
    }
    else if (values && typeof values === 'object') {
        var unique_1 = {};
        arrayValues = coders.map(function (coder) {
            var name = coder.localName;
            if (!name) {
                logger.throwError('cannot encode object for signature with missing names', logger_1.Logger.errors.INVALID_ARGUMENT, {
                    argument: 'values',
                    coder: coder,
                    value: values
                });
            }
            if (unique_1[name]) {
                logger.throwError('cannot encode object for signature with duplicate names', logger_1.Logger.errors.INVALID_ARGUMENT, {
                    argument: 'values',
                    coder: coder,
                    value: values
                });
            }
            unique_1[name] = true;
            return values[name];
        });
    }
    else {
        logger.throwArgumentError('invalid tuple value', 'tuple', values);
    }
    if (coders.length !== arrayValues.length) {
        logger.throwArgumentError('types/value length mismatch', 'tuple', values);
    }
    var staticWriter = new Writer(writer.wordSize);
    var dynamicWriter = new Writer(writer.wordSize);
    var updateFuncs = [];
    coders.forEach(function (coder, index) {
        var value = arrayValues[index];
        if (coder.dynamic) {
            // Get current dynamic offset (for the future pointer)
            var dynamicOffset_1 = dynamicWriter.length;
            // Encode the dynamic value into the dynamicWriter
            coder.encode(dynamicWriter, value);
            // Prepare to populate the correct offset once we are done
            var updateFunc_1 = staticWriter.writeUpdatableValue();
            updateFuncs.push(function (baseOffset) {
                updateFunc_1(baseOffset + dynamicOffset_1);
            });
        }
        else {
            coder.encode(staticWriter, value);
        }
    });
    // Backfill all the dynamic offsets, now that we know the static length
    updateFuncs.forEach(function (func) {
        func(staticWriter.length);
    });
    var length = writer.appendWriter(staticWriter);
    length += writer.appendWriter(dynamicWriter);
    return length;
}
var AnonymousCoder = /** @class */ (function (_super) {
    __extends(AnonymousCoder, _super);
    function AnonymousCoder(coder) {
        var _this = _super.call(this, coder.name, coder.type, undefined, coder.dynamic) || this;
        _this.coder = coder;
        return _this;
    }
    AnonymousCoder.prototype.defaultValue = function () {
        return this.coder.defaultValue();
    };
    AnonymousCoder.prototype.encode = function (writer, value) {
        return this.coder.encode(writer, value);
    };
    AnonymousCoder.prototype.decode = function (reader) {
        return this.coder.decode(reader);
    };
    return AnonymousCoder;
}(Coder));
var ArrayCoder = /** @class */ (function (_super) {
    __extends(ArrayCoder, _super);
    function ArrayCoder(coder, length, localName) {
        var _this = this;
        var type = coder.type + '[' + (length >= 0 ? length : '') + ']';
        var dynamic = length === -1 || coder.dynamic;
        _this = _super.call(this, 'array', type, localName, dynamic) || this;
        _this.coder = coder;
        _this.length = length;
        return _this;
    }
    ArrayCoder.prototype.defaultValue = function () {
        // Verifies the child coder is valid (even if the array is dynamic or 0-length)
        var defaultChild = this.coder.defaultValue();
        var result = [];
        for (var i = 0; i < this.length; i++) {
            result.push(defaultChild);
        }
        return result;
    };
    ArrayCoder.prototype.encode = function (writer, value) {
        if (!Array.isArray(value)) {
            this._throwError('expected array value', value);
        }
        var count = this.length;
        if (count === -1) {
            count = value.length;
            writer.writeValue(value.length);
        }
        logger.checkArgumentCount(value.length, count, 'coder array' + (this.localName ? ' ' + this.localName : ''));
        var coders = [];
        for (var i = 0; i < value.length; i++) {
            coders.push(this.coder);
        }
        return pack(writer, coders, value);
    };
    ArrayCoder.prototype.decode = function (reader) {
        var count = this.length;
        if (count === -1) {
            count = reader.readValue().toNumber();
            // Check that there is *roughly* enough data to ensure
            // stray random data is not being read as a length. Each
            // slot requires at least 32 bytes for their value (or 32
            // bytes as a link to the data). This could use a much
            // tighter bound, but we are erroring on the side of safety.
            if (count * 32 > reader._data.length) {
                logger.throwError('insufficient data length', logger_1.Logger.errors.BUFFER_OVERRUN, {
                    length: reader._data.length,
                    count: count
                });
            }
        }
        var coders = [];
        for (var i = 0; i < count; i++) {
            coders.push(new AnonymousCoder(this.coder));
        }
        return reader.coerce(this.name, unpack(reader, coders));
    };
    return ArrayCoder;
}(Coder));
function unpack(reader, coders) {
    var values = [];
    // A reader anchored to this base
    var baseReader = reader.subReader(0);
    coders.forEach(function (coder) {
        var value = null;
        if (coder.dynamic) {
            var offset = reader.readValue();
            var offsetReader = baseReader.subReader(offset.toNumber());
            try {
                value = coder.decode(offsetReader);
            }
            catch (error) {
                // Cannot recover from this
                if (error.code === logger_1.Logger.errors.BUFFER_OVERRUN) {
                    throw error;
                }
                value = error;
                value.baseType = coder.name;
                value.name = coder.localName;
                value.type = coder.type;
            }
        }
        else {
            try {
                value = coder.decode(reader);
            }
            catch (error) {
                // Cannot recover from this
                if (error.code === logger_1.Logger.errors.BUFFER_OVERRUN) {
                    throw error;
                }
                value = error;
                value.baseType = coder.name;
                value.name = coder.localName;
                value.type = coder.type;
            }
        }
        if (value != undefined) {
            values.push(value);
        }
    });
    // We only output named properties for uniquely named coders
    var uniqueNames = coders.reduce(function (accum, coder) {
        var name = coder.localName;
        if (name) {
            if (!accum[name]) {
                accum[name] = 0;
            }
            accum[name]++;
        }
        return accum;
    }, {});
    // Add any named parameters (i.e. tuples)
    coders.forEach(function (coder, index) {
        var name = coder.localName;
        if (!name || uniqueNames[name] !== 1) {
            return;
        }
        if (name === 'length') {
            name = '_length';
        }
        if (values[name] != null) {
            return;
        }
        var value = values[index];
        if (value instanceof Error) {
            Object.defineProperty(values, name, {
                get: function () {
                    throw value;
                }
            });
        }
        else {
            values[name] = value;
        }
    });
    var _loop_1 = function (i) {
        var value = values[i];
        if (value instanceof Error) {
            Object.defineProperty(values, i, {
                get: function () {
                    throw value;
                }
            });
        }
    };
    for (var i = 0; i < values.length; i++) {
        _loop_1(i);
    }
    return Object.freeze(values);
}
var TupleCoder = /** @class */ (function (_super) {
    __extends(TupleCoder, _super);
    function TupleCoder(coders, localName) {
        var _this = this;
        var dynamic = false;
        var types = [];
        coders.forEach(function (coder) {
            if (coder.dynamic) {
                dynamic = true;
            }
            types.push(coder.type);
        });
        var type = 'tuple(' + types.join(',') + ')';
        _this = _super.call(this, 'tuple', type, localName, dynamic) || this;
        _this.coders = coders;
        return _this;
    }
    TupleCoder.prototype.defaultValue = function () {
        var values = [];
        this.coders.forEach(function (coder) {
            values.push(coder.defaultValue());
        });
        // We only output named properties for uniquely named coders
        var uniqueNames = this.coders.reduce(function (accum, coder) {
            var name = coder.localName;
            if (name) {
                if (!accum[name]) {
                    accum[name] = 0;
                }
                accum[name]++;
            }
            return accum;
        }, {});
        // Add named values
        this.coders.forEach(function (coder, index) {
            var name = coder.localName;
            if (!name || uniqueNames[name] !== 1) {
                return;
            }
            if (name === 'length') {
                name = '_length';
            }
            if (values[name] != null) {
                return;
            }
            values[name] = values[index];
        });
        return Object.freeze(values);
    };
    TupleCoder.prototype.encode = function (writer, value) {
        return pack(writer, this.coders, value);
    };
    TupleCoder.prototype.decode = function (reader) {
        return reader.coerce(this.name, unpack(reader, this.coders));
    };
    return TupleCoder;
}(Coder));
var NullCoder = /** @class */ (function (_super) {
    __extends(NullCoder, _super);
    function NullCoder(localName) {
        return _super.call(this, 'null', '', localName, false) || this;
    }
    NullCoder.prototype.defaultValue = function () {
        return null;
    };
    NullCoder.prototype.encode = function (writer, value) {
        if (value != null) {
            this._throwError('not null', value);
        }
        return writer.writeBytes([]);
    };
    NullCoder.prototype.decode = function (reader) {
        reader.readBytes(0);
        return reader.coerce(this.name, null);
    };
    return NullCoder;
}(Coder));
var MaxUint256 = BigNumber.from('0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff');
var NegativeOne = BigNumber.from(-1);
var Zero = BigNumber.from(0);
var One = BigNumber.from(1);
var NumberCoder = /** @class */ (function (_super) {
    __extends(NumberCoder, _super);
    function NumberCoder(size, signed, localName) {
        var _this = this;
        var name = (signed ? 'int' : 'uint') + size * 8;
        _this = _super.call(this, name, name, localName, false) || this;
        _this.size = size;
        _this.signed = signed;
        return _this;
    }
    NumberCoder.prototype.defaultValue = function () {
        return 0;
    };
    NumberCoder.prototype.encode = function (writer, value) {
        var v = BigNumber.from(value);
        // Check bounds are safe for encoding
        var maxUintValue = MaxUint256.mask(writer.wordSize * 8);
        if (this.signed) {
            var bounds = maxUintValue.mask(this.size * 8 - 1);
            if (v.gt(bounds) || v.lt(bounds.add(One).mul(NegativeOne))) {
                this._throwError('value out-of-bounds', value);
            }
        }
        else if (v.lt(Zero) || v.gt(maxUintValue.mask(this.size * 8))) {
            this._throwError('value out-of-bounds', value);
        }
        v = v.toTwos(this.size * 8).mask(this.size * 8);
        if (this.signed) {
            v = v.fromTwos(this.size * 8).toTwos(8 * writer.wordSize);
        }
        return writer.writeValue(v);
    };
    NumberCoder.prototype.decode = function (reader) {
        var value = reader.readValue().mask(this.size * 8);
        if (this.signed) {
            value = value.fromTwos(this.size * 8);
        }
        return reader.coerce(this.name, value);
    };
    return NumberCoder;
}(Coder));
var paramTypeBytes = new RegExp(/^bytes([0-9]*)$/);
var paramTypeNumber = new RegExp(/^(u?int)([0-9]*)$/);
var FixedBytesCoder = /** @class */ (function (_super) {
    __extends(FixedBytesCoder, _super);
    function FixedBytesCoder(size, localName) {
        var _this = this;
        var name = 'bytes' + String(size);
        _this = _super.call(this, name, name, localName, false) || this;
        _this.size = size;
        return _this;
    }
    FixedBytesCoder.prototype.defaultValue = function () {
        return '0x0000000000000000000000000000000000000000000000000000000000000000'.substring(0, 2 + this.size * 2);
    };
    FixedBytesCoder.prototype.encode = function (writer, value) {
        var data = arrayify(value);
        if (data.length !== this.size) {
            this._throwError('incorrect data length', value);
        }
        return writer.writeBytes(data);
    };
    FixedBytesCoder.prototype.decode = function (reader) {
        return reader.coerce(this.name, hexlify(reader.readBytes(this.size)));
    };
    return FixedBytesCoder;
}(Coder));
var AbiCoder = /** @class */ (function () {
    function AbiCoder(coerceFunc) {
        var _newTarget = this.constructor;
        logger.checkNew(_newTarget, AbiCoder);
        defineReadOnly(this, 'coerceFunc', coerceFunc || null);
    }
    AbiCoder.prototype._getCoder = function (param) {
        var _this = this;
        switch (param.baseType) {
            case 'address':
                return new AddressCoder(param.name);
            case 'bool':
                return new BooleanCoder(param.name);
            case 'string':
                return new StringCoder(param.name);
            case 'bytes':
                return new BytesCoder(param.name);
            case 'array':
                return new ArrayCoder(this._getCoder(param.arrayChildren), param.arrayLength, param.name);
            case 'tuple':
                return new TupleCoder((param.components || []).map(function (component) {
                    return _this._getCoder(component);
                }), param.name);
            case '':
                return new NullCoder(param.name);
        }
        // u?int[0-9]*
        var match = param.type.match(paramTypeNumber);
        if (match) {
            var size = parseInt(match[2] || '256');
            if (size === 0 || size > 256 || size % 8 !== 0) {
                logger.throwArgumentError('invalid ' + match[1] + ' bit length', 'param', param);
            }
            return new NumberCoder(size / 8, match[1] === 'int', param.name);
        }
        // bytes[0-9]+
        match = param.type.match(paramTypeBytes);
        if (match) {
            var size = parseInt(match[1]);
            if (size === 0 || size > 32) {
                logger.throwArgumentError('invalid bytes length', 'param', param);
            }
            return new FixedBytesCoder(size, param.name);
        }
        return logger.throwArgumentError('invalid type', 'type', param.type);
    };
    AbiCoder.prototype._getWordSize = function () {
        return 32;
    };
    AbiCoder.prototype._getReader = function (data, allowLoose) {
        return new Reader(data, this._getWordSize(), this.coerceFunc, allowLoose);
    };
    AbiCoder.prototype._getWriter = function () {
        return new Writer(this._getWordSize());
    };
    AbiCoder.prototype.getDefaultValue = function (types) {
        var _this = this;
        var coders = types.map(function (type) { return _this._getCoder(ParamType.from(type)); });
        var coder = new TupleCoder(coders, '_');
        return coder.defaultValue();
    };
    AbiCoder.prototype.encode = function (types, values) {
        var _this = this;
        if (types.length !== values.length) {
            logger.throwError('types/values length mismatch', logger_1.Logger.errors.INVALID_ARGUMENT, {
                count: { types: types.length, values: values.length },
                value: { types: types, values: values }
            });
        }
        var coders = types.map(function (type) { return _this._getCoder(ParamType.from(type)); });
        var coder = new TupleCoder(coders, '_');
        var writer = this._getWriter();
        coder.encode(writer, values);
        return writer.data;
    };
    AbiCoder.prototype.decode = function (types, data, loose) {
        var _this = this;
        var coders = types.map(function (type) { return _this._getCoder(ParamType.from(type)); });
        var coder = new TupleCoder(coders, '_');
        return coder.decode(this._getReader(arrayify(data), loose));
    };
    return AbiCoder;
}());
var regexIdentifier = new RegExp('^[a-zA-Z$_][a-zA-Z0-9$_]*$');
function verifyIdentifier(value) {
    if (!value || !value.match(regexIdentifier)) {
        logger.throwArgumentError("invalid identifier \"" + value + "\"", 'value', value);
    }
    return value;
}
var regexParen = new RegExp('^([^)(]*)\\((.*)\\)([^)(]*)$');
function splitNesting(value) {
    value = value.trim();
    var result = [];
    var accum = '';
    var depth = 0;
    for (var offset = 0; offset < value.length; offset++) {
        var c = value[offset];
        if (c === ',' && depth === 0) {
            result.push(accum);
            accum = '';
        }
        else {
            accum += c;
            if (c === '(') {
                depth++;
            }
            else if (c === ')') {
                depth--;
                if (depth === -1) {
                    logger.throwArgumentError('unbalanced parenthesis', 'value', value);
                }
            }
        }
    }
    if (accum) {
        result.push(accum);
    }
    return result;
}
function parseParams(value, allowIndex) {
    return splitNesting(value).map(function (param) { return ParamType.fromString(param, allowIndex); });
}
function checkForbidden(fragment) {
    var sig = fragment.format();
    if (sig === 'Error(string)' || sig === 'Panic(uint256)') {
        logger.throwArgumentError("cannot specify user defined " + sig + " error", 'fragment', fragment);
    }
    return fragment;
}
var Fragment = /** @class */ (function () {
    function Fragment(constructorGuard, params) {
        if (constructorGuard !== _constructorGuard) {
            logger.throwError('use a static from method', logger_1.Logger.errors.UNSUPPORTED_OPERATION, {
                operation: 'new Fragment()'
            });
        }
        populate(this, params);
        this._isFragment = true;
        Object.freeze(this);
    }
    Fragment.from = function (value) {
        if (Fragment.isFragment(value)) {
            return value;
        }
        if (typeof value === 'string') {
            return Fragment.fromString(value);
        }
        return Fragment.fromObject(value);
    };
    Fragment.fromObject = function (value) {
        if (Fragment.isFragment(value)) {
            return value;
        }
        switch (value.type) {
            case 'function':
                return FunctionFragment.fromObject(value);
            case 'event':
                return EventFragment.fromObject(value);
            case 'constructor':
                return ConstructorFragment.fromObject(value);
            case 'error':
                return ErrorFragment.fromObject(value);
            case 'fallback':
            case 'receive':
                // @TODO: Something? Maybe return a FunctionFragment? A custom DefaultFunctionFragment?
                return null;
        }
        return logger.throwArgumentError('invalid fragment object', 'value', value);
    };
    Fragment.fromString = function (value) {
        // Make sure the "returns" is surrounded by a space and all whitespace is exactly one space
        value = value.replace(/\s/g, ' ');
        value = value
            .replace(/\(/g, ' (')
            .replace(/\)/g, ') ')
            .replace(/\s+/g, ' ');
        value = value.trim();
        if (value.split(' ')[0] === 'event') {
            return EventFragment.fromString(value.substring(5).trim());
        }
        else if (value.split(' ')[0] === 'function') {
            return FunctionFragment.fromString(value.substring(8).trim());
        }
        else if (value.split('(')[0].trim() === 'constructor') {
            return ConstructorFragment.fromString(value.trim());
        }
        else if (value.split(' ')[0] === 'error') {
            return ErrorFragment.fromString(value.substring(5).trim());
        }
        return logger.throwArgumentError('unsupported fragment', 'value', value);
    };
    Fragment.isFragment = function (value) {
        return !!(value && value._isFragment);
    };
    return Fragment;
}());
var EventFragment = /** @class */ (function (_super) {
    __extends(EventFragment, _super);
    function EventFragment() {
        return _super !== null && _super.apply(this, arguments) || this;
    }
    EventFragment.prototype.format = function (format) {
        if (!format) {
            format = FormatTypes.sighash;
        }
        if (!FormatTypes[format]) {
            logger.throwArgumentError('invalid format type', 'format', format);
        }
        if (format === FormatTypes.json) {
            return JSON.stringify({
                type: 'event',
                anonymous: this.anonymous,
                name: this.name,
                inputs: this.inputs.map(function (input) { return JSON.parse(input.format(format)); })
            });
        }
        var result = '';
        if (format !== FormatTypes.sighash) {
            result += 'event ';
        }
        result +=
            this.name +
                '(' +
                this.inputs.map(function (input) { return input.format(format); }).join(format === FormatTypes.full ? ', ' : ',') +
                ') ';
        if (format !== FormatTypes.sighash) {
            if (this.anonymous) {
                result += 'anonymous ';
            }
        }
        return result.trim();
    };
    EventFragment.from = function (value) {
        if (typeof value === 'string') {
            return EventFragment.fromString(value);
        }
        return EventFragment.fromObject(value);
    };
    EventFragment.fromObject = function (value) {
        if (EventFragment.isEventFragment(value)) {
            return value;
        }
        if (value.type !== 'event') {
            logger.throwArgumentError('invalid event object', 'value', value);
        }
        var params = {
            name: verifyIdentifier(value.name),
            anonymous: value.anonymous,
            inputs: value.inputs ? value.inputs.map(ParamType.fromObject) : [],
            type: 'event'
        };
        return new EventFragment(_constructorGuard, params);
    };
    EventFragment.fromString = function (value) {
        var match = value.match(regexParen);
        if (!match) {
            logger.throwArgumentError('invalid event string', 'value', value);
        }
        var anonymous = false;
        match[3].split(' ').forEach(function (modifier) {
            switch (modifier.trim()) {
                case 'anonymous':
                    anonymous = true;
                    break;
                case '':
                    break;
                default:
                    logger.warn('unknown modifier: ' + modifier);
            }
        });
        return EventFragment.fromObject({
            name: match[1].trim(),
            anonymous: anonymous,
            inputs: parseParams(match[2], true),
            type: 'event'
        });
    };
    EventFragment.isEventFragment = function (value) {
        return value && value._isFragment && value.type === 'event';
    };
    return EventFragment;
}(Fragment));
var ErrorFragment = /** @class */ (function (_super) {
    __extends(ErrorFragment, _super);
    function ErrorFragment() {
        return _super !== null && _super.apply(this, arguments) || this;
    }
    ErrorFragment.prototype.format = function (format) {
        if (!format) {
            format = FormatTypes.sighash;
        }
        if (!FormatTypes[format]) {
            logger.throwArgumentError('invalid format type', 'format', format);
        }
        if (format === FormatTypes.json) {
            return JSON.stringify({
                type: 'error',
                name: this.name,
                inputs: this.inputs.map(function (input) { return JSON.parse(input.format(format)); })
            });
        }
        var result = '';
        if (format !== FormatTypes.sighash) {
            result += 'error ';
        }
        result +=
            this.name +
                '(' +
                this.inputs.map(function (input) { return input.format(format); }).join(format === FormatTypes.full ? ', ' : ',') +
                ') ';
        return result.trim();
    };
    ErrorFragment.from = function (value) {
        if (typeof value === 'string') {
            return ErrorFragment.fromString(value);
        }
        return ErrorFragment.fromObject(value);
    };
    ErrorFragment.fromObject = function (value) {
        if (ErrorFragment.isErrorFragment(value)) {
            return value;
        }
        if (value.type !== 'error') {
            logger.throwArgumentError('invalid error object', 'value', value);
        }
        var params = {
            type: value.type,
            name: verifyIdentifier(value.name),
            inputs: value.inputs ? value.inputs.map(ParamType.fromObject) : []
        };
        return checkForbidden(new ErrorFragment(_constructorGuard, params));
    };
    ErrorFragment.fromString = function (value) {
        var params = { type: 'error' };
        var parens = value.match(regexParen);
        if (!parens) {
            logger.throwArgumentError('invalid error signature', 'value', value);
        }
        params.name = parens[1].trim();
        if (params.name) {
            verifyIdentifier(params.name);
        }
        params.inputs = parseParams(parens[2], false);
        return checkForbidden(ErrorFragment.fromObject(params));
    };
    ErrorFragment.isErrorFragment = function (value) {
        return value && value._isFragment && value.type === 'error';
    };
    return ErrorFragment;
}(Fragment));
function verifyState(value) {
    var result = {
        constant: false,
        payable: true,
        stateMutability: 'payable'
    };
    if (value.stateMutability != null) {
        result.stateMutability = value.stateMutability;
        // Set (and check things are consistent) the constant property
        result.constant = result.stateMutability === 'view' || result.stateMutability === 'pure';
        if (value.constant != null) {
            if (!!value.constant !== result.constant) {
                logger.throwArgumentError('cannot have constant function with mutability ' + result.stateMutability, 'value', value);
            }
        }
        // Set (and check things are consistent) the payable property
        result.payable = result.stateMutability === 'payable';
        if (value.payable != null) {
            if (!!value.payable !== result.payable) {
                logger.throwArgumentError('cannot have payable function with mutability ' + result.stateMutability, 'value', value);
            }
        }
    }
    else if (value.payable != null) {
        result.payable = !!value.payable;
        // If payable we can assume non-constant; otherwise we can't assume
        if (value.constant == null && !result.payable && value.type !== 'constructor') {
            logger.throwArgumentError('unable to determine stateMutability', 'value', value);
        }
        result.constant = !!value.constant;
        if (result.constant) {
            result.stateMutability = 'view';
        }
        else {
            result.stateMutability = result.payable ? 'payable' : 'nonpayable';
        }
        if (result.payable && result.constant) {
            logger.throwArgumentError('cannot have constant payable function', 'value', value);
        }
    }
    else if (value.constant != null) {
        result.constant = !!value.constant;
        result.payable = !result.constant;
        result.stateMutability = result.constant ? 'view' : 'payable';
    }
    else if (value.type !== 'constructor') {
        logger.throwArgumentError('unable to determine stateMutability', 'value', value);
    }
    return result;
}
function parseGas(value, params) {
    params.gas = null;
    var comps = value.split('@');
    if (comps.length !== 1) {
        if (comps.length > 2) {
            logger.throwArgumentError('invalid human-readable ABI signature', 'value', value);
        }
        if (!comps[1].match(/^[0-9]+$/)) {
            logger.throwArgumentError('invalid human-readable ABI signature gas', 'value', value);
        }
        params.gas = BigNumber.from(comps[1]);
        return comps[0];
    }
    return value;
}
function parseModifiers(value, params) {
    params.constant = false;
    params.payable = false;
    params.stateMutability = 'nonpayable';
    value.split(' ').forEach(function (modifier) {
        switch (modifier.trim()) {
            case 'constant':
                params.constant = true;
                break;
            case 'payable':
                params.payable = true;
                params.stateMutability = 'payable';
                break;
            case 'nonpayable':
                params.payable = false;
                params.stateMutability = 'nonpayable';
                break;
            case 'pure':
                params.constant = true;
                params.stateMutability = 'pure';
                break;
            case 'view':
                params.constant = true;
                params.stateMutability = 'view';
                break;
            case 'external':
            case 'public':
            case '':
                break;
            default:
                console.log('unknown modifier: ' + modifier);
        }
    });
}
function hexDataSlice(data, offset, endOffset) {
    if (typeof data !== 'string') {
        data = hexlify(data);
    }
    else if (!isHexString(data) || data.length % 2) {
        logger.throwArgumentError('invalid hexData', 'value', data);
    }
    offset = 2 + 2 * offset;
    if (endOffset != null) {
        return '0x' + data.substring(offset, 2 + 2 * endOffset);
    }
    return '0x' + data.substring(offset);
}
var ConstructorFragment = /** @class */ (function (_super) {
    __extends(ConstructorFragment, _super);
    function ConstructorFragment() {
        return _super !== null && _super.apply(this, arguments) || this;
    }
    ConstructorFragment.prototype.format = function (format) {
        if (!format) {
            format = FormatTypes.sighash;
        }
        if (!FormatTypes[format]) {
            logger.throwArgumentError('invalid format type', 'format', format);
        }
        if (format === FormatTypes.json) {
            return JSON.stringify({
                type: 'constructor',
                stateMutability: this.stateMutability !== 'nonpayable' ? this.stateMutability : undefined,
                payable: this.payable,
                gas: this.gas ? this.gas.toNumber() : undefined,
                inputs: this.inputs.map(function (input) { return JSON.parse(input.format(format)); })
            });
        }
        if (format === FormatTypes.sighash) {
            logger.throwError('cannot format a constructor for sighash', logger_1.Logger.errors.UNSUPPORTED_OPERATION, {
                operation: 'format(sighash)'
            });
        }
        var result = 'constructor(' +
            this.inputs.map(function (input) { return input.format(format); }).join(format === FormatTypes.full ? ', ' : ',') +
            ') ';
        if (this.stateMutability && this.stateMutability !== 'nonpayable') {
            result += this.stateMutability + ' ';
        }
        return result.trim();
    };
    ConstructorFragment.from = function (value) {
        if (typeof value === 'string') {
            return ConstructorFragment.fromString(value);
        }
        return ConstructorFragment.fromObject(value);
    };
    ConstructorFragment.fromObject = function (value) {
        if (ConstructorFragment.isConstructorFragment(value)) {
            return value;
        }
        if (value.type !== 'constructor') {
            logger.throwArgumentError('invalid constructor object', 'value', value);
        }
        var state = verifyState(value);
        if (state.constant) {
            logger.throwArgumentError('constructor cannot be constant', 'value', value);
        }
        var params = {
            name: null,
            type: value.type,
            inputs: value.inputs ? value.inputs.map(ParamType.fromObject) : [],
            payable: state.payable,
            stateMutability: state.stateMutability,
            gas: value.gas ? BigNumber.from(value.gas) : null
        };
        return new ConstructorFragment(_constructorGuard, params);
    };
    ConstructorFragment.fromString = function (value) {
        var params = { type: 'constructor' };
        value = parseGas(value, params);
        var parens = value.match(regexParen);
        if (!parens || parens[1].trim() !== 'constructor') {
            logger.throwArgumentError('invalid constructor string', 'value', value);
        }
        params.inputs = parseParams(parens[2].trim(), false);
        parseModifiers(parens[3].trim(), params);
        return ConstructorFragment.fromObject(params);
    };
    ConstructorFragment.isConstructorFragment = function (value) {
        return value && value._isFragment && value.type === 'constructor';
    };
    return ConstructorFragment;
}(Fragment));
var FunctionFragment = /** @class */ (function (_super) {
    __extends(FunctionFragment, _super);
    function FunctionFragment() {
        return _super !== null && _super.apply(this, arguments) || this;
    }
    FunctionFragment.prototype.format = function (format) {
        if (!format) {
            format = FormatTypes.sighash;
        }
        if (!FormatTypes[format]) {
            logger.throwArgumentError('invalid format type', 'format', format);
        }
        if (format === FormatTypes.json) {
            return JSON.stringify({
                type: 'function',
                name: this.name,
                constant: this.constant,
                stateMutability: this.stateMutability !== 'nonpayable' ? this.stateMutability : undefined,
                payable: this.payable,
                gas: this.gas ? this.gas.toNumber() : undefined,
                inputs: this.inputs.map(function (input) { return JSON.parse(input.format(format)); }),
                outputs: this.outputs.map(function (output) { return JSON.parse(output.format(format)); })
            });
        }
        var result = '';
        if (format !== FormatTypes.sighash) {
            result += 'function ';
        }
        result +=
            this.name +
                '(' +
                this.inputs.map(function (input) { return input.format(format); }).join(format === FormatTypes.full ? ', ' : ',') +
                ') ';
        if (format !== FormatTypes.sighash) {
            if (this.stateMutability) {
                if (this.stateMutability !== 'nonpayable') {
                    result += this.stateMutability + ' ';
                }
            }
            else if (this.constant) {
                result += 'view ';
            }
            if (this.outputs && this.outputs.length) {
                result += 'returns (' + this.outputs.map(function (output) { return output.format(format); }).join(', ') + ') ';
            }
            if (this.gas != null) {
                result += '@' + this.gas.toString() + ' ';
            }
        }
        return result.trim();
    };
    FunctionFragment.from = function (value) {
        if (typeof value === 'string') {
            return FunctionFragment.fromString(value);
        }
        return FunctionFragment.fromObject(value);
    };
    FunctionFragment.fromObject = function (value) {
        if (FunctionFragment.isFunctionFragment(value)) {
            return value;
        }
        if (value.type !== 'function') {
            logger.throwArgumentError('invalid function object', 'value', value);
        }
        var state = verifyState(value);
        var params = {
            type: value.type,
            name: verifyIdentifier(value.name),
            constant: state.constant,
            inputs: value.inputs ? value.inputs.map(ParamType.fromObject) : [],
            outputs: value.outputs ? value.outputs.map(ParamType.fromObject) : [],
            payable: state.payable,
            stateMutability: state.stateMutability,
            gas: value.gas ? BigNumber.from(value.gas) : null
        };
        return new FunctionFragment(_constructorGuard, params);
    };
    FunctionFragment.fromString = function (value) {
        var params = { type: 'function' };
        value = parseGas(value, params);
        var comps = value.split(' returns ');
        if (comps.length > 2) {
            logger.throwArgumentError('invalid function string', 'value', value);
        }
        var parens = comps[0].match(regexParen);
        if (!parens) {
            logger.throwArgumentError('invalid function signature', 'value', value);
        }
        params.name = parens[1].trim();
        if (params.name) {
            verifyIdentifier(params.name);
        }
        params.inputs = parseParams(parens[2], false);
        parseModifiers(parens[3].trim(), params);
        // We have outputs
        if (comps.length > 1) {
            var returns = comps[1].match(regexParen);
            if (returns[1].trim() != '' || returns[3].trim() != '') {
                logger.throwArgumentError('unexpected tokens', 'value', value);
            }
            params.outputs = parseParams(returns[2], false);
        }
        else {
            params.outputs = [];
        }
        return FunctionFragment.fromObject(params);
    };
    FunctionFragment.isFunctionFragment = function (value) {
        return value && value._isFragment && value.type === 'function';
    };
    return FunctionFragment;
}(ConstructorFragment));
function getStatic(ctor, key) {
    for (var i = 0; i < 32; i++) {
        if (ctor[key]) {
            return ctor[key];
        }
        if (!ctor.prototype || typeof ctor.prototype !== 'object') {
            break;
        }
        ctor = Object.getPrototypeOf(ctor.prototype).constructor;
    }
    return null;
}
var defaultAbiCoder = new AbiCoder();
function id(text) {
    return keccak256(toUtf8Bytes(text));
}
var BuiltinErrors = {
    '0x08c379a0': { signature: 'Error(string)', name: 'Error', inputs: ['string'], reason: true },
    '0x4e487b71': { signature: 'Panic(uint256)', name: 'Panic', inputs: ['uint256'] }
};
var Description = /** @class */ (function () {
    function Description(info) {
        for (var key in info) {
            ;
            this[key] = deepCopy(info[key]);
        }
    }
    return Description;
}());
var Indexed = /** @class */ (function (_super) {
    __extends(Indexed, _super);
    function Indexed() {
        return _super !== null && _super.apply(this, arguments) || this;
    }
    Indexed.isIndexed = function (value) {
        return !!(value && value._isIndexed);
    };
    return Indexed;
}(Description));
function wrapAccessError(property, error) {
    var wrap = new Error("deferred error during ABI decoding triggered accessing " + property);
    wrap.error = error;
    return wrap;
}
var TransactionDescription = /** @class */ (function (_super) {
    __extends(TransactionDescription, _super);
    function TransactionDescription() {
        return _super !== null && _super.apply(this, arguments) || this;
    }
    return TransactionDescription;
}(Description));
var LogDescription = /** @class */ (function (_super) {
    __extends(LogDescription, _super);
    function LogDescription() {
        return _super !== null && _super.apply(this, arguments) || this;
    }
    return LogDescription;
}(Description));
var ErrorDescription = /** @class */ (function (_super) {
    __extends(ErrorDescription, _super);
    function ErrorDescription() {
        return _super !== null && _super.apply(this, arguments) || this;
    }
    return ErrorDescription;
}(Description));
var opaque = { bigint: true, boolean: true, function: true, number: true, string: true };
function _isFrozen(object) {
    // Opaque objects are not mutable, so safe to copy by assignment
    if (object === undefined || object === null || opaque[typeof object]) {
        return true;
    }
    if (Array.isArray(object) || typeof object === 'object') {
        if (!Object.isFrozen(object)) {
            return false;
        }
        var keys = Object.keys(object);
        for (var i = 0; i < keys.length; i++) {
            if (!_isFrozen(object[keys[i]])) {
                return false;
            }
        }
        return true;
    }
    return logger.throwArgumentError("Cannot deepCopy " + typeof object, 'object', object);
}
function _deepCopy(object) {
    if (_isFrozen(object)) {
        return object;
    }
    // Arrays are mutable, so we need to create a copy
    if (Array.isArray(object)) {
        return Object.freeze(object.map(function (item) { return deepCopy(item); }));
    }
    if (typeof object === 'object') {
        var result_5 = {};
        for (var key in object) {
            var value = object[key];
            if (value === undefined) {
                continue;
            }
            defineReadOnly(result_5, key, deepCopy(value));
        }
        return result_5;
    }
    return logger.throwArgumentError("Cannot deepCopy " + typeof object, 'object', object);
}
function deepCopy(object) {
    return _deepCopy(object);
}
var Interface = /** @class */ (function () {
    function Interface(fragments) {
        var _newTarget = this.constructor;
        var _this = this;
        logger.checkNew(_newTarget, Interface);
        var abi = [];
        if (typeof fragments === 'string') {
            abi = JSON.parse(fragments);
        }
        else {
            abi = fragments;
        }
        defineReadOnly(this, 'fragments', abi
            .map(function (fragment) {
            return Fragment.from(fragment);
        })
            .filter(function (fragment) { return fragment != null; }));
        defineReadOnly(this, '_abiCoder', getStatic(_newTarget, 'getAbiCoder')());
        defineReadOnly(this, 'functions', {});
        defineReadOnly(this, 'errors', {});
        defineReadOnly(this, 'events', {});
        defineReadOnly(this, 'structs', {});
        // Add all fragments by their signature
        this.fragments.forEach(function (fragment) {
            var bucket = null;
            switch (fragment.type) {
                case 'constructor':
                    if (_this.deploy) {
                        logger.warn('duplicate definition - constructor');
                        return;
                    }
                    //checkNames(fragment, "input", fragment.inputs);
                    defineReadOnly(_this, 'deploy', fragment);
                    return;
                case 'function':
                    //checkNames(fragment, "input", fragment.inputs);
                    //checkNames(fragment, "output", (<FunctionFragment>fragment).outputs);
                    bucket = _this.functions;
                    break;
                case 'event':
                    //checkNames(fragment, "input", fragment.inputs);
                    bucket = _this.events;
                    break;
                case 'error':
                    bucket = _this.errors;
                    break;
                default:
                    return;
            }
            var signature = fragment.format();
            if (bucket[signature]) {
                logger.warn('duplicate definition - ' + signature);
                return;
            }
            bucket[signature] = fragment;
        });
        // If we do not have a constructor add a default
        if (!this.deploy) {
            defineReadOnly(this, 'deploy', ConstructorFragment.from({
                payable: false,
                type: 'constructor'
            }));
        }
        defineReadOnly(this, '_isInterface', true);
    }
    Interface.prototype.format = function (format) {
        if (!format) {
            format = FormatTypes.full;
        }
        if (format === FormatTypes.sighash) {
            logger.throwArgumentError('interface does not support formatting sighash', 'format', format);
        }
        var abi = this.fragments.map(function (fragment) { return fragment.format(format); });
        // We need to re-bundle the JSON fragments a bit
        if (format === FormatTypes.json) {
            return JSON.stringify(abi.map(function (j) { return JSON.parse(j); }));
        }
        return abi;
    };
    // Sub-classes can override these to handle other blockchains
    Interface.getAbiCoder = function () {
        return defaultAbiCoder;
    };
    Interface.getAddress = function (address) {
        return getAddress(address);
    };
    Interface.getSighash = function (fragment) {
        return hexDataSlice(id(fragment.format()), 0, 4);
    };
    Interface.getEventTopic = function (eventFragment) {
        return id(eventFragment.format());
    };
    // Find a function definition by any means necessary (unless it is ambiguous)
    Interface.prototype.getFunction = function (nameOrSignatureOrSighash) {
        if (isHexString(nameOrSignatureOrSighash)) {
            for (var name_1 in this.functions) {
                if (nameOrSignatureOrSighash === this.getSighash(name_1)) {
                    return this.functions[name_1];
                }
            }
            logger.throwArgumentError('no matching function', 'sighash', nameOrSignatureOrSighash);
        }
        // It is a bare name, look up the function (will return null if ambiguous)
        if (nameOrSignatureOrSighash.indexOf('(') === -1) {
            var name_2 = nameOrSignatureOrSighash.trim();
            var matching = Object.keys(this.functions).filter(function (f) { return f.split('(' /* fix:) */)[0] === name_2; });
            if (matching.length === 0) {
                logger.throwArgumentError('no matching function', 'name', name_2);
            }
            else if (matching.length > 1) {
                logger.throwArgumentError('multiple matching functions', 'name', name_2);
            }
            return this.functions[matching[0]];
        }
        // Normlize the signature and lookup the function
        var result = this.functions[FunctionFragment.fromString(nameOrSignatureOrSighash).format()];
        if (!result) {
            logger.throwArgumentError('no matching function', 'signature', nameOrSignatureOrSighash);
        }
        return result;
    };
    // Find an event definition by any means necessary (unless it is ambiguous)
    Interface.prototype.getEvent = function (nameOrSignatureOrTopic) {
        if (isHexString(nameOrSignatureOrTopic)) {
            var topichash = nameOrSignatureOrTopic.toLowerCase();
            for (var name_3 in this.events) {
                if (topichash === this.getEventTopic(name_3)) {
                    return this.events[name_3];
                }
            }
            logger.throwArgumentError('no matching event', 'topichash', topichash);
        }
        // It is a bare name, look up the function (will return null if ambiguous)
        if (nameOrSignatureOrTopic.indexOf('(') === -1) {
            var name_4 = nameOrSignatureOrTopic.trim();
            var matching = Object.keys(this.events).filter(function (f) { return f.split('(' /* fix:) */)[0] === name_4; });
            if (matching.length === 0) {
                logger.throwArgumentError('no matching event', 'name', name_4);
            }
            else if (matching.length > 1) {
                logger.throwArgumentError('multiple matching events', 'name', name_4);
            }
            return this.events[matching[0]];
        }
        // Normlize the signature and lookup the function
        var result = this.events[EventFragment.fromString(nameOrSignatureOrTopic).format()];
        if (!result) {
            logger.throwArgumentError('no matching event', 'signature', nameOrSignatureOrTopic);
        }
        return result;
    };
    // Find a function definition by any means necessary (unless it is ambiguous)
    Interface.prototype.getError = function (nameOrSignatureOrSighash) {
        if (isHexString(nameOrSignatureOrSighash)) {
            var getSighash = getStatic(this.constructor, 'getSighash');
            for (var name_5 in this.errors) {
                var error = this.errors[name_5];
                if (nameOrSignatureOrSighash === getSighash(error)) {
                    return this.errors[name_5];
                }
            }
            logger.throwArgumentError('no matching error', 'sighash', nameOrSignatureOrSighash);
        }
        // It is a bare name, look up the function (will return null if ambiguous)
        if (nameOrSignatureOrSighash.indexOf('(') === -1) {
            var name_6 = nameOrSignatureOrSighash.trim();
            var matching = Object.keys(this.errors).filter(function (f) { return f.split('(' /* fix:) */)[0] === name_6; });
            if (matching.length === 0) {
                logger.throwArgumentError('no matching error', 'name', name_6);
            }
            else if (matching.length > 1) {
                logger.throwArgumentError('multiple matching errors', 'name', name_6);
            }
            return this.errors[matching[0]];
        }
        // Normlize the signature and lookup the function
        var result = this.errors[FunctionFragment.fromString(nameOrSignatureOrSighash).format()];
        if (!result) {
            logger.throwArgumentError('no matching error', 'signature', nameOrSignatureOrSighash);
        }
        return result;
    };
    // Get the sighash (the bytes4 selector) used by Solidity to identify a function
    Interface.prototype.getSighash = function (fragment) {
        if (typeof fragment === 'string') {
            try {
                fragment = this.getFunction(fragment);
            }
            catch (error) {
                try {
                    fragment = this.getError(fragment);
                }
                catch (_) {
                    throw error;
                }
            }
        }
        return getStatic(this.constructor, 'getSighash')(fragment);
    };
    // Get the topic (the bytes32 hash) used by Solidity to identify an event
    Interface.prototype.getEventTopic = function (eventFragment) {
        if (typeof eventFragment === 'string') {
            eventFragment = this.getEvent(eventFragment);
        }
        return getStatic(this.constructor, 'getEventTopic')(eventFragment);
    };
    Interface.prototype._decodeParams = function (params, data) {
        return this._abiCoder.decode(params, data);
    };
    Interface.prototype._encodeParams = function (params, values) {
        return this._abiCoder.encode(params, values);
    };
    Interface.prototype.encodeDeploy = function (values) {
        return this._encodeParams(this.deploy.inputs, values || []);
    };
    Interface.prototype.decodeErrorResult = function (fragment, data) {
        if (typeof fragment === 'string') {
            fragment = this.getError(fragment);
        }
        var bytes = arrayify(data);
        if (hexlify(bytes.slice(0, 4)) !== this.getSighash(fragment)) {
            logger.throwArgumentError("data signature does not match error " + fragment.name + ".", 'data', hexlify(bytes));
        }
        return this._decodeParams(fragment.inputs, bytes.slice(4));
    };
    Interface.prototype.encodeErrorResult = function (fragment, values) {
        if (typeof fragment === 'string') {
            fragment = this.getError(fragment);
        }
        return hexlify(concat([this.getSighash(fragment), this._encodeParams(fragment.inputs, values || [])]));
    };
    // Decode the data for a function call (e.g. tx.data)
    Interface.prototype.decodeFunctionData = function (functionFragment, data) {
        if (typeof functionFragment === 'string') {
            functionFragment = this.getFunction(functionFragment);
        }
        var bytes = arrayify(data);
        if (hexlify(bytes.slice(0, 4)) !== this.getSighash(functionFragment)) {
            logger.throwArgumentError("data signature does not match function " + functionFragment.name + ".", 'data', hexlify(bytes));
        }
        return this._decodeParams(functionFragment.inputs, bytes.slice(4));
    };
    // Encode the data for a function call (e.g. tx.data)
    Interface.prototype.encodeFunctionData = function (functionFragment, values) {
        if (typeof functionFragment === 'string') {
            functionFragment = this.getFunction(functionFragment);
        }
        return hexlify(concat([this.getSighash(functionFragment), this._encodeParams(functionFragment.inputs, values || [])]));
    };
    // Decode the result from a function call (e.g. from eth_call)
    Interface.decodeFunctionResult = function (functionFragment, data) {
        if (typeof functionFragment === 'string') {
            functionFragment = this.getFunction(functionFragment);
        }
        var bytes = arrayify(data);
        var reason = null;
        var errorArgs = null;
        var errorName = null;
        var errorSignature = null;
        switch (bytes.length % this._abiCoder._getWordSize()) {
            case 0:
                try {
                    return this._abiCoder.decode(functionFragment.outputs, bytes);
                }
                catch (error) { }
                break;
            case 4: {
                var selector = hexlify(bytes.slice(0, 4));
                var builtin = BuiltinErrors[selector];
                if (builtin) {
                    errorArgs = this._abiCoder.decode(builtin.inputs, bytes.slice(4));
                    errorName = builtin.name;
                    errorSignature = builtin.signature;
                    if (builtin.reason) {
                        reason = errorArgs[0];
                    }
                }
                else {
                    try {
                        var error = this.getError(selector);
                        errorArgs = this._abiCoder.decode(error.inputs, bytes.slice(4));
                        errorName = error.name;
                        errorSignature = error.format();
                    }
                    catch (error) {
                        console.log(error);
                    }
                }
                break;
            }
        }
        return logger.throwError('call revert exception', logger_1.Logger.errors.CALL_EXCEPTION, {
            method: functionFragment.format(),
            errorArgs: errorArgs,
            errorName: errorName,
            errorSignature: errorSignature,
            reason: reason
        });
    };
    // Encode the result for a function call (e.g. for eth_call)
    Interface.prototype.encodeFunctionResult = function (functionFragment, values) {
        if (typeof functionFragment === 'string') {
            functionFragment = this.getFunction(functionFragment);
        }
        return hexlify(this._abiCoder.encode(functionFragment.outputs, values || []));
    };
    // Create the filter for the event with search criteria (e.g. for eth_filterLog)
    Interface.prototype.encodeFilterTopics = function (eventFragment, values) {
        var _this = this;
        if (typeof eventFragment === 'string') {
            eventFragment = this.getEvent(eventFragment);
        }
        if (values.length > eventFragment.inputs.length) {
            logger.throwError('too many arguments for ' + eventFragment.format(), logger_1.Logger.errors.UNEXPECTED_ARGUMENT, {
                argument: 'values',
                value: values
            });
        }
        var topics = [];
        if (!eventFragment.anonymous) {
            topics.push(this.getEventTopic(eventFragment));
        }
        var encodeTopic = function (param, value) {
            if (param.type === 'string') {
                return id(value);
            }
            else if (param.type === 'bytes') {
                return keccak256(hexlify(value));
            }
            // Check addresses are valid
            if (param.type === 'address') {
                _this._abiCoder.encode(['address'], [value]);
            }
            return hexZeroPad(hexlify(value), 32);
        };
        values.forEach(function (value, index) {
            var param = eventFragment.inputs[index];
            if (!param.indexed) {
                if (value != null) {
                    logger.throwArgumentError('cannot filter non-indexed parameters; must be null', 'contract.' + param.name, value);
                }
                return;
            }
            if (value == null) {
                topics.push(null);
            }
            else if (param.baseType === 'array' || param.baseType === 'tuple') {
                logger.throwArgumentError('filtering with tuples or arrays not supported', 'contract.' + param.name, value);
            }
            else if (Array.isArray(value)) {
                topics.push(value.map(function (value) { return encodeTopic(param, value); }));
            }
            else {
                topics.push(encodeTopic(param, value));
            }
        });
        // Trim off trailing nulls
        while (topics.length && topics[topics.length - 1] === null) {
            topics.pop();
        }
        return topics;
    };
    Interface.prototype.encodeEventLog = function (eventFragment, values) {
        var _this = this;
        if (typeof eventFragment === 'string') {
            eventFragment = this.getEvent(eventFragment);
        }
        var topics = [];
        var dataTypes = [];
        var dataValues = [];
        if (!eventFragment.anonymous) {
            topics.push(this.getEventTopic(eventFragment));
        }
        if (values.length !== eventFragment.inputs.length) {
            logger.throwArgumentError('event arguments/values mismatch', 'values', values);
        }
        eventFragment.inputs.forEach(function (param, index) {
            var value = values[index];
            if (param.indexed) {
                if (param.type === 'string') {
                    topics.push(id(value));
                }
                else if (param.type === 'bytes') {
                    topics.push(keccak256(value));
                }
                else if (param.baseType === 'tuple' || param.baseType === 'array') {
                    // @TOOD
                    throw new Error('not implemented');
                }
                else {
                    topics.push(_this._abiCoder.encode([param.type], [value]));
                }
            }
            else {
                dataTypes.push(param);
                dataValues.push(value);
            }
        });
        return {
            data: this._abiCoder.encode(dataTypes, dataValues),
            topics: topics
        };
    };
    // Decode a filter for the event and the search criteria
    Interface.prototype.decodeEventLog = function (eventFragment, data, topics) {
        if (typeof eventFragment === 'string') {
            eventFragment = this.getEvent(eventFragment);
        }
        if (topics != null && !eventFragment.anonymous) {
            var topicHash = this.getEventTopic(eventFragment);
            if (!isHexString(topics[0], 32) || topics[0].toLowerCase() !== topicHash) {
                logger.throwError('fragment/topic mismatch', logger_1.Logger.errors.INVALID_ARGUMENT, {
                    argument: 'topics[0]',
                    expected: topicHash,
                    value: topics[0]
                });
            }
            topics = topics.slice(1);
        }
        var indexed = [];
        var nonIndexed = [];
        var dynamic = [];
        eventFragment.inputs.forEach(function (param, index) {
            if (param.indexed) {
                if (param.type === 'string' ||
                    param.type === 'bytes' ||
                    param.baseType === 'tuple' ||
                    param.baseType === 'array') {
                    indexed.push(ParamType.fromObject({ type: 'bytes32', name: param.name }));
                    dynamic.push(true);
                }
                else {
                    indexed.push(param);
                    dynamic.push(false);
                }
            }
            else {
                nonIndexed.push(param);
                dynamic.push(false);
            }
        });
        var resultIndexed = topics != null ? this._abiCoder.decode(indexed, concat(topics)) : null;
        var resultNonIndexed = this._abiCoder.decode(nonIndexed, data, true);
        var result = [];
        var nonIndexedIndex = 0, indexedIndex = 0;
        eventFragment.inputs.forEach(function (param, index) {
            if (param.indexed) {
                if (resultIndexed == null) {
                    result[index] = new Indexed({ _isIndexed: true, hash: null });
                }
                else if (dynamic[index]) {
                    result[index] = new Indexed({ _isIndexed: true, hash: resultIndexed[indexedIndex++] });
                }
                else {
                    try {
                        result[index] = resultIndexed[indexedIndex++];
                    }
                    catch (error) {
                        result[index] = error;
                    }
                }
            }
            else {
                try {
                    result[index] = resultNonIndexed[nonIndexedIndex++];
                }
                catch (error) {
                    result[index] = error;
                }
            }
            // Add the keyword argument if named and safe
            if (param.name && result[param.name] == null) {
                var value_1 = result[index];
                // Make error named values throw on access
                if (value_1 instanceof Error) {
                    Object.defineProperty(result, param.name, {
                        get: function () {
                            throw wrapAccessError("property " + JSON.stringify(param.name), value_1);
                        }
                    });
                }
                else {
                    result[param.name] = value_1;
                }
            }
        });
        var _loop_2 = function (i) {
            var value = result[i];
            if (value instanceof Error) {
                Object.defineProperty(result, i, {
                    get: function () {
                        throw wrapAccessError("index " + i, value);
                    }
                });
            }
        };
        // Make all error indexed values throw on access
        for (var i = 0; i < result.length; i++) {
            _loop_2(i);
        }
        return Object.freeze(result);
    };
    // Given a transaction, find the matching function fragment (if any) and
    // determine all its properties and call parameters
    Interface.prototype.parseTransaction = function (tx) {
        var fragment = this.getFunction(tx.data.substring(0, 10).toLowerCase());
        if (!fragment) {
            return null;
        }
        return new TransactionDescription({
            args: this._abiCoder.decode(fragment.inputs, '0x' + tx.data.substring(10)),
            functionFragment: fragment,
            name: fragment.name,
            signature: fragment.format(),
            sighash: this.getSighash(fragment),
            value: BigNumber.from(tx.value || '0')
        });
    };
    // @TODO
    //parseCallResult(data: BytesLike): ??
    // Given an event log, find the matching event fragment (if any) and
    // determine all its properties and values
    Interface.prototype.parseLog = function (log) {
        var fragment = this.getEvent(log.topics[0]);
        if (!fragment || fragment.anonymous) {
            return null;
        }
        // @TODO: If anonymous, and the only method, and the input count matches, should we parse?
        //        Probably not, because just because it is the only event in the ABI does
        //        not mean we have the full ABI; maybe jsut a fragment?
        return new LogDescription({
            eventFragment: fragment,
            name: fragment.name,
            signature: fragment.format(),
            topic: this.getEventTopic(fragment),
            args: this.decodeEventLog(fragment, log.data, log.topics)
        });
    };
    Interface.prototype.parseError = function (data) {
        var hexData = hexlify(data);
        var fragment = this.getError(hexData.substring(0, 10).toLowerCase());
        if (!fragment) {
            return null;
        }
        return new ErrorDescription({
            args: this._abiCoder.decode(fragment.inputs, '0x' + hexData.substring(10)),
            errorFragment: fragment,
            name: fragment.name,
            signature: fragment.format(),
            sighash: this.getSighash(fragment)
        });
    };
    /*
      static from(value: Array<Fragment | string | JsonAbi> | string | Interface) {
          if (Interface.isInterface(value)) {
              return value;
          }
          if (typeof(value) === "string") {
              return new Interface(JSON.parse(value));
          }
          return new Interface(value);
      }
      */
    Interface.isInterface = function (value) {
        return !!(value && value._isInterface);
    };
    return Interface;
}());
var data = '0x000000000000000000000000000000000000000000000000000000000000002000000000000000000000000000000000000000000000000000000000000000045745544800000000000000000000000000000000000000000000000000000000';
var prms1 = {
    arrayChildren: null,
    arrayLength: null,
    baseType: 'string',
    components: null,
    indexed: null,
    name: null,
    type: 'string'
};
var PT = new ParamType(_constructorGuard, prms1);
var prms2 = {
    constant: true,
    gas: null,
    inputs: [],
    name: 'symbol',
    outputs: [PT],
    payable: false,
    stateMutability: 'view',
    type: 'function',
    _isFragment: true
};
var FF = new FunctionFragment(_constructorGuard, prms2);
var result = Interface.decodeFunctionResult(FF, data);
console.log(result);
