import { DaiPriceOracle, PriceSet } from '../../../generated/DaiPriceOracle/DaiPriceOracle'

import { PriceLog, Token } from '../../../generated/schema'
import { toDecimal } from '../../utils/numberic'

export function handlePriceSet(event: PriceSet): void {
  let oracle = DaiPriceOracle.bind(event.address)

  let token = Token.load(oracle.DAI().toHexString())

  if (token != null) {
    let priceLog = new PriceLog(token.id + '-' + event.params.newPriceInfo.lastUpdate.toString())
    priceLog.asset = token.id
    priceLog.value = toDecimal(event.params.newPriceInfo.price, token.decimals)
    priceLog.timestamp = event.block.timestamp

    priceLog.save()
  }
}
