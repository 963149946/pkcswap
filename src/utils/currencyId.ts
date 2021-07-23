import { Currency, ETHER, Token } from 'sun_zhen_tao_swap-sdk'

export function currencyId(currency: Currency): string {
  if (currency === ETHER) return 'HT'
  if (currency instanceof Token) return currency.address
  throw new Error('invalid currency')
}
