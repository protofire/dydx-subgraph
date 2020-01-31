import { DaiPriceOracle, PriceSet } from '../../generated/DaiPriceOracle/DaiPriceOracle'

import { Token, TokenPrice } from '../../generated/schema'

import { toDecimal } from '../utils/decimal'

export function handlePriceSet(event: PriceSet): void {
  let oracle = DaiPriceOracle.bind(event.address)

  let token = Token.load(oracle.DAI().toHexString())

  if (token != null) {
    let price = new TokenPrice(token.id + '-' + event.params.newPriceInfo.lastUpdate.toString())
    price.token = token.id
    price.value = toDecimal(event.params.newPriceInfo.price, token.decimals)
    price.block = event.block.number
    price.timestamp = event.block.timestamp

    token.price = price.id

    price.save()
    token.save()
  }
}
