import { Address, BigDecimal } from '@graphprotocol/graph-ts'

import { SoloMargin, LogAddMarket, LogIndexUpdate } from '../../generated/Margin/SoloMargin'
import { ERC20 } from '../../generated/Margin/ERC20'

import { Market, MarketState, Token, TokenPrice } from '../../generated/schema'
import { pow, toDecimal } from '../utils/numeric'

const DEFAULT_DECIMALS = 18
const NETWORK_EARNINGS_RATE = 0.95 // TODO: Get this value from the SoloMargin contract

export function handleAddMarket(event: LogAddMarket): void {
  let token = registerToken(event.params.token)

  let market = new Market(event.params.marketId.toString())
  market.token = token.id

  market.created = event.block.timestamp
  market.createdAtBlock = event.block.number
  market.createdAtTransaction = event.transaction.hash

  token.market = market.id
  token.save()

  market.save()
}

export function handleIndexUpdate(event: LogIndexUpdate): void {
  let market = Market.load(event.params.market.toString())

  if (market != null) {
    let token = Token.load(market.token)

    if (token != null) {
      let solo = SoloMargin.bind(event.address)

      // Update token price
      let currentTokenPrice = TokenPrice.load(token.price)

      let newPrice = toDecimal(solo.getMarketPrice(event.params.market).value, token.decimals)

      if (currentTokenPrice == null) {
        let newTokenPrice = new TokenPrice(token.id + '-' + event.block.timestamp.toString())
        newTokenPrice.token = token.id
        newTokenPrice.value = newPrice
        newTokenPrice.block = event.block.number
        newTokenPrice.timestamp = event.block.timestamp

        token.price = newTokenPrice.id

        newTokenPrice.save()
        token.save()
      }

      if (currentTokenPrice != null) {
        let currentPrice = currentTokenPrice.value

        if (currentPrice != newPrice) {
          let newTokenPrice = new TokenPrice(token.id + '-' + event.block.timestamp.toString())
          newTokenPrice.token = token.id
          newTokenPrice.value = newPrice
          newTokenPrice.block = event.block.number
          newTokenPrice.timestamp = event.block.timestamp

          token.price = newTokenPrice.id

          newTokenPrice.save()
          token.save()
        }
      }

      // Save new market state
      let newMarketState = new MarketState(market.id + '-' + event.block.timestamp.toString())
      newMarketState.market = market.id
      newMarketState.timestamp = event.block.timestamp

      // Update total par for this market
      let totalPar = solo.getMarketTotalPar(event.params.market)

      // Update interest rates. See: https://help.dydx.exchange/en/articles/2924246-how-do-interest-rates-work
      newMarketState.utilization = totalPar.supply.isZero()
        ? totalPar.supply.toBigDecimal()
        : totalPar.borrow.div(totalPar.supply).toBigDecimal()

      // If the utilization is X, then the borrow interest is calculated as: (0.04 * X) + (0.11 * X^32) + (0.35 * X^64)
      newMarketState.borrowerInterestRate = BigDecimal.fromString('0.04')
        .times(newMarketState.utilization)
        .plus(BigDecimal.fromString('0.11').times(pow(newMarketState.utilization, 32)))
        .plus(BigDecimal.fromString('0.35').times(pow(newMarketState.utilization, 64)))

      // if the borrow interest rate is B, then the lender interest is calculated as: 95% * (B * X)
      newMarketState.lenderInterestRate = newMarketState.borrowerInterestRate
        .times(newMarketState.utilization)
        .times(BigDecimal.fromString(NETWORK_EARNINGS_RATE.toString()))

      // TODO: Trading interest rate
      newMarketState.traderInterestRate = BigDecimal.fromString('0')

      newMarketState.save()

      market.state = newMarketState.id
      market.lastIndexUpdate = event.params.index.lastUpdate

      market.save()
    }
  }
}

function registerToken(tokenAddress: Address): Token {
  let erc20Token = ERC20.bind(tokenAddress)

  let tokenDecimals = erc20Token.try_decimals()
  let tokenName = erc20Token.try_name()
  let tokenSymbol = erc20Token.try_symbol()

  let token = new Token(tokenAddress.toHexString())
  token.address = tokenAddress
  token.decimals = !tokenDecimals.reverted ? tokenDecimals.value : DEFAULT_DECIMALS
  token.name = !tokenName.reverted ? tokenName.value : null
  token.symbol = !tokenSymbol.reverted ? tokenSymbol.value : null

  // Handle Single-Collateral Dai manually since isn't a detailed token
  if (token.address.toHexString() == '0x89d24a6b4ccb1b6faa2625fe562bdd9a23260359') {
    token.decimals = 18
    token.name = 'Sai Stablecoin v1.0'
    token.symbol = 'SAI'
  }

  return token
}
