hex='000000000000000000000000000000000000000000000000000000000000002000000000000000000000000000000000000000000000000000000000000000045745544800000000000000000000000000000000000000000000000000000000'
function a() {
    const result = [];
    for (let i = 0; i < hex.length; i += 2) {
        result.push(parseInt(hex.substring(i, i + 2), 16));
        }
        if   (result.slice) {
            console.log(123)
 }

        //return addSlice(new Uint8Array(result));
}
function addSlice(array){
    if (array.slice) { return array; }

    array.slice = function() {
        const args = Array.prototype.slice.call(arguments);
        return addSlice(new Uint8Array(Array.prototype.slice.apply(array, args)));
    }

    return array;
}
a()

DynamicBytesCoder extends Coder {
    constructor(type, localName) {
       super(type, type, localName, true);
    }
    defaultValue(){
        return "0x";
    }
    encode(writer, value){
        value = arrayify(value);
        let length = writer.writeValue(value.length);
        length += writer.writeBytes(value);
        return length;
    }
    decode(reader){
        return reader.readBytes(reader.readValue().toNumber(), true);
    }
}
class StringCoder extends DynamicBytesCoder {

    constructor(localName) {
        super("string", localName);
    }
    defaultValue(){
        return "";
    }
    encode(writer, value){
        return super.encode(writer, toUtf8Bytes(value));
    }
    decode(reader){
        return toUtf8String(super.decode(reader));
    }
}
const type={arrayChildren: null,
arrayLength: null,
baseType: "string",
components: null,
indexed: null,
name: null,
type: "string",
_isParamType: true}
function from(value){
    return fromObject(value);
    }
function  fromObject(value){
        if (isParamType(value)) { return value; }

    }
function isParamType(value){
        return !!(value != null && value._isParamType);
    }
    console.log(from(type))