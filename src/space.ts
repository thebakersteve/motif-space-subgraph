
import { Space } from '../types/schema'
import {
  Approval,
  ApprovalForAll,
  Space as SpaceContract, 
  TokenMetadataURIUpdated,
  TokenURIUpdated,
  Transfer,
} from '../types/Space/Space'
import { log } from '@graphprotocol/graph-ts'
import {
  createSpace,
  createTransfer,
  createURIUpdate,
  fetchSpaceBidShares,
  findOrCreateUser,
  zeroAddress,
  findLand
} from './helpers'

const CONTENT = 'Content'
const METADATA = 'Metadata'

/**
 * Handler called when the `TokenURIUpdated` Event is called on the Motif Contract
 * @param event
 */
export function handleTokenURIUpdated(event: TokenURIUpdated): void {
  let tokenId = event.params._tokenId.toString()

  log.info(`Starting handler for TokenURIUpdated Event for tokenId: {}`, [tokenId])

  let space = Space.load(tokenId)
  if (space == null) {
    log.error('Space is null for tokenId: {}', [tokenId])
  }

  let updater = findOrCreateUser(event.params.owner.toHexString())
  let uriUpdateId = tokenId
    .concat('-')
    .concat(event.transaction.hash.toHexString())
    .concat('-')
    .concat(event.transactionLogIndex.toString())

  createURIUpdate(
    uriUpdateId,
    event.transaction.hash.toHexString(),
    space as Space,
    CONTENT,
    space.contentURI,
    event.params._uri,
    updater.id,
    space.owner,
    event.block.timestamp,
    event.block.number
  )

  space.contentURI = event.params._uri
  space.save()

  log.info(`Completed handler for TokenURIUpdated Event for tokenId: {}`, [tokenId])
}

/**
 * Handler called when the `TokenMetadataURIUpdated` Event is called on the Motif Contract
 * @param event
 */
export function handleTokenMetadataURIUpdated(event: TokenMetadataURIUpdated): void {
  let tokenId = event.params._tokenId.toString()

  log.info(`Starting handler for TokenMetadataURIUpdated Event for tokenId: {}`, [
    tokenId,
  ])

  let space = Space.load(tokenId)
  if (space == null) {
    log.error('Space is null for tokenId: {}', [tokenId])
  }

  let updater = findOrCreateUser(event.params.owner.toHexString())
  let uriUpdateId = tokenId
    .concat('-')
    .concat(event.transaction.hash.toHexString())
    .concat('-')
    .concat(event.transactionLogIndex.toString())

  createURIUpdate(
    uriUpdateId,
    event.transaction.hash.toHexString(),
    space as Space,
    METADATA,
    space.metadataURI,
    event.params._uri,
    updater.id,
    space.owner,
    event.block.timestamp,
    event.block.number
  )

  space.metadataURI = event.params._uri
  space.save()

  log.info(`Completed handler for TokenMetadataURIUpdated Event for tokenId: {}`, [
    tokenId,
  ])
}

/**
 * Handler called when the `Transfer` Event is called on the Motif Contract
 * @param event
 */
export function handleTransfer(event: Transfer): void {
  let fromAddr = event.params.from.toHexString()
  let toAddr = event.params.to.toHexString()
  let tokenId = event.params.tokenId.toString()

  log.info(`Starting handler for Transfer Event of tokenId: {}, from: {}. to: {}`, [
    tokenId,
    fromAddr,
    toAddr,
  ])

  let toUser = findOrCreateUser(toAddr)
  let fromUser = findOrCreateUser(fromAddr)

  if (fromUser.id == zeroAddress) {
    handleMint(event)
    return
  }

  let space = Space.load(tokenId)
  if (space == null) {
    log.error(`Space is null for token id: {}`, [tokenId])
  }

  if (toUser.id == zeroAddress) {
    space.prevOwner = zeroAddress
    space.burnedAtTimeStamp = event.block.timestamp
    space.burnedAtBlockNumber = event.block.number
  }

  space.owner = toUser.id
  space.approved = null
  space.save()

  let transferId = tokenId
    .concat('-')
    .concat(event.transaction.hash.toHexString())
    .concat('-')
    .concat(event.transactionLogIndex.toString())

  createTransfer(
    transferId,
    event.transaction.hash.toHexString(),
    space as Space,
    fromUser,
    toUser,
    event.block.timestamp,
    event.block.number
  )

  log.info(`Completed handler for Transfer Event of tokenId: {}, from: {}. to: {}`, [
    tokenId,
    fromAddr,
    toAddr,
  ])
}

/**
 * Handler called when the `Approval` Event is called on the Motif Contract
 * @param event
 */
export function handleApproval(event: Approval): void {
  let ownerAddr = event.params.owner.toHexString()
  let approvedAddr = event.params.approved.toHexString()
  let tokenId = event.params.tokenId.toString()

  log.info(
    `Starting handler for Approval Event of tokenId: {}, owner: {}, approved: {}`,
    [tokenId, ownerAddr, approvedAddr]
  )

  let space = Space.load(tokenId)
  if (space == null) {
    log.error('Space is null for tokenId: {}', [tokenId])
  }

  if (approvedAddr == zeroAddress) {
    space.approved = null
  } else {
    let approvedUser = findOrCreateUser(approvedAddr)
    space.approved = approvedUser.id
  }

  space.save()

  log.info(
    `Completed handler for Approval Event of tokenId: {}, owner: {}, approved: {}`,
    [tokenId, ownerAddr, approvedAddr]
  )
}

/**
 * Handler called when the `ApprovalForAll` Event is called on the Motif Contract
 * @param event
 */
export function handleApprovalForAll(event: ApprovalForAll): void {
  let ownerAddr = event.params.owner.toHexString()
  let operatorAddr = event.params.operator.toHexString()
  let approved = event.params.approved

  log.info(
    `Starting handler for ApprovalForAll Event for owner: {}, operator: {}, approved: {}`,
    [ownerAddr, operatorAddr, approved.toString()]
  )

  let owner = findOrCreateUser(ownerAddr)
  let operator = findOrCreateUser(operatorAddr)

  if (approved == true) {
    owner.authorizedUsers = owner.authorizedUsers.concat([operator.id])
  } else {
    // if authorizedUsers array is null, no-op
    if (!owner.authorizedUsers) {
      log.info(
        'Owner does not currently have any authorized users. No db changes neccessary. Returning early.',
        []
      )
      log.info(
        `Completed handler for ApprovalForAll Event for owner: {}, operator: {}, approved: {}`,
        [ownerAddr, operatorAddr, approved.toString()]
      )
      return
    }

    let index = owner.authorizedUsers.indexOf(operator.id)
    let copyAuthorizedUsers = owner.authorizedUsers
    copyAuthorizedUsers.splice(index, 1)
    owner.authorizedUsers = copyAuthorizedUsers
  }

  owner.save()

  log.info(
    `Completed handler for ApprovalForAll Event for owner: {}, operator: {}, approved: {}`,
    [ownerAddr, operatorAddr, approved.toString()]
  )
}

/**
 * Handler called when the `Mint` Event is called on the Motif Contract
 * @param event
 */
function handleMint(event: Transfer): void {
  let creator = findOrCreateUser(event.params.to.toHexString())
  let zeroUser = findOrCreateUser(zeroAddress)
  let tokenId = event.params.tokenId

  let spaceContract = SpaceContract.bind(event.address)
  let contentURI = spaceContract.tokenURI(tokenId)
  let metadataURI = spaceContract.tokenMetadataURI(tokenId)

  let contentHash = spaceContract.tokenContentHashes(tokenId)
  let metadataHash = spaceContract.tokenMetadataHashes(tokenId)
 
  let lands = spaceContract.tokenLandDetails(tokenId)
  let pin = spaceContract.tokenPinRecord(tokenId)
 
  let bidShares = fetchSpaceBidShares(tokenId, event.address)

  let space = createSpace(
    tokenId.toString(),
    event.transaction.hash.toHexString(),
    creator,
    creator,
    creator,
    contentURI,
    contentHash,
    metadataURI,
    metadataHash,
    bidShares.creator,
    bidShares.owner,
    bidShares.prevOwner,
    event.block.timestamp,
    event.block.number, 
    lands,
    pin
  )

  let transferId = tokenId
    .toString()
    .concat('-')
    .concat(event.transaction.hash.toHexString())
    .concat('-')
    .concat(event.transactionLogIndex.toString())

  createTransfer(
    transferId,
    event.transaction.hash.toHexString(),
    space,
    zeroUser,
    creator,
    event.block.timestamp,
    event.block.number
  )
}
