var AuctionHouse = artifacts.require('../contracts/AuctionHouse.sol');

var log = console.log;
var balance = web3.eth.getBalance;

contract("AuctionHouse", function(err, accounts) {
    it("should end an auction that met reserve correctly", function(err) {
        var sn = SampleName.deployed();
        var owner = accounts[5];
        var recordId = "testValidAuction.name";
        var bidder = accounts[6];
        var bidAmount = web3.toWei(2, "ether");
        var reserveAmount = web3.toWei(0.3, "ether");
        var auctionId;
        var sellerBalanceAfterBid, contractBalanceAfterBid, bidderBalanceAfterBid;
        var sellerBalanceAfterClose, contractBalanceAfterClose, bidderBalanceAfterClose;

        sn.addRecord(recordId, owner, recordId, owner, { from: owner }, function(err, txId) {
            return AuctionHouse.new(function(err, ah) {
                log("ABOUT TO CREATE AUCTION " + web3.eth.blockNumber);
                ah.createAuction("Title",
                    "Description",
                    sn.address,
                    recordId,
                    web3.eth.blockNumber.timestamp,
                    10,
                    reserveAmount,
                    function(err, txId) {
                        log("AUCTION CREATED " + web3.eth.blockNumber);
                        return ah.getAuctionsCountForUser(owner, function(err, auctionsCount) {
                            return ah.getAuctionIdForUserAndIdx(owner, auctionsCount - 1, function(err, aucId) {
                                auctionId = aucId;
                                return sn.setOwner(recordId, ah.address, function(err) {
                                    return ah.activateAuction(auctionId, function(err, res) {
                                        log("AUCTION ACTIVATED " + web3.eth.blockNumber);
                                        return ah.placeBid(auctionId, { from: bidder, value: bidAmount }, function(err) {
                                            // Skip 100 blocks
                                            var i = 0;
                                            for (i = 0; i < 100; i++) {
                                                ah.getStatus(auctionId);
                                            }
                                            return ah.getStatus(auctionId, function(err) {
                                                log("CHECKING BALANCES " + web3.eth.blockNumber);
                                                sellerBalanceAfterBid = balance(owner).toNumber();
                                                contractBalanceAfterBid = balance(ah.address).toNumber();
                                                bidderBalanceAfterBid = balance(bidder).toNumber();
                                                return ah.endAuction(auctionId, function(err) {
                                                    log("AUCTION OVER " + web3.eth.blockNumber);
                                                    sellerBalanceAfterClose = balance(owner).toNumber();
                                                    bidderBalanceAfterClose = balance(bidder).toNumber();

                                                    assert.equal(sellerBalanceAfterClose, sellerBalanceAfterBid, "Seller balance should be the same before withdraw");
                                                    assert.equal(bidderBalanceAfterBid, bidderBalanceAfterClose, "Bidder balance should stay the same");

                                                    return ah.withdrawRefund(function(err) {
                                                        contractBalanceAfterWithdraw = balance(ah.address).toNumber();
                                                        assert.isBelow(contractBalanceAfterWithdraw, contractBalanceAfterBid, "Contract balance should have gone down");

                                                        log("PASSED ALL ASSERTIONS");
                                                        return sn.owner(recordId, function(err, itemOwner) {
                                                            log("MAKING SURE THAT THE ITEM IS OWNED CORRECTLY.");
                                                            assert.equal(itemOwner, bidder, "Bidder should be the new owner");
                                                            return ah.getStatus(auctionId, function(err, status) {
                                                                assert.equal(status.toNumber(), 2, "auction should be inactive");
                                                            });
                                                        });
                                                    });
                                                });
                                            });
                                        });
                                    });
                                });
                            });
                        });
                    });
            });
        });
    });
});