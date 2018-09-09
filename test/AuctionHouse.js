var AuctionHouse = artifacts.require('./contracts/AuctionHouse.sol');
var SampleName = artifacts.require('../contracts/SampleName.sol');

var log = console.log;
var balance = web3.eth.getBalance;

function createRecord(sn, owner, recordId, fromAddr, callback) {
    sn.addRecord(recordId, owner, recordId, owner, { from: fromAddr }, function(err, res) {
        callback();
    });
}

function createAuction(recordId,
    title,
    desc,
    contractAddrOfAsset,
    deadline,
    startingPrice,
    reservePrice,
    fromAddr,
    callback) {
    return AuctionHouse.new(function(err, ah) {
        return ah.createAuction(title,
            desc,
            contractAddrOfAsset,
            recordId,
            deadline,
            startingPrice,
            reservePrice, { from: fromAddr },
            function(err, txId) {
                callback(ah);
            });
    });
    // });
}

contract("AuctionHouse", function(accounts) {
    it("should check and see if the asset is already on auction", function() {
        var sn = SampleName.new();
        var owner = accounts[1];
        var recordId = "test9.name";
        var title = "title";
        var desc = "desc";
        var contractAddrOfAsset = sn.address;
        var expiration = 60;
        var startingPrice = web3.toWei(0.2, "ether");
        var reservePrice = web3.toWei(0.3, "ether");

        createRecord(sn, owner, recordId, owner, function() {
            //Create an auction
            createAuction(recordId,
                title,
                desc,
                contractAddrOfAsset,
                deadline,
                startingPrice,
                reservePrice,
                owner,
                function(ah) {
                    return ah.getAuctionCount({ from: account }, function(err, auctionCount) {
                        assert.strictEqual(auctionCount.toNumber(), 1, "there should be 1 auction created");

                        //Create another auction with the same record
                        createAuction(recordId, title, desc, contractAddrOfAsset, deadline, startingPrice, reservePrice, owner, function(ah) {
                            return ah.getAuctionCount({ from: account }, function(err, auctionCount) {
                                assert.strictEqual(auctionCount.toNumber(), 1, "there should still be 1 auction created (cannot auction the same asset twice)");
                            });
                        });
                    });

                });
        });
    });

    it("should know if a seller owns an asset on an external contract", function() {
        var sn = SampleName.deployed();
        var owner = accounts[0];
        var recordId = "test.name";

        // Create a samplename record
        sn.addRecord(recordId, owner, recordId, owner, { from: owner }, function(err, res) {
            return AuctionHouse.new(function(err, ah) {
                return ah.partyOwnsAsset(owner, sn.address, recordId, { from: account }, function(err, res) {
                    assert.strictEqual(res, true, "the owner doesn't own this asset");
                }, function(err, res) {
                    return ah.partyOwnsAsset(accounts[1], sn.address, recordId, { from: account }, function(err, res) {
                        assert.strictEqual(res, false, "the owner owns this asset, but shouldn't.");
                    });
                });
            });
        });
    });


    it("should let us construct a valid auction", function() {
        var sn = SampleName.deployed();
        var owner = accounts[0];
        var recordId = "test2.name";
        var targetAuctionId = 0;
        var startingBid = web3.toWei(0.2, "ether");
        var reservePrice = web3.toWei(0.3, "ether");

        // Start by creating a sample record
        sn.addRecord(_address, owner, recordId, owner, { from: owner }, function(err, txId) {
            return AuctionHouse.new(function(err, ah) {
                // Now create an auction
                return ah.createAuction("Title",
                    "Description",
                    sn.address,
                    recordId,
                    web3.eth.blockNumber + 100,
                    startingBid,
                    reservePrice,
                    5,
                    accounts[2], { from: owner },
                    function(err, txId) {

                        return ah.getAuction(targetAuctionId, { from: account }, function(err, auction) {
                            assert.strictEqual(auction[0], owner, "Didn't get the correct seller");
                            assert.strictEqual(auction[3], "Title", "Didn't set an auction name");
                            assert.equal(auction[8], startingBid, "Didn't set a starting bid price")
                            assert.equal(auction[10], startingBid, "Didn't set a current bid price");
                            return ah.getAuctionsCountForUser(owner, { from: account });
                        }, function(err, auctionsCount) {
                            assert.strictEqual(auctionsCount.toNumber(), 1, "Should only have 1 auction");
                            return ah.getAuctionIdForUserAndIdx(owner, auctionsCount.toNumber() - 1, { from: account });
                        }, function(err, auctionId) {
                            assert.strictEqual(auctionId.toNumber(), targetAuctionId, "AuctionId should be zero");
                        });

                    });
            });
        });
    });

    it("should activate and cancel an auction", function() {
        var sn = SampleName.deployed();
        var owner = accounts[1];
        var bidder = accounts[2];
        var recordId = "test3.name";
        var bidAmount = web3.toWei(0.25, "ether");

        var auctionId;
        var bidderBalanceBeforeBid;
        var bidderBalanceAfterBid;
        var bidderBalanceAfterCancellation;
        var bidderBalanceAfterWithdraw;

        sn.addRecord(recordId, owner, recordId, owner, { from: owner }, function(err, txId) {
            return AuctionHouse.new(function(err, ah) {
                ah.createAuction("Title",
                    "Description",
                    sn.address,
                    recordId,
                    web3.eth.blockNumber + 100,
                    web3.toWei(0.2, "ether"),
                    web3.toWei(0.3, "ether"),
                    5,
                    accounts[2], { from: owner },
                    function(err, txId) {
                        return ah.getAuctionsCountForUser(owner, { from: account });
                    },
                    function(err, auctionsCount) {
                        return ah.getAuctionIdForUserAndIdx(owner, auctionsCount - 1, { from: account });
                    },
                    function(err, aucId) {
                        auctionId = aucId;
                        return ah.getStatus(auctionId, { from: account });
                    },
                    function(err, auctionStatus) {
                        assert.strictEqual(auctionStatus.toNumber(), 0, "Auction status should be pending");
                        return sn.setOwner(recordId, ah.address, { from: owner });
                    },
                    function(err) {
                        return ah.activateAuction(auctionId, { from: owner });
                    },
                    function(err, res) {
                        return ah.getStatus(auctionId, { from: account });
                    },
                    function(err, activeAuctionStatus) {
                        assert.strictEqual(activeAuctionStatus.toNumber(), 1, "Auction should be active");
                        bidderBalanceBeforeBid = web3.eth.getBalance(bidder).toNumber();
                        return ah.placeBid(auctionId, { from: bidder, value: bidAmount, gas: 500000 });
                    },
                    function(err) {
                        bidderBalanceAfterBid = web3.eth.getBalance(bidder).toNumber();
                        assert.isAbove(bidderBalanceBeforeBid - bidAmount, bidderBalanceAfterBid, "Balance should be (bidAmount + gas) less now");
                        return ah.cancelAuction(auctionId, { from: owner });
                    },
                    function(err, res) {
                        bidderBalanceAfterCancellation = web3.eth.getBalance(bidder).toNumber();
                        assert.strictEqual(bidderBalanceAfterBid, bidderBalanceAfterCancellation, "Balance should be the same after cancellation, before withdraw");
                        return ah.getStatus(auctionId, { from: account });
                    },
                    function(err, cancelledAuctionStatus) {
                        assert.strictEqual(cancelledAuctionStatus.toNumber(), 2, "Auction should be inactive");
                        return ah.withdrawRefund({ from: bidder });
                    },
                    function(err) {
                        bidderBalanceAfterWithdraw = web3.eth.getBalance(bidder).toNumber();
                        assert.isAbove(bidderBalanceAfterWithdraw, bidderBalanceAfterCancellation, "Balance should be more after withdraw");
                        return sn.owner(recordId, { from: account });
                    },
                    function(err, assetOwner) {
                        assert.strictEqual(assetOwner, owner, "Should return the asset to the seller");
                    });
            });
        });
    });

    it("should place a valid bid", function() {
        var sn = SampleName.deployed();
        var owner = accounts[4];
        var recordId = "test4.name";
        var bidder = accounts[5];
        var bidAmount = web3.toWei(0.4, "ether");
        var contractStartBalance;
        var auctionId;

        // Create an asset,
        // create an auction,
        // transfer the asset to the auction
        // activate the auction
        // place a bid
        // check that the bid properties and auction current bid updated

        sn.addRecord(recordId, owner, recordId, owner, { from: owner }, function(err, txId) {
            return AuctionHouse.new(function(err, ah) {
                contractStartBalance = web3.eth.getBalance(ah.address);
                ah.createAuction("Title",
                    "Description",
                    sn.address,
                    recordId,
                    web3.eth.blockNumber + 100,
                    (2 * 10 ^ 6),
                    (3 * 10 ^ 6),
                    5,
                    accounts[2], { from: owner },
                    function(err, txId) {
                        return ah.getAuctionsCountForUser(owner, { from: account });
                    },
                    function(err, auctionsCount) {
                        return ah.getAuctionIdForUserAndIdx(owner, auctionsCount - 1, { from: account });
                    },
                    function(err, aucId) {
                        auctionId = aucId;
                        return sn.setOwner(recordId, ah.address, { from: owner });
                    },
                    function(err) {
                        return ah.activateAuction(auctionId, { from: owner });
                    },
                    function(err, res) {
                        return ah.placeBid(auctionId, { from: bidder, value: bidAmount });
                    },
                    function(err) {
                        return ah.getBidCountForAuction(auctionId, { from: account });
                    },
                    function(err, bidCount) {
                        assert.strictEqual(bidCount.toNumber(), 1, "there should be one bid");
                        return ah.getBidForAuctionByIdx(auctionId, bidCount - 1, { from: account });
                    },
                    function(err, bids) {
                        assert.strictEqual(bids[0], bidder, "bidder was not correct");
                        assert.equal(bids[1].toNumber(), bidAmount, "bid amount was not correct");
                        assert.equal(web3.eth.getBalance(ah.address).toNumber(), contractStartBalance + bidAmount, "Contract balance did not equal the bid amount");
                        return ah.getAuction(auctionId, { from: account });
                    },
                    function(err, auction) {
                        assert.equal(auction[10].toNumber(), bidAmount, "current bid was not equal to the newly bid amount");
                    });
            });
        });
    });

    var expectedExceptionPromise = function(action, gasToUse) {
        return new Promise(function(resolve, reject) {
                try {
                    resolve(action());
                } catch (e) {
                    reject(e);
                }
            }, function(err, txn) {
                // https://gist.github.com/xavierlepretre/88682e871f4ad07be4534ae560692ee6
                return web3.eth.getTransactionReceiptMined(txn);
            }, function(err, receipt) {
                // We are in Geth
                assert.equal(receipt.gasUsed, gasToUse, "should have used all the gas");
            })
            .catch(function(e) {
                if ((e + "").indexOf("invalid JUMP") || (e + "").indexOf("out of gas") > -1) {
                    // We are in TestRPC
                } else if ((e + "").indexOf("please check your gas amount") > -1) {
                    // We are in Geth for a deployment
                } else {
                    throw e;
                }
            });
    };
});