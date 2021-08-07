enum ErrorCode {
  ///////////////////
  // Generic Errors

  // Unknown Error
  UNKNOWN_ERROR = 'UNKNOWN_ERROR',

  // Not Implemented
  NOT_IMPLEMENTED = 'NOT_IMPLEMENTED',

  // Unsupported Operation
  //   - operation
  UNSUPPORTED_OPERATION = 'UNSUPPORTED_OPERATION',

  // Network Error (i.e. Ethereum Network, such as an invalid chain ID)
  //   - event ("noNetwork" is not re-thrown in provider.ready; otherwise thrown)
  NETWORK_ERROR = 'NETWORK_ERROR',

  // Some sort of bad response from the server
  SERVER_ERROR = 'SERVER_ERROR',

  // Timeout
  TIMEOUT = 'TIMEOUT',

  ///////////////////
  // Operational  Errors

  // Buffer Overrun
  BUFFER_OVERRUN = 'BUFFER_OVERRUN',

  // Numeric Fault
  //   - operation: the operation being executed
  //   - fault: the reason this faulted
  NUMERIC_FAULT = 'NUMERIC_FAULT',

  ///////////////////
  // Argument Errors

  // Missing new operator to an object
  //  - name: The name of the class
  MISSING_NEW = 'MISSING_NEW',

  // Invalid argument (e.g. value is incompatible with type) to a function:
  //   - argument: The argument name that was invalid
  //   - value: The value of the argument
  INVALID_ARGUMENT = 'INVALID_ARGUMENT',

  // Missing argument to a function:
  //   - count: The number of arguments received
  //   - expectedCount: The number of arguments expected
  MISSING_ARGUMENT = 'MISSING_ARGUMENT',

  // Too many arguments
  //   - count: The number of arguments received
  //   - expectedCount: The number of arguments expected
  UNEXPECTED_ARGUMENT = 'UNEXPECTED_ARGUMENT',

  ///////////////////
  // Blockchain Errors

  // Call exception
  //  - transaction: the transaction
  //  - address?: the contract address
  //  - args?: The arguments passed into the function
  //  - method?: The Solidity method signature
  //  - errorSignature?: The EIP848 error signature
  //  - errorArgs?: The EIP848 error parameters
  //  - reason: The reason (only for EIP848 "Error(string)")
  CALL_EXCEPTION = 'CALL_EXCEPTION',

  // Insufficien funds (< value + gasLimit * gasPrice)
  //   - transaction: the transaction attempted
  INSUFFICIENT_FUNDS = 'INSUFFICIENT_FUNDS',

  // Nonce has already been used
  //   - transaction: the transaction attempted
  NONCE_EXPIRED = 'NONCE_EXPIRED',

  // The replacement fee for the transaction is too low
  //   - transaction: the transaction attempted
  REPLACEMENT_UNDERPRICED = 'REPLACEMENT_UNDERPRICED',

  // The gas limit could not be estimated
  //   - transaction: the transaction passed to estimateGas
  UNPREDICTABLE_GAS_LIMIT = 'UNPREDICTABLE_GAS_LIMIT',

  // The transaction was replaced by one with a higher gas price
  //   - reason: "cancelled", "replaced" or "repriced"
  //   - cancelled: true if reason == "cancelled" or reason == "replaced")
  //   - hash: original transaction hash
  //   - replacement: the full TransactionsResponse for the replacement
  //   - receipt: the receipt of the replacement
  TRANSACTION_REPLACED = 'TRANSACTION_REPLACED'
}
enum LogLevel {
  DEBUG = 'DEBUG',
  INFO = 'INFO',
  WARNING = 'WARNING',
  ERROR = 'ERROR',
  OFF = 'OFF'
}
const LogLevels: { [name: string]: number } = { debug: 1, default: 2, info: 2, warning: 3, error: 4, off: 5 }
let _logLevel = LogLevels['default']
let _censorErrors = false
function _checkNormalize(): any {
  try {
    const missing: Array<string> = []

      // Make sure all forms of normalization are supported
    ;['NFD', 'NFC', 'NFKD', 'NFKC'].forEach(form => {
      try {
        if ('test'.normalize(form) !== 'test') {
          throw new Error('bad normalize')
        }
      } catch (error) {
        missing.push(form)
      }
    })

    if (missing.length) {
      throw new Error('missing ' + missing.join(', '))
    }

    if (String.fromCharCode(0xe9).normalize('NFD') !== String.fromCharCode(0x65, 0x0301)) {
      throw new Error('broken implementation')
    }
  } catch (error) {
    return error.message
  }

  return null
}
const _normalizeError = _checkNormalize()
let _globalLogger: Logger = null
let _permanentCensorErrors = false;

class Logger {
  readonly version: string

  static errors = ErrorCode

  static levels = LogLevel

  constructor(version: string) {
    Object.defineProperty(this, 'version', {
      enumerable: true,
      value: version,
      writable: false
    })
  }

  _log(logLevel: LogLevel, args: Array<any>): void {
    const level = logLevel.toLowerCase()
    if (LogLevels[level] == null) {
      this.throwArgumentError('invalid log level name', 'logLevel', logLevel)
    }
    if (_logLevel > LogLevels[level]) {
      return
    }
    console.log.apply(console, args)
  }

  debug(...args: Array<any>): void {
    this._log(Logger.levels.DEBUG, args)
  }

  info(...args: Array<any>): void {
    this._log(Logger.levels.INFO, args)
  }

  warn(...args: Array<any>): void {
    this._log(Logger.levels.WARNING, args)
  }

  makeError(message: string, code?: ErrorCode, params?: any): Error {
    // Errors are being censored
    if (_censorErrors) {
      return this.makeError('censored error', code, {})
    }

    if (!code) {
      code = Logger.errors.UNKNOWN_ERROR
    }
    if (!params) {
      params = {}
    }

    const messageDetails: Array<string> = []
    Object.keys(params).forEach(key => {
      try {
        messageDetails.push(key + '=' + JSON.stringify(params[key]))
      } catch (error) {
        messageDetails.push(key + '=' + JSON.stringify(params[key].toString()))
      }
    })
    messageDetails.push(`code=${code}`)
    messageDetails.push(`version=${this.version}`)

    const reason = message
    if (messageDetails.length) {
      message += ' (' + messageDetails.join(', ') + ')'
    }

    // @TODO: Any??
    const error: any = new Error(message)
    error.reason = reason
    error.code = code

    Object.keys(params).forEach(function(key) {
      error[key] = params[key]
    })

    return error
  }

  throwError(message: string, code?: ErrorCode, params?: any): never {
    throw this.makeError(message, code, params)
  }

  throwArgumentError(message: string, name: string, value: any): never {
    return this.throwError(message, Logger.errors.INVALID_ARGUMENT, {
      argument: name,
      value: value
    })
  }

  assert(condition: any, message: string, code?: ErrorCode, params?: any): void {
    if (!!condition) {
      return
    }
    this.throwError(message, code, params)
  }

  assertArgument(condition: any, message: string, name: string, value: any): void {
    if (!!condition) {
      return
    }
    this.throwArgumentError(message, name, value)
  }

  checkNormalize(message?: string): void {
    if (message == null) {
      message = 'platform missing String.prototype.normalize'
    }
    if (_normalizeError) {
      this.throwError('platform missing String.prototype.normalize', Logger.errors.UNSUPPORTED_OPERATION, {
        operation: 'String.prototype.normalize',
        form: _normalizeError
      })
    }
  }

  checkSafeUint53(value: number, message?: string): void {
    if (typeof value !== 'number') {
      return
    }

    if (message == null) {
      message = 'value not safe'
    }

    if (value < 0 || value >= 0x1fffffffffffff) {
      this.throwError(message, Logger.errors.NUMERIC_FAULT, {
        operation: 'checkSafeInteger',
        fault: 'out-of-safe-range',
        value: value
      })
    }

    if (value % 1) {
      this.throwError(message, Logger.errors.NUMERIC_FAULT, {
        operation: 'checkSafeInteger',
        fault: 'non-integer',
        value: value
      })
    }
  }

  checkArgumentCount(count: number, expectedCount: number, message?: string): void {
    if (message) {
      message = ': ' + message
    } else {
      message = ''
    }

    if (count < expectedCount) {
      this.throwError('missing argument' + message, Logger.errors.MISSING_ARGUMENT, {
        count: count,
        expectedCount: expectedCount
      })
    }

    if (count > expectedCount) {
      this.throwError('too many arguments' + message, Logger.errors.UNEXPECTED_ARGUMENT, {
        count: count,
        expectedCount: expectedCount
      })
    }
  }

  checkNew(target: any, kind: any): void {
    if (target === Object || target == null) {
      this.throwError('missing new', Logger.errors.MISSING_NEW, { name: kind.name })
    }
  }

  checkAbstract(target: any, kind: any): void {
    if (target === kind) {
      this.throwError(
        'cannot instantiate abstract class ' + JSON.stringify(kind.name) + ' directly; use a sub-class',
        Logger.errors.UNSUPPORTED_OPERATION,
        { name: target.name, operation: 'new' }
      )
    } else if (target === Object || target == null) {
      this.throwError('missing new', Logger.errors.MISSING_NEW, { name: kind.name })
    }
  }

  static globalLogger(): Logger {
    if (!_globalLogger) {
      _globalLogger = new Logger(version)
    }
    return _globalLogger
  }

  static setCensorship(censorship: boolean, permanent?: boolean): void {
    if (!censorship && permanent) {
      this.globalLogger().throwError('cannot permanently disable censorship', Logger.errors.UNSUPPORTED_OPERATION, {
        operation: 'setCensorship'
      })
    }

    if (_permanentCensorErrors) {
      if (!censorship) {
        return
      }
      this.globalLogger().throwError('error censorship permanent', Logger.errors.UNSUPPORTED_OPERATION, {
        operation: 'setCensorship'
      })
    }

    _censorErrors = !!censorship
    _permanentCensorErrors = !!permanent
  }

  static setLogLevel(logLevel: LogLevel): void {
    const level = LogLevels[logLevel.toLowerCase()]
    if (level == null) {
      Logger.globalLogger().warn('invalid log level - ' + logLevel)
      return
    }
    _logLevel = level
  }

  static from(version: string): Logger {
    return new Logger(version)
  }
}
const version = 'abi/5.4.0'
const logger = new Logger(version)
const _constructorGuard = {}
const paramTypeArray = new RegExp(/^(.*)\[([0-9]*)\]$/)
type ParseState = {
  allowArray?: boolean
  allowName?: boolean
  allowParams?: boolean
  allowType?: boolean
  readArray?: boolean
}
type ParseNode = {
  parent?: any
  type?: string
  name?: string
  state?: ParseState
  indexed?: boolean
  components?: Array<ParseNode>
}
const ModifiersBytes: { [name: string]: boolean } = { calldata: true, memory: true, storage: true }
const ModifiersNest: { [name: string]: boolean } = { calldata: true, memory: true }

function checkModifier(type: string, name: string): boolean {
  if (type === 'bytes' || type === 'string') {
    if (ModifiersBytes[name]) {
      return true
    }
  } else if (type === 'address') {
    if (name === 'payable') {
      return true
    }
  } else if (type.indexOf('[') >= 0 || type === 'tuple') {
    if (ModifiersNest[name]) {
      return true
    }
  }
  if (ModifiersBytes[name] || name === 'payable') {
    logger.throwArgumentError('invalid modifier', 'name', name)
  }
  return false
}
function parseParamType(param: string, allowIndexed: boolean): ParseNode {
  const originalParam = param
  function throwError(i: number) {
    logger.throwArgumentError(`unexpected character at position ${i}`, 'param', param)
  }
  param = param.replace(/\s/g, ' ')

  function newNode(parent: ParseNode): ParseNode {
    const node: ParseNode = { type: '', name: '', parent: parent, state: { allowType: true } }
    if (allowIndexed) {
      node.indexed = false
    }
    return node
  }

  const parent: ParseNode = { type: '', name: '', state: { allowType: true } }
  let node = parent

  for (let i = 0; i < param.length; i++) {
    const c = param[i]
    switch (c) {
      case '(':
        if (node.state.allowType && node.type === '') {
          node.type = 'tuple'
        } else if (!node.state.allowParams) {
          throwError(i)
        }
        node.state.allowType = false
        node.type = verifyType(node.type)
        node.components = [newNode(node)]
        node = node.components[0]
        break

      case ')':
        delete node.state

        if (node.name === 'indexed') {
          if (!allowIndexed) {
            throwError(i)
          }
          node.indexed = true
          node.name = ''
        }

        if (checkModifier(node.type, node.name)) {
          node.name = ''
        }

        node.type = verifyType(node.type)

        const child = node
        node = node.parent
        if (!node) {
          throwError(i)
        }
        delete child.parent
        node.state.allowParams = false
        node.state.allowName = true
        node.state.allowArray = true
        break

      case ',':
        delete node.state

        if (node.name === 'indexed') {
          if (!allowIndexed) {
            throwError(i)
          }
          node.indexed = true
          node.name = ''
        }

        if (checkModifier(node.type, node.name)) {
          node.name = ''
        }
        node.type = verifyType(node.type)
        const sibling: ParseNode = newNode(node.parent)
        //{ type: "", name: "", parent: node.parent, state: { allowType: true } };
        node.parent.components.push(sibling)
        delete node.parent
        node = sibling
        break

      // Hit a space...
      case ' ':
        // If reading type, the type is done and may read a param or name
        if (node.state.allowType) {
          if (node.type !== '') {
            node.type = verifyType(node.type)
            delete node.state.allowType
            node.state.allowName = true
            node.state.allowParams = true
          }
        }

        // If reading name, the name is done
        if (node.state.allowName) {
          if (node.name !== '') {
            if (node.name === 'indexed') {
              if (!allowIndexed) {
                throwError(i)
              }
              if (node.indexed) {
                throwError(i)
              }
              node.indexed = true
              node.name = ''
            } else if (checkModifier(node.type, node.name)) {
              node.name = ''
            } else {
              node.state.allowName = false
            }
          }
        }

        break

      case '[':
        if (!node.state.allowArray) {
          throwError(i)
        }

        node.type += c

        node.state.allowArray = false
        node.state.allowName = false
        node.state.readArray = true
        break

      case ']':
        if (!node.state.readArray) {
          throwError(i)
        }

        node.type += c

        node.state.readArray = false
        node.state.allowArray = true
        node.state.allowName = true
        break

      default:
        if (node.state.allowType) {
          node.type += c
          node.state.allowParams = true
          node.state.allowArray = true
        } else if (node.state.allowName) {
          node.name += c
          delete node.state.allowArray
        } else if (node.state.readArray) {
          node.type += c
        } else {
          throwError(i)
        }
    }
  }

  if (node.parent) {
    logger.throwArgumentError('unexpected eof', 'param', param)
  }

  delete parent.state

  if (node.name === 'indexed') {
    if (!allowIndexed) {
      throwError(originalParam.length - 7)
    }
    if (node.indexed) {
      throwError(originalParam.length - 7)
    }
    node.indexed = true
    node.name = ''
  } else if (checkModifier(node.type, node.name)) {
    node.name = ''
  }

  parent.type = verifyType(parent.type)

  return parent
}
function defineReadOnly<T, K extends keyof T>(object: T, name: K, value: T[K]): void {
  Object.defineProperty(object, name, {
    enumerable: true,
    value: value,
    writable: false
  })
}

const FormatTypes: { [name: string]: string } = Object.freeze({
  sighash: 'sighash',
  minimal: 'minimal',
  full: 'full',
  json: 'json'
})

function populate(object: any, params: any) {
  for (const key in params) {
    defineReadOnly(object, key, params[key])
  }
}

interface JsonFragmentType {
  readonly name?: string
  readonly indexed?: boolean
  readonly type?: string
  readonly internalType?: any // @TODO: in v6 reduce type
  readonly components?: ReadonlyArray<JsonFragmentType>
}

function verifyType(type: string): string {
  // These need to be transformed to their full description
  if (type.match(/^uint($|[^1-9])/)) {
    type = 'uint256' + type.substring(4)
  } else if (type.match(/^int($|[^1-9])/)) {
    type = 'int256' + type.substring(3)
  }
  // @TODO: more verification
  return type
}

class ParamType {
  readonly name: string
  readonly type: string
  readonly baseType: string
  readonly indexed: boolean
  readonly components: Array<ParamType>
  readonly arrayLength: number
  readonly arrayChildren: ParamType
  readonly _isParamType: boolean
  constructor(constructorGuard: any, params: any) {
    if (constructorGuard !== _constructorGuard) {
      logger.throwError('use fromString', Logger.errors.UNSUPPORTED_OPERATION, {
        operation: 'new ParamType()'
      })
    }
    populate(this, params)
    const match = this.type.match(paramTypeArray)
    if (match) {
      populate(this, {
        arrayLength: parseInt(match[2] || '-1'),
        arrayChildren: ParamType.fromObject({
          type: match[1],
          components: this.components
        }),
        baseType: 'array'
      })
    } else {
      populate(this, {
        arrayLength: null,
        arrayChildren: null,
        baseType: this.components != null ? 'tuple' : this.type
      })
    }
    this._isParamType = true
    Object.freeze(this)
  }
  format(format?: string): string {
    if (!format) {
      format = FormatTypes.sighash
    }
    if (!FormatTypes[format]) {
      logger.throwArgumentError('invalid format type', 'format', format)
    }
    if (format === FormatTypes.json) {
      const result: any = {
        type: this.baseType === 'tuple' ? 'tuple' : this.type,
        name: this.name || undefined
      }
      if (typeof this.indexed === 'boolean') {
        result.indexed = this.indexed
      }
      if (this.components) {
        result.components = this.components.map(comp => JSON.parse(comp.format(format)))
      }
      return JSON.stringify(result)
    }
    let result = ''
    if (this.baseType === 'array') {
      result += this.arrayChildren.format(format)
      result += '[' + (this.arrayLength < 0 ? '' : String(this.arrayLength)) + ']'
    } else {
      if (this.baseType === 'tuple') {
        if (format !== FormatTypes.sighash) {
          result += this.type
        }
        result +=
          '(' + this.components.map(comp => comp.format(format)).join(format === FormatTypes.full ? ', ' : ',') + ')'
      } else {
        result += this.type
      }
    }
    if (format !== FormatTypes.sighash) {
      if (this.indexed === true) {
        result += ' indexed'
      }
      if (format === FormatTypes.full && this.name) {
        result += ' ' + this.name
      }
    }
    return result
  }
  static from(value: string | JsonFragmentType | ParamType, allowIndexed?: boolean): ParamType {
    if (typeof value === 'string') {
      return ParamType.fromString(value, allowIndexed)
    }
    return ParamType.fromObject(value)
  }
  static fromObject(value: JsonFragmentType | ParamType): ParamType {
    if (ParamType.isParamType(value)) {
      return value
    }
    return new ParamType(_constructorGuard, {
      name: value.name || null,
      type: verifyType(value.type),
      indexed: value.indexed == null ? null : !!value.indexed,
      components: value.components ? value.components.map(ParamType.fromObject) : null
    })
  }

  static fromString(value: string, allowIndexed?: boolean): ParamType {
    function ParamTypify(node: ParseNode): ParamType {
      return ParamType.fromObject({
        name: node.name,
        type: node.type,
        indexed: node.indexed,
        components: node.components
      })
    }

    return ParamTypify(parseParamType(value, !!allowIndexed))
  }

  static isParamType(value: any): value is ParamType {
    return !!(value != null && value._isParamType)
  }
}
type Bytes = ArrayLike<number>
type BytesLike = Bytes | string
interface Result extends ReadonlyArray<any> {
  readonly [key: string]: any
}
type CoerceFunc = (type: string, value: any) => any
interface Hexable {
  toHexString(): string
}
type DataOptions = {
  allowMissingPrefix?: boolean
  hexPad?: 'left' | 'right' | null
}
const HexCharacters = '0123456789abcdef'
function isHexable(value: any): value is Hexable {
  return !!value.toHexString
}
function isHexString(value: any, length?: number): boolean {
  if (typeof value !== 'string' || !value.match(/^0x[0-9A-Fa-f]*$/)) {
    return false
  }
  if (length && value.length !== 2 + 2 * length) {
    return false
  }
  return true
}
function isBytes(value: any): value is Bytes {
  if (value == null) {
    return false
  }

  if (value.constructor === Uint8Array) {
    return true
  }
  if (typeof value === 'string') {
    return false
  }
  if (value.length == null) {
    return false
  }

  for (let i = 0; i < value.length; i++) {
    const v = value[i]
    if (typeof v !== 'number' || v < 0 || v >= 256 || v % 1) {
      return false
    }
  }
  return true
}
function hexlify(value: BytesLike | Hexable | number | bigint, options?: DataOptions): string {
  if (!options) {
    options = {}
  }

  if (typeof value === 'number') {
    logger.checkSafeUint53(value, 'invalid hexlify value')

    let hex = ''
    while (value) {
      hex = HexCharacters[value & 0xf] + hex
      value = Math.floor(value / 16)
    }

    if (hex.length) {
      if (hex.length % 2) {
        hex = '0' + hex
      }
      return '0x' + hex
    }

    return '0x00'
  }

  if (typeof value === 'bigint') {
    value = value.toString(16)
    if (value.length % 2) {
      return '0x0' + value
    }
    return '0x' + value
  }

  if (options.allowMissingPrefix && typeof value === 'string' && value.substring(0, 2) !== '0x') {
    value = '0x' + value
  }

  if (isHexable(value)) {
    return value.toHexString()
  }

  if (isHexString(value)) {
    if ((<string>value).length % 2) {
      if (options.hexPad === 'left') {
        value = '0x0' + (<string>value).substring(2)
      } else if (options.hexPad === 'right') {
        value += '0'
      } else {
        logger.throwArgumentError('hex data is odd-length', 'value', value)
      }
    }
    return (<string>value).toLowerCase()
  }

  if (isBytes(value)) {
    let result = '0x'
    for (let i = 0; i < value.length; i++) {
      const v = value[i]
      result += HexCharacters[(v & 0xf0) >> 4] + HexCharacters[v & 0x0f]
    }
    return result
  }

  return logger.throwArgumentError('invalid hexlify value', 'value', value)
}
function addSlice(array: Uint8Array): Uint8Array {
  if (array.slice) {
    return array
  }

  array.slice = function() {
    const args = Array.prototype.slice.call(arguments)
    return addSlice(new Uint8Array(Array.prototype.slice.apply(array, args)))
  }

  return array
}
function hexConcat(items: ReadonlyArray<BytesLike>): string {
  let result = '0x'
  items.forEach(item => {
    result += hexlify(item).substring(2)
  })
  return result
}
function arrayify(value: BytesLike | Hexable | number, options?: DataOptions): Uint8Array {
  if (!options) {
    options = {}
  }

  if (typeof value === 'number') {
    logger.checkSafeUint53(value, 'invalid arrayify value')

    const result = []
    while (value) {
      result.unshift(value & 0xff)
      value = parseInt(String(value / 256))
    }
    if (result.length === 0) {
      result.push(0)
    }

    return addSlice(new Uint8Array(result))
  }

  if (options.allowMissingPrefix && typeof value === 'string' && value.substring(0, 2) !== '0x') {
    value = '0x' + value
  }

  if (isHexable(value)) {
    value = value.toHexString()
  }

  if (isHexString(value)) {
    let hex = (<string>value).substring(2)
    if (hex.length % 2) {
      if (options.hexPad === 'left') {
        hex = '0x0' + hex.substring(2)
      } else if (options.hexPad === 'right') {
        hex += '0'
      } else {
        logger.throwArgumentError('hex data is odd-length', 'value', value)
      }
    }

    const result = []
    for (let i = 0; i < hex.length; i += 2) {
      result.push(parseInt(hex.substring(i, i + 2), 16))
    }

    return addSlice(new Uint8Array(result))
  }

  if (isBytes(value)) {
    return addSlice(new Uint8Array(value))
  }

  return logger.throwArgumentError('invalid arrayify value', 'value', value)
}
function concat(items: ReadonlyArray<BytesLike>): Uint8Array {
  const objects = items.map(item => arrayify(item))
  const length = objects.reduce((accum, item) => accum + item.length, 0)

  const result = new Uint8Array(length)

  objects.reduce((offset, object) => {
    result.set(object, offset)
    return offset + object.length
  }, 0)

  return addSlice(result)
}

class Writer {
  readonly wordSize: number

  _data: Array<Uint8Array>
  _dataLength: number
  _padding: Uint8Array

  constructor(wordSize?: number) {
    defineReadOnly(this, 'wordSize', wordSize || 32)
    this._data = []
    this._dataLength = 0
    this._padding = new Uint8Array(wordSize)
  }

  get data(): string {
    return hexConcat(this._data)
  }
  get length(): number {
    return this._dataLength
  }

  _writeData(data: Uint8Array): number {
    this._data.push(data)
    this._dataLength += data.length
    return data.length
  }

  appendWriter(writer: Writer): number {
    return this._writeData(concat(writer._data))
  }

  // Arrayish items; padded on the right to wordSize
  writeBytes(value: BytesLike): number {
    let bytes = arrayify(value)
    const paddingOffset = bytes.length % this.wordSize
    if (paddingOffset) {
      bytes = concat([bytes, this._padding.slice(paddingOffset)])
    }
    return this._writeData(bytes)
  }

  _getValue(value: BigNumberish): Uint8Array {
    let bytes = arrayify(BigNumber.from(value))
    if (bytes.length > this.wordSize) {
      logger.throwError('value out-of-bounds', Logger.errors.BUFFER_OVERRUN, {
        length: this.wordSize,
        offset: bytes.length
      })
    }
    if (bytes.length % this.wordSize) {
      bytes = concat([this._padding.slice(bytes.length % this.wordSize), bytes])
    }
    return bytes
  }

  // BigNumberish items; padded on the left to wordSize
  writeValue(value: BigNumberish): number {
    return this._writeData(this._getValue(value))
  }

  writeUpdatableValue(): (value: BigNumberish) => void {
    const offset = this._data.length
    this._data.push(this._padding)
    this._dataLength += this.wordSize
    return (value: BigNumberish) => {
      this._data[offset] = this._getValue(value)
    }
  }
}
import _BN from 'bn'
import BN = _BN.BN

function toBN(value: BigNumberish): BN {
  const hex = BigNumber.from(value).toHexString()
  if (hex[0] === '-') {
    return new BN('-' + hex.substring(3), 16)
  }
  return new BN(hex.substring(2), 16)
}
function throwFault(fault: string, operation: string, value?: any): never {
  const params: any = { fault: fault, operation: operation }
  if (value != null) {
    params.value = value
  }

  return logger.throwError(fault, Logger.errors.NUMERIC_FAULT, params)
}
let _warnedToStringRadix = false
function toHex(value: string | BN): string {
  // For BN, call on the hex string
  if (typeof value !== 'string') {
    return toHex(value.toString(16))
  }

  // If negative, prepend the negative sign to the normalized positive value
  if (value[0] === '-') {
    // Strip off the negative sign
    value = value.substring(1)

    // Cannot have mulitple negative signs (e.g. "--0x04")
    if (value[0] === '-') {
      logger.throwArgumentError('invalid hex', 'value', value)
    }

    // Call toHex on the positive component
    value = toHex(value)

    // Do not allow "-0x00"
    if (value === '0x00') {
      return value
    }

    // Negate the value
    return '-' + value
  }

  // Add a "0x" prefix if missing
  if (value.substring(0, 2) !== '0x') {
    value = '0x' + value
  }

  // Normalize zero
  if (value === '0x') {
    return '0x00'
  }

  // Make the string even length
  if (value.length % 2) {
    value = '0x0' + value.substring(2)
  }

  // Trim to smallest even-length string
  while (value.length > 4 && value.substring(0, 4) === '0x00') {
    value = '0x' + value.substring(4)
  }

  return value
}
const MAX_SAFE = 0x1fffffffffffff

class BigNumber implements Hexable {
  readonly _hex: string
  readonly _isBigNumber: boolean

  constructor(constructorGuard: any, hex: string) {
    logger.checkNew(new.target, BigNumber)

    if (constructorGuard !== _constructorGuard) {
      logger.throwError('cannot call constructor directly; use BigNumber.from', Logger.errors.UNSUPPORTED_OPERATION, {
        operation: 'new (BigNumber)'
      })
    }

    this._hex = hex
    this._isBigNumber = true

    Object.freeze(this)
  }

  fromTwos(value: number): BigNumber {
    return toBigNumber(toBN(this).fromTwos(value))
  }

  toTwos(value: number): BigNumber {
    return toBigNumber(toBN(this).toTwos(value))
  }

  abs(): BigNumber {
    if (this._hex[0] === '-') {
      return BigNumber.from(this._hex.substring(1))
    }
    return this
  }

  add(other: BigNumberish): BigNumber {
    return toBigNumber(toBN(this).add(toBN(other)))
  }

  sub(other: BigNumberish): BigNumber {
    return toBigNumber(toBN(this).sub(toBN(other)))
  }

  div(other: BigNumberish): BigNumber {
    const o = BigNumber.from(other)
    if (o.isZero()) {
      throwFault('division by zero', 'div')
    }
    return toBigNumber(toBN(this).div(toBN(other)))
  }

  mul(other: BigNumberish): BigNumber {
    return toBigNumber(toBN(this).mul(toBN(other)))
  }

  mod(other: BigNumberish): BigNumber {
    const value = toBN(other)
    if (value.isNeg()) {
      throwFault('cannot modulo negative values', 'mod')
    }
    return toBigNumber(toBN(this).umod(value))
  }

  pow(other: BigNumberish): BigNumber {
    const value = toBN(other)
    if (value.isNeg()) {
      throwFault('cannot raise to negative values', 'pow')
    }
    return toBigNumber(toBN(this).pow(value))
  }

  and(other: BigNumberish): BigNumber {
    const value = toBN(other)
    if (this.isNegative() || value.isNeg()) {
      throwFault("cannot 'and' negative values", 'and')
    }
    return toBigNumber(toBN(this).and(value))
  }

  or(other: BigNumberish): BigNumber {
    const value = toBN(other)
    if (this.isNegative() || value.isNeg()) {
      throwFault("cannot 'or' negative values", 'or')
    }
    return toBigNumber(toBN(this).or(value))
  }

  xor(other: BigNumberish): BigNumber {
    const value = toBN(other)
    if (this.isNegative() || value.isNeg()) {
      throwFault("cannot 'xor' negative values", 'xor')
    }
    return toBigNumber(toBN(this).xor(value))
  }

  mask(value: number): BigNumber {
    if (this.isNegative() || value < 0) {
      throwFault('cannot mask negative values', 'mask')
    }
    return toBigNumber(toBN(this).maskn(value))
  }

  shl(value: number): BigNumber {
    if (this.isNegative() || value < 0) {
      throwFault('cannot shift negative values', 'shl')
    }
    return toBigNumber(toBN(this).shln(value))
  }

  shr(value: number): BigNumber {
    if (this.isNegative() || value < 0) {
      throwFault('cannot shift negative values', 'shr')
    }
    return toBigNumber(toBN(this).shrn(value))
  }

  eq(other: BigNumberish): boolean {
    return toBN(this).eq(toBN(other))
  }

  lt(other: BigNumberish): boolean {
    return toBN(this).lt(toBN(other))
  }

  lte(other: BigNumberish): boolean {
    return toBN(this).lte(toBN(other))
  }

  gt(other: BigNumberish): boolean {
    return toBN(this).gt(toBN(other))
  }

  gte(other: BigNumberish): boolean {
    return toBN(this).gte(toBN(other))
  }

  isNegative(): boolean {
    return this._hex[0] === '-'
  }

  isZero(): boolean {
    return toBN(this).isZero()
  }

  toNumber(): number {
    try {
      return toBN(this).toNumber()
    } catch (error) {
      throwFault('overflow', 'toNumber', this.toString())
    }
    return null
  }

  toBigInt(): bigint {
    try {
      return BigInt(this.toString())
    } catch (e) {}

    return logger.throwError('this platform does not support BigInt', Logger.errors.UNSUPPORTED_OPERATION, {
      value: this.toString()
    })
  }

  toString(): string {
    // Lots of people expect this, which we do not support, so check (See: #889)
    if (arguments.length > 0) {
      if (arguments[0] === 10) {
        if (!_warnedToStringRadix) {
          _warnedToStringRadix = true
          logger.warn('BigNumber.toString does not accept any parameters; base-10 is assumed')
        }
      } else if (arguments[0] === 16) {
        logger.throwError(
          'BigNumber.toString does not accept any parameters; use bigNumber.toHexString()',
          Logger.errors.UNEXPECTED_ARGUMENT,
          {}
        )
      } else {
        logger.throwError('BigNumber.toString does not accept parameters', Logger.errors.UNEXPECTED_ARGUMENT, {})
      }
    }
    return toBN(this).toString(10)
  }

  toHexString(): string {
    return this._hex
  }

  toJSON(key?: string): any {
    return { type: 'BigNumber', hex: this.toHexString() }
  }

  static from(value: any): BigNumber {
    if (value instanceof BigNumber) {
      return value
    }

    if (typeof value === 'string') {
      if (value.match(/^-?0x[0-9a-f]+$/i)) {
        return new BigNumber(_constructorGuard, toHex(value))
      }

      if (value.match(/^-?[0-9]+$/)) {
        return new BigNumber(_constructorGuard, toHex(new BN(value)))
      }

      return logger.throwArgumentError('invalid BigNumber string', 'value', value)
    }

    if (typeof value === 'number') {
      if (value % 1) {
        throwFault('underflow', 'BigNumber.from', value)
      }

      if (value >= MAX_SAFE || value <= -MAX_SAFE) {
        throwFault('overflow', 'BigNumber.from', value)
      }

      return BigNumber.from(String(value))
    }

    const anyValue = <any>value

    if (typeof anyValue === 'bigint') {
      return BigNumber.from(anyValue.toString())
    }

    if (isBytes(anyValue)) {
      return BigNumber.from(hexlify(anyValue))
    }

    if (anyValue) {
      // Hexable interface (takes piority)
      if (anyValue.toHexString) {
        const hex = anyValue.toHexString()
        if (typeof hex === 'string') {
          return BigNumber.from(hex)
        }
      } else {
        // For now, handle legacy JSON-ified values (goes away in v6)
        let hex = anyValue._hex

        // New-form JSON
        if (hex == null && anyValue.type === 'BigNumber') {
          hex = anyValue.hex
        }

        if (typeof hex === 'string') {
          if (isHexString(hex) || (hex[0] === '-' && isHexString(hex.substring(1)))) {
            return BigNumber.from(hex)
          }
        }
      }
    }

    return logger.throwArgumentError('invalid BigNumber value', 'value', value)
  }

  static isBigNumber(value: any): value is BigNumber {
    return !!(value && value._isBigNumber)
  }
}
function toBigNumber(value: BN): BigNumber {
  return BigNumber.from(toHex(value))
}
type BigNumberish = BigNumber | Bytes | bigint | string | number
class Reader {
  readonly wordSize: number
  readonly allowLoose: boolean

  readonly _data: Uint8Array
  readonly _coerceFunc: CoerceFunc

  _offset: number

  constructor(data: BytesLike, wordSize?: number, coerceFunc?: CoerceFunc, allowLoose?: boolean) {
    defineReadOnly(this, '_data', arrayify(data))
    defineReadOnly(this, 'wordSize', wordSize || 32)
    defineReadOnly(this, '_coerceFunc', coerceFunc)
    defineReadOnly(this, 'allowLoose', allowLoose)

    this._offset = 0
  }

  get data(): string {
    return hexlify(this._data)
  }
  get consumed(): number {
    return this._offset
  }

  // The default Coerce function
  static coerce(name: string, value: any): any {
    const match = name.match('^u?int([0-9]+)$')
    if (match && parseInt(match[1]) <= 48) {
      value = value.toNumber()
    }
    return value
  }

  coerce(name: string, value: any): any {
    if (this._coerceFunc) {
      return this._coerceFunc(name, value)
    }
    return Reader.coerce(name, value)
  }

  _peekBytes(offset: number, length: number, loose?: boolean): Uint8Array {
    let alignedLength = Math.ceil(length / this.wordSize) * this.wordSize
    if (this._offset + alignedLength > this._data.length) {
      if (this.allowLoose && loose && this._offset + length <= this._data.length) {
        alignedLength = length
      } else {
        logger.throwError('data out-of-bounds', Logger.errors.BUFFER_OVERRUN, {
          length: this._data.length,
          offset: this._offset + alignedLength
        })
      }
    }
    return this._data.slice(this._offset, this._offset + alignedLength)
  }

  subReader(offset: number): Reader {
    return new Reader(this._data.slice(this._offset + offset), this.wordSize, this._coerceFunc, this.allowLoose)
  }

  readBytes(length: number, loose?: boolean): Uint8Array {
    const bytes = this._peekBytes(0, length, !!loose)
    this._offset += bytes.length
    // @TODO: Make sure the length..end bytes are all 0?
    return bytes.slice(0, length)
  }

  readValue(): BigNumber {
    return BigNumber.from(this.readBytes(this.wordSize))
  }
}
abstract class Coder {
  // The coder name:
  //   - address, uint256, tuple, array, etc.
  readonly name: string

  // The fully expanded type, including composite types:
  //   - address, uint256, tuple(address,bytes), uint256[3][4][],  etc.
  readonly type: string

  // The localName bound in the signature, in this example it is "baz":
  //   - tuple(address foo, uint bar) baz
  readonly localName: string

  // Whether this type is dynamic:
  //  - Dynamic: bytes, string, address[], tuple(boolean[]), etc.
  //  - Not Dynamic: address, uint256, boolean[3], tuple(address, uint8)
  readonly dynamic: boolean

  constructor(name: string, type: string, localName: string, dynamic: boolean) {
    // @TODO: defineReadOnly these
    this.name = name
    this.type = type
    this.localName = localName
    this.dynamic = dynamic
  }

  _throwError(message: string, value: any): void {
    logger.throwArgumentError(message, this.localName, value)
  }

  abstract encode(writer: Writer, value: any): number
  abstract decode(reader: Reader): any

  abstract defaultValue(): any
}
import sha3 from 'js-sha3'
function keccak256(data: BytesLike): string {
  return '0x' + sha3.keccak_256(arrayify(data))
}
function getChecksumAddress(address: string): string {
  if (!isHexString(address, 20)) {
    logger.throwArgumentError('invalid address', 'address', address)
  }

  address = address.toLowerCase()

  const chars = address.substring(2).split('')

  const expanded = new Uint8Array(40)
  for (let i = 0; i < 40; i++) {
    expanded[i] = chars[i].charCodeAt(0)
  }

  const hashed = arrayify(keccak256(expanded))

  for (let i = 0; i < 40; i += 2) {
    if (hashed[i >> 1] >> 4 >= 8) {
      chars[i] = chars[i].toUpperCase()
    }
    if ((hashed[i >> 1] & 0x0f) >= 8) {
      chars[i + 1] = chars[i + 1].toUpperCase()
    }
  }

  return '0x' + chars.join('')
}
interface String {
  /** Removes whitespace from the left end of a string. */
  trimLeft(): string
  /** Removes whitespace from the right end of a string. */
  trimRight(): string

  /** Returns a copy with leading whitespace removed. */
  trimStart(): string
  /** Returns a copy with trailing whitespace removed. */
  trimEnd(): string
}
const ibanLookup: { [character: string]: string } = {}
for (let i = 0; i < 10; i++) {
  ibanLookup[String(i)] = String(i)
}
for (let i = 0; i < 26; i++) {
  ibanLookup[String.fromCharCode(65 + i)] = String(10 + i)
}
const MAX_SAFE_INTEGER = 0x1fffffffffffff
function log10(x: number): number {
  if (Math.log10) {
    return Math.log10(x)
  }
  return Math.log(x) / Math.LN10
}
const safeDigits = Math.floor(log10(MAX_SAFE_INTEGER))

function ibanChecksum(address: string): string {
  address = address.toUpperCase()
  address = address.substring(4) + address.substring(0, 2) + '00'

  let expanded = address
    .split('')
    .map(c => {
      return ibanLookup[c]
    })
    .join('')

  // Javascript can handle integers safely up to 15 (decimal) digits
  while (expanded.length >= safeDigits) {
    const block = expanded.substring(0, safeDigits)
    expanded = (parseInt(block, 10) % 97) + expanded.substring(block.length)
  }

  let checksum = String(98 - (parseInt(expanded, 10) % 97))
  while (checksum.length < 2) {
    checksum = '0' + checksum
  }

  return checksum
}
function _base36To16(value: string): string {
  return new BN(value, 36).toString(16)
}
function getAddress(address: string): string {
  let result = null

  if (typeof address !== 'string') {
    logger.throwArgumentError('invalid address', 'address', address)
  }

  if (address.match(/^(0x)?[0-9a-fA-F]{40}$/)) {
    // Missing the 0x prefix
    if (address.substring(0, 2) !== '0x') {
      address = '0x' + address
    }

    result = getChecksumAddress(address)

    // It is a checksummed address with a bad checksum
    if (address.match(/([A-F].*[a-f])|([a-f].*[A-F])/) && result !== address) {
      logger.throwArgumentError('bad address checksum', 'address', address)
    }

    // Maybe ICAP? (we only support direct mode)
  } else if (address.match(/^XE[0-9]{2}[0-9A-Za-z]{30,31}$/)) {
    // It is an ICAP address with a bad checksum
    if (address.substring(2, 4) !== ibanChecksum(address)) {
      logger.throwArgumentError('bad icap checksum', 'address', address)
    }

    result = _base36To16(address.substring(4))
    while (result.length < 40) {
      result = '0' + result
    }
    result = getChecksumAddress('0x' + result)
  } else {
    logger.throwArgumentError('invalid address', 'address', address)
  }

  return result
}
function hexZeroPad(value: BytesLike, length: number): string {
  if (typeof value !== 'string') {
    value = hexlify(value)
  } else if (!isHexString(value)) {
    logger.throwArgumentError('invalid hex string', 'value', value)
  }

  if (value.length > 2 * length + 2) {
    logger.throwArgumentError('value out of range', 'value', arguments[1])
  }

  while (value.length < 2 * length + 2) {
    value = '0x0' + value.substring(2)
  }

  return value
}
class AddressCoder extends Coder {
  constructor(localName: string) {
    super('address', 'address', localName, false)
  }

  defaultValue(): string {
    return '0x0000000000000000000000000000000000000000'
  }

  encode(writer: Writer, value: string): number {
    try {
      getAddress(value)
    } catch (error) {
      this._throwError(error.message, value)
    }
    return writer.writeValue(value)
  }

  decode(reader: Reader): any {
    return getAddress(hexZeroPad(reader.readValue().toHexString(), 20))
  }
}
class BooleanCoder extends Coder {
  constructor(localName: string) {
    super('bool', 'bool', localName, false)
  }

  defaultValue(): boolean {
    return false
  }

  encode(writer: Writer, value: boolean): number {
    return writer.writeValue(value ? 1 : 0)
  }

  decode(reader: Reader): any {
    return reader.coerce(this.type, !reader.readValue().isZero())
  }
}
class DynamicBytesCoder extends Coder {
  constructor(type: string, localName: string) {
    super(type, type, localName, true)
  }

  defaultValue(): string {
    return '0x'
  }

  encode(writer: Writer, value: any): number {
    value = arrayify(value)
    let length = writer.writeValue(value.length)
    length += writer.writeBytes(value)
    return length
  }

  decode(reader: Reader): any {
    return reader.readBytes(reader.readValue().toNumber(), true)
  }
}
enum UnicodeNormalizationForm {
  current = '',
  NFC = 'NFC',
  NFD = 'NFD',
  NFKC = 'NFKC',
  NFKD = 'NFKD'
}
function toUtf8Bytes(str: string, form: UnicodeNormalizationForm = UnicodeNormalizationForm.current): Uint8Array {
  if (form != UnicodeNormalizationForm.current) {
    logger.checkNormalize()
    str = str.normalize(form)
  }

  const result = []
  for (let i = 0; i < str.length; i++) {
    const c = str.charCodeAt(i)

    if (c < 0x80) {
      result.push(c)
    } else if (c < 0x800) {
      result.push((c >> 6) | 0xc0)
      result.push((c & 0x3f) | 0x80)
    } else if ((c & 0xfc00) == 0xd800) {
      i++
      const c2 = str.charCodeAt(i)

      if (i >= str.length || (c2 & 0xfc00) !== 0xdc00) {
        throw new Error('invalid utf-8 string')
      }

      // Surrogate Pair
      const pair = 0x10000 + ((c & 0x03ff) << 10) + (c2 & 0x03ff)
      result.push((pair >> 18) | 0xf0)
      result.push(((pair >> 12) & 0x3f) | 0x80)
      result.push(((pair >> 6) & 0x3f) | 0x80)
      result.push((pair & 0x3f) | 0x80)
    } else {
      result.push((c >> 12) | 0xe0)
      result.push(((c >> 6) & 0x3f) | 0x80)
      result.push((c & 0x3f) | 0x80)
    }
  }

  return arrayify(result)
}
function _toUtf8String(codePoints: Array<number>): string {
  return codePoints
    .map(codePoint => {
      if (codePoint <= 0xffff) {
        return String.fromCharCode(codePoint)
      }
      codePoint -= 0x10000
      return String.fromCharCode(((codePoint >> 10) & 0x3ff) + 0xd800, (codePoint & 0x3ff) + 0xdc00)
    })
    .join('')
}
enum Utf8ErrorReason {
  // A continuation byte was present where there was nothing to continue
  // - offset = the index the codepoint began in
  UNEXPECTED_CONTINUE = 'unexpected continuation byte',

  // An invalid (non-continuation) byte to start a UTF-8 codepoint was found
  // - offset = the index the codepoint began in
  BAD_PREFIX = 'bad codepoint prefix',

  // The string is too short to process the expected codepoint
  // - offset = the index the codepoint began in
  OVERRUN = 'string overrun',

  // A missing continuation byte was expected but not found
  // - offset = the index the continuation byte was expected at
  MISSING_CONTINUE = 'missing continuation byte',

  // The computed code point is outside the range for UTF-8
  // - offset       = start of this codepoint
  // - badCodepoint = the computed codepoint; outside the UTF-8 range
  OUT_OF_RANGE = 'out of UTF-8 range',

  // UTF-8 strings may not contain UTF-16 surrogate pairs
  // - offset       = start of this codepoint
  // - badCodepoint = the computed codepoint; inside the UTF-16 surrogate range
  UTF16_SURROGATE = 'UTF-16 surrogate',

  // The string is an overlong reperesentation
  // - offset       = start of this codepoint
  // - badCodepoint = the computed codepoint; already bounds checked
  OVERLONG = 'overlong representation'
}
type Utf8ErrorFunc = (
  reason: Utf8ErrorReason,
  offset: number,
  bytes: ArrayLike<number>,
  output: Array<number>,
  badCodepoint?: number
) => number
function errorFunc(
  reason: Utf8ErrorReason,
  offset: number,
  bytes: ArrayLike<number>,
  output: Array<number>,
  badCodepoint?: number
): number {
  return logger.throwArgumentError(`invalid codepoint at offset ${offset}; ${reason}`, 'bytes', bytes)
}

function ignoreFunc(
  reason: Utf8ErrorReason,
  offset: number,
  bytes: ArrayLike<number>,
  output: Array<number>,
  badCodepoint?: number
): number {
  // If there is an invalid prefix (including stray continuation), skip any additional continuation bytes
  if (reason === Utf8ErrorReason.BAD_PREFIX || reason === Utf8ErrorReason.UNEXPECTED_CONTINUE) {
    let i = 0
    for (let o = offset + 1; o < bytes.length; o++) {
      if (bytes[o] >> 6 !== 0x02) {
        break
      }
      i++
    }
    return i
  }
  // This byte runs us past the end of the string, so just jump to the end
  // (but the first byte was read already read and therefore skipped)
  if (reason === Utf8ErrorReason.OVERRUN) {
    return bytes.length - offset - 1
  }
  // Nothing to skip
  return 0
}

function replaceFunc(
  reason: Utf8ErrorReason,
  offset: number,
  bytes: ArrayLike<number>,
  output: Array<number>,
  badCodepoint?: number
): number {
  // Overlong representations are otherwise "valid" code points; just non-deistingtished
  if (reason === Utf8ErrorReason.OVERLONG) {
    output.push(badCodepoint)
    return 0
  }
  // Put the replacement character into the output
  output.push(0xfffd)
  // Otherwise, process as if ignoring errors
  return ignoreFunc(reason, offset, bytes, output, badCodepoint)
}
const Utf8ErrorFuncs: { [name: string]: Utf8ErrorFunc } = Object.freeze({
  error: errorFunc,
  ignore: ignoreFunc,
  replace: replaceFunc
})
function getUtf8CodePoints(bytes: BytesLike, onError?: Utf8ErrorFunc): Array<number> {
  if (onError == null) {
    onError = Utf8ErrorFuncs.error
  }

  bytes = arrayify(bytes)

  const result: Array<number> = []
  let i = 0

  // Invalid bytes are ignored
  while (i < bytes.length) {
    const c = bytes[i++]

    // 0xxx xxxx
    if (c >> 7 === 0) {
      result.push(c)
      continue
    }

    // Multibyte; how many bytes left for this character?
    let extraLength = null
    let overlongMask = null

    // 110x xxxx 10xx xxxx
    if ((c & 0xe0) === 0xc0) {
      extraLength = 1
      overlongMask = 0x7f

      // 1110 xxxx 10xx xxxx 10xx xxxx
    } else if ((c & 0xf0) === 0xe0) {
      extraLength = 2
      overlongMask = 0x7ff

      // 1111 0xxx 10xx xxxx 10xx xxxx 10xx xxxx
    } else if ((c & 0xf8) === 0xf0) {
      extraLength = 3
      overlongMask = 0xffff
    } else {
      if ((c & 0xc0) === 0x80) {
        i += onError(Utf8ErrorReason.UNEXPECTED_CONTINUE, i - 1, bytes, result)
      } else {
        i += onError(Utf8ErrorReason.BAD_PREFIX, i - 1, bytes, result)
      }
      continue
    }

    // Do we have enough bytes in our data?
    if (i - 1 + extraLength >= bytes.length) {
      i += onError(Utf8ErrorReason.OVERRUN, i - 1, bytes, result)
      continue
    }

    // Remove the length prefix from the char
    let res = c & ((1 << (8 - extraLength - 1)) - 1)

    for (let j = 0; j < extraLength; j++) {
      const nextChar = bytes[i]

      // Invalid continuation byte
      if ((nextChar & 0xc0) != 0x80) {
        i += onError(Utf8ErrorReason.MISSING_CONTINUE, i, bytes, result)
        res = null
        break
      }

      res = (res << 6) | (nextChar & 0x3f)
      i++
    }

    // See above loop for invalid contimuation byte
    if (res === null) {
      continue
    }

    // Maximum code point
    if (res > 0x10ffff) {
      i += onError(Utf8ErrorReason.OUT_OF_RANGE, i - 1 - extraLength, bytes, result, res)
      continue
    }

    // Reserved for UTF-16 surrogate halves
    if (res >= 0xd800 && res <= 0xdfff) {
      i += onError(Utf8ErrorReason.UTF16_SURROGATE, i - 1 - extraLength, bytes, result, res)
      continue
    }

    // Check for overlong sequences (more bytes than needed)
    if (res <= overlongMask) {
      i += onError(Utf8ErrorReason.OVERLONG, i - 1 - extraLength, bytes, result, res)
      continue
    }

    result.push(res)
  }

  return result
}
function toUtf8String(bytes: BytesLike, onError?: Utf8ErrorFunc): string {
  return _toUtf8String(getUtf8CodePoints(bytes, onError))
}
class StringCoder extends DynamicBytesCoder {
  constructor(localName: string) {
    super('string', localName)
  }
  defaultValue(): string {
    return ''
  }
  encode(writer: Writer, value: any): number {
    return super.encode(writer, toUtf8Bytes(value))
  }
  decode(reader: Reader): any {
    return toUtf8String(super.decode(reader))
  }
}

class BytesCoder extends DynamicBytesCoder {
  constructor(localName: string) {
    super('bytes', localName)
  }
  decode(reader: Reader): any {
    return reader.coerce(this.name, hexlify(super.decode(reader)))
  }
}
function pack(writer: Writer, coders: ReadonlyArray<Coder>, values: Array<any> | { [name: string]: any }): number {
  let arrayValues: Array<any> = null

  if (Array.isArray(values)) {
    arrayValues = values
  } else if (values && typeof values === 'object') {
    const unique: { [name: string]: boolean } = {}

    arrayValues = coders.map(coder => {
      const name = coder.localName
      if (!name) {
        logger.throwError('cannot encode object for signature with missing names', Logger.errors.INVALID_ARGUMENT, {
          argument: 'values',
          coder: coder,
          value: values
        })
      }

      if (unique[name]) {
        logger.throwError('cannot encode object for signature with duplicate names', Logger.errors.INVALID_ARGUMENT, {
          argument: 'values',
          coder: coder,
          value: values
        })
      }

      unique[name] = true

      return values[name]
    })
  } else {
    logger.throwArgumentError('invalid tuple value', 'tuple', values)
  }

  if (coders.length !== arrayValues.length) {
    logger.throwArgumentError('types/value length mismatch', 'tuple', values)
  }

  const staticWriter = new Writer(writer.wordSize)
  const dynamicWriter = new Writer(writer.wordSize)

  const updateFuncs: Array<(baseOffset: number) => void> = []
  coders.forEach((coder, index) => {
    const value = arrayValues[index]

    if (coder.dynamic) {
      // Get current dynamic offset (for the future pointer)
      const dynamicOffset = dynamicWriter.length

      // Encode the dynamic value into the dynamicWriter
      coder.encode(dynamicWriter, value)

      // Prepare to populate the correct offset once we are done
      const updateFunc = staticWriter.writeUpdatableValue()
      updateFuncs.push((baseOffset: number) => {
        updateFunc(baseOffset + dynamicOffset)
      })
    } else {
      coder.encode(staticWriter, value)
    }
  })

  // Backfill all the dynamic offsets, now that we know the static length
  updateFuncs.forEach(func => {
    func(staticWriter.length)
  })

  let length = writer.appendWriter(staticWriter)
  length += writer.appendWriter(dynamicWriter)
  return length
}
class AnonymousCoder extends Coder {
  private coder: Coder

  constructor(coder: Coder) {
    super(coder.name, coder.type, undefined, coder.dynamic)
    this.coder = coder
  }

  defaultValue(): any {
    return this.coder.defaultValue()
  }

  encode(writer: Writer, value: any): number {
    return this.coder.encode(writer, value)
  }

  decode(reader: Reader): any {
    return this.coder.decode(reader)
  }
}

class ArrayCoder extends Coder {
  readonly coder: Coder
  readonly length: number
  constructor(coder: Coder, length: number, localName: string) {
    const type = coder.type + '[' + (length >= 0 ? length : '') + ']'
    const dynamic = length === -1 || coder.dynamic
    super('array', type, localName, dynamic)

    this.coder = coder
    this.length = length
  }
  defaultValue(): Array<any> {
    // Verifies the child coder is valid (even if the array is dynamic or 0-length)
    const defaultChild = this.coder.defaultValue()

    const result: Array<any> = []
    for (let i = 0; i < this.length; i++) {
      result.push(defaultChild)
    }
    return result
  }
  encode(writer: Writer, value: Array<any>): number {
    if (!Array.isArray(value)) {
      this._throwError('expected array value', value)
    }

    let count = this.length

    if (count === -1) {
      count = value.length
      writer.writeValue(value.length)
    }

    logger.checkArgumentCount(value.length, count, 'coder array' + (this.localName ? ' ' + this.localName : ''))

    const coders = []
    for (let i = 0; i < value.length; i++) {
      coders.push(this.coder)
    }

    return pack(writer, coders, value)
  }

  decode(reader: Reader): any {
    let count = this.length
    if (count === -1) {
      count = reader.readValue().toNumber()

      // Check that there is *roughly* enough data to ensure
      // stray random data is not being read as a length. Each
      // slot requires at least 32 bytes for their value (or 32
      // bytes as a link to the data). This could use a much
      // tighter bound, but we are erroring on the side of safety.
      if (count * 32 > reader._data.length) {
        logger.throwError('insufficient data length', Logger.errors.BUFFER_OVERRUN, {
          length: reader._data.length,
          count: count
        })
      }
    }
    const coders = []
    for (let i = 0; i < count; i++) {
      coders.push(new AnonymousCoder(this.coder))
    }

    return reader.coerce(this.name, unpack(reader, coders))
  }
}

function unpack(reader: Reader, coders: Array<Coder>): Result {
  const values: any = []

  // A reader anchored to this base
  const baseReader = reader.subReader(0)

  coders.forEach(coder => {
    let value: any = null

    if (coder.dynamic) {
      const offset = reader.readValue()
      const offsetReader = baseReader.subReader(offset.toNumber())
      try {
        value = coder.decode(offsetReader)
      } catch (error) {
        // Cannot recover from this
        if (error.code === Logger.errors.BUFFER_OVERRUN) {
          throw error
        }
        value = error
        value.baseType = coder.name
        value.name = coder.localName
        value.type = coder.type
      }
    } else {
      try {
        value = coder.decode(reader)
      } catch (error) {
        // Cannot recover from this
        if (error.code === Logger.errors.BUFFER_OVERRUN) {
          throw error
        }
        value = error
        value.baseType = coder.name
        value.name = coder.localName
        value.type = coder.type
      }
    }

    if (value != undefined) {
      values.push(value)
    }
  })

  // We only output named properties for uniquely named coders
  const uniqueNames = coders.reduce((accum, coder) => {
    const name = coder.localName
    if (name) {
      if (!accum[name]) {
        accum[name] = 0
      }
      accum[name]++
    }
    return accum
  }, <{ [name: string]: number }>{})

  // Add any named parameters (i.e. tuples)
  coders.forEach((coder: Coder, index: number) => {
    let name = coder.localName
    if (!name || uniqueNames[name] !== 1) {
      return
    }

    if (name === 'length') {
      name = '_length'
    }

    if (values[name] != null) {
      return
    }

    const value = values[index]

    if (value instanceof Error) {
      Object.defineProperty(values, name, {
        get: () => {
          throw value
        }
      })
    } else {
      values[name] = value
    }
  })

  for (let i = 0; i < values.length; i++) {
    const value = values[i]
    if (value instanceof Error) {
      Object.defineProperty(values, i, {
        get: () => {
          throw value
        }
      })
    }
  }

  return Object.freeze(values)
}

class TupleCoder extends Coder {
  readonly coders: Array<Coder>

  constructor(coders: Array<Coder>, localName: string) {
    let dynamic = false
    const types: Array<string> = []
    coders.forEach(coder => {
      if (coder.dynamic) {
        dynamic = true
      }
      types.push(coder.type)
    })
    const type = 'tuple(' + types.join(',') + ')'

    super('tuple', type, localName, dynamic)
    this.coders = coders
  }

  defaultValue(): any {
    const values: any = []
    this.coders.forEach(coder => {
      values.push(coder.defaultValue())
    })

    // We only output named properties for uniquely named coders
    const uniqueNames = this.coders.reduce((accum, coder) => {
      const name = coder.localName
      if (name) {
        if (!accum[name]) {
          accum[name] = 0
        }
        accum[name]++
      }
      return accum
    }, <{ [name: string]: number }>{})

    // Add named values
    this.coders.forEach((coder: Coder, index: number) => {
      let name = coder.localName
      if (!name || uniqueNames[name] !== 1) {
        return
      }

      if (name === 'length') {
        name = '_length'
      }

      if (values[name] != null) {
        return
      }

      values[name] = values[index]
    })

    return Object.freeze(values)
  }

  encode(writer: Writer, value: Array<any> | { [name: string]: any }): number {
    return pack(writer, this.coders, value)
  }

  decode(reader: Reader): any {
    return reader.coerce(this.name, unpack(reader, this.coders))
  }
}
class NullCoder extends Coder {
  constructor(localName: string) {
    super('null', '', localName, false)
  }

  defaultValue(): null {
    return null
  }

  encode(writer: Writer, value: any): number {
    if (value != null) {
      this._throwError('not null', value)
    }
    return writer.writeBytes([])
  }

  decode(reader: Reader): any {
    reader.readBytes(0)
    return reader.coerce(this.name, null)
  }
}
const MaxUint256: BigNumber = /*#__PURE__*/ BigNumber.from(
  '0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff'
)
const NegativeOne: BigNumber = /*#__PURE__*/ BigNumber.from(-1)
const Zero: BigNumber = /*#__PURE__*/ BigNumber.from(0)
const One: BigNumber = /*#__PURE__*/ BigNumber.from(1)

class NumberCoder extends Coder {
  readonly size: number
  readonly signed: boolean

  constructor(size: number, signed: boolean, localName: string) {
    const name = (signed ? 'int' : 'uint') + size * 8
    super(name, name, localName, false)

    this.size = size
    this.signed = signed
  }

  defaultValue(): number {
    return 0
  }

  encode(writer: Writer, value: BigNumberish): number {
    let v = BigNumber.from(value)

    // Check bounds are safe for encoding
    const maxUintValue = MaxUint256.mask(writer.wordSize * 8)
    if (this.signed) {
      const bounds = maxUintValue.mask(this.size * 8 - 1)
      if (v.gt(bounds) || v.lt(bounds.add(One).mul(NegativeOne))) {
        this._throwError('value out-of-bounds', value)
      }
    } else if (v.lt(Zero) || v.gt(maxUintValue.mask(this.size * 8))) {
      this._throwError('value out-of-bounds', value)
    }

    v = v.toTwos(this.size * 8).mask(this.size * 8)

    if (this.signed) {
      v = v.fromTwos(this.size * 8).toTwos(8 * writer.wordSize)
    }

    return writer.writeValue(v)
  }

  decode(reader: Reader): any {
    let value = reader.readValue().mask(this.size * 8)

    if (this.signed) {
      value = value.fromTwos(this.size * 8)
    }

    return reader.coerce(this.name, value)
  }
}
const paramTypeBytes = new RegExp(/^bytes([0-9]*)$/)
const paramTypeNumber = new RegExp(/^(u?int)([0-9]*)$/)
class FixedBytesCoder extends Coder {
  readonly size: number

  constructor(size: number, localName: string) {
    const name = 'bytes' + String(size)
    super(name, name, localName, false)
    this.size = size
  }

  defaultValue(): string {
    return '0x0000000000000000000000000000000000000000000000000000000000000000'.substring(0, 2 + this.size * 2)
  }

  encode(writer: Writer, value: BytesLike): number {
    const data = arrayify(value)
    if (data.length !== this.size) {
      this._throwError('incorrect data length', value)
    }
    return writer.writeBytes(data)
  }

  decode(reader: Reader): any {
    return reader.coerce(this.name, hexlify(reader.readBytes(this.size)))
  }
}

class AbiCoder {
  readonly coerceFunc: CoerceFunc

  constructor(coerceFunc?: CoerceFunc) {
    logger.checkNew(new.target, AbiCoder)
    defineReadOnly(this, 'coerceFunc', coerceFunc || null)
  }

  _getCoder(param: ParamType): Coder {
    switch (param.baseType) {
      case 'address':
        return new AddressCoder(param.name)
      case 'bool':
        return new BooleanCoder(param.name)
      case 'string':
        return new StringCoder(param.name)
      case 'bytes':
        return new BytesCoder(param.name)
      case 'array':
        return new ArrayCoder(this._getCoder(param.arrayChildren), param.arrayLength, param.name)
      case 'tuple':
        return new TupleCoder(
          (param.components || []).map(component => {
            return this._getCoder(component)
          }),
          param.name
        )
      case '':
        return new NullCoder(param.name)
    }

    // u?int[0-9]*
    let match = param.type.match(paramTypeNumber)
    if (match) {
      const size = parseInt(match[2] || '256')
      if (size === 0 || size > 256 || size % 8 !== 0) {
        logger.throwArgumentError('invalid ' + match[1] + ' bit length', 'param', param)
      }
      return new NumberCoder(size / 8, match[1] === 'int', param.name)
    }

    // bytes[0-9]+
    match = param.type.match(paramTypeBytes)
    if (match) {
      const size = parseInt(match[1])
      if (size === 0 || size > 32) {
        logger.throwArgumentError('invalid bytes length', 'param', param)
      }
      return new FixedBytesCoder(size, param.name)
    }

    return logger.throwArgumentError('invalid type', 'type', param.type)
  }

  _getWordSize(): number {
    return 32
  }

  _getReader(data: Uint8Array, allowLoose?: boolean): Reader {
    return new Reader(data, this._getWordSize(), this.coerceFunc, allowLoose)
  }

  _getWriter(): Writer {
    return new Writer(this._getWordSize())
  }

  getDefaultValue(types: ReadonlyArray<string | ParamType>): Result {
    const coders: Array<Coder> = types.map(type => this._getCoder(ParamType.from(type)))
    const coder = new TupleCoder(coders, '_')
    return coder.defaultValue()
  }

  encode(types: ReadonlyArray<string | ParamType>, values: ReadonlyArray<any>): string {
    if (types.length !== values.length) {
      logger.throwError('types/values length mismatch', Logger.errors.INVALID_ARGUMENT, {
        count: { types: types.length, values: values.length },
        value: { types: types, values: values }
      })
    }

    const coders = types.map(type => this._getCoder(ParamType.from(type)))
    const coder = new TupleCoder(coders, '_')

    const writer = this._getWriter()
    coder.encode(writer, values)
    return writer.data
  }

  decode(types: ReadonlyArray<string | ParamType>, data: BytesLike, loose?: boolean): Result {
    const coders: Array<Coder> = types.map(type => this._getCoder(ParamType.from(type)))
    const coder = new TupleCoder(coders, '_')
    return coder.decode(this._getReader(arrayify(data), loose))
  }
}

interface ReadonlyArray<T> {
  /**
   * Gets the length of the array. This is a number one higher than the highest element defined in an array.
   */
  readonly length: number
  /**
   * Returns a string representation of an array.
   */
  toString(): string
  /**
   * Returns a string representation of an array. The elements are converted to string using their toLocaleString methods.
   */
  toLocaleString(): string
  /**
   * Combines two or more arrays.
   * @param items Additional items to add to the end of array1.
   */
  concat(...items: ConcatArray<T>[]): T[]
  /**
   * Combines two or more arrays.
   * @param items Additional items to add to the end of array1.
   */
  concat(...items: (T | ConcatArray<T>)[]): T[]
  /**
   * Adds all the elements of an array separated by the specified separator string.
   * @param separator A string used to separate one element of an array from the next in the resulting String. If omitted, the array elements are separated with a comma.
   */
  join(separator?: string): string
  /**
   * Returns a section of an array.
   * @param start The beginning of the specified portion of the array.
   * @param end The end of the specified portion of the array. This is exclusive of the element at the index 'end'.
   */
  slice(start?: number, end?: number): T[]
  /**
   * Returns the index of the first occurrence of a value in an array.
   * @param searchElement The value to locate in the array.
   * @param fromIndex The array index at which to begin the search. If fromIndex is omitted, the search starts at index 0.
   */
  indexOf(searchElement: T, fromIndex?: number): number
  /**
   * Returns the index of the last occurrence of a specified value in an array.
   * @param searchElement The value to locate in the array.
   * @param fromIndex The array index at which to begin the search. If fromIndex is omitted, the search starts at the last index in the array.
   */
  lastIndexOf(searchElement: T, fromIndex?: number): number
  /**
   * Determines whether all the members of an array satisfy the specified test.
   * @param predicate A function that accepts up to three arguments. The every method calls
   * the predicate function for each element in the array until the predicate returns a value
   * which is coercible to the Boolean value false, or until the end of the array.
   * @param thisArg An object to which the this keyword can refer in the predicate function.
   * If thisArg is omitted, undefined is used as the this value.
   */
  every<S extends T>(
    predicate: (value: T, index: number, array: readonly T[]) => value is S,
    thisArg?: any
  ): this is readonly S[]
  /**
   * Determines whether all the members of an array satisfy the specified test.
   * @param predicate A function that accepts up to three arguments. The every method calls
   * the predicate function for each element in the array until the predicate returns a value
   * which is coercible to the Boolean value false, or until the end of the array.
   * @param thisArg An object to which the this keyword can refer in the predicate function.
   * If thisArg is omitted, undefined is used as the this value.
   */
  every(predicate: (value: T, index: number, array: readonly T[]) => unknown, thisArg?: any): boolean
  /**
   * Determines whether the specified callback function returns true for any element of an array.
   * @param predicate A function that accepts up to three arguments. The some method calls
   * the predicate function for each element in the array until the predicate returns a value
   * which is coercible to the Boolean value true, or until the end of the array.
   * @param thisArg An object to which the this keyword can refer in the predicate function.
   * If thisArg is omitted, undefined is used as the this value.
   */
  some(predicate: (value: T, index: number, array: readonly T[]) => unknown, thisArg?: any): boolean
  /**
   * Performs the specified action for each element in an array.
   * @param callbackfn  A function that accepts up to three arguments. forEach calls the callbackfn function one time for each element in the array.
   * @param thisArg  An object to which the this keyword can refer in the callbackfn function. If thisArg is omitted, undefined is used as the this value.
   */
  forEach(callbackfn: (value: T, index: number, array: readonly T[]) => void, thisArg?: any): void
  /**
   * Calls a defined callback function on each element of an array, and returns an array that contains the results.
   * @param callbackfn A function that accepts up to three arguments. The map method calls the callbackfn function one time for each element in the array.
   * @param thisArg An object to which the this keyword can refer in the callbackfn function. If thisArg is omitted, undefined is used as the this value.
   */
  map<U>(callbackfn: (value: T, index: number, array: readonly T[]) => U, thisArg?: any): U[]
  /**
   * Returns the elements of an array that meet the condition specified in a callback function.
   * @param predicate A function that accepts up to three arguments. The filter method calls the predicate function one time for each element in the array.
   * @param thisArg An object to which the this keyword can refer in the predicate function. If thisArg is omitted, undefined is used as the this value.
   */
  filter<S extends T>(predicate: (value: T, index: number, array: readonly T[]) => value is S, thisArg?: any): S[]
  /**
   * Returns the elements of an array that meet the condition specified in a callback function.
   * @param predicate A function that accepts up to three arguments. The filter method calls the predicate function one time for each element in the array.
   * @param thisArg An object to which the this keyword can refer in the predicate function. If thisArg is omitted, undefined is used as the this value.
   */
  filter(predicate: (value: T, index: number, array: readonly T[]) => unknown, thisArg?: any): T[]
  /**
   * Calls the specified callback function for all the elements in an array. The return value of the callback function is the accumulated result, and is provided as an argument in the next call to the callback function.
   * @param callbackfn A function that accepts up to four arguments. The reduce method calls the callbackfn function one time for each element in the array.
   * @param initialValue If initialValue is specified, it is used as the initial value to start the accumulation. The first call to the callbackfn function provides this value as an argument instead of an array value.
   */
  reduce(callbackfn: (previousValue: T, currentValue: T, currentIndex: number, array: readonly T[]) => T): T
  reduce(
    callbackfn: (previousValue: T, currentValue: T, currentIndex: number, array: readonly T[]) => T,
    initialValue: T
  ): T
  /**
   * Calls the specified callback function for all the elements in an array. The return value of the callback function is the accumulated result, and is provided as an argument in the next call to the callback function.
   * @param callbackfn A function that accepts up to four arguments. The reduce method calls the callbackfn function one time for each element in the array.
   * @param initialValue If initialValue is specified, it is used as the initial value to start the accumulation. The first call to the callbackfn function provides this value as an argument instead of an array value.
   */
  reduce<U>(
    callbackfn: (previousValue: U, currentValue: T, currentIndex: number, array: readonly T[]) => U,
    initialValue: U
  ): U
  /**
   * Calls the specified callback function for all the elements in an array, in descending order. The return value of the callback function is the accumulated result, and is provided as an argument in the next call to the callback function.
   * @param callbackfn A function that accepts up to four arguments. The reduceRight method calls the callbackfn function one time for each element in the array.
   * @param initialValue If initialValue is specified, it is used as the initial value to start the accumulation. The first call to the callbackfn function provides this value as an argument instead of an array value.
   */
  reduceRight(callbackfn: (previousValue: T, currentValue: T, currentIndex: number, array: readonly T[]) => T): T
  reduceRight(
    callbackfn: (previousValue: T, currentValue: T, currentIndex: number, array: readonly T[]) => T,
    initialValue: T
  ): T
  /**
   * Calls the specified callback function for all the elements in an array, in descending order. The return value of the callback function is the accumulated result, and is provided as an argument in the next call to the callback function.
   * @param callbackfn A function that accepts up to four arguments. The reduceRight method calls the callbackfn function one time for each element in the array.
   * @param initialValue If initialValue is specified, it is used as the initial value to start the accumulation. The first call to the callbackfn function provides this value as an argument instead of an array value.
   */
  reduceRight<U>(
    callbackfn: (previousValue: U, currentValue: T, currentIndex: number, array: readonly T[]) => U,
    initialValue: U
  ): U

  readonly [n: number]: T
}
interface JsonFragment {
  readonly name?: string
  readonly type?: string

  readonly anonymous?: boolean

  readonly payable?: boolean
  readonly constant?: boolean
  readonly stateMutability?: string

  readonly inputs?: ReadonlyArray<JsonFragmentType>
  readonly outputs?: ReadonlyArray<JsonFragmentType>

  readonly gas?: string
}
//type TypeCheck<T> = { -readonly [K in keyof T]: T[K] }
const regexIdentifier = new RegExp('^[a-zA-Z$_][a-zA-Z0-9$_]*$')

function verifyIdentifier(value: string): string {
  if (!value || !value.match(regexIdentifier)) {
    logger.throwArgumentError(`invalid identifier "${value}"`, 'value', value)
  }
  return value
}
const regexParen = new RegExp('^([^)(]*)\\((.*)\\)([^)(]*)$')

interface _Fragment {
  readonly type: string
  readonly name: string
  readonly inputs: ReadonlyArray<ParamType>
}
interface _EventFragment extends _Fragment {
  readonly anonymous: boolean
}
function splitNesting(value: string): Array<any> {
  value = value.trim()

  const result = []
  let accum = ''
  let depth = 0
  for (let offset = 0; offset < value.length; offset++) {
    const c = value[offset]
    if (c === ',' && depth === 0) {
      result.push(accum)
      accum = ''
    } else {
      accum += c
      if (c === '(') {
        depth++
      } else if (c === ')') {
        depth--
        if (depth === -1) {
          logger.throwArgumentError('unbalanced parenthesis', 'value', value)
        }
      }
    }
  }
  if (accum) {
    result.push(accum)
  }

  return result
}
function parseParams(value: string, allowIndex: boolean): Array<ParamType> {
  return splitNesting(value).map(param => ParamType.fromString(param, allowIndex))
}

function checkForbidden(fragment: ErrorFragment): ErrorFragment {
  const sig = fragment.format()
  if (sig === 'Error(string)' || sig === 'Panic(uint256)') {
    logger.throwArgumentError(`cannot specify user defined ${sig} error`, 'fragment', fragment)
  }
  return fragment
}
abstract class Fragment {
  readonly type: string
  readonly name: string
  readonly inputs: Array<ParamType>

  readonly _isFragment: boolean

  constructor(constructorGuard: any, params: any) {
    if (constructorGuard !== _constructorGuard) {
      logger.throwError('use a static from method', Logger.errors.UNSUPPORTED_OPERATION, {
        operation: 'new Fragment()'
      })
    }
    populate(this, params)

    this._isFragment = true

    Object.freeze(this)
  }

  abstract format(format?: string): string

  static from(value: Fragment | JsonFragment | string): Fragment {
    if (Fragment.isFragment(value)) {
      return value
    }

    if (typeof value === 'string') {
      return Fragment.fromString(value)
    }

    return Fragment.fromObject(value)
  }

  static fromObject(value: Fragment | JsonFragment): Fragment {
    if (Fragment.isFragment(value)) {
      return value
    }

    switch (value.type) {
      case 'function':
        return FunctionFragment.fromObject(value)
      case 'event':
        return EventFragment.fromObject(value)
      case 'constructor':
        return ConstructorFragment.fromObject(value)
      case 'error':
        return ErrorFragment.fromObject(value)
      case 'fallback':
      case 'receive':
        // @TODO: Something? Maybe return a FunctionFragment? A custom DefaultFunctionFragment?
        return null
    }

    return logger.throwArgumentError('invalid fragment object', 'value', value)
  }

  static fromString(value: string): Fragment {
    // Make sure the "returns" is surrounded by a space and all whitespace is exactly one space
    value = value.replace(/\s/g, ' ')
    value = value
      .replace(/\(/g, ' (')
      .replace(/\)/g, ') ')
      .replace(/\s+/g, ' ')
    value = value.trim()

    if (value.split(' ')[0] === 'event') {
      return EventFragment.fromString(value.substring(5).trim())
    } else if (value.split(' ')[0] === 'function') {
      return FunctionFragment.fromString(value.substring(8).trim())
    } else if (value.split('(')[0].trim() === 'constructor') {
      return ConstructorFragment.fromString(value.trim())
    } else if (value.split(' ')[0] === 'error') {
      return ErrorFragment.fromString(value.substring(5).trim())
    }

    return logger.throwArgumentError('unsupported fragment', 'value', value)
  }

  static isFragment(value: any): value is Fragment {
    return !!(value && value._isFragment)
  }
}
class EventFragment extends Fragment {
  readonly anonymous: boolean

  format(format?: string): string {
    if (!format) {
      format = FormatTypes.sighash
    }
    if (!FormatTypes[format]) {
      logger.throwArgumentError('invalid format type', 'format', format)
    }

    if (format === FormatTypes.json) {
      return JSON.stringify({
        type: 'event',
        anonymous: this.anonymous,
        name: this.name,
        inputs: this.inputs.map(input => JSON.parse(input.format(format)))
      })
    }

    let result = ''

    if (format !== FormatTypes.sighash) {
      result += 'event '
    }

    result +=
      this.name +
      '(' +
      this.inputs.map(input => input.format(format)).join(format === FormatTypes.full ? ', ' : ',') +
      ') '

    if (format !== FormatTypes.sighash) {
      if (this.anonymous) {
        result += 'anonymous '
      }
    }

    return result.trim()
  }

  static from(value: EventFragment | JsonFragment | string): EventFragment {
    if (typeof value === 'string') {
      return EventFragment.fromString(value)
    }
    return EventFragment.fromObject(value)
  }

  static fromObject(value: JsonFragment | EventFragment): EventFragment {
    if (EventFragment.isEventFragment(value)) {
      return value
    }

    if (value.type !== 'event') {
      logger.throwArgumentError('invalid event object', 'value', value)
    }

    const params = {
      name: verifyIdentifier(value.name),
      anonymous: value.anonymous,
      inputs: value.inputs ? value.inputs.map(ParamType.fromObject) : [],
      type: 'event'
    }

    return new EventFragment(_constructorGuard, params)
  }

  static fromString(value: string): EventFragment {
    const match = value.match(regexParen)
    if (!match) {
      logger.throwArgumentError('invalid event string', 'value', value)
    }

    let anonymous = false
    match[3].split(' ').forEach(modifier => {
      switch (modifier.trim()) {
        case 'anonymous':
          anonymous = true
          break
        case '':
          break
        default:
          logger.warn('unknown modifier: ' + modifier)
      }
    })

    return EventFragment.fromObject({
      name: match[1].trim(),
      anonymous: anonymous,
      inputs: parseParams(match[2], true),
      type: 'event'
    })
  }

  static isEventFragment(value: any): value is EventFragment {
    return value && value._isFragment && value.type === 'event'
  }
}
class ErrorFragment extends Fragment {
  format(format?: string): string {
    if (!format) {
      format = FormatTypes.sighash
    }
    if (!FormatTypes[format]) {
      logger.throwArgumentError('invalid format type', 'format', format)
    }

    if (format === FormatTypes.json) {
      return JSON.stringify({
        type: 'error',
        name: this.name,
        inputs: this.inputs.map(input => JSON.parse(input.format(format)))
      })
    }

    let result = ''

    if (format !== FormatTypes.sighash) {
      result += 'error '
    }

    result +=
      this.name +
      '(' +
      this.inputs.map(input => input.format(format)).join(format === FormatTypes.full ? ', ' : ',') +
      ') '

    return result.trim()
  }

  static from(value: ErrorFragment | JsonFragment | string): ErrorFragment {
    if (typeof value === 'string') {
      return ErrorFragment.fromString(value)
    }
    return ErrorFragment.fromObject(value)
  }

  static fromObject(value: ErrorFragment | JsonFragment): ErrorFragment {
    if (ErrorFragment.isErrorFragment(value)) {
      return value
    }

    if (value.type !== 'error') {
      logger.throwArgumentError('invalid error object', 'value', value)
    }

    const params = {
      type: value.type,
      name: verifyIdentifier(value.name),
      inputs: value.inputs ? value.inputs.map(ParamType.fromObject) : []
    }

    return checkForbidden(new ErrorFragment(_constructorGuard, params))
  }

  static fromString(value: string): ErrorFragment {
    const params: any = { type: 'error' }

    const parens = value.match(regexParen)
    if (!parens) {
      logger.throwArgumentError('invalid error signature', 'value', value)
    }

    params.name = parens[1].trim()
    if (params.name) {
      verifyIdentifier(params.name)
    }

    params.inputs = parseParams(parens[2], false)

    return checkForbidden(ErrorFragment.fromObject(params))
  }

  static isErrorFragment(value: any): value is ErrorFragment {
    return value && value._isFragment && value.type === 'error'
  }
}

type StateInputValue = {
  constant?: boolean
  payable?: boolean
  stateMutability?: string
  type?: string
}

type StateOutputValue = {
  constant: boolean
  payable: boolean
  stateMutability: string
}

function verifyState(value: StateInputValue): StateOutputValue {
  const result: any = {
    constant: false,
    payable: true,
    stateMutability: 'payable'
  }

  if (value.stateMutability != null) {
    result.stateMutability = value.stateMutability

    // Set (and check things are consistent) the constant property
    result.constant = result.stateMutability === 'view' || result.stateMutability === 'pure'
    if (value.constant != null) {
      if (!!value.constant !== result.constant) {
        logger.throwArgumentError(
          'cannot have constant function with mutability ' + result.stateMutability,
          'value',
          value
        )
      }
    }

    // Set (and check things are consistent) the payable property
    result.payable = result.stateMutability === 'payable'
    if (value.payable != null) {
      if (!!value.payable !== result.payable) {
        logger.throwArgumentError(
          'cannot have payable function with mutability ' + result.stateMutability,
          'value',
          value
        )
      }
    }
  } else if (value.payable != null) {
    result.payable = !!value.payable

    // If payable we can assume non-constant; otherwise we can't assume
    if (value.constant == null && !result.payable && value.type !== 'constructor') {
      logger.throwArgumentError('unable to determine stateMutability', 'value', value)
    }

    result.constant = !!value.constant

    if (result.constant) {
      result.stateMutability = 'view'
    } else {
      result.stateMutability = result.payable ? 'payable' : 'nonpayable'
    }

    if (result.payable && result.constant) {
      logger.throwArgumentError('cannot have constant payable function', 'value', value)
    }
  } else if (value.constant != null) {
    result.constant = !!value.constant
    result.payable = !result.constant
    result.stateMutability = result.constant ? 'view' : 'payable'
  } else if (value.type !== 'constructor') {
    logger.throwArgumentError('unable to determine stateMutability', 'value', value)
  }

  return result
}

interface _ConstructorFragment extends _Fragment {
  stateMutability: string
  payable: boolean
  gas?: BigNumber
}
function parseGas(value: string, params: any): string {
  params.gas = null

  const comps = value.split('@')
  if (comps.length !== 1) {
    if (comps.length > 2) {
      logger.throwArgumentError('invalid human-readable ABI signature', 'value', value)
    }
    if (!comps[1].match(/^[0-9]+$/)) {
      logger.throwArgumentError('invalid human-readable ABI signature gas', 'value', value)
    }
    params.gas = BigNumber.from(comps[1])
    return comps[0]
  }

  return value
}
function parseModifiers(value: string, params: any): void {
  params.constant = false
  params.payable = false
  params.stateMutability = 'nonpayable'

  value.split(' ').forEach(modifier => {
    switch (modifier.trim()) {
      case 'constant':
        params.constant = true
        break
      case 'payable':
        params.payable = true
        params.stateMutability = 'payable'
        break
      case 'nonpayable':
        params.payable = false
        params.stateMutability = 'nonpayable'
        break
      case 'pure':
        params.constant = true
        params.stateMutability = 'pure'
        break
      case 'view':
        params.constant = true
        params.stateMutability = 'view'
        break
      case 'external':
      case 'public':
      case '':
        break
      default:
        console.log('unknown modifier: ' + modifier)
    }
  })
}

function hexDataSlice(data: BytesLike, offset: number, endOffset?: number): string {
  if (typeof data !== 'string') {
    data = hexlify(data)
  } else if (!isHexString(data) || data.length % 2) {
    logger.throwArgumentError('invalid hexData', 'value', data)
  }

  offset = 2 + 2 * offset

  if (endOffset != null) {
    return '0x' + data.substring(offset, 2 + 2 * endOffset)
  }

  return '0x' + data.substring(offset)
}
class ConstructorFragment extends Fragment {
  stateMutability: string
  payable: boolean
  gas?: BigNumber

  format(format?: string): string {
    if (!format) {
      format = FormatTypes.sighash
    }
    if (!FormatTypes[format]) {
      logger.throwArgumentError('invalid format type', 'format', format)
    }

    if (format === FormatTypes.json) {
      return JSON.stringify({
        type: 'constructor',
        stateMutability: this.stateMutability !== 'nonpayable' ? this.stateMutability : undefined,
        payable: this.payable,
        gas: this.gas ? this.gas.toNumber() : undefined,
        inputs: this.inputs.map(input => JSON.parse(input.format(format)))
      })
    }

    if (format === FormatTypes.sighash) {
      logger.throwError('cannot format a constructor for sighash', Logger.errors.UNSUPPORTED_OPERATION, {
        operation: 'format(sighash)'
      })
    }

    let result =
      'constructor(' +
      this.inputs.map(input => input.format(format)).join(format === FormatTypes.full ? ', ' : ',') +
      ') '

    if (this.stateMutability && this.stateMutability !== 'nonpayable') {
      result += this.stateMutability + ' '
    }

    return result.trim()
  }

  static from(value: ConstructorFragment | JsonFragment | string): ConstructorFragment {
    if (typeof value === 'string') {
      return ConstructorFragment.fromString(value)
    }
    return ConstructorFragment.fromObject(value)
  }

  static fromObject(value: ConstructorFragment | JsonFragment): ConstructorFragment {
    if (ConstructorFragment.isConstructorFragment(value)) {
      return value
    }

    if (value.type !== 'constructor') {
      logger.throwArgumentError('invalid constructor object', 'value', value)
    }

    const state = verifyState(value)
    if (state.constant) {
      logger.throwArgumentError('constructor cannot be constant', 'value', value)
    }

    const params = {
      name: null,
      type: value.type,
      inputs: value.inputs ? value.inputs.map(ParamType.fromObject) : [],
      payable: state.payable,
      stateMutability: state.stateMutability,
      gas: value.gas ? BigNumber.from(value.gas) : null
    }

    return new ConstructorFragment(_constructorGuard, params)
  }

  static fromString(value: string): ConstructorFragment {
    const params: any = { type: 'constructor' }

    value = parseGas(value, params)

    const parens = value.match(regexParen)
    if (!parens || parens[1].trim() !== 'constructor') {
      logger.throwArgumentError('invalid constructor string', 'value', value)
    }

    params.inputs = parseParams(parens[2].trim(), false)

    parseModifiers(parens[3].trim(), params)

    return ConstructorFragment.fromObject(params)
  }

  static isConstructorFragment(value: any): value is ConstructorFragment {
    return value && value._isFragment && value.type === 'constructor'
  }
}
interface _FunctionFragment extends _ConstructorFragment {
  constant: boolean
  outputs?: Array<ParamType>
}

class FunctionFragment extends ConstructorFragment {
  constant: boolean
  outputs?: Array<ParamType>

  format(format?: string): string {
    if (!format) {
      format = FormatTypes.sighash
    }
    if (!FormatTypes[format]) {
      logger.throwArgumentError('invalid format type', 'format', format)
    }

    if (format === FormatTypes.json) {
      return JSON.stringify({
        type: 'function',
        name: this.name,
        constant: this.constant,
        stateMutability: this.stateMutability !== 'nonpayable' ? this.stateMutability : undefined,
        payable: this.payable,
        gas: this.gas ? this.gas.toNumber() : undefined,
        inputs: this.inputs.map(input => JSON.parse(input.format(format))),
        outputs: this.outputs.map(output => JSON.parse(output.format(format)))
      })
    }

    let result = ''

    if (format !== FormatTypes.sighash) {
      result += 'function '
    }

    result +=
      this.name +
      '(' +
      this.inputs.map(input => input.format(format)).join(format === FormatTypes.full ? ', ' : ',') +
      ') '

    if (format !== FormatTypes.sighash) {
      if (this.stateMutability) {
        if (this.stateMutability !== 'nonpayable') {
          result += this.stateMutability + ' '
        }
      } else if (this.constant) {
        result += 'view '
      }

      if (this.outputs && this.outputs.length) {
        result += 'returns (' + this.outputs.map(output => output.format(format)).join(', ') + ') '
      }

      if (this.gas != null) {
        result += '@' + this.gas.toString() + ' '
      }
    }

    return result.trim()
  }

  static from(value: FunctionFragment | JsonFragment | string): FunctionFragment {
    if (typeof value === 'string') {
      return FunctionFragment.fromString(value)
    }
    return FunctionFragment.fromObject(value)
  }

  static fromObject(value: FunctionFragment | JsonFragment): FunctionFragment {
    if (FunctionFragment.isFunctionFragment(value)) {
      return value
    }

    if (value.type !== 'function') {
      logger.throwArgumentError('invalid function object', 'value', value)
    }

    const state = verifyState(value)

    const params = {
      type: value.type,
      name: verifyIdentifier(value.name),
      constant: state.constant,
      inputs: value.inputs ? value.inputs.map(ParamType.fromObject) : [],
      outputs: value.outputs ? value.outputs.map(ParamType.fromObject) : [],
      payable: state.payable,
      stateMutability: state.stateMutability,
      gas: value.gas ? BigNumber.from(value.gas) : null
    }

    return new FunctionFragment(_constructorGuard, params)
  }

  static fromString(value: string): FunctionFragment {
    const params: any = { type: 'function' }
    value = parseGas(value, params)

    const comps = value.split(' returns ')
    if (comps.length > 2) {
      logger.throwArgumentError('invalid function string', 'value', value)
    }

    const parens = comps[0].match(regexParen)
    if (!parens) {
      logger.throwArgumentError('invalid function signature', 'value', value)
    }

    params.name = parens[1].trim()
    if (params.name) {
      verifyIdentifier(params.name)
    }

    params.inputs = parseParams(parens[2], false)

    parseModifiers(parens[3].trim(), params)

    // We have outputs
    if (comps.length > 1) {
      const returns = comps[1].match(regexParen)
      if (returns[1].trim() != '' || returns[3].trim() != '') {
        logger.throwArgumentError('unexpected tokens', 'value', value)
      }
      params.outputs = parseParams(returns[2], false)
    } else {
      params.outputs = []
    }

    return FunctionFragment.fromObject(params)
  }

  static isFunctionFragment(value: any): value is FunctionFragment {
    return value && value._isFragment && value.type === 'function'
  }
}

function getStatic<T>(ctor: any, key: string): T {
  for (let i = 0; i < 32; i++) {
    if (ctor[key]) {
      return ctor[key]
    }
    if (!ctor.prototype || typeof ctor.prototype !== 'object') {
      break
    }
    ctor = Object.getPrototypeOf(ctor.prototype).constructor
  }
  return null
}

const defaultAbiCoder: AbiCoder = new AbiCoder()

function id(text: string): string {
  return keccak256(toUtf8Bytes(text))
}
const BuiltinErrors: Record<string, { signature: string; inputs: Array<string>; name: string; reason?: boolean }> = {
  '0x08c379a0': { signature: 'Error(string)', name: 'Error', inputs: ['string'], reason: true },
  '0x4e487b71': { signature: 'Panic(uint256)', name: 'Panic', inputs: ['uint256'] }
}
class Description<T = any> {
  constructor(info: { [K in keyof T]: T[K] }) {
    for (const key in info) {
      ;(<any>this)[key] = deepCopy(info[key])
    }
  }
}
class Indexed extends Description<Indexed> {
  readonly hash: string
  readonly _isIndexed: boolean

  static isIndexed(value: any): value is Indexed {
    return !!(value && value._isIndexed)
  }
}
function wrapAccessError(property: string, error: Error): Error {
  const wrap = new Error(`deferred error during ABI decoding triggered accessing ${property}`)
  ;(<any>wrap).error = error
  return wrap
}
class TransactionDescription extends Description<TransactionDescription> {
  readonly functionFragment: FunctionFragment
  readonly name: string
  readonly args: Result
  readonly signature: string
  readonly sighash: string
  readonly value: BigNumber
}
class LogDescription extends Description<LogDescription> {
  readonly eventFragment: EventFragment
  readonly name: string
  readonly signature: string
  readonly topic: string
  readonly args: Result
}
class ErrorDescription extends Description<ErrorDescription> {
  readonly errorFragment: ErrorFragment
  readonly name: string
  readonly args: Result
  readonly signature: string
  readonly sighash: string
}

const opaque: { [key: string]: boolean } = { bigint: true, boolean: true, function: true, number: true, string: true }

function _isFrozen(object: any): boolean {
  // Opaque objects are not mutable, so safe to copy by assignment
  if (object === undefined || object === null || opaque[typeof object]) {
    return true
  }

  if (Array.isArray(object) || typeof object === 'object') {
    if (!Object.isFrozen(object)) {
      return false
    }

    const keys = Object.keys(object)
    for (let i = 0; i < keys.length; i++) {
      if (!_isFrozen(object[keys[i]])) {
        return false
      }
    }

    return true
  }

  return logger.throwArgumentError(`Cannot deepCopy ${typeof object}`, 'object', object)
}
function _deepCopy(object: any): any {
  if (_isFrozen(object)) {
    return object
  }

  // Arrays are mutable, so we need to create a copy
  if (Array.isArray(object)) {
    return Object.freeze(object.map(item => deepCopy(item)))
  }

  if (typeof object === 'object') {
    const result: { [key: string]: any } = {}
    for (const key in object) {
      const value = object[key]
      if (value === undefined) {
        continue
      }
      defineReadOnly(result, key, deepCopy(value))
    }

    return result
  }

  return logger.throwArgumentError(`Cannot deepCopy ${typeof object}`, 'object', object)
}
function deepCopy<T>(object: T): T {
  return _deepCopy(object)
}
class Interface {
  readonly fragments: ReadonlyArray<Fragment>

  readonly errors: { [name: string]: ErrorFragment }
  readonly events: { [name: string]: EventFragment }
  readonly functions: { [name: string]: FunctionFragment }
  readonly structs: { [name: string]: any }

  readonly deploy: ConstructorFragment

  readonly _abiCoder: AbiCoder

  readonly _isInterface: boolean

  constructor(fragments: string | ReadonlyArray<Fragment | JsonFragment | string>) {
    logger.checkNew(new.target, Interface)

    let abi: ReadonlyArray<Fragment | JsonFragment | string> = []
    if (typeof fragments === 'string') {
      abi = JSON.parse(fragments)
    } else {
      abi = fragments
    }

    defineReadOnly(
      this,
      'fragments',
      abi
        .map(fragment => {
          return Fragment.from(fragment)
        })
        .filter(fragment => fragment != null)
    )

    defineReadOnly(this, '_abiCoder', getStatic<() => AbiCoder>(new.target, 'getAbiCoder')())

    defineReadOnly(this, 'functions', {})
    defineReadOnly(this, 'errors', {})
    defineReadOnly(this, 'events', {})
    defineReadOnly(this, 'structs', {})

    // Add all fragments by their signature
    this.fragments.forEach(fragment => {
      let bucket: { [name: string]: Fragment } = null
      switch (fragment.type) {
        case 'constructor':
          if (this.deploy) {
            logger.warn('duplicate definition - constructor')
            return
          }
          //checkNames(fragment, "input", fragment.inputs);
          defineReadOnly(this, 'deploy', <ConstructorFragment>fragment)
          return
        case 'function':
          //checkNames(fragment, "input", fragment.inputs);
          //checkNames(fragment, "output", (<FunctionFragment>fragment).outputs);
          bucket = this.functions
          break
        case 'event':
          //checkNames(fragment, "input", fragment.inputs);
          bucket = this.events
          break
        case 'error':
          bucket = this.errors
          break
        default:
          return
      }

      const signature = fragment.format()
      if (bucket[signature]) {
        logger.warn('duplicate definition - ' + signature)
        return
      }

      bucket[signature] = fragment
    })

    // If we do not have a constructor add a default
    if (!this.deploy) {
      defineReadOnly(
        this,
        'deploy',
        ConstructorFragment.from({
          payable: false,
          type: 'constructor'
        })
      )
    }

    defineReadOnly(this, '_isInterface', true)
  }

  format(format?: string): string | Array<string> {
    if (!format) {
      format = FormatTypes.full
    }
    if (format === FormatTypes.sighash) {
      logger.throwArgumentError('interface does not support formatting sighash', 'format', format)
    }

    const abi = this.fragments.map(fragment => fragment.format(format))

    // We need to re-bundle the JSON fragments a bit
    if (format === FormatTypes.json) {
      return JSON.stringify(abi.map(j => JSON.parse(j)))
    }

    return abi
  }

  // Sub-classes can override these to handle other blockchains
  static getAbiCoder(): AbiCoder {
    return defaultAbiCoder
  }

  static getAddress(address: string): string {
    return getAddress(address)
  }

  static getSighash(fragment: ErrorFragment | FunctionFragment): string {
    return hexDataSlice(id(fragment.format()), 0, 4)
  }

  static getEventTopic(eventFragment: EventFragment): string {
    return id(eventFragment.format())
  }

  // Find a function definition by any means necessary (unless it is ambiguous)
  getFunction(nameOrSignatureOrSighash: string): FunctionFragment {
    if (isHexString(nameOrSignatureOrSighash)) {
      for (const name in this.functions) {
        if (nameOrSignatureOrSighash === this.getSighash(name)) {
          return this.functions[name]
        }
      }
      logger.throwArgumentError('no matching function', 'sighash', nameOrSignatureOrSighash)
    }

    // It is a bare name, look up the function (will return null if ambiguous)
    if (nameOrSignatureOrSighash.indexOf('(') === -1) {
      const name = nameOrSignatureOrSighash.trim()
      const matching = Object.keys(this.functions).filter(f => f.split('(' /* fix:) */)[0] === name)
      if (matching.length === 0) {
        logger.throwArgumentError('no matching function', 'name', name)
      } else if (matching.length > 1) {
        logger.throwArgumentError('multiple matching functions', 'name', name)
      }

      return this.functions[matching[0]]
    }

    // Normlize the signature and lookup the function
    const result = this.functions[FunctionFragment.fromString(nameOrSignatureOrSighash).format()]
    if (!result) {
      logger.throwArgumentError('no matching function', 'signature', nameOrSignatureOrSighash)
    }
    return result
  }

  // Find an event definition by any means necessary (unless it is ambiguous)
  getEvent(nameOrSignatureOrTopic: string): EventFragment {
    if (isHexString(nameOrSignatureOrTopic)) {
      const topichash = nameOrSignatureOrTopic.toLowerCase()
      for (const name in this.events) {
        if (topichash === this.getEventTopic(name)) {
          return this.events[name]
        }
      }
      logger.throwArgumentError('no matching event', 'topichash', topichash)
    }

    // It is a bare name, look up the function (will return null if ambiguous)
    if (nameOrSignatureOrTopic.indexOf('(') === -1) {
      const name = nameOrSignatureOrTopic.trim()
      const matching = Object.keys(this.events).filter(f => f.split('(' /* fix:) */)[0] === name)
      if (matching.length === 0) {
        logger.throwArgumentError('no matching event', 'name', name)
      } else if (matching.length > 1) {
        logger.throwArgumentError('multiple matching events', 'name', name)
      }

      return this.events[matching[0]]
    }

    // Normlize the signature and lookup the function
    const result = this.events[EventFragment.fromString(nameOrSignatureOrTopic).format()]
    if (!result) {
      logger.throwArgumentError('no matching event', 'signature', nameOrSignatureOrTopic)
    }
    return result
  }

  // Find a function definition by any means necessary (unless it is ambiguous)
  getError(nameOrSignatureOrSighash: string): ErrorFragment {
    if (isHexString(nameOrSignatureOrSighash)) {
      const getSighash = getStatic<(f: ErrorFragment | FunctionFragment) => string>(this.constructor, 'getSighash')
      for (const name in this.errors) {
        const error = this.errors[name]
        if (nameOrSignatureOrSighash === getSighash(error)) {
          return this.errors[name]
        }
      }
      logger.throwArgumentError('no matching error', 'sighash', nameOrSignatureOrSighash)
    }

    // It is a bare name, look up the function (will return null if ambiguous)
    if (nameOrSignatureOrSighash.indexOf('(') === -1) {
      const name = nameOrSignatureOrSighash.trim()
      const matching = Object.keys(this.errors).filter(f => f.split('(' /* fix:) */)[0] === name)
      if (matching.length === 0) {
        logger.throwArgumentError('no matching error', 'name', name)
      } else if (matching.length > 1) {
        logger.throwArgumentError('multiple matching errors', 'name', name)
      }

      return this.errors[matching[0]]
    }

    // Normlize the signature and lookup the function
    const result = this.errors[FunctionFragment.fromString(nameOrSignatureOrSighash).format()]
    if (!result) {
      logger.throwArgumentError('no matching error', 'signature', nameOrSignatureOrSighash)
    }
    return result
  }

  // Get the sighash (the bytes4 selector) used by Solidity to identify a function
  getSighash(fragment: ErrorFragment | FunctionFragment | string): string {
    if (typeof fragment === 'string') {
      try {
        fragment = this.getFunction(fragment)
      } catch (error) {
        try {
          fragment = this.getError(<string>fragment)
        } catch (_) {
          throw error
        }
      }
    }

    return getStatic<(f: ErrorFragment | FunctionFragment) => string>(this.constructor, 'getSighash')(fragment)
  }

  // Get the topic (the bytes32 hash) used by Solidity to identify an event
  getEventTopic(eventFragment: EventFragment | string): string {
    if (typeof eventFragment === 'string') {
      eventFragment = this.getEvent(eventFragment)
    }

    return getStatic<(e: EventFragment) => string>(this.constructor, 'getEventTopic')(eventFragment)
  }

  _decodeParams(params: ReadonlyArray<ParamType>, data: BytesLike): Result {
    return this._abiCoder.decode(params, data)
  }

  _encodeParams(params: ReadonlyArray<ParamType>, values: ReadonlyArray<any>): string {
    return this._abiCoder.encode(params, values)
  }

  encodeDeploy(values?: ReadonlyArray<any>): string {
    return this._encodeParams(this.deploy.inputs, values || [])
  }

  decodeErrorResult(fragment: ErrorFragment | string, data: BytesLike): Result {
    if (typeof fragment === 'string') {
      fragment = this.getError(fragment)
    }

    const bytes = arrayify(data)

    if (hexlify(bytes.slice(0, 4)) !== this.getSighash(fragment)) {
      logger.throwArgumentError(`data signature does not match error ${fragment.name}.`, 'data', hexlify(bytes))
    }

    return this._decodeParams(fragment.inputs, bytes.slice(4))
  }

  encodeErrorResult(fragment: ErrorFragment | string, values?: ReadonlyArray<any>): string {
    if (typeof fragment === 'string') {
      fragment = this.getError(fragment)
    }

    return hexlify(concat([this.getSighash(fragment), this._encodeParams(fragment.inputs, values || [])]))
  }

  // Decode the data for a function call (e.g. tx.data)
  decodeFunctionData(functionFragment: FunctionFragment | string, data: BytesLike): Result {
    if (typeof functionFragment === 'string') {
      functionFragment = this.getFunction(functionFragment)
    }

    const bytes = arrayify(data)

    if (hexlify(bytes.slice(0, 4)) !== this.getSighash(functionFragment)) {
      logger.throwArgumentError(
        `data signature does not match function ${functionFragment.name}.`,
        'data',
        hexlify(bytes)
      )
    }

    return this._decodeParams(functionFragment.inputs, bytes.slice(4))
  }

  // Encode the data for a function call (e.g. tx.data)
  encodeFunctionData(functionFragment: FunctionFragment | string, values?: ReadonlyArray<any>): string {
    if (typeof functionFragment === 'string') {
      functionFragment = this.getFunction(functionFragment)
    }

    return hexlify(
      concat([this.getSighash(functionFragment), this._encodeParams(functionFragment.inputs, values || [])])
    )
  }

  // Decode the result from a function call (e.g. from eth_call)
  static decodeFunctionResult(functionFragment: FunctionFragment | string, data: BytesLike): Result {
    if (typeof functionFragment === 'string') {
      functionFragment = this.getFunction(functionFragment)
    }

    const bytes = arrayify(data)

    let reason: string = null
    let errorArgs: Result = null
    let errorName: string = null
    let errorSignature: string = null
    switch (bytes.length % this._abiCoder._getWordSize()) {
      case 0:
        try {
          return this._abiCoder.decode(functionFragment.outputs, bytes)
        } catch (error) {}
        break

      case 4: {
        const selector = hexlify(bytes.slice(0, 4))
        const builtin = BuiltinErrors[selector]
        if (builtin) {
          errorArgs = this._abiCoder.decode(builtin.inputs, bytes.slice(4))
          errorName = builtin.name
          errorSignature = builtin.signature
          if (builtin.reason) {
            reason = errorArgs[0]
          }
        } else {
          try {
            const error = this.getError(selector)
            errorArgs = this._abiCoder.decode(error.inputs, bytes.slice(4))
            errorName = error.name
            errorSignature = error.format()
          } catch (error) {
            console.log(error)
          }
        }
        break
      }
    }

    return logger.throwError('call revert exception', Logger.errors.CALL_EXCEPTION, {
      method: functionFragment.format(),
      errorArgs,
      errorName,
      errorSignature,
      reason
    })
  }

  // Encode the result for a function call (e.g. for eth_call)
  encodeFunctionResult(functionFragment: FunctionFragment | string, values?: ReadonlyArray<any>): string {
    if (typeof functionFragment === 'string') {
      functionFragment = this.getFunction(functionFragment)
    }

    return hexlify(this._abiCoder.encode(functionFragment.outputs, values || []))
  }

  // Create the filter for the event with search criteria (e.g. for eth_filterLog)
  encodeFilterTopics(eventFragment: EventFragment, values: ReadonlyArray<any>): Array<string | Array<string>> {
    if (typeof eventFragment === 'string') {
      eventFragment = this.getEvent(eventFragment)
    }

    if (values.length > eventFragment.inputs.length) {
      logger.throwError('too many arguments for ' + eventFragment.format(), Logger.errors.UNEXPECTED_ARGUMENT, {
        argument: 'values',
        value: values
      })
    }

    const topics: Array<string | Array<string>> = []
    if (!eventFragment.anonymous) {
      topics.push(this.getEventTopic(eventFragment))
    }

    const encodeTopic = (param: ParamType, value: any): string => {
      if (param.type === 'string') {
        return id(value)
      } else if (param.type === 'bytes') {
        return keccak256(hexlify(value))
      }

      // Check addresses are valid
      if (param.type === 'address') {
        this._abiCoder.encode(['address'], [value])
      }
      return hexZeroPad(hexlify(value), 32)
    }

    values.forEach((value, index) => {
      const param = eventFragment.inputs[index]

      if (!param.indexed) {
        if (value != null) {
          logger.throwArgumentError(
            'cannot filter non-indexed parameters; must be null',
            'contract.' + param.name,
            value
          )
        }
        return
      }

      if (value == null) {
        topics.push(null)
      } else if (param.baseType === 'array' || param.baseType === 'tuple') {
        logger.throwArgumentError('filtering with tuples or arrays not supported', 'contract.' + param.name, value)
      } else if (Array.isArray(value)) {
        topics.push(value.map(value => encodeTopic(param, value)))
      } else {
        topics.push(encodeTopic(param, value))
      }
    })

    // Trim off trailing nulls
    while (topics.length && topics[topics.length - 1] === null) {
      topics.pop()
    }

    return topics
  }

  encodeEventLog(eventFragment: EventFragment, values: ReadonlyArray<any>): { data: string; topics: Array<string> } {
    if (typeof eventFragment === 'string') {
      eventFragment = this.getEvent(eventFragment)
    }

    const topics: Array<string> = []

    const dataTypes: Array<ParamType> = []
    const dataValues: Array<string> = []

    if (!eventFragment.anonymous) {
      topics.push(this.getEventTopic(eventFragment))
    }

    if (values.length !== eventFragment.inputs.length) {
      logger.throwArgumentError('event arguments/values mismatch', 'values', values)
    }

    eventFragment.inputs.forEach((param, index) => {
      const value = values[index]
      if (param.indexed) {
        if (param.type === 'string') {
          topics.push(id(value))
        } else if (param.type === 'bytes') {
          topics.push(keccak256(value))
        } else if (param.baseType === 'tuple' || param.baseType === 'array') {
          // @TOOD
          throw new Error('not implemented')
        } else {
          topics.push(this._abiCoder.encode([param.type], [value]))
        }
      } else {
        dataTypes.push(param)
        dataValues.push(value)
      }
    })

    return {
      data: this._abiCoder.encode(dataTypes, dataValues),
      topics: topics
    }
  }

  // Decode a filter for the event and the search criteria
  decodeEventLog(eventFragment: EventFragment | string, data: BytesLike, topics?: ReadonlyArray<string>): Result {
    if (typeof eventFragment === 'string') {
      eventFragment = this.getEvent(eventFragment)
    }

    if (topics != null && !eventFragment.anonymous) {
      const topicHash = this.getEventTopic(eventFragment)
      if (!isHexString(topics[0], 32) || topics[0].toLowerCase() !== topicHash) {
        logger.throwError('fragment/topic mismatch', Logger.errors.INVALID_ARGUMENT, {
          argument: 'topics[0]',
          expected: topicHash,
          value: topics[0]
        })
      }
      topics = topics.slice(1)
    }

    const indexed: Array<ParamType> = []
    const nonIndexed: Array<ParamType> = []
    const dynamic: Array<boolean> = []

    eventFragment.inputs.forEach((param, index) => {
      if (param.indexed) {
        if (
          param.type === 'string' ||
          param.type === 'bytes' ||
          param.baseType === 'tuple' ||
          param.baseType === 'array'
        ) {
          indexed.push(ParamType.fromObject({ type: 'bytes32', name: param.name }))
          dynamic.push(true)
        } else {
          indexed.push(param)
          dynamic.push(false)
        }
      } else {
        nonIndexed.push(param)
        dynamic.push(false)
      }
    })

    const resultIndexed = topics != null ? this._abiCoder.decode(indexed, concat(topics)) : null
    const resultNonIndexed = this._abiCoder.decode(nonIndexed, data, true)

    const result: Array<any> & { [key: string]: any } = []
    let nonIndexedIndex = 0,
      indexedIndex = 0
    eventFragment.inputs.forEach((param, index) => {
      if (param.indexed) {
        if (resultIndexed == null) {
          result[index] = new Indexed({ _isIndexed: true, hash: null })
        } else if (dynamic[index]) {
          result[index] = new Indexed({ _isIndexed: true, hash: resultIndexed[indexedIndex++] })
        } else {
          try {
            result[index] = resultIndexed[indexedIndex++]
          } catch (error) {
            result[index] = error
          }
        }
      } else {
        try {
          result[index] = resultNonIndexed[nonIndexedIndex++]
        } catch (error) {
          result[index] = error
        }
      }

      // Add the keyword argument if named and safe
      if (param.name && result[param.name] == null) {
        const value = result[index]

        // Make error named values throw on access
        if (value instanceof Error) {
          Object.defineProperty(result, param.name, {
            get: () => {
              throw wrapAccessError(`property ${JSON.stringify(param.name)}`, value)
            }
          })
        } else {
          result[param.name] = value
        }
      }
    })

    // Make all error indexed values throw on access
    for (let i = 0; i < result.length; i++) {
      const value = result[i]
      if (value instanceof Error) {
        Object.defineProperty(result, i, {
          get: () => {
            throw wrapAccessError(`index ${i}`, value)
          }
        })
      }
    }

    return Object.freeze(result)
  }

  // Given a transaction, find the matching function fragment (if any) and
  // determine all its properties and call parameters
  parseTransaction(tx: { data: string; value?: BigNumberish }): TransactionDescription {
    const fragment = this.getFunction(tx.data.substring(0, 10).toLowerCase())

    if (!fragment) {
      return null
    }

    return new TransactionDescription({
      args: this._abiCoder.decode(fragment.inputs, '0x' + tx.data.substring(10)),
      functionFragment: fragment,
      name: fragment.name,
      signature: fragment.format(),
      sighash: this.getSighash(fragment),
      value: BigNumber.from(tx.value || '0')
    })
  }

  // @TODO
  //parseCallResult(data: BytesLike): ??

  // Given an event log, find the matching event fragment (if any) and
  // determine all its properties and values
  parseLog(log: { topics: Array<string>; data: string }): LogDescription {
    const fragment = this.getEvent(log.topics[0])

    if (!fragment || fragment.anonymous) {
      return null
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
    })
  }

  parseError(data: BytesLike): ErrorDescription {
    const hexData = hexlify(data)
    const fragment = this.getError(hexData.substring(0, 10).toLowerCase())

    if (!fragment) {
      return null
    }

    return new ErrorDescription({
      args: this._abiCoder.decode(fragment.inputs, '0x' + hexData.substring(10)),
      errorFragment: fragment,
      name: fragment.name,
      signature: fragment.format(),
      sighash: this.getSighash(fragment)
    })
  }

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

  static isInterface(value: any): value is Interface {
    return !!(value && value._isInterface)
  }
}

const data =
  '0x000000000000000000000000000000000000000000000000000000000000002000000000000000000000000000000000000000000000000000000000000000045745544800000000000000000000000000000000000000000000000000000000'
const prms1 = {
  arrayChildren: null,
  arrayLength: null,
  baseType: 'string',
  components: null,
  indexed: null,
  name: null,
  type: 'string'
}
const PT = new ParamType(_constructorGuard, prms1)

const prms2 = {
  constant: true,
  gas: null,
  inputs: [],
  name: 'symbol',
  outputs: [PT],
  payable: false,
  stateMutability: 'view',
  type: 'function',
  _isFragment: true
}

const FF = new FunctionFragment(_constructorGuard, prms2)
const result = Interface.decodeFunctionResult(FF, data)
console.log(result)
