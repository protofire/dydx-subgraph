import { Address } from '@graphprotocol/graph-ts'

import { LogAddMarket } from '../../generated/Margin/SoloMargin'
import { ERC20 } from '../../generated/Margin/ERC20'

import { Market, Token } from '../../generated/schema'

const DEFAULT_TOKEN_DECIMALS = 18

export function handleLogAddMarket(event: LogAddMarket): void {
  let token = registerToken(event.params.token)

  let market = new Market(event.params.marketId.toString())
  market.token = token.id

  market.created = event.block.timestamp
  market.createdAtBlock = event.block.number
  market.createdAtTransaction = event.transaction.hash

  token.market = market.id

  market.save()
  token.save()
}

function registerToken(tokenAddress: Address): Token {
  let erc20Token = ERC20.bind(tokenAddress)

  let tokenDecimals = erc20Token.try_decimals()
  let tokenName = erc20Token.try_name()
  let tokenSymbol = erc20Token.try_symbol()

  let token = new Token(tokenAddress.toHexString())
  token.address = tokenAddress
  token.decimals = !tokenDecimals.reverted ? tokenDecimals.value : DEFAULT_TOKEN_DECIMALS
  token.name = !tokenName.reverted ? tokenName.value : null
  token.symbol = !tokenSymbol.reverted ? tokenSymbol.value : null

  return token
}
