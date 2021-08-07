#0xf642060ad79BB34232172DC3d195B0930C8321a0在roposten网络和火币测试网第一次部署合约的地址,nonce=0
#0xF1c6443AD2B87ba79B1838D8D7835712E9A92dbb
#0xF1c6443AD2B87ba79B1838D8D7835712E9A92dbb

#0xf642060ad79BB34232172DC3d195B0930C8321a0在roposten网络和火币测试网第二次部署合约的地址,nonce=1
#0xC086D50fDe19ADa3fE2C31F013eF02614aBd9A47
#0xC086D50fDe19ADa3fE2C31F013eF02614aBd9A47

#0xf642060ad79BB34232172DC3d195B0930C8321a0在roposten网络和火币测试网第三次部署工厂合约的地址,nonce=2
# 0x8bBD31DDE7a2BF8D94953BE5B0a3d7CDf6889d12
# 0x8bBD31DDE7a2BF8D94953BE5B0a3d7CDf6889d12
#此时就连工厂合约的init_code_hash哈希值也都是相同的
# 0x4784a89af3b7a4ae5888074ddd1024534db2494442d7eec236ea8720e470e072
# 0x4784a89af3b7a4ae5888074ddd1024534db2494442d7eec236ea8720e470e072

try:
    from Crypto.Hash import keccak
    sha3_256 = lambda x: keccak.new(digest_bits=256, data=x).digest()
except:
    import sha3 as _sha3
    sha3_256 = lambda x: _sha3.sha3_256(x).digest()
import rlp
from rlp.utils import decode_hex,encode_hex


def to_string(value):
    if isinstance(value, bytes):
        return value
    if isinstance(value, str):
        return bytes(value, 'utf-8')
    if isinstance(value, int):
        return bytes(str(value), 'utf-8')


def sha3(seed):
    return sha3_256(to_string(seed))

def normalize_address(x, allow_blank=False):
    if allow_blank and x == '':
        return ''
    if len(x) in (42, 50) and x[:2] == '0x':
        x = x[2:]
    if len(x) in (40, 48):
        x = decode_hex(x)
    if len(x) == 24:
        assert len(x) == 24 and sha3(x[:20])[:4] == x[-4:]
        x = x[:20]
    if len(x) != 20:
        raise Exception("Invalid address format: %r" % x)
    return x

def mk_contract_address(sender, nonce):
    return sha3(rlp.encode([normalize_address(sender), nonce]))[12:]

def decode_addr(v):
    '''decodes an address from serialization'''
    if len(v) not in [0, 20]:
        raise Exception("Serialized addresses must be empty or 20 bytes long!")
    return encode_hex(v)


if __name__ == '__main__':
    #nonce值要传入数字而不是字符串，新账户第一次部署合约的nonce为0
    #这意味着对于同一个账户地址，只要传入的nonce值相同，部署出来的合约地址一定相同（和合约代码无关）
    print('您部署的智能合约地址为','0x'+decode_addr(mk_contract_address("0xf642060ad79BB34232172DC3d195B0930C8321a0",2)))