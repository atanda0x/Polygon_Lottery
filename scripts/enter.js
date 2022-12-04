const { ethers } = require("hardhat")

async function enterLottery() {
    const polygonlottery = await ethers.getContract("PolygonLottery")
    const entranceFee = await polygonlottery.getEntranceFee()
    await polygonlottery.enterLottery({ value: entranceFee + 1 })
    console.log("Entered!")
}

enterRaffle()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error)
        process.exit(1)
    })