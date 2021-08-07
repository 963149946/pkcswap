123.ts:648:17 - error TS2307: Cannot find module 'bn' or its corresponding type declarations.

648 import _BN from 'bn'
                    ~~~~

123.ts:1090:8 - error TS1192: Module '"D:/pkcswap-interface-609/node_modules/js-sha3/index"' has no default export.

1090 import sha3 from 'js-sha3'
            ~~~~

123.ts:3386:31 - error TS2339: Property 'getFunction' does not exist on type 'typeof Interface'.

3386       functionFragment = this.getFunction(functionFragment)
                                   ~~~~~~~~~~~

123.ts:3395:33 - error TS2339: Property '_abiCoder' does not exist on type 'typeof Interface'.

3395     switch (bytes.length % this._abiCoder._getWordSize()) {
                                     ~~~~~~~~~

123.ts:3398:23 - error TS2339: Property '_abiCoder' does not exist on type 'typeof Interface'.

3398           return this._abiCoder.decode(functionFragment.outputs, bytes)
                           ~~~~~~~~~

123.ts:3398:57 - error TS2339: Property 'outputs' does not exist on type 'string | FunctionFragment'.
  Property 'outputs' does not exist on type 'string'.

3398           return this._abiCoder.decode(functionFragment.outputs, bytes)
                                                             ~~~~~~~

123.ts:3406:28 - error TS2339: Property '_abiCoder' does not exist on type 'typeof Interface'.

3406           errorArgs = this._abiCoder.decode(builtin.inputs, bytes.slice(4))
                                ~~~~~~~~~

123.ts:3414:32 - error TS2339: Property 'getError' does not exist on type 'typeof Interface'.

3414             const error = this.getError(selector)
                                    ~~~~~~~~

123.ts:3415:30 - error TS2339: Property '_abiCoder' does not exist on type 'typeof Interface'.

3415             errorArgs = this._abiCoder.decode(error.inputs, bytes.slice(4))
                                  ~~~~~~~~~

123.ts:3427:32 - error TS2339: Property 'format' does not exist on type 'string | FunctionFragment'.
  Property 'format' does not exist on type 'string'.

3427       method: functionFragment.format(),