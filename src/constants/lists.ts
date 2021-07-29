// the Uniswap Default token list lives here

// export const DEFAULT_TOKEN_LIST_URL = 'https://raw.githubusercontent.com/compound-finance/token-list/master/compound.tokenlist.json'
//export const DEFAULT_TOKEN_LIST_URL = 'http://119.29.91.158:8888/comp'
export const DEFAULT_TOKEN_LIST_URL = 'http://raw.githubusercontent.com/963149946/tokenlist/main/pkcswap_tokenlist.json'

export const DEFAULT_LIST_OF_LISTS: string[] = [
  DEFAULT_TOKEN_LIST_URL,
  //宝塔面板默认使用8888端口，apache默认使用80端口
  //宝塔面板的左侧导航栏安全页面可以设置放行端口范围3000-5000
  //这里不知道为啥腾讯云的安全组页面放行端口没有效果，要借助宝塔才行
  'http://119.29.91.158:3333/tokenlist'

]
