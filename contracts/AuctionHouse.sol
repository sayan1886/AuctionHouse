pragma solidity ^0.4.16;

// This is the main contract that governs execution of auctions
// of non-fungible on-chain assets. Any user can initiate an auction
// for an item that conforms to the Asset interface described in
// Asset.sol

import "./Asset.sol";

contract AuctionHouse {

    struct Bid {
        address bidder;
        uint256 amount;
        uint timestamp;
    }

    enum AuctionStatus {Pending, Active, Inactive}

    struct Auction {
        // Location and ownership information of the item for sale
        address seller;
        address contractAddress; // Contract where the item exists
        string recordId;         // RecordID within the contract as per the Asset interface

        // Auction metadata
        string title;
        string description;      // Optionally markdown formatted?
        uint startTimeStamp;
        uint expirationTimeStamp;
        AuctionStatus status;

        // Distribution bonus
        // uint distributionCut;    // In percent, ie 10 is a 10% cut to the distribution address
        // address distributionAddress; 

        // Pricing
        uint256 startingPrice;   // In wei
        uint256 reservePrice;
        uint256 currentBid;

        Bid[] bids;
    }

    Auction[] public auctions;          // All auctions
    mapping(address => uint[]) public auctionsRunByUser; // Pointer to auctions index for auctions run by this user

    mapping(address => uint[]) public auctionsBidOnByUser; // Pointer to auctions index for auctions this user has bid on

    mapping(string => bool) activeContractRecordConcat;

    mapping(address => uint) refunds;

    address owner;

    // Events
    event AuctionCreated(uint id, string title, uint256 startingPrice, uint256 reservePrice);
    event AuctionActivated(uint id);
    event AuctionCancelled(uint id);
    event BidPlaced(uint auctionId, address bidder, uint256 amount);
    event AuctionEndedWithWinner(uint auctionId, address winningBidder, uint256 amount);
    event AuctionEndedWithoutWinner(uint auctionId, uint256 topBid, uint256 reservePrice);

    event LogFailure(string message);

    modifier onlyOwner {
        require (owner == msg.sender);
        _;
    }

    modifier onlySeller(uint auctionId) {
        require (auctions[auctionId].seller == msg.sender);
        _;
    }

    modifier onlyLive(uint auctionId) {
        Auction memory a = auctions[auctionId];
        require (a.status == AuctionStatus.Active);

        // Auction should not be over
        require (a.expirationTimeStamp < now);
        _;
    }

    constructor () public {
        owner = msg.sender;
    }

    // Create an auction, transfer the item to this contract, activate the auction
    function createAuction(
                           string _title,
                           string _description,
                           address _contractAddressOfAsset,
                           string _recordIdOfAsset,
                           uint _deadline,   // in mins
                           uint256 _startingPrice,
                           uint256 _reservePrice
                        //    uint _distributionCut,
                        //    address _distributionCutAddress
                           ) public payable returns (uint auctionId) {

        // Check to see if the seller owns the asset at the contract
        if (!partyOwnsAsset(msg.sender, _contractAddressOfAsset, _recordIdOfAsset)) {
            emit LogFailure("Seller does not own this asset");
            revert();
        }

        // Price validations
        if (_startingPrice < 0 || _reservePrice < 0) {
            emit LogFailure("StartingPrice or ReservePrice was below zero");
            revert();
        }

        auctionId = auctions.length++;
        Auction storage a = auctions[auctionId];
        a.seller = msg.sender;
        a.contractAddress = _contractAddressOfAsset;
        a.recordId = _recordIdOfAsset;
        a.title = _title;
        a.description = _description;
        a.startTimeStamp = now;
        a.expirationTimeStamp = a.startTimeStamp + (_deadline * 60);
        a.status = AuctionStatus.Pending;

        a.startingPrice = _startingPrice;
        a.reservePrice = _reservePrice;
        a.currentBid = _startingPrice;

        auctionsRunByUser[a.seller].push(auctionId);
        activeContractRecordConcat[strConcat(addrToString(_contractAddressOfAsset), _recordIdOfAsset)] = true;

        emit AuctionCreated(auctionId, a.title, a.startingPrice, a.reservePrice);

        return auctionId;
    }

    function partyOwnsAsset(address _party, address _contract, string _recordId) internal view returns (bool success) {
        Asset assetContract = Asset(_contract);
        return assetContract.owner(_recordId) == _party;
    }

    // function getDeadline(string _recordId) {
        
    // }

    /**
     * The auction fields are indexed in the return val as follows
     * [0]  -> Auction.seller
     * [1]  -> Auction.contractAddress
     * [2]  -> Auction.recordId
     * [3]  -> Auction.title
     * [4]  -> Auction.description
     * [5]  -> Auction.expirationTimeStamp
     * [8]  -> Auction.startingPrice
     * [9] -> Auction.reservePrice
     * [10] -> Auction.currentBid
     * [11] -> Auction.bids.length      
     * []  -> Auction.status (Not included right now)
     */
    function getAuction(uint idx) public view returns (address, address, string, string, string, uint, uint, uint256, uint256, uint) {
        Auction memory a = auctions[idx];
        require (a.seller != 0);

        return (a.seller,
                a.contractAddress,
                a.recordId,
                a.title,
                a.description,
                a.expirationTimeStamp,
                a.startingPrice,
                a.reservePrice,
                a.currentBid,
                a.bids.length
                );
    }

    function getAuctionCount() public view returns (uint) {
        return auctions.length;
    }

    function getStatus(uint idx) public view returns (uint) {
        Auction memory a = auctions[idx];
        return uint(a.status);
    }

    function getAuctionsCountForUser(address addr) public view returns (uint) {
        return auctionsRunByUser[addr].length;
    }

    function getAuctionIdForUserAndIdx(address addr, uint idx) public view returns (uint) {
        return auctionsRunByUser[addr][idx];
    }

    function getActiveContractRecordConcat(string _contractRecordConcat) public view returns (bool) {
        return activeContractRecordConcat[_contractRecordConcat];
    }

    // Checks if this contract address is the owner of the item for the auction
    function activateAuction(uint auctionId) onlySeller(auctionId) public payable returns (bool){
        Auction storage a = auctions[auctionId];

        require (partyOwnsAsset(this, a.contractAddress, a.recordId));

        a.status = AuctionStatus.Active;
        emit AuctionActivated(auctionId);
        return true;
    }

    function cancelAuction(uint auctionId) onlySeller(auctionId) public payable returns (bool) {
        Auction storage a = auctions[auctionId];

        require (partyOwnsAsset(this, a.contractAddress, a.recordId));
        require (a.currentBid < a.reservePrice);   // Can't cancel the auction if someone has already outbid the reserve.

        Asset asset = Asset(a.contractAddress);
        require(asset.setOwner(a.recordId, a.seller));

        // Refund to the bidder
        uint bidsLength = a.bids.length;
        if (bidsLength > 0) {
            Bid memory topBid = a.bids[bidsLength - 1];
            refunds[topBid.bidder] += topBid.amount;

            activeContractRecordConcat[strConcat(addrToString(a.contractAddress), a.recordId)] = false;
        }

        emit AuctionCancelled(auctionId);
        a.status = AuctionStatus.Inactive;
        return true;
    }

    /* BIDS */
    function getBidCountForAuction(uint auctionId) public payable returns (uint) {
        Auction storage a = auctions[auctionId];
        return a.bids.length;
    }

    function getBidForAuctionByIdx(uint auctionId, uint idx) public view returns (address bidder, uint256 amount, uint timestamp) {
        Auction storage a = auctions[auctionId];
        require(idx <= a.bids.length - 1);

        Bid storage b = a.bids[idx];
        return (b.bidder, b.amount, b.timestamp);
    }

    function placeBid(uint auctionId) payable onlyLive(auctionId) public returns (bool success) {
        uint256 amount = msg.value;
        Auction storage a = auctions[auctionId];

        require (a.currentBid < amount);

        uint bidIdx = a.bids.length++;
        Bid storage b = a.bids[bidIdx];
        b.bidder = msg.sender;
        b.amount = amount;
        b.timestamp = now;
        a.currentBid = amount;

        auctionsBidOnByUser[b.bidder].push(auctionId);

        // Log refunds for the previous bidder
        if (bidIdx > 0) {
            Bid memory previousBid = a.bids[bidIdx - 1];
            refunds[previousBid.bidder] += previousBid.amount;
        }

        emit BidPlaced(auctionId, b.bidder, b.amount);
        return true;
    }

    function getRefundValue() public view returns (uint) {
        return refunds[msg.sender];
    }

    function withdrawRefund() public payable {
        uint refund = refunds[msg.sender];
        refunds[msg.sender] = 0;
        if (!msg.sender.send(refund))
            refunds[msg.sender] = refund;
    }

    function endAuction(uint auctionId) public payable returns (bool success) {
        // Check if the auction is passed the end date
        Auction storage a = auctions[auctionId];
        activeContractRecordConcat[strConcat(addrToString(a.contractAddress), a.recordId)] = false;

        // Make sure auction hasn't already been ended
        if (a.status != AuctionStatus.Active) {
            emit LogFailure("Can not end an auction that's already ended");
            revert();
        }
        
        if (a.expirationTimeStamp < now) {
            emit LogFailure("Can not end an auction that hasn't hit the deadline yet");
            revert(); 
        }

        Asset asset = Asset(a.contractAddress);

        // No bids, make the auction inactive
        if (a.bids.length == 0) {
            require(asset.setOwner(a.recordId, a.seller));
            a.status = AuctionStatus.Inactive;
            return true;
        }

        Bid storage topBid = a.bids[a.bids.length - 1];

        // If the auction hit its reserve price
        if (a.currentBid >= a.reservePrice) {
            require(asset.setOwner(a.recordId, topBid.bidder)); // Set the items new owner

            // refunds[a.distributionAddress] += distributionShare;
            refunds[a.seller] += a.currentBid;

            emit AuctionEndedWithWinner(auctionId, topBid.bidder, a.currentBid);
        } else {
            // Return the item to the owner and the money to the top bidder
            require(asset.setOwner(a.recordId, a.seller));

            refunds[topBid.bidder] += a.currentBid;

            emit AuctionEndedWithoutWinner(auctionId, a.currentBid, a.reservePrice);
        }

        a.status = AuctionStatus.Inactive;
        return true;
    }

    function strConcat(string _a, string _b) internal pure returns (string) {
        bytes memory _ba = bytes(_a);
        bytes memory _bb = bytes(_b);
        bytes memory ab = new bytes (_ba.length + _bb.length);
        uint k = 0;
        for (uint i = 0; i < _ba.length; i++) ab[k++] = _ba[i];
        for (i = 0; i < _bb.length; i++) ab[k++] = _bb[i];
        return string(ab);
    }

    function addrToString(address x) internal pure returns (string) {
        bytes memory b = new bytes(20);
        for (uint i = 0; i < 20; i++)
            b[i] = byte(uint8(uint(x) / (2**(8*(19 - i)))));
        return string(b);
    }
}
