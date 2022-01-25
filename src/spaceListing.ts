import {
    createReserveList,
    createReserveListBid,
    findOrCreateCurrency,
    findOrCreateUser,
    handleBidReplaced,
    handleFinishedList,
    handleReserveListExtended,
    setReserveListFirstBidTime,
} from './helpers'
import {
    ListApprovalUpdated,
    ListDropApprovalUpdated,
    ListBid,
    ListCanceled,
    ListCreated,
    ListDurationExtended,
    ListEnded,
    ListListPriceUpdated
} from '../types/SpaceListing/SpaceListing'
import { Space, ReserveList } from '../types/schema'
import { log } from '@graphprotocol/graph-ts'

export function handleReserveListCreated(event: ListCreated): void {

    log.info(`Starting handler for ListCreated for list {}`, [event.params.listId.toString()])

    let tokenId = event.params.tokenId.toString()
    let tokenOwner = findOrCreateUser(event.params.tokenOwner.toHexString())
    let intermediary = findOrCreateUser(event.params.intermediary.toHexString())
    let space = Space.load(tokenId)

    createReserveList(
        event.params.listId.toString(),
        event.transaction.hash.toHexString(),
        event.params.tokenId,
        event.params.tokenContract.toHexString(),
        space,
        event.params.startsAt,
        event.params.duration,
        event.params.listPrice,
        event.params.listType,
        event.params.intermediaryFeePercentage,
        findOrCreateCurrency(event.params.listCurrency.toHexString()),
        event.block.timestamp,
        event.block.number,
        tokenOwner,
        intermediary
    )

    log.info(`Completed handler for ListCreated for list {}`, [event.params.listId.toString()])
}

export function handleReserveListApprovalUpdate(event: ListApprovalUpdated): void {
    let id = event.params.listId.toString()
    log.info(`Starting handler for ListApprovalUpdate on list {}`, [id])

    let list = ReserveList.load(id)

    list.approved = event.params.approved
    list.status = 'Active'
    list.approvedTimestamp = event.block.timestamp;
    list.approvedBlockNumber = event.block.number;
    list.save()

    log.info(`Completed handler for ListApprovalUpdate on list {}`, [id])
}


export function handleReserveListDropApprovalUpdate(event: ListDropApprovalUpdated): void {
    let id = event.params.listId.toString()
    log.info(`Starting handler for ListDropApprovalUpdate on list {}`, [id])

    let list = ReserveList.load(id)

    list.approved = event.params.approved
    list.status = 'Active'
    list.approvedTimestamp = event.block.timestamp;
    list.approvedBlockNumber = event.block.number;
    list.startsAt = event.params.startsAt;

    list.save()

    log.info(`Completed handler for ListApprovalUpdate on list {}`, [id])
}

export function handleReserveListListPriceUpdate(event: ListListPriceUpdated): void {
    let id = event.params.listId.toString()
    log.info(`Starting handler for ListApprovalUpdate on list {}`, [id])

    let list = ReserveList.load(id)

    list.listPrice = event.params.listPrice
    list.save()

    log.info(`Completed handler for ListApprovalUpdate on list {}`, [id])
}

export function handleReserveListBid(event: ListBid): void {
    let listId = event.params.listId.toString()
    log.info(`Starting handler for ListBid on list {}`, [listId])

    let list = ReserveList.load(listId)

    if (list === null) {
        log.error('Missing Reserve List with id {} for bid', [listId])
        return
    }

    if (event.params.firstBid) {
        log.info('setting list first bid time', [])
        setReserveListFirstBidTime(list as ReserveList, event.block.timestamp)
    } else {
        log.info('replacing bid', [])
        handleBidReplaced(list as ReserveList, event.block.timestamp, event.block.number)
    }

    let id = listId.concat('-').concat(event.transaction.hash.toHexString()).concat('-').concat(event.logIndex.toString())

    createReserveListBid(
        id,
        event.transaction.hash.toHexString(),
        list as ReserveList,
        event.params.value,
        event.block.timestamp,
        event.block.number,
        findOrCreateUser(event.params.sender.toHexString())
    )

    log.info(`Completed handler for ListBid on list {}`, [listId])
}

export function handleReserveListDurationExtended(event: ListDurationExtended): void {
    let listId = event.params.listId.toString()
    log.info(`Starting handler for ListDurationExtended on list {}`, [listId])

    let list = ReserveList.load(listId)

    if (list === null) {
        log.error('Missing Reserve List with id {} for bid', [listId])
        return
    }

    handleReserveListExtended(list as ReserveList, event.params.duration);

    log.info(`Completed handler for ListDurationExtended on list {}`, [listId])
}

export function handleReserveListEnded(event: ListEnded): void {
    let listId = event.params.listId.toString()
    log.info(`Starting handler for ListEnd on list {}`, [listId])

    let list = ReserveList.load(listId)

    if (!list) {
        log.error('Missing Reserve List with id {} for bid', [listId])
        return
    }

    // First, remove the current bid and set it to the winning bid
    handleBidReplaced(list as ReserveList, event.block.timestamp, event.block.number, true)

    // Then, finalize the list
    handleFinishedList(list as ReserveList, event.block.timestamp, event.block.number)

    log.info(`Completed handler for ListEnd on list {}`, [listId])
}

export function handleReserveListCanceled(event: ListCanceled): void {
    let listId = event.params.listId.toString()
    log.info(`Starting handler for ListCanceled on list {}`, [listId])

    let list = ReserveList.load(listId)

    if (!list) {
        log.error('Missing Reserve List with id {} for bid', [listId])
    }

    // First, remove any current bid and set it to refunded
    if (list.currentBid) {
        handleBidReplaced(list as ReserveList, event.block.timestamp, event.block.number)
    }

    // Then, create an inactive list based of of the current active list
    // Then, finalize the list
    handleFinishedList(list as ReserveList, event.block.timestamp, event.block.number)

    log.info(`Completed handler for ListCanceled on list {}`, [listId])
}