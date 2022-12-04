const { assert, expect } = require("chai")
const { network, deployments, ethers } = require("hardhat")
const { developmentChains, networkConfig } = require("../../helper-hardhat-config")

!developmentChains.includes(network.name)
    ? describe.skip
    : describe("PolygnLottery Unit Tests", function () {
          let polygonlottery, polygonlotteryContract, vrfCoordinatorV2Mock, polygonlotteryEntranceFee, interval, player // , deployer

          beforeEach(async () => {
              accounts = await ethers.getSigners() // could also do with getNamedAccounts
              //   deployer = accounts[0]
              player = accounts[1]
              await deployments.fixture(["mocks", "polygonlottery"]) // Deploys modules with the tags "mocks" and "polygonlottery"
              vrfCoordinatorV2Mock = await ethers.getContract("VRFCoordinatorV2Mock") // Returns a new connection to the VRFCoordinatorV2Mock contract
              polygonlotteryContract = await ethers.getContract("polygonlottery") // Returns a new connection to the Lottery contract
              polygonlottery = polygonlotteryContract.connect(player) // Returns a new instance of the Lottery contract connected to player
              polygonlotteryEntranceFee = await polygonlottery.getEntranceFee()
              interval = await polygonlottery.getInterval()
          })

          describe("constructor", function () {
              it("initializes the polygonlottery correctly", async () => {
                  // Ideally, we'd separate these out so that only 1 assert per "it" block
                  // And ideally, we'd make this check everything
                  const lotteryState = (await polygonlottery.getLottteryState()).toString()
                  // Comparisons for PolygonLottery initialization:
                  assert.equal(lotteryState, "0")
                  assert.equal(
                      interval.toString(),
                      networkConfig[network.config.chainId]["keepersUpdateInterval"]
                  )
              })
          })

          describe("enterLottery", function () {
              it("reverts when you don't pay enough", async () => {
                  await expect(polygonlottery.enterLottery()).to.be.revertedWith( // is reverted when not paid enough or polygonlottery is not open
                      "PolygonLottery__SendMoreToEnterLottery"
                  )
              })
              it("records player when they enter", async () => {
                  await polygonlottery.enterLottery({ value: polygonlotteryEntranceFee })
                  const contractPlayer = await polygonlottery.getPlayer(0)
                  assert.equal(player.address, contractPlayer)
              })
              it("emits event on enter", async () => {
                  await expect(polygonlottery.enterLottery({ value: polygonlotteryEntranceFee })).to.emit( // emits LotteryEnter event if entered to index player(s) address
                      polygonlottery,
                      "PolygonLotteryEnter"
                  )
              })
              it("doesn't allow entrance when polygonlottery is calculating", async () => {
                  await polygonlottery.enterLottery({ value: polygonlotteryEntranceFee })
                  // for a documentation of the methods below, go here: https://hardhat.org/hardhat-network/reference
                  await network.provider.send("evm_increaseTime", [interval.toNumber() + 1])
                  await network.provider.request({ method: "evm_mine", params: [] })
                  // we pretend to be a keeper for a second
                  await polygonlottery.performUpkeep([]) // changes the state to calculating for our comparison below
                  await expect(polygonlottery.enterLottery({ value: polygonlotteryEntranceFee })).to.be.revertedWith( // is reverted as polygonlottery is calculating
                      "PolygonLottery__LotteryNotOpen"
                  )
              })
          })
          describe("checkUpkeep", function () {
              it("returns false if people haven't sent any ETH", async () => {
                  await network.provider.send("evm_increaseTime", [interval.toNumber() + 1])
                  await network.provider.request({ method: "evm_mine", params: [] })
                  const { upkeepNeeded } = await polygonlottery.callStatic.checkUpkeep("0x") // upkeepNeeded = (timePassed && isOpen && hasBalance && hasPlayers)
                  assert(!upkeepNeeded)
              })
              it("returns false if polygonlottery isn't open", async () => {
                  await polygonlottery.enterLottery({ value: polygonlotteryEntranceFee })
                  await network.provider.send("evm_increaseTime", [interval.toNumber() + 1])
                  await network.provider.request({ method: "evm_mine", params: [] })
                  await polygonlottery.performUpkeep([]) // changes the state to calculating
                  const lotteryState = await polygonlottery.getLotteryState() // stores the new state
                  const { upkeepNeeded } = await polygonlottery.callStatic.checkUpkeep("0x") // upkeepNeeded = (timePassed && isOpen && hasBalance && hasPlayers)
                  assert.equal(lotteryState.toString() == "1", upkeepNeeded == false)
              })
              it("returns false if enough time hasn't passed", async () => {
                  await polygonlottery.enterLottery({ value: polygonlotteryEntranceFee })
                  await network.provider.send("evm_increaseTime", [interval.toNumber() - 5]) // use a higher number here if this test fails
                  await network.provider.request({ method: "evm_mine", params: [] })
                  const { upkeepNeeded } = await polygonlottery.callStatic.checkUpkeep("0x") // upkeepNeeded = (timePassed && isOpen && hasBalance && hasPlayers)
                  assert(!upkeepNeeded)
              })
              it("returns true if enough time has passed, has players, eth, and is open", async () => {
                  await polygonlottery.enterLottery({ value: polygonlotteryEntranceFee })
                  await network.provider.send("evm_increaseTime", [interval.toNumber() + 1])
                  await network.provider.request({ method: "evm_mine", params: [] })
                  const { upkeepNeeded } = await polygonlottery.callStatic.checkUpkeep("0x") // upkeepNeeded = (timePassed && isOpen && hasBalance && hasPlayers)
                  assert(upkeepNeeded)
              })
          })

          describe("performUpkeep", function () {
              it("can only run if checkupkeep is true", async () => {
                  await polygonlottery.enterLottery({ value: polygonlotteryEntranceFee })
                  await network.provider.send("evm_increaseTime", [interval.toNumber() + 1])
                  await network.provider.request({ method: "evm_mine", params: [] })
                  const tx = await polygonlottery.performUpkeep("0x") 
                  assert(tx)
              })
              it("reverts if checkup is false", async () => {
                  await expect(polygonlottery.performUpkeep("0x")).to.be.revertedWith( 
                      "PolygonLottery__UpkeepNotNeeded"
                  )
              })
              it("updates the polygonlottery state and emits a requestId", async () => {
                  // Too many asserts in this test!
                  await polygonlottery.enterLottery({ value: polygonlotteryEntranceFee })
                  await network.provider.send("evm_increaseTime", [interval.toNumber() + 1])
                  await network.provider.request({ method: "evm_mine", params: [] })
                  const txResponse = await polygonlottery.performUpkeep("0x") // emits requestId
                  const txReceipt = await txResponse.wait(1) // waits 1 block
                  const lotteryState = await polygonlottery.getLotteryState() // updates state
                  const requestId = txReceipt.events[1].args.requestId
                  assert(requestId.toNumber() > 0)
                  assert(lotteryState == 1) // 0 = open, 1 = calculating
              })
          })
          describe("fulfillRandomWords", function () {
              beforeEach(async () => {
                  await polygonlottery.enterLottery({ value: polygonlotteryEntranceFee })
                  await network.provider.send("evm_increaseTime", [interval.toNumber() + 1])
                  await network.provider.request({ method: "evm_mine", params: [] })
              })
              it("can only be called after performupkeep", async () => {
                  await expect(
                      vrfCoordinatorV2Mock.fulfillRandomWords(0, polygonlottery.address) // reverts if not fulfilled
                  ).to.be.revertedWith("nonexistent request")
                  await expect(
                      vrfCoordinatorV2Mock.fulfillRandomWords(1, polygonlottery.address) // reverts if not fulfilled
                  ).to.be.revertedWith("nonexistent request")
              })

            // This test is too big...
            // This test simulates users entering the polygonlottery and wraps the entire functionality of the polygonlottery
            // inside a promise that will resolve if everything is successful.
            // An event listener for the WinnerPicked is set up
            // Mocks of chainlink keepers and vrf coordinator are used to kickoff this winnerPicked event
            // All the assertions are done once the WinnerPicked event is fired
              it("picks a winner, resets, and sends money", async () => {
                  const additionalEntrances = 3 // to test
                  const startingIndex = 2
                  for (let i = startingIndex; i < startingIndex + additionalEntrances; i++) { // i = 2; i < 5; i=i+1
                    polygonlottery = polygonlotteryContract.connect(accounts[i]) // Returns a new instance of the Lottery contract connected to player
                      await polygonlottery.enterLottery({ value: polygonlotteryEntranceFee })
                  }
                  const startingTimeStamp = await polygonlottery.getLastTimeStamp() // stores starting timestamp (before we fire our event)

                  // This will be more important for our staging tests...
                  await new Promise(async (resolve, reject) => {
                    polygonlottery.once("WinnerPicked", async () => { // event listener for WinnerPicked
                          console.log("WinnerPicked event fired!")
                          try {
                              // Now lets get the ending values...
                              const recentWinner = await polygonlottery.getRecentWinner()
                              const lotteryState = await polygonlottery.getLotteryState()
                              const winnerBalance = await accounts[2].getBalance()
                              const endingTimeStamp = await polygonlottery.getLastTimeStamp()
                              await expect(polygonlottery.getPlayer(0)).to.be.reverted
                              // Comparisons to check if our ending values are correct:
                              assert.equal(recentWinner.toString(), accounts[2].address)
                              assert.equal(lotteryState, 0)
                              assert.equal(
                                  winnerBalance.toString(), 
                                  startingBalance 
                                      .add(
                                        polygonlotteryEntranceFee
                                              .mul(additionalEntrances)
                                              .add(polygonlotteryEntranceFee)
                                      )
                                      .toString()
                              )
                              assert(endingTimeStamp > startingTimeStamp)
                              resolve() // if try passes, resolves the promise 
                          } catch (e) { 
                              reject(e) // if try fails, rejects the promise
                          }
                      })

                      // kicking off the event by mocking the chainlink keepers and vrf coordinator
                      const tx = await polygonlottery.performUpkeep("0x")
                      const txReceipt = await tx.wait(1)
                      const startingBalance = await accounts[2].getBalance()
                      await vrfCoordinatorV2Mock.fulfillRandomWords(
                          txReceipt.events[1].args.requestId,
                          polygonlottery.address
                      )
                  })
              })
          })
      })